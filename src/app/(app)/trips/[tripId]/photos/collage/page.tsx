'use client';

import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Shuffle, Download, Pin, Loader2, Eraser, Wand2, Hand, X, GripVertical } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useAlbum } from '@/hooks/useAlbum';
import { useToast } from '@/context/ToastContext';
import type { AlbumPhoto } from '@/types';

// Lazy-load every template so only the active one's code lands in the
// initial bundle. Each template is ~5-10KB, with 8 of them that adds up.
const MosaicAutoTemplate = dynamic(() => import('@/components/trips/photos/collage/MosaicAutoTemplate'), { ssr: false, loading: () => null });
const PinterestWallTemplate = dynamic(() => import('@/components/trips/photos/collage/PinterestWallTemplate'), { ssr: false, loading: () => null });
const PolaroidWallTemplate = dynamic(() => import('@/components/trips/photos/collage/PolaroidWallTemplate'), { ssr: false, loading: () => null });
const ScrapbookTemplate = dynamic(() => import('@/components/trips/photos/collage/ScrapbookTemplate'), { ssr: false, loading: () => null });
const CinemaGridTemplate = dynamic(() => import('@/components/trips/photos/collage/CinemaGridTemplate'), { ssr: false, loading: () => null });
const BigHeroTemplate = dynamic(() => import('@/components/trips/photos/collage/BigHeroTemplate'), { ssr: false, loading: () => null });
const FilmstripGridTemplate = dynamic(() => import('@/components/trips/photos/collage/FilmstripGridTemplate'), { ssr: false, loading: () => null });
const TiltedStackTemplate = dynamic(() => import('@/components/trips/photos/collage/TiltedStackTemplate'), { ssr: false, loading: () => null });
const BentoTemplate = dynamic(() => import('@/components/trips/photos/collage/BentoTemplate'), { ssr: false, loading: () => null });
const Y2KPopTemplate = dynamic(() => import('@/components/trips/photos/collage/Y2KPopTemplate'), { ssr: false, loading: () => null });
const MoodBoardTemplate = dynamic(() => import('@/components/trips/photos/collage/MoodBoardTemplate'), { ssr: false, loading: () => null });
const MinimalKinfolkTemplate = dynamic(() => import('@/components/trips/photos/collage/MinimalKinfolkTemplate'), { ssr: false, loading: () => null });
const DiamondTemplate = dynamic(() => import('@/components/trips/photos/collage/DiamondTemplate'), { ssr: false, loading: () => null });
const PhotoboothTemplate = dynamic(() => import('@/components/trips/photos/collage/PhotoboothTemplate'), { ssr: false, loading: () => null });

type TemplateId =
  | 'mosaic'
  | 'pinterest'
  | 'polaroid'
  | 'scrapbook'
  | 'cinema'
  | 'bighero'
  | 'filmstrip'
  | 'tilted'
  | 'bento'
  | 'y2k'
  | 'moodboard'
  | 'minimal'
  | 'diamond'
  | 'photobooth';

const TEMPLATES: { id: TemplateId; label: string; maxPhotos: number; subtitle: string }[] = [
  { id: 'bento',      label: 'Bento',      maxPhotos: 24, subtitle: 'Apple asimétrico' },
  { id: 'mosaic',     label: 'Mosaic',     maxPhotos: 48, subtitle: 'Auto-split mosaico' },
  { id: 'moodboard',  label: 'Mood Board', maxPhotos: 18, subtitle: 'Pinterest editorial' },
  { id: 'y2k',        label: 'Y2K Pop',    maxPhotos: 24, subtitle: 'Maximalista neón' },
  { id: 'minimal',    label: 'Minimal',    maxPhotos: 8,  subtitle: 'Kinfolk sereno' },
  { id: 'cinema',     label: 'Cinema',     maxPhotos: 48, subtitle: 'Grilla simétrica' },
  { id: 'pinterest',  label: 'Pinterest',  maxPhotos: 48, subtitle: 'Columnas masonry' },
  { id: 'bighero',    label: 'Big Hero',   maxPhotos: 48, subtitle: '1 grande + resto' },
  { id: 'diamond',    label: 'Diamond',    maxPhotos: 24, subtitle: 'Patrón rombos' },
  { id: 'tilted',     label: 'Tilted',     maxPhotos: 48, subtitle: 'Cards inclinadas' },
  { id: 'photobooth', label: 'Photobooth', maxPhotos: 24, subtitle: 'Tiras retro' },
  { id: 'filmstrip',  label: 'Filmstrip',  maxPhotos: 48, subtitle: 'Cintas de película' },
  { id: 'polaroid',   label: 'Polaroid',   maxPhotos: 24, subtitle: 'Pared cork-board' },
  { id: 'scrapbook',  label: 'Scrapbook',  maxPhotos: 10, subtitle: 'Página de diario' },
];

const COUNT_OPTIONS = [6, 12, 24, 36, 48] as const;

/** Draggable thumbnail used in the manual-mode "Orden" strip. Wraps the
 *  photo in a dnd-kit sortable wrapper; the entire tile is the drag handle
 *  to keep touch interaction smooth. */
function SortableThumb({
  id,
  index,
  url,
  onRemove,
}: {
  id: string;
  index: number;
  url: string;
  onRemove: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
    touchAction: 'none',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-amber-300/60 ring-1 ring-amber-300/30 shadow-md cursor-grab active:cursor-grabbing"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
      <div className="absolute top-0.5 left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-300 flex items-center justify-center shadow">
        <span className="text-[10px] font-black text-amber-950">{index + 1}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove(url);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Quitar"
        className="absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-rose-500/95 hover:bg-rose-400 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
      </button>
      <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-black/55 backdrop-blur-sm flex items-center justify-center pointer-events-none">
        <GripVertical className="w-2.5 h-2.5 text-white/85" />
      </div>
    </div>
  );
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function slugify(s: string): string {
  return (s || 'viaje')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}

function formatDateRange(start?: string, end?: string): string | undefined {
  if (!start) return undefined;
  try {
    const s = new Date(start);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    if (!end) return s.toLocaleDateString('es', opts);
    const e = new Date(end);
    return `${s.toLocaleDateString('es', { day: 'numeric', month: 'long' })} — ${e.toLocaleDateString('es', opts)}`;
  } catch {
    return undefined;
  }
}

export default function CollagePage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip } = useTrip(tripId);
  const { events } = useEvents(tripId);
  const { albumPhotos } = useAlbum(tripId, trip);
  const { toast } = useToast();

  const [template, setTemplate] = useState<TemplateId>('bento');
  const [photoCount, setPhotoCount] = useState<number>(12);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [pinnedUrls, setPinnedUrls] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  /** In manual mode, the user explicitly picks the photos in order. The
   *  sample comes straight from this array. Reshuffle in manual mode only
   *  changes the layout (template's internal seed), not the photo choices. */
  const [manualSelection, setManualSelection] = useState<string[]>([]);
  /** User-editable title + destination. Initialised to the trip values
   *  on first load (see effect below) so it shows something useful, then
   *  the user can edit freely. Empty string = hide that line. */
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [customDestination, setCustomDestination] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const previewWrapperRef = useRef<HTMLDivElement | null>(null);

  // Active template's max photos. If user picks a count higher than the
  // template supports, clamp shown count but keep selection intact so
  // switching back to a larger-capacity template doesn't lose state.
  const activeMax = useMemo(() => TEMPLATES.find((t) => t.id === template)?.maxPhotos ?? 48, [template]);
  const effectiveCount = Math.min(photoCount, activeMax);

  // Pool: photos with captions first, then the rest, then de-dup.
  const allPool = useMemo(() => {
    const seen = new Set<string>();
    const result: AlbumPhoto[] = [];
    const captioned = albumPhotos.filter((p) => p.caption?.trim());
    const rest = albumPhotos.filter((p) => !p.caption?.trim());
    for (const p of [...captioned, ...rest]) {
      if (!p.url || seen.has(p.url)) continue;
      seen.add(p.url);
      result.push(p);
    }
    // Also include event-only photos
    for (const ev of events) {
      if (Array.isArray(ev.photos)) {
        for (const url of ev.photos) {
          if (!url || seen.has(url)) continue;
          seen.add(url);
          result.push({ url, date: ev.date, uploadedAt: ev.createdAt });
        }
      }
    }
    return result;
  }, [albumPhotos, events]);

  // Sample for the active template.
  //  • Auto mode: pinned URLs first (preserve insertion order), then
  //    random unpinned to fill up to effectiveCount.
  //  • Manual mode: exactly the user's manualSelection (clamped to count).
  const sample = useMemo(() => {
    if (allPool.length === 0) return [] as AlbumPhoto[];
    const byUrl = new Map(allPool.map((p) => [p.url, p] as const));
    if (mode === 'manual') {
      const out: AlbumPhoto[] = [];
      for (const url of manualSelection.slice(0, effectiveCount)) {
        const p = byUrl.get(url);
        if (p) out.push(p);
      }
      return out;
    }
    const pinnedPhotos: AlbumPhoto[] = [];
    for (const url of pinnedUrls) {
      const p = byUrl.get(url);
      if (p) pinnedPhotos.push(p);
    }
    const unpinnedPool = allPool.filter((p) => !pinnedUrls.has(p.url));
    const shuffled = shuffleWithSeed(unpinnedPool, shuffleSeed);
    const need = Math.max(0, effectiveCount - pinnedPhotos.length);
    return [...pinnedPhotos.slice(0, effectiveCount), ...shuffled.slice(0, need)];
  }, [allPool, mode, manualSelection, pinnedUrls, shuffleSeed, effectiveCount]);

  const dateRange = useMemo(
    () => formatDateRange(trip?.startDate, trip?.endDate),
    [trip],
  );

  // Seed the editable fields with the trip's values once the trip loads.
  useEffect(() => {
    if (trip && customTitle === null) setCustomTitle(trip.title || 'Mi viaje');
    if (trip && customDestination === null) setCustomDestination(trip.destination || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  const effectiveTitle = (customTitle ?? trip?.title) || 'Mi viaje';
  const effectiveDestination = customDestination ?? trip?.destination ?? '';

  // Resize observer to scale the 1080×1080 preview into the available width.
  useEffect(() => {
    const node = previewWrapperRef.current;
    if (!node) return;
    const update = () => {
      const w = node.clientWidth;
      if (w > 0) setPreviewScale(w / 1080);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const togglePin = useCallback((url: string) => {
    setPinnedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const toggleManualSelection = useCallback(
    (url: string) => {
      setManualSelection((prev) => {
        if (prev.includes(url)) return prev.filter((u) => u !== url);
        if (prev.length >= effectiveCount) return prev; // cap at count
        return [...prev, url];
      });
    },
    [effectiveCount],
  );

  const removeFromManual = useCallback((url: string) => {
    setManualSelection((prev) => prev.filter((u) => u !== url));
  }, []);

  const clearPins = useCallback(() => setPinnedUrls(new Set()), []);
  const clearManual = useCallback(() => setManualSelection([]), []);
  const reshuffle = useCallback(() => setShuffleSeed((s) => s + 1), []);

  // dnd-kit sensors for the manual-mode reorder strip. PointerSensor has
  // a small activation distance so taps on the X button don't start a drag.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSelectionDragEnd = useCallback((e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setManualSelection((prev) => {
      const oldIdx = prev.indexOf(String(e.active.id));
      const newIdx = prev.indexOf(String(e.over!.id));
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  /** Click handler delegated to elements inside the stage with data-photo-url.
   *  Auto mode: toggle pin. Manual mode: remove from selection. */
  const handleStageClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const wrapper = target.closest('[data-photo-url]') as HTMLElement | null;
      if (!wrapper) return;
      const url = wrapper.getAttribute('data-photo-url');
      if (!url) return;
      e.preventDefault();
      e.stopPropagation();
      if (mode === 'manual') {
        removeFromManual(url);
      } else {
        togglePin(url);
      }
    },
    [mode, removeFromManual, togglePin],
  );

  /** After every render, measure photo positions in the stage so we can
   *  overlay click-targets + pin badges on top of the scaled preview. */
  type SlotMeasure = { left: number; top: number; width: number; height: number; url: string };
  const [slotMeasures, setSlotMeasures] = useState<SlotMeasure[]>([]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const wrapper = previewWrapperRef.current;
    if (!stage || !wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    // After a render the templates lay out their photos. Wait one frame to
    // make sure transforms have settled.
    const id = requestAnimationFrame(() => {
      const nodes = Array.from(stage.querySelectorAll<HTMLElement>('[data-photo-url]'));
      const measures: SlotMeasure[] = nodes.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left - wrapperRect.left,
          top: r.top - wrapperRect.top,
          width: r.width,
          height: r.height,
          url: el.getAttribute('data-photo-url') || '',
        };
      });
      setSlotMeasures(measures);
    });
    return () => cancelAnimationFrame(id);
    // sample, template, scale and pinning all affect rendered positions.
  }, [sample, template, previewScale, mode, pinnedUrls, manualSelection]);

  const handleDownload = async () => {
    if (!stageRef.current) return;
    setDownloading(true);
    try {
      // Wait for Google Fonts to land so the export uses Playfair/Caveat
      // instead of a system fallback.
      try {
        if (typeof document !== 'undefined' && 'fonts' in document) {
          await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
        }
      } catch {/* ignore */}
      const dataUrl = await toPng(stageRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#0a1628',
      });
      const link = document.createElement('a');
      const slug = slugify(effectiveTitle);
      link.download = `gustrips-${slug}-${template}.png`;
      link.href = dataUrl;
      link.click();
      toast('Collage descargado', 'success');
    } catch (err) {
      console.error('Collage export failed:', err);
      toast('No pudimos exportar el collage. Reintentá.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const commonProps = {
    photos: sample,
    tripTitle: effectiveTitle,
    destination: effectiveDestination || undefined,
    dateRange,
    seed: shuffleSeed + 1,
    count: effectiveCount,
    ref: stageRef,
  };

  const renderTemplate = () => {
    if (sample.length === 0) {
      const isManual = mode === 'manual';
      return (
        <div
          style={{
            width: 1080,
            height: 1080,
            background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-playfair), Georgia, serif',
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          <div style={{ fontSize: 90, opacity: 0.4 }}>{isManual ? '👋' : '📷'}</div>
          <p style={{ fontSize: 36, marginTop: 16, marginBottom: 0, fontStyle: 'italic' }}>
            {isManual ? `Elegí ${effectiveCount} fotos del panel derecho` : 'No hay fotos en este viaje'}
          </p>
          {isManual && (
            <p style={{ fontSize: 22, marginTop: 12, color: 'rgba(255,255,255,0.4)' }}>
              o cambiá a modo Auto para que las propongamos solas
            </p>
          )}
        </div>
      );
    }
    switch (template) {
      case 'mosaic':     return <MosaicAutoTemplate {...commonProps} />;
      case 'pinterest':  return <PinterestWallTemplate {...commonProps} />;
      case 'polaroid':   return <PolaroidWallTemplate {...commonProps} />;
      case 'scrapbook':  return <ScrapbookTemplate {...commonProps} />;
      case 'cinema':     return <CinemaGridTemplate {...commonProps} />;
      case 'bighero':    return <BigHeroTemplate {...commonProps} />;
      case 'filmstrip':  return <FilmstripGridTemplate {...commonProps} />;
      case 'tilted':     return <TiltedStackTemplate {...commonProps} />;
      case 'bento':      return <BentoTemplate {...commonProps} />;
      case 'y2k':        return <Y2KPopTemplate {...commonProps} />;
      case 'moodboard':  return <MoodBoardTemplate {...commonProps} />;
      case 'minimal':    return <MinimalKinfolkTemplate {...commonProps} />;
      case 'diamond':    return <DiamondTemplate {...commonProps} />;
      case 'photobooth': return <PhotoboothTemplate {...commonProps} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-16">
      {/* Dark glass stage — the trip layout uses a light pastel
          background; without this wrapper the white-on-white controls
          are invisible. */}
      <div
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 p-5 sm:p-7"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}/photos`)}
          aria-label="Volver a fotos"
          className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/85 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white text-2xl font-bold leading-none">Crear collage</h1>
          <p className="text-white/55 text-xs mt-1">
            {mode === 'auto'
              ? `${allPool.length} fotos · ${pinnedUrls.size} fijadas · click en una foto del preview para fijarla`
              : `Elegí ${effectiveCount} fotos del panel derecho · ${manualSelection.length}/${effectiveCount}`}
          </p>
        </div>
        {/* Mode toggle */}
        <div className="flex bg-white/[0.04] rounded-xl p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'auto' ? 'bg-amber-400/20 text-amber-100' : 'text-white/65 hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Auto
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'manual' ? 'bg-amber-400/20 text-amber-100' : 'text-white/65 hover:text-white'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* Preview */}
        <div>
          <div
            ref={previewWrapperRef}
            className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl shadow-black/40"
            style={{ aspectRatio: '1 / 1' }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transformOrigin: 'top left',
                transform: `scale(${previewScale})`,
                width: 1080,
                height: 1080,
              }}
              onClickCapture={handleStageClick}
            >
              {renderTemplate()}
            </div>
            {/* Pin badge overlay — visible only in auto mode, on top of
                pinned photos. Computed from slotMeasures (post-render DOM
                positions) so it tracks transforms, scale, and any template. */}
            {mode === 'auto' && slotMeasures.map((s, i) => {
              if (!pinnedUrls.has(s.url)) return null;
              return (
                <div
                  key={`pin-${i}-${s.url}`}
                  style={{
                    position: 'absolute',
                    left: s.left,
                    top: s.top,
                    width: s.width,
                    height: s.height,
                    border: '3px solid rgba(245,158,11,0.95)',
                    borderRadius: 4,
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 2px rgba(0,0,0,0.35), 0 6px 18px rgba(245,158,11,0.55)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(245,158,11,0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                    }}
                  >
                    <Pin className="w-3.5 h-3.5" stroke="#1a1408" strokeWidth={3} />
                  </div>
                </div>
              );
            })}
            {/* Manual mode preview hint — show a subtle X badge on each filled photo */}
            {mode === 'manual' && slotMeasures.map((s, i) => (
              <div
                key={`x-${i}-${s.url}`}
                style={{
                  position: 'absolute',
                  left: s.left + s.width - 26,
                  top: s.top + 4,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(244,63,94,0.92)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                }}
              >
                <X className="w-3 h-3" stroke="#fff" strokeWidth={3} />
              </div>
            ))}
          </div>

          {/* Action bar — sticky on mobile so download is always reachable */}
          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={reshuffle}
                disabled={sample.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition-colors disabled:opacity-40"
                title={mode === 'manual' ? 'Reordena el patrón del template' : 'Mezcla las fotos no fijadas'}
              >
                <Shuffle className="w-4 h-4" />
                {mode === 'manual' ? 'Reordenar' : 'Mezclar'}
              </button>
              {mode === 'auto' && pinnedUrls.size > 0 && (
                <button
                  type="button"
                  onClick={clearPins}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition-colors"
                >
                  <Eraser className="w-4 h-4" />
                  Soltar todas
                </button>
              )}
              {mode === 'manual' && manualSelection.length > 0 && (
                <button
                  type="button"
                  onClick={clearManual}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition-colors"
                >
                  <Eraser className="w-4 h-4" />
                  Vaciar
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || sample.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-white text-sm font-bold shadow-[0_8px_30px_rgba(245,158,11,0.35)] disabled:opacity-60 transition-all"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exportando…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Descargar PNG
                </>
              )}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          {/* Custom title + destination */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider">Texto del collage</p>
              {trip && (effectiveTitle !== trip.title || effectiveDestination !== (trip.destination || '')) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomTitle(trip.title || 'Mi viaje');
                    setCustomDestination(trip.destination || '');
                  }}
                  className="text-[10px] text-white/50 hover:text-white/85 font-semibold uppercase tracking-wider"
                >
                  Restaurar
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={customTitle ?? ''}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Mi viaje"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 focus:border-amber-300/60 focus:bg-white/[0.10] text-white text-sm font-bold placeholder-white/30 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1">
                  Destino (opcional)
                </label>
                <input
                  type="text"
                  value={customDestination ?? ''}
                  onChange={(e) => setCustomDestination(e.target.value)}
                  placeholder="Cornwall, UK"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 focus:border-amber-300/60 focus:bg-white/[0.10] text-white text-sm font-medium placeholder-white/30 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Templates */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
            <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider mb-3">Plantilla</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => {
                const isActive = template === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`text-left p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-amber-400/15 border-amber-300/60 text-amber-100'
                        : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]'
                    }`}
                  >
                    <p className={`text-sm font-bold leading-none ${isActive ? '' : 'text-white'}`}>{t.label}</p>
                    <p className="text-[10px] text-white/45 mt-1 leading-tight">{t.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Count selector */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
            <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider mb-3">
              Fotos · {effectiveCount}
              {photoCount > activeMax && (
                <span className="text-amber-300 ml-2 normal-case font-medium tracking-normal">
                  (esta plantilla muestra máx {activeMax})
                </span>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPhotoCount(n)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-bold transition-all ${
                    photoCount === n
                      ? 'bg-amber-400/15 border-amber-300/60 text-amber-100'
                      : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Order strip — manual mode only, when ≥2 photos picked */}
          {mode === 'manual' && manualSelection.length >= 2 && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
              <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider mb-3">
                Orden · arrastrá para reacomodar
              </p>
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSelectionDragEnd}
              >
                <SortableContext items={manualSelection} strategy={horizontalListSortingStrategy}>
                  <div className="flex flex-wrap gap-1.5">
                    {manualSelection.map((url, i) => (
                      <SortableThumb
                        key={url}
                        id={url}
                        index={i}
                        url={url}
                        onRemove={removeFromManual}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Pool — auto mode = pin toggles, manual mode = ordered selection */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider">
                {mode === 'auto' ? 'Fijar fotos al collage' : `Elegir fotos · ${manualSelection.length}/${effectiveCount}`}
              </p>
              {((mode === 'auto' && pinnedUrls.size > 0) || (mode === 'manual' && manualSelection.length > 0)) && (
                <button
                  type="button"
                  onClick={mode === 'auto' ? clearPins : clearManual}
                  className="text-[10px] text-white/50 hover:text-white/85 font-semibold uppercase tracking-wider"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div
              className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-1.5 max-h-[520px] overflow-y-auto pr-1"
              style={{ scrollbarWidth: 'thin' }}
            >
              {allPool.map((p) => {
                const pinned = mode === 'auto' && pinnedUrls.has(p.url);
                const selectionIndex = mode === 'manual' ? manualSelection.indexOf(p.url) : -1;
                const selected = selectionIndex >= 0;
                const active = pinned || selected;
                return (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() => (mode === 'auto' ? togglePin(p.url) : toggleManualSelection(p.url))}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      active
                        ? 'border-amber-300 ring-2 ring-amber-300/50 shadow-[0_4px_18px_rgba(245,158,11,0.45)]'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    aria-label={active ? 'Quitar' : 'Agregar'}
                    title={
                      mode === 'auto'
                        ? pinned ? 'Fijada — clic para soltar' : 'Clic para fijar al collage'
                        : selected ? `Posición #${selectionIndex + 1} — clic para quitar` : 'Clic para agregar'
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className={`w-full h-full object-cover ${active ? '' : 'opacity-90'}`}
                      loading="lazy"
                      decoding="async"
                    />
                    {pinned && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-300 flex items-center justify-center shadow-md">
                        <Pin className="w-3 h-3 text-amber-950" strokeWidth={3} />
                      </div>
                    )}
                    {selected && (
                      <div className="absolute top-1 right-1 min-w-[20px] h-5 px-1 rounded-full bg-amber-300 flex items-center justify-center shadow-md">
                        <span className="text-[10px] font-black text-amber-950">{selectionIndex + 1}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-white/40 text-[10px] mt-2 text-center">
              {allPool.length} fotos en el viaje
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
