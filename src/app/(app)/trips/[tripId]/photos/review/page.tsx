'use client';

/**
 * Photo Review page — Tinder-style triage flow.
 *
 * The user steps through every un-reviewed photo and decides whether to
 * keep, delete or favorite it, optionally editing the caption inline.
 * Advancing requires an explicit Keep or Delete — there is no Skip, so
 * an accidental space/arrow press can't jump past a photo undecided.
 *
 * Data flow:
 *   - Pulls `albumPhotos` and review-mode mutations from the layout-level
 *     `TripDataProvider` (no new Firestore subscription opened here).
 *   - Snapshots the queue at session start / filter change; we do NOT
 *     recompute the queue when albumPhotos updates, otherwise the act
 *     of "Keep"-ing photo A would shrink the unreviewed queue and the
 *     next `index + 1` would land on photo C instead of B (visible to
 *     the user as "advances too fast").
 *   - Per-photo decisions are tracked in a Map so stats stay accurate
 *     when the user goes back and changes their mind.
 *
 * Interaction surface:
 *   - Buttons: Delete (red, left) · Back (center) · Favorite (toggle) · Keep (green, right)
 *   - Keyboard: ← delete · → keep · ↓ / f favorite · Backspace back
 *     · c focus textarea · Esc blur textarea · Cmd/Ctrl+Enter keep
 *   - Touch:  swipe right = keep, swipe left = delete (Tinder convention).
 *   - Voice:  optional dictation appends to the caption.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import {
  ArrowLeft,
  Check,
  Trash2,
  Star,
  Mic,
  MicOff,
  Filter,
  Undo2,
  Loader2,
} from 'lucide-react';

import {
  useEventsFromContext as useEvents,
  useAlbumFromContext as useAlbum,
} from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { formatDateES, classNames } from '@/lib/utils/helpers';
import type { AlbumPhoto, TripEvent } from '@/types';

/* ─────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                */
/* ─────────────────────────────────────────────────────────────────────── */

type ReviewFilter = 'unreviewed' | 'all' | 'favorites';
type ActionKind = 'keep' | 'delete' | 'favorite';
type Decision = 'kept' | 'deleted';

interface ReviewStats {
  kept: number;
  deleted: number;
  favorited: number;
}

const CAPTION_MAX = 500;
const SWIPE_THRESHOLD = 110;

/** Pick the queue for the current filter, dropping soft-deleted photos and
 *  sorting oldest-first to match the rest of the album views. */
function buildQueue(photos: AlbumPhoto[], filter: ReviewFilter): AlbumPhoto[] {
  const alive = photos.filter((p) => !p.deletedAt);
  const filtered = alive.filter((p) => {
    switch (filter) {
      case 'unreviewed':
        return !p.reviewed;
      case 'favorites':
        return p.favorite === true;
      case 'all':
      default:
        return true;
    }
  });
  return [...filtered].sort((a, b) => {
    const u = a.uploadedAt.localeCompare(b.uploadedAt);
    if (u !== 0) return u;
    return a.url.localeCompare(b.url);
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function eventDisplayName(event: TripEvent | undefined): string | undefined {
  if (!event) return undefined;
  if (event.title) return event.title;
  const d: any = event.details ?? {};
  return (
    d.restaurantName ||
    d.hotelName ||
    d.activityName ||
    d.rentalCompany ||
    d.portName ||
    d.airline ||
    d.transportMode ||
    undefined
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─────────────────────────────────────────────────────────────────────── */
/*  Page component                                                          */
/* ─────────────────────────────────────────────────────────────────────── */

export default function PhotoReviewPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { albumPhotos, markReviewed, markFavorite, softDelete, restorePhoto, updateCaption } =
    useAlbum();
  const { events } = useEvents();
  const { toast } = useToast();

  /* ─── Local state ──────────────────────────────────────────────────── */
  const [filter, setFilter] = useState<ReviewFilter>('unreviewed');
  const [index, setIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [originalCaption, setOriginalCaption] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [captionSavedFlash, setCaptionSavedFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Snapshot of the queue captured at session start / filter change.
  // We deliberately do NOT recompute when albumPhotos updates — that would
  // shrink the queue after every Keep/Delete (since markReviewed flips
  // `reviewed:true`), causing the next `index + 1` to jump TWO photos
  // forward instead of one. Symptom the user reports as "advances too fast".
  const [queue, setQueue] = useState<AlbumPhoto[]>([]);
  const queueInitialized = useRef(false);

  // Per-photo decisions. The map persists across "Atrás" navigation so
  // stats stay accurate when the user goes back and changes their mind
  // (the old action is overwritten, not double-counted).
  const [decisions, setDecisions] = useState<Map<string, Decision>>(() => new Map());
  const [favoritedUrls, setFavoritedUrls] = useState<Set<string>>(() => new Set());

  // Last action retained for symmetry with the toast undo. We don't surface
  // a global "undo last" — the delete toast already covers the destructive
  // case, and undoing a "keep" is just opening the photo from the album.
  const [, setLastAction] = useState<{ kind: ActionKind; photo: AlbumPhoto } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /* ─── Queue snapshot lifecycle ─────────────────────────────────────── */
  // Re-snapshot on filter change. setIndex(0) resets the cursor.
  useEffect(() => {
    if (!queueInitialized.current && albumPhotos.length === 0) return;
    setQueue(buildQueue(albumPhotos, filter));
    setIndex(0);
    setDecisions(new Map());
    setFavoritedUrls(new Set());
    queueInitialized.current = true;
    // albumPhotos intentionally omitted — see the comment on `queue` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Initial snapshot once Firestore has delivered albumPhotos. Runs at most
  // once per page mount; after that the queue is stable until filter change.
  useEffect(() => {
    if (queueInitialized.current) return;
    if (albumPhotos.length === 0) return;
    setQueue(buildQueue(albumPhotos, filter));
    queueInitialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumPhotos]);

  /* ─── Derived data ─────────────────────────────────────────────────── */
  const currentPhoto: AlbumPhoto | undefined = queue[index];
  const showSummary = queue.length > 0 && index >= queue.length;

  const stats = useMemo<ReviewStats>(() => {
    let kept = 0;
    let deleted = 0;
    for (const action of decisions.values()) {
      if (action === 'kept') kept++;
      else if (action === 'deleted') deleted++;
    }
    return { kept, deleted, favorited: favoritedUrls.size };
  }, [decisions, favoritedUrls]);

  const eventsById = useMemo(() => {
    const m = new Map<string, TripEvent>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const currentEvent =
    currentPhoto?.eventId ? eventsById.get(currentPhoto.eventId) : undefined;

  /* ─── Caption sync ──────────────────────────────────────────────────
     When the photo changes we reset the textarea to whatever caption is
     persisted on the new photo. Done via useEffect on the photo URL
     (single primitive dep) — the "adjust state during render" pattern is
     too easy to misuse with our context-fed deps and was triggering a
     render loop in production. */
  const photoUrl = currentPhoto?.url ?? null;
  useEffect(() => {
    const c = currentPhoto?.caption ?? '';
    setCaption(c);
    setOriginalCaption(c);
    // We deliberately depend on `photoUrl` only — the caption value
    // comes off the same photo, so we don't need it in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl]);

  /* ─── Speech recognition ──────────────────────────────────────────── */
  const speech = useSpeechRecognition({ lang: 'es-MX', continuous: true, interimResults: true });
  const speechBaseRef = useRef<string>('');
  // Stable ref to .reset() so we don't have to depend on the whole
  // `speech` object (which is a new reference on every render and would
  // make this effect fire every render → speech.reset → setState in the
  // hook → re-render → infinite loop. That was the React #301 in prod.)
  const speechResetRef = useRef(speech.reset);
  speechResetRef.current = speech.reset;

  // When dictation finalizes, the latest transcript is committed to the
  // caption. We capture the caption value at start time in `speechBaseRef`
  // so the appended text doesn't double up while interim results stream.
  useEffect(() => {
    if (!speech.listening && speech.transcript) {
      const base = speechBaseRef.current;
      const appended = base
        ? `${base.trimEnd()} ${speech.transcript.trim()}`
        : speech.transcript.trim();
      setCaption(appended.slice(0, CAPTION_MAX));
      speechResetRef.current();
    }
  }, [speech.listening, speech.transcript]);

  const toggleDictation = useCallback(() => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    speechBaseRef.current = caption;
    speech.start();
  }, [speech, caption]);

  /* ─── Caption persistence helper ────────────────────────────────────
     Returns the caption that ended up on the photo so we can update the
     `originalCaption` ref without depending on async state. */
  const persistCaptionIfDirty = useCallback(
    async (photo: AlbumPhoto, nextCaption: string, opts?: { silent?: boolean }) => {
      const trimmed = nextCaption.slice(0, CAPTION_MAX);
      if (trimmed === (photo.caption ?? '')) return trimmed;
      try {
        await updateCaption(photo, trimmed);
        if (!opts?.silent) {
          setCaptionSavedFlash(true);
          setTimeout(() => setCaptionSavedFlash(false), 500);
        }
      } catch (err) {
        console.warn('[review] caption save failed', err);
        toast('No se pudo guardar el comentario', 'error');
      }
      return trimmed;
    },
    [updateCaption, toast],
  );

  /* ─── Advance helper ──────────────────────────────────────────────── */
  const advance = useCallback(() => {
    setDirection(1);
    setIndex((i) => i + 1);
  }, []);

  /* ─── Actions ─────────────────────────────────────────────────────── */
  const handleKeep = useCallback(async () => {
    if (!currentPhoto || busy) return;
    const photoSnapshot = currentPhoto;
    setBusy(true);
    try {
      await persistCaptionIfDirty(photoSnapshot, caption, { silent: true });
      await markReviewed(photoSnapshot, true);
      // If the photo had previously been soft-deleted (user changed mind
      // via Atrás), restore it.
      if (decisions.get(photoSnapshot.url) === 'deleted') {
        await restorePhoto(photoSnapshot);
      }
      setDecisions((m) => {
        const next = new Map(m);
        next.set(photoSnapshot.url, 'kept');
        return next;
      });
      setLastAction({ kind: 'keep', photo: photoSnapshot });
      advance();
    } catch (err) {
      console.warn('[review] keep failed', err);
      toast('No se pudo marcar como revisada', 'error');
    } finally {
      setBusy(false);
    }
  }, [
    currentPhoto,
    busy,
    caption,
    decisions,
    persistCaptionIfDirty,
    markReviewed,
    restorePhoto,
    advance,
    toast,
  ]);

  const handleDelete = useCallback(async () => {
    if (!currentPhoto || busy) return;
    const photoSnapshot = currentPhoto;
    setBusy(true);
    try {
      await persistCaptionIfDirty(photoSnapshot, caption, { silent: true });
      await softDelete(photoSnapshot);
      await markReviewed(photoSnapshot, true);
      setDecisions((m) => {
        const next = new Map(m);
        next.set(photoSnapshot.url, 'deleted');
        return next;
      });
      setLastAction({ kind: 'delete', photo: photoSnapshot });

      toast('Foto eliminada', 'info', {
        label: 'Deshacer',
        onClick: async () => {
          try {
            await restorePhoto(photoSnapshot);
            setDecisions((m) => {
              const next = new Map(m);
              next.delete(photoSnapshot.url);
              return next;
            });
          } catch (err) {
            console.warn('[review] restore failed', err);
            toast('No se pudo restaurar la foto', 'error');
          }
        },
      });

      advance();
    } catch (err) {
      console.warn('[review] delete failed', err);
      toast('No se pudo eliminar la foto', 'error');
    } finally {
      setBusy(false);
    }
  }, [
    currentPhoto,
    busy,
    caption,
    persistCaptionIfDirty,
    softDelete,
    markReviewed,
    restorePhoto,
    toast,
    advance,
  ]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!currentPhoto || busy) return;
    const photoSnapshot = currentPhoto;
    const wasFavorite = photoSnapshot.favorite === true;
    const next = !wasFavorite;
    setBusy(true);
    try {
      await persistCaptionIfDirty(photoSnapshot, caption, { silent: true });
      await markFavorite(photoSnapshot, next);
      setFavoritedUrls((s) => {
        const ns = new Set(s);
        if (next) ns.add(photoSnapshot.url);
        else ns.delete(photoSnapshot.url);
        return ns;
      });
      setLastAction({ kind: 'favorite', photo: photoSnapshot });
    } catch (err) {
      console.warn('[review] favorite failed', err);
      toast('No se pudo actualizar la favorita', 'error');
    } finally {
      setBusy(false);
    }
  }, [currentPhoto, busy, caption, persistCaptionIfDirty, markFavorite, toast]);

  /** Step back to the previous photo. Persists the in-flight caption first
   *  so we don't lose typed-but-unsaved text. Does NOT undo the previous
   *  decision in Firestore — if the user wants to change it, they pick
   *  Keep or Delete again and that overwrites. */
  const handleBack = useCallback(async () => {
    if (index === 0 || busy) return;
    setBusy(true);
    try {
      if (currentPhoto) {
        await persistCaptionIfDirty(currentPhoto, caption, { silent: true });
      }
      setDirection(-1);
      setIndex((i) => Math.max(0, i - 1));
    } finally {
      setBusy(false);
    }
  }, [index, busy, currentPhoto, caption, persistCaptionIfDirty]);

  /* ─── Filter changes reset position ─────────────────────────────────
     Done in the handler (vs. an effect) to keep the render → state cycle
     atomic and avoid an extra render with a stale index. */
  const changeFilter = useCallback((next: ReviewFilter) => {
    setFilter(next);
    setIndex(0);
  }, []);

  /* ─── Caption blur → persist ──────────────────────────────────────── */
  const handleCaptionBlur = useCallback(() => {
    if (!currentPhoto) return;
    if (caption === originalCaption) return;
    void persistCaptionIfDirty(currentPhoto, caption).then((saved) => {
      setOriginalCaption(saved);
    });
  }, [currentPhoto, caption, originalCaption, persistCaptionIfDirty]);

  const handleCaptionKey = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter → conservar (no descansamos un Enter plano para
      // permitir captions multilínea).
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleKeep();
      } else if (e.key === 'Escape') {
        textareaRef.current?.blur();
      }
    },
    [handleKeep],
  );

  /* ─── Keyboard shortcuts ──────────────────────────────────────────── */
  useEffect(() => {
    function isTextareaActive() {
      return (
        typeof document !== 'undefined' &&
        document.activeElement === textareaRef.current
      );
    }

    function onKey(e: KeyboardEvent) {
      // The "c" shortcut focuses the textarea regardless of where focus
      // currently is, but only when not already typing somewhere.
      if (isTextareaActive()) return;
      if (showSummary) return;
      if (!currentPhoto) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'd':
        case 'D':
          e.preventDefault();
          void handleDelete();
          break;
        case 'ArrowRight':
        case 'k':
        case 'K':
          e.preventDefault();
          void handleKeep();
          break;
        case 'Backspace':
          e.preventDefault();
          void handleBack();
          break;
        case 'ArrowDown':
        case 'f':
        case 'F':
          e.preventDefault();
          void handleFavoriteToggle();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          textareaRef.current?.focus();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPhoto, showSummary, handleKeep, handleDelete, handleBack, handleFavoriteToggle]);

  /* ─── Preload next photo ──────────────────────────────────────────── */
  useEffect(() => {
    const next = queue[index + 1];
    if (!next) return;
    if (typeof window === 'undefined') return;
    const src = next.fullUrl || next.url;
    if (!src) return;
    const img = new window.Image();
    img.src = src;
    // No cleanup needed — the browser caches the bytes.
  }, [queue, index]);

  /* ─── Swipe handling ──────────────────────────────────────────────── */
  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (busy) return;
      if (info.offset.x > SWIPE_THRESHOLD) {
        setDirection(1);
        void handleKeep();
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        setDirection(-1);
        void handleDelete();
      }
    },
    [busy, handleKeep, handleDelete],
  );

  /* ─── Navigation ──────────────────────────────────────────────────── */
  const goBack = useCallback(() => {
    router.push(`/trips/${tripId}/photos`);
  }, [router, tripId]);

  const restartUnreviewed = useCallback(() => {
    setDecisions(new Map());
    setFavoritedUrls(new Set());
    setIndex(0);
    setFilter('unreviewed');
  }, []);

  /* ─── Render: empty / summary / main ──────────────────────────────── */

  // Empty state (no photos to review at all under the current filter, and
  // we haven't gone through a session yet)
  const emptyOnLoad = queue.length === 0 && stats.kept + stats.deleted === 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col text-white"
      style={{ background: '#0a0a0a' }}
    >
      {/* ─── Top bar ─── */}
      <header className="relative flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 text-white/55 text-xs sm:text-sm font-medium tabular-nums">
          {queue.length > 0 ? (
            <>
              {Math.min(index + 1, queue.length)}{' '}
              <span className="text-white/30">de</span> {queue.length}
            </>
          ) : (
            <span className="text-white/30">Sin fotos</span>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Filtros"
            className={classNames(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filtersOpen
                ? 'bg-white/[0.1] text-white'
                : 'text-white/70 hover:text-white hover:bg-white/[0.06]',
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">
              {filter === 'unreviewed'
                ? 'Sin revisar'
                : filter === 'favorites'
                  ? 'Favoritas'
                  : 'Todas'}
            </span>
          </button>

          {filtersOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                aria-hidden
                onClick={() => setFiltersOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 z-40 w-60 rounded-xl border border-white/[0.1] bg-[#111] shadow-2xl shadow-black/60 overflow-hidden"
              >
                {(
                  [
                    ['unreviewed', 'Sin revisar', 'Sólo las pendientes'],
                    ['all', 'Todas', 'Vuelve a pasarlas todas'],
                    ['favorites', 'Favoritas', 'Sólo las marcadas con estrella'],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      changeFilter(value);
                      setFiltersOpen(false);
                    }}
                    className={classNames(
                      'w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-white/[0.06] transition-colors',
                      filter === value && 'bg-white/[0.04]',
                    )}
                    role="menuitem"
                  >
                    <span
                      className={classNames(
                        'text-[13px] font-semibold',
                        filter === value ? 'text-emerald-200' : 'text-white',
                      )}
                    >
                      {label}
                    </span>
                    <span className="text-[11px] text-white/45">{hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* ─── Body ─── */}
      {emptyOnLoad ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-300/30 flex items-center justify-center">
            <Check className="w-7 h-7 text-emerald-300" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">Todas revisadas</h1>
            <p className="text-white/55 text-sm mt-1">
              No quedan fotos pendientes con este filtro.
            </p>
          </div>
          <button
            type="button"
            onClick={goBack}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-white text-sm font-semibold transition-colors"
          >
            Volver al álbum
          </button>
        </div>
      ) : showSummary ? (
        <SummaryView
          stats={stats}
          filter={filter}
          onBackToAlbum={goBack}
          onRestart={restartUnreviewed}
        />
      ) : currentPhoto ? (
        <main className="flex-1 flex flex-col min-h-0 px-3 sm:px-6 pb-4">
          {/* Card area */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-3 sm:py-4">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentPhoto.url}
                custom={direction}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -80, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="relative w-full max-w-3xl h-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
              >
                {/* Favorite star — sits on top of the image card */}
                <button
                  type="button"
                  onClick={handleFavoriteToggle}
                  aria-label={currentPhoto.favorite ? 'Quitar favorita' : 'Marcar favorita'}
                  className={classNames(
                    'absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all backdrop-blur-md border',
                    currentPhoto.favorite
                      ? 'bg-amber-400/20 border-amber-300/50 text-amber-300'
                      : 'bg-black/40 border-white/15 text-white/70 hover:text-white hover:bg-black/60',
                  )}
                >
                  <Star
                    className="w-5 h-5"
                    fill={currentPhoto.favorite ? 'currentColor' : 'none'}
                    strokeWidth={2}
                  />
                </button>

                {/* Image with zoom/pan */}
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black/40 border border-white/[0.05]">
                  <TransformWrapper
                    initialScale={1}
                    minScale={1}
                    maxScale={5}
                    doubleClick={{ mode: 'reset' }}
                    panning={{ disabled: false, velocityDisabled: true }}
                    wheel={{ step: 0.2 }}
                    centerOnInit
                  >
                    <TransformComponent
                      wrapperStyle={{ width: '100%', height: '100%' }}
                      contentStyle={{ width: '100%', height: '100%' }}
                    >
                      <div className="relative w-full h-full">
                        <Image
                          src={currentPhoto.fullUrl || currentPhoto.url}
                          alt={currentPhoto.caption || 'Foto del viaje'}
                          fill
                          sizes="(max-width: 768px) 100vw, 800px"
                          priority
                          unoptimized
                          draggable={false}
                          className="object-contain pointer-events-none"
                        />
                      </div>
                    </TransformComponent>
                  </TransformWrapper>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Metadata strip */}
          <div className="flex items-center justify-center gap-2 text-white/40 text-[11px] sm:text-xs mb-2">
            <span>{formatDateES(currentPhoto.date)}</span>
            {currentEvent && (
              <>
                <span className="text-white/20">·</span>
                <span className="truncate max-w-[60vw]">
                  {eventDisplayName(currentEvent) ?? 'Evento'}
                </span>
              </>
            )}
          </div>

          {/* Caption */}
          <div className="w-full max-w-2xl mx-auto">
            <div
              className={classNames(
                'relative rounded-xl border transition-colors duration-300',
                captionSavedFlash
                  ? 'border-emerald-400/60 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]'
                  : 'border-white/[0.08] focus-within:border-white/20',
                'bg-white/[0.04]',
              )}
            >
              <textarea
                ref={textareaRef}
                value={caption}
                maxLength={CAPTION_MAX}
                onChange={(e) => setCaption(e.target.value)}
                onBlur={handleCaptionBlur}
                onKeyDown={handleCaptionKey}
                rows={2}
                placeholder="Agrega un comentario (opcional). Cmd+Enter para conservar."
                className="w-full bg-transparent text-white placeholder:text-white/30 text-sm sm:text-[15px] leading-relaxed px-3.5 py-2.5 pr-12 outline-none resize-none max-h-[7.5rem]"
                style={{ minHeight: '3rem' }}
              />

              {speech.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  aria-label={speech.listening ? 'Detener dictado' : 'Dictar comentario'}
                  className={classNames(
                    'absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all border',
                    speech.listening
                      ? 'bg-rose-500/25 border-rose-300/50 text-rose-200 animate-pulse'
                      : 'bg-white/[0.06] border-white/[0.08] text-white/55 hover:text-white hover:bg-white/[0.12]',
                  )}
                >
                  {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mt-1 px-1">
              <span className="text-white/30 text-[10px] hidden sm:inline">
                <kbd className="bg-white/[0.08] px-1.5 py-0.5 rounded text-white/70 font-mono text-[10px]">c</kbd>{' '}
                para escribir ·{' '}
                <kbd className="bg-white/[0.08] px-1.5 py-0.5 rounded text-white/70 font-mono text-[10px]">Esc</kbd>{' '}
                salir
              </span>
              <span
                className={classNames(
                  'text-[10px] tabular-nums ml-auto',
                  caption.length > CAPTION_MAX - 40 ? 'text-amber-300/80' : 'text-white/25',
                )}
              >
                {caption.length}/{CAPTION_MAX}
              </span>
            </div>
          </div>

          {/* Action bar */}
          <div className="mt-4 flex items-center justify-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              aria-label="Eliminar"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 rounded-2xl bg-gradient-to-b from-rose-500/25 to-rose-600/25 hover:from-rose-500/40 hover:to-rose-600/40 border border-rose-400/40 text-rose-100 hover:text-white font-semibold shadow-[0_8px_24px_rgba(244,63,94,0.18)] transition-all disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" strokeWidth={2.2} />
              )}
              <span>Eliminar</span>
            </button>

            <button
              type="button"
              onClick={handleBack}
              disabled={busy || index === 0}
              aria-label="Atrás"
              title="Atrás (Backspace)"
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-white/65 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleKeep}
              disabled={busy}
              aria-label="Conservar"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 rounded-2xl bg-gradient-to-b from-emerald-400/25 to-emerald-500/25 hover:from-emerald-400/45 hover:to-emerald-500/45 border border-emerald-300/45 text-emerald-100 hover:text-white font-semibold shadow-[0_8px_24px_rgba(16,185,129,0.22)] transition-all disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5" strokeWidth={2.6} />
              )}
              <span>Conservar</span>
            </button>
          </div>

          {/* Shortcut hints — desktop only */}
          <div className="hidden sm:flex items-center justify-center gap-3 mt-3 text-[11px] text-white/35">
            <span>
              <kbd className="bg-white/[0.06] px-1.5 py-0.5 rounded text-white/65 font-mono">←</kbd>{' '}
              eliminar
            </span>
            <span>
              <kbd className="bg-white/[0.06] px-1.5 py-0.5 rounded text-white/65 font-mono">→</kbd>{' '}
              conservar
            </span>
            <span>
              <kbd className="bg-white/[0.06] px-1.5 py-0.5 rounded text-white/65 font-mono">⌫</kbd>{' '}
              atrás
            </span>
            <span>
              <kbd className="bg-white/[0.06] px-1.5 py-0.5 rounded text-white/65 font-mono">f</kbd>{' '}
              favorita
            </span>
          </div>
        </main>
      ) : null}

      {/* Invisible preload of next image for instant transitions */}
      {queue[index + 1] && (
        <link
          rel="preload"
          as="image"
          href={queue[index + 1].fullUrl || queue[index + 1].url}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Summary subview (kept inline per spec)                                  */
/* ─────────────────────────────────────────────────────────────────────── */

interface SummaryViewProps {
  stats: ReviewStats;
  filter: ReviewFilter;
  onBackToAlbum: () => void;
  onRestart: () => void;
}

function SummaryView({ stats, filter, onBackToAlbum, onRestart }: SummaryViewProps) {
  const items: { label: string; value: number; accent: string }[] = [
    { label: 'Conservadas', value: stats.kept, accent: 'text-emerald-300' },
    { label: 'Eliminadas', value: stats.deleted, accent: 'text-rose-300' },
    { label: 'Favoritas', value: stats.favorited, accent: 'text-amber-300' },
  ];

  // Offer a "review again" only if there might still be unreviewed items
  // (i.e. when we just finished a filtered subset like 'favorites' or 'all').
  const showRestart = filter !== 'unreviewed';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <p className="text-white/45 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
          Sesión completa
        </p>
        <h1 className="text-white text-3xl sm:text-4xl font-bold mb-8">Revisión terminada</h1>

        <div className="grid grid-cols-3 gap-3 mb-10">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 flex flex-col items-center gap-1"
            >
              <span className={classNames('text-3xl font-bold tabular-nums', item.accent)}>
                {item.value}
              </span>
              <span className="text-white/55 text-[11px] font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onBackToAlbum}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-black text-base font-semibold hover:bg-white/90 transition-colors"
          >
            Volver al álbum
          </button>
          {showRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white/85 text-sm font-semibold transition-colors"
            >
              Pasar las que falten por revisar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
