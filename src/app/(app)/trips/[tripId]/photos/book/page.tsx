'use client';

/**
 * Photo Book editor — page-by-page WYSIWYG editor.
 *
 * Architecture:
 *  - Single source of truth: a `BookState` held in React state and mirrored
 *    to localStorage under `gustrips:book:${tripId}`.
 *  - On first load (no localStorage), `seedBookFromTrip` builds the initial
 *    state from the trip + events + albumPhotos.
 *  - dnd-kit wires up two interaction lanes:
 *      a) page reordering inside the left rail (handled inside PageList)
 *      b) photo drops from the bottom-right photo pool onto slots in the
 *         active page preview (handled at this level so we can update the
 *         page that owns the slot).
 *  - PDF generation lives in `exportPhotoBookPdf` and is dynamically
 *    imported on demand to keep the route shell tiny.
 *
 * Vol. 2: the right column is now organised in TABS to fit the expanded
 * toolset (layouts, fotos, texto, stickers, fondo, estilo).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Loader2,
  RotateCcw,
  Wand2,
  ShoppingBag,
  LayoutGrid,
  Image as ImageIcon,
  Type as TypeIcon,
  Sparkles,
  Palette,
  Paintbrush,
  FileText,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
// Trip / events / album come from the layout-level TripDataProvider.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
  useAlbumFromContext as useAlbum,
} from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { useTripMode } from '@/hooks/useTripMode';

import PagePreview from '@/components/trips/photos/book/PagePreview';
import PageList from '@/components/trips/photos/book/PageList';
import PhotoCropModal from '@/components/trips/photos/book/PhotoCropModal';
import LayoutPicker from '@/components/trips/photos/book/LayoutPicker';
import PhotoPool from '@/components/trips/photos/book/PhotoPool';
import TextEditor from '@/components/trips/photos/book/TextEditor';
import ThemeSelector from '@/components/trips/photos/book/ThemeSelector';
import PhotoFilterPicker from '@/components/trips/photos/book/PhotoFilterPicker';
import PhotoFramePicker from '@/components/trips/photos/book/PhotoFramePicker';
import StickerPanel from '@/components/trips/photos/book/StickerPanel';
import BackgroundPanel from '@/components/trips/photos/book/BackgroundPanel';

import { LAYOUTS } from '@/lib/photobook/layouts';
import { THEMES, getTheme } from '@/lib/photobook/themes';
import {
  applyLayout,
  blankPage,
  layoutForPhotoCount,
  newId,
  seedBookFromTrip,
  seedEmptyBook,
} from '@/lib/photobook/seed';
import type {
  BookPage,
  BookPatternId,
  BookSize,
  BookState,
  LayoutId,
  PhotoFilter,
  PhotoFrame,
  SlotCrop,
  Sticker,
  ThemeId,
  TextZoneKind,
} from '@/lib/photobook/types';

const STORAGE_KEY = (tripId: string) => `gustrips:book:${tripId}`;

const SIZE_OPTIONS: { id: BookSize; label: string }[] = [
  { id: 'a4', label: 'A4' },
  { id: 'square', label: 'Cuadrado' },
  { id: 'letter', label: 'Letter' },
];

type EditorTab = 'layout' | 'photos' | 'text' | 'stickers' | 'background' | 'style';

const TAB_DEFS: { id: EditorTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'photos', label: 'Fotos', icon: ImageIcon },
  { id: 'text', label: 'Texto', icon: TypeIcon },
  { id: 'stickers', label: 'Stickers', icon: Sparkles },
  { id: 'background', label: 'Fondo', icon: Paintbrush },
  { id: 'style', label: 'Estilo', icon: Palette },
];

function loadFromStorage(tripId: string): BookState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookState;
    if (!parsed?.cover || !Array.isArray(parsed.pages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(tripId: string, state: BookState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY(tripId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export default function PhotoBookPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { trip } = useTrip();
  const { events } = useEvents();
  const { albumPhotos } = useAlbum();
  const { toast } = useToast();
  // Trip mode drives the auto-seed behavior below: once the trip has ended
  // ('memories') and the user already shot enough photos, opening the book
  // editor should not greet them with a picker — they almost certainly want
  // to look at their book, not configure it.
  const tripMode = useTripMode(trip);

  const [state, setState] = useState<BookState | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('photos');
  const [poolQuery, setPoolQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    phase: 'fetching' | 'rendering';
    current: number;
    total: number;
  } | null>(null);
  const [previewWidth, setPreviewWidth] = useState(420);
  // True when this is the first visit for the trip (no localStorage state)
  // and the user has not yet picked between auto-seed vs blank.
  const [needsSetup, setNeedsSetup] = useState(false);
  // Slot crop dialog state. Open when the user double-clicks a filled slot.
  const [cropTarget, setCropTarget] = useState<{
    pageId: string;
    slotIndex: number;
    photoUrl: string;
  } | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);

  /* ─── Initialisation (load or prompt) ──────────────────── */
  // Auto-seed threshold for the "memories" mode. Below this many album
  // photos we still ask the user with the picker — generating a book from
  // 2-3 photos rarely produces anything worth showing.
  const MEMORIES_AUTOSEED_MIN_PHOTOS = 5;
  const seededRef = useRef(false);
  useEffect(() => {
    if (!trip || seededRef.current) return;
    // Wait for tripMode to resolve. `useTripMode(null)` defaults to
    // 'planning', so we gate on having an actual trip first (already
    // covered by the early return above), then trust the hook output.
    seededRef.current = true;
    const restored = loadFromStorage(tripId);
    if (restored) {
      setState(restored);
      setActivePageId(restored.cover.id);
      return;
    }
    // First visit: in 'memories' mode with enough material, jump straight
    // to a seeded book and inform the user with a toast. They can always
    // tweak / reset via the existing Reiniciar button. In every other case
    // (planning, active, or memories with too few photos) we fall back to
    // the original picker so the user keeps full control.
    if (
      tripMode.mode === 'memories' &&
      albumPhotos.length >= MEMORIES_AUTOSEED_MIN_PHOTOS
    ) {
      const fresh = seedBookFromTrip(trip, events, albumPhotos);
      setState(fresh);
      setActivePageId(fresh.cover.id);
      toast('Tu photobook está listo. Editalo a tu gusto.', 'success');
      return;
    }
    setNeedsSetup(true);
  }, [trip, tripId, tripMode.mode, albumPhotos, events, toast]);

  const handleSeedFromEvents = useCallback(() => {
    if (!trip) return;
    const fresh = seedBookFromTrip(trip, events, albumPhotos);
    setState(fresh);
    setActivePageId(fresh.cover.id);
    setNeedsSetup(false);
  }, [trip, events, albumPhotos]);

  const handleSeedEmpty = useCallback(() => {
    if (!trip) return;
    const fresh = seedEmptyBook(trip);
    setState(fresh);
    setActivePageId(fresh.cover.id);
    setNeedsSetup(false);
  }, [trip]);

  /* ─── Persist on every change ──────────────────────────── */
  useEffect(() => {
    if (!state) return;
    saveToStorage(tripId, state);
  }, [state, tripId]);

  /* ─── Responsive preview width ─────────────────────────── */
  useEffect(() => {
    const node = previewWrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setPreviewWidth(Math.max(220, Math.min(560, w - 24)));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [state]);

  /* ─── State helpers ────────────────────────────────────── */

  const activePage: BookPage | null = useMemo(() => {
    if (!state || !activePageId) return null;
    if (state.cover.id === activePageId) return state.cover;
    return state.pages.find((p) => p.id === activePageId) ?? null;
  }, [state, activePageId]);

  const updatePage = useCallback(
    (pageId: string, updater: (page: BookPage) => BookPage) => {
      setState((cur) => {
        if (!cur) return cur;
        if (cur.cover.id === pageId) {
          return { ...cur, cover: updater(cur.cover) };
        }
        return {
          ...cur,
          pages: cur.pages.map((p) => (p.id === pageId ? updater(p) : p)),
        };
      });
    },
    [],
  );

  const handleLayoutChange = useCallback(
    (id: LayoutId) => {
      if (!activePage) return;
      if (activePage.layoutId === 'cover' && id !== 'cover') return;
      if (id === 'cover' && activePage.layoutId !== 'cover') return;
      updatePage(activePage.id, (p) => applyLayout(p, id));
      setSelectedSlot(null);
    },
    [activePage, updatePage],
  );

  const handleTextChange = useCallback(
    (field: TextZoneKind, value: string) => {
      if (!activePage) return;
      updatePage(activePage.id, (p) => ({ ...p, [field]: value }));
    },
    [activePage, updatePage],
  );

  const handleAddPage = useCallback(() => {
    setState((cur) => {
      if (!cur) return cur;
      const np = blankPage('1-hero');
      return { ...cur, pages: [...cur.pages, np] };
    });
  }, []);

  const handleDuplicatePage = useCallback((pageId: string) => {
    setState((cur) => {
      if (!cur) return cur;
      const idx = cur.pages.findIndex((p) => p.id === pageId);
      if (idx < 0) return cur;
      const dup = { ...cur.pages[idx], id: newId() };
      const next = [...cur.pages];
      next.splice(idx + 1, 0, dup);
      return { ...cur, pages: next };
    });
  }, []);

  const handleDeletePage = useCallback(
    (pageId: string) => {
      setState((cur) => {
        if (!cur) return cur;
        const next = cur.pages.filter((p) => p.id !== pageId);
        if (activePageId === pageId) {
          setActivePageId(cur.cover.id);
        }
        return { ...cur, pages: next.length > 0 ? next : [blankPage('1-hero')] };
      });
    },
    [activePageId],
  );

  const handleReorderPages = useCallback((orderedIds: string[]) => {
    setState((cur) => {
      if (!cur) return cur;
      const byId = new Map(cur.pages.map((p) => [p.id, p]));
      const next: BookPage[] = [];
      for (const id of orderedIds) {
        const p = byId.get(id);
        if (p) next.push(p);
      }
      return { ...cur, pages: next };
    });
  }, []);

  const handleSlotCropOpen = useCallback(
    (slotIndex: number) => {
      if (!activePage) return;
      const photoUrl = activePage.photoUrls[slotIndex];
      if (!photoUrl) return;
      setCropTarget({ pageId: activePage.id, slotIndex, photoUrl });
    },
    [activePage],
  );

  const handleSlotCropConfirm = useCallback(
    (crop: SlotCrop) => {
      if (!cropTarget) return;
      const { pageId, slotIndex } = cropTarget;
      updatePage(pageId, (p) => {
        const existing = p.slotCrops ?? Array.from({ length: p.photoUrls.length }, () => null);
        const next = [...existing];
        next[slotIndex] = crop;
        return { ...p, slotCrops: next };
      });
      setCropTarget(null);
    },
    [cropTarget, updatePage],
  );

  const handleSlotCropReset = useCallback(() => {
    if (!cropTarget) return;
    const { pageId, slotIndex } = cropTarget;
    updatePage(pageId, (p) => {
      if (!p.slotCrops) return p;
      const next = [...p.slotCrops];
      next[slotIndex] = null;
      // Drop the array entirely if every entry is null — keeps state lean.
      const allNull = next.every((c) => c === null);
      return { ...p, slotCrops: allNull ? undefined : next };
    });
    setCropTarget(null);
  }, [cropTarget, updatePage]);

  const handleMovePage = useCallback((pageId: string, direction: 'up' | 'down') => {
    setState((cur) => {
      if (!cur) return cur;
      const idx = cur.pages.findIndex((p) => p.id === pageId);
      if (idx < 0) return cur;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= cur.pages.length) return cur;
      const next = [...cur.pages];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return { ...cur, pages: next };
    });
  }, []);

  const handleAutoFill = useCallback(() => {
    if (!state || !trip) return;
    const sortedEvents = [...events].sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
    const existingEventTitles = new Set(state.pages.map((p) => p.title?.trim()));
    const additions: BookPage[] = [];
    for (const ev of sortedEvents) {
      if (!ev.title) continue;
      if (existingEventTitles.has(ev.title.trim())) continue;
      const photos: string[] = [];
      const seen = new Set<string>();
      for (const url of ev.photos ?? []) {
        if (url && !seen.has(url)) { seen.add(url); photos.push(url); }
      }
      for (const p of albumPhotos) {
        if (p.eventId !== ev.id) continue;
        const url = p.fullUrl || p.url;
        if (url && !seen.has(url)) { seen.add(url); photos.push(url); }
      }
      if (photos.length === 0) continue;
      const layoutId = layoutForPhotoCount(photos.length);
      const def = LAYOUTS[layoutId];
      additions.push({
        id: newId(),
        layoutId,
        photoUrls: Array.from({ length: def.slotCount }, (_, i) => photos[i] ?? null),
        title: ev.title,
        caption: ev.notes || undefined,
        date: ev.date || undefined,
        location: [ev.city, ev.country].filter(Boolean).join(', ') || ev.location || undefined,
      });
    }
    if (additions.length === 0) {
      toast('Ya tenés una página para cada evento', 'info');
      return;
    }
    setState({ ...state, pages: [...state.pages, ...additions] });
    toast(`Se agregaron ${additions.length} páginas`, 'success');
  }, [state, trip, events, albumPhotos, toast]);

  // Re-open the setup picker so the user can choose between auto-seed
  // (from events) or starting blank. The picker itself shows a warning
  // that the current book will be replaced when state already exists.
  const handleReset = useCallback(() => {
    if (!trip) return;
    setNeedsSetup(true);
    setSelectedSlot(null);
    setSelectedStickerId(null);
  }, [trip]);

  /* ─── DnD: photo pool → slot ───────────────────────────── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over) return;
      const aData = active.data.current as { kind?: string; url?: string } | undefined;
      const oData = over.data.current as { kind?: string; pageId?: string; index?: number } | undefined;
      if (aData?.kind !== 'photo' || !aData.url) return;
      if (oData?.kind !== 'slot' || !oData.pageId || typeof oData.index !== 'number') return;
      const { pageId, index } = oData;
      const url = aData.url;
      updatePage(pageId, (p) => {
        const next = [...p.photoUrls];
        next[index] = url;
        // Dropping a new photo into a slot invalidates whatever crop was
        // there before (the crop rect refers to the OLD image).
        let slotCrops = p.slotCrops;
        if (slotCrops && slotCrops[index] != null) {
          const cropsNext = [...slotCrops];
          cropsNext[index] = null;
          slotCrops = cropsNext.every((c) => c === null) ? undefined : cropsNext;
        }
        return { ...p, photoUrls: next, slotCrops };
      });
    },
    [updatePage],
  );

  const handleTapPhoto = useCallback(
    (url: string) => {
      if (!activePage) return;
      const slotCount = LAYOUTS[activePage.layoutId].slotCount;
      if (slotCount === 0) {
        toast('Esta página no tiene fotos', 'info');
        return;
      }
      let target = selectedSlot;
      if (target == null) {
        target = activePage.photoUrls.findIndex((u) => !u);
        if (target < 0) target = 0;
      }
      const i = target;
      updatePage(activePage.id, (p) => {
        const next = [...p.photoUrls];
        next[i] = url;
        // Same reasoning as the drag handler — clear the stale crop.
        let slotCrops = p.slotCrops;
        if (slotCrops && slotCrops[i] != null) {
          const cropsNext = [...slotCrops];
          cropsNext[i] = null;
          slotCrops = cropsNext.every((c) => c === null) ? undefined : cropsNext;
        }
        return { ...p, photoUrls: next, slotCrops };
      });
    },
    [activePage, selectedSlot, updatePage, toast],
  );

  /* ─── Vol. 2: per-slot filter & frame & caption ────────── */

  const handleFilterChange = useCallback(
    (filter: PhotoFilter | null) => {
      if (!activePage || selectedSlot == null) return;
      updatePage(activePage.id, (p) => {
        const cnt = LAYOUTS[p.layoutId].slotCount;
        const next = Array.from(
          { length: cnt },
          (_, i) => p.photoFilters?.[i] ?? null,
        );
        next[selectedSlot] = filter;
        return { ...p, photoFilters: next };
      });
    },
    [activePage, selectedSlot, updatePage],
  );

  const handleFrameChange = useCallback(
    (frame: PhotoFrame | null) => {
      if (!activePage || selectedSlot == null) return;
      updatePage(activePage.id, (p) => {
        const cnt = LAYOUTS[p.layoutId].slotCount;
        const next = Array.from(
          { length: cnt },
          (_, i) => p.photoFrames?.[i] ?? null,
        );
        next[selectedSlot] = frame;
        return { ...p, photoFrames: next };
      });
    },
    [activePage, selectedSlot, updatePage],
  );

  const handleSlotCaptionChange = useCallback(
    (caption: string) => {
      if (!activePage || selectedSlot == null) return;
      updatePage(activePage.id, (p) => {
        const cnt = LAYOUTS[p.layoutId].slotCount;
        const next = Array.from(
          { length: cnt },
          (_, i) => p.slotCaptions?.[i] ?? null,
        );
        next[selectedSlot] = caption || null;
        return { ...p, slotCaptions: next };
      });
    },
    [activePage, selectedSlot, updatePage],
  );

  /* ─── Background + pattern ─────────────────────────────── */

  const handleBackgroundChange = useCallback((color: string | undefined) => {
    if (!activePage) return;
    updatePage(activePage.id, (p) => ({ ...p, background: color }));
  }, [activePage, updatePage]);

  const handlePatternChange = useCallback((pattern: BookPatternId | undefined) => {
    if (!activePage) return;
    updatePage(activePage.id, (p) => ({ ...p, backgroundPattern: pattern }));
  }, [activePage, updatePage]);

  /* ─── Stickers ─────────────────────────────────────────── */

  const handleAddSticker = useCallback(
    (sticker: Sticker) => {
      if (!activePage) return;
      updatePage(activePage.id, (p) => ({
        ...p,
        stickers: [...(p.stickers ?? []), sticker],
      }));
      setActiveTab('stickers');
    },
    [activePage, updatePage],
  );

  const handleRemoveSticker = useCallback(
    (id: string) => {
      if (!activePage) return;
      updatePage(activePage.id, (p) => ({
        ...p,
        stickers: (p.stickers ?? []).filter((s) => s.id !== id),
      }));
      if (selectedStickerId === id) setSelectedStickerId(null);
    },
    [activePage, updatePage, selectedStickerId],
  );

  const handleUpdateSticker = useCallback(
    (id: string, patch: Partial<Sticker>) => {
      if (!activePage) return;
      updatePage(activePage.id, (p) => ({
        ...p,
        stickers: (p.stickers ?? []).map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        ),
      }));
    },
    [activePage, updatePage],
  );

  const handleMoveSticker = useCallback(
    (id: string, x: number, y: number) => {
      if (!activePage) return;
      updatePage(activePage.id, (p) => ({
        ...p,
        stickers: (p.stickers ?? []).map((s) =>
          s.id === id ? { ...s, x, y } : s,
        ),
      }));
    },
    [activePage, updatePage],
  );

  /* ─── PDF export ───────────────────────────────────────── */
  const handleExport = useCallback(async () => {
    if (!state || !trip) return;
    setIsExporting(true);
    setExportProgress(null);
    try {
      const mod = await import('@/lib/utils/exportPhotoBookPdf');
      const slug = (trip.title || 'viaje').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      await mod.exportAndDownloadPhotoBookPdf(
        state,
        `photobook_${slug}.pdf`,
        (info) => setExportProgress(info),
      );
      toast('Photo book descargado', 'success');
    } catch (err) {
      console.error('Photo book export failed:', err);
      toast('Error al generar el photo book', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [state, trip, toast]);

  /* ─── First-visit setup picker ─────────────────────────── */
  if (trip && needsSetup) {
    // Quick stats so the user knows what "automatic" would actually pull.
    const eventPhotoCount = events.reduce((n, ev) => n + (ev.photos?.length ?? 0), 0);
    const totalPhotos = eventPhotoCount + albumPhotos.length;
    const eventsWithPhotos = events.filter((ev) => {
      if ((ev.photos?.length ?? 0) > 0) return true;
      return albumPhotos.some((p) => p.eventId === ev.id);
    }).length;
    const willGenerateContent = totalPhotos > 0 && eventsWithPhotos > 0;
    const isReplacing = state !== null; // came from Reiniciar, not first visit

    return (
      <div className="max-w-[1400px] mx-auto pb-16">
        <div
          className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 p-6 sm:p-10 space-y-8"
          style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
        >
          <button
            type="button"
            onClick={() => {
              if (isReplacing) {
                setNeedsSetup(false);
              } else {
                router.push(`/trips/${tripId}/photos`);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/85 hover:text-white text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isReplacing ? 'Cancelar' : 'Volver a fotos'}
          </button>

          <div className="text-center space-y-2 pt-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              ¿Cómo querés armar tu photobook?
            </h1>
            <p className="text-sm text-white/60">
              {isReplacing
                ? 'Esto va a reemplazar el photobook actual.'
                : 'Podés cambiar de idea después con el botón Reiniciar.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <button
              type="button"
              onClick={handleSeedFromEvents}
              disabled={!willGenerateContent}
              className="group relative text-left rounded-2xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-amber-300/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.04] disabled:hover:border-white/[0.08] p-6 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-300/15 border border-amber-300/30 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-amber-200" />
                </div>
                <h2 className="text-base font-semibold text-white">Desde mis eventos</h2>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                Genero una página por cada evento del viaje que tenga fotos. Listo en segundos.
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs text-white/55">
                {willGenerateContent ? (
                  <>
                    {eventsWithPhotos} {eventsWithPhotos === 1 ? 'página' : 'páginas'} · {totalPhotos} {totalPhotos === 1 ? 'foto' : 'fotos'}
                  </>
                ) : (
                  <span className="text-amber-200/80">Todavía no hay eventos con fotos.</span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={handleSeedEmpty}
              className="group relative text-left rounded-2xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-sky-300/30 p-6 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-sky-300/15 border border-sky-300/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-sky-200" />
                </div>
                <h2 className="text-base font-semibold text-white">Empezar desde cero</h2>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                Arrancás con una portada y una página vacía. Vos elegís cada foto desde el pool.
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs text-white/55">
                Control total · más manual
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Loading state ────────────────────────────────────── */
  if (!trip || !state || !activePage) {
    return <div className="p-6 text-white/70 text-sm">Cargando…</div>;
  }

  const theme = getTheme(state.theme);
  const selectedPhotoUrl =
    selectedSlot != null ? activePage.photoUrls[selectedSlot] ?? null : null;
  const selectedFilter =
    selectedSlot != null
      ? (activePage.photoFilters?.[selectedSlot] ?? null)
      : null;
  const selectedFrame =
    selectedSlot != null
      ? (activePage.photoFrames?.[selectedSlot] ?? null)
      : null;
  const selectedCaption =
    selectedSlot != null
      ? (activePage.slotCaptions?.[selectedSlot] ?? '')
      : '';

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="max-w-[1400px] mx-auto pb-16">
        <div
          className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 p-4 sm:p-6 space-y-5"
          style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
        >
          {/* ─── Top bar ─── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => router.push(`/trips/${tripId}/photos`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/85 hover:text-white text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a fotos
              </button>

              <select
                value={state.theme}
                onChange={(e) => setState((s) => (s ? { ...s, theme: e.target.value as ThemeId } : s))}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs font-semibold focus:outline-none focus:border-amber-300/40"
              >
                {Object.values(THEMES).map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-900">
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                value={state.size}
                onChange={(e) => setState((s) => (s ? { ...s, size: e.target.value as BookSize } : s))}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs font-semibold focus:outline-none focus:border-amber-300/40"
              >
                {SIZE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900">
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAutoFill}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/85 hover:text-white text-xs font-semibold transition-colors"
                title="Agrega una página por cada evento sin página todavía"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Auto-completar
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/85 hover:text-white text-xs font-semibold transition-colors"
                title="Elegir entre regenerar desde eventos o empezar desde cero"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reiniciar
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/45 text-xs font-semibold cursor-not-allowed"
                title="Próximamente"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Pedí impreso desde $40
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-zinc-900 font-bold text-sm shadow-lg shadow-amber-500/20 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed min-w-[180px] justify-center"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting
                  ? exportProgress
                    ? exportProgress.phase === 'fetching'
                      ? `Cargando ${exportProgress.current}/${exportProgress.total} fotos`
                      : `Página ${exportProgress.current}/${exportProgress.total}`
                    : 'Preparando…'
                  : 'Descargar PDF'}
              </button>
            </div>
          </div>

          {/* ─── Title strip ─── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
              Photo Book · {trip.title}
            </p>
            <p className="text-xs text-white/55 mt-0.5">
              {state.pages.length + 1} páginas · {theme.label}
            </p>
          </div>

          {/* ─── 3-column grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_320px] gap-4">
            {/* ─── Left rail: pages ─── */}
            <aside className="lg:max-h-[80vh] overflow-y-auto pr-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">
                Páginas
              </div>
              <PageList
                state={state}
                activePageId={activePageId!}
                onSelectPage={(id) => {
                  setActivePageId(id);
                  setSelectedSlot(null);
                  setSelectedStickerId(null);
                }}
                onReorder={handleReorderPages}
                onDuplicate={handleDuplicatePage}
                onDelete={handleDeletePage}
                onMove={handleMovePage}
                onAdd={handleAddPage}
              />
            </aside>

            {/* ─── Center: preview ─── */}
            <div
              ref={previewWrapRef}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start justify-center"
              onClick={() => setSelectedStickerId(null)}
            >
              <PagePreview
                page={activePage}
                theme={state.theme}
                size={state.size}
                width={previewWidth}
                interactive
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                onCropSlot={handleSlotCropOpen}
                onTextChange={handleTextChange}
                selectedStickerId={selectedStickerId}
                onSelectSticker={setSelectedStickerId}
                onMoveSticker={handleMoveSticker}
              />
            </div>

            {/* ─── Right panel: tabbed editor ─── */}
            <aside className="lg:max-h-[80vh] overflow-y-auto pr-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
              {/* Tab strip */}
              <div className="grid grid-cols-6 gap-1 p-1 rounded-lg bg-black/30 border border-white/[0.06]">
                {TAB_DEFS.map(({ id, label, icon: Icon }) => {
                  const active = id === activeTab;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      title={label}
                      aria-pressed={active}
                      className={
                        'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors ' +
                        (active
                          ? 'bg-amber-300/15 text-amber-100'
                          : 'text-white/55 hover:text-white hover:bg-white/[0.06]')
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[8.5px] leading-tight font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ─── Tab content ─── */}
              {activeTab === 'layout' && (
                <section className="space-y-2">
                  {activePage.layoutId === 'cover' ? (
                    <p className="text-[11px] text-white/55 italic">
                      La tapa tiene un layout fijo. Cambiá el layout de las
                      páginas internas desde acá.
                    </p>
                  ) : (
                    <LayoutPicker
                      value={activePage.layoutId}
                      onChange={handleLayoutChange}
                    />
                  )}
                </section>
              )}

              {activeTab === 'photos' && (
                <section className="space-y-3">
                  {/* Pool */}
                  <div>
                    <div className="text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">
                      Fotos del viaje
                    </div>
                    <PhotoPool
                      photos={albumPhotos}
                      query={poolQuery}
                      onQueryChange={setPoolQuery}
                      onTapPhoto={handleTapPhoto}
                    />
                  </div>

                  {/* Selected slot controls */}
                  <div className="rounded-md bg-white/[0.04] border border-white/[0.08] p-2 space-y-3">
                    <div className="text-[9px] uppercase font-bold tracking-wider text-white/60">
                      {selectedSlot != null
                        ? `Foto seleccionada · slot ${selectedSlot + 1}`
                        : 'Tocá una foto del preview'}
                    </div>
                    {selectedSlot != null ? (
                      <>
                        <div>
                          <div className="text-[10px] font-semibold text-white/65 mb-1">
                            Filtro
                          </div>
                          <PhotoFilterPicker
                            photoUrl={selectedPhotoUrl}
                            value={selectedFilter}
                            onChange={handleFilterChange}
                          />
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-white/65 mb-1">
                            Marco
                          </div>
                          <PhotoFramePicker
                            value={selectedFrame}
                            onChange={handleFrameChange}
                          />
                        </div>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-white/65">
                            Caption del slot
                          </span>
                          <input
                            type="text"
                            value={selectedCaption ?? ''}
                            onChange={(e) => handleSlotCaptionChange(e.target.value)}
                            placeholder="Texto bajo la foto (polaroid, etc.)"
                            className="w-full px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-amber-300/40"
                          />
                        </label>
                      </>
                    ) : (
                      <p className="text-[10.5px] text-white/45 italic">
                        Tocá una foto en el preview para aplicar filtros,
                        marcos o un caption.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'text' && (
                <section>
                  <TextEditor page={activePage} onChange={handleTextChange} />
                </section>
              )}

              {activeTab === 'stickers' && (
                <section>
                  <StickerPanel
                    stickers={activePage.stickers ?? []}
                    selectedStickerId={selectedStickerId}
                    onAdd={handleAddSticker}
                    onRemove={handleRemoveSticker}
                    onSelect={setSelectedStickerId}
                    onUpdate={handleUpdateSticker}
                  />
                </section>
              )}

              {activeTab === 'background' && (
                <section>
                  <BackgroundPanel
                    themeId={state.theme}
                    backgroundColor={activePage.background}
                    pattern={activePage.backgroundPattern}
                    onColorChange={handleBackgroundChange}
                    onPatternChange={handlePatternChange}
                  />
                </section>
              )}

              {activeTab === 'style' && (
                <section>
                  <ThemeSelector
                    value={state.theme}
                    onChange={(id) => setState((s) => (s ? { ...s, theme: id } : s))}
                  />
                </section>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* Photo crop dialog — opens on slot double-click. */}
      {cropTarget && (() => {
        const targetPage =
          state.cover.id === cropTarget.pageId
            ? state.cover
            : state.pages.find((p) => p.id === cropTarget.pageId);
        if (!targetPage) return null;
        const slotDef = LAYOUTS[targetPage.layoutId]?.slots?.[cropTarget.slotIndex];
        if (!slotDef) return null;
        const PAGE_RATIOS: Record<BookSize, number> = {
          a4: 210 / 297,
          square: 1,
          letter: 216 / 279,
        };
        // The slot's w/h are in page-relative units (0..1). Real-world aspect
        // also depends on the page's own aspect ratio.
        const aspect = (slotDef.w / slotDef.h) * PAGE_RATIOS[state.size];
        const currentCrop = targetPage.slotCrops?.[cropTarget.slotIndex] ?? null;
        return (
          <PhotoCropModal
            photoUrl={cropTarget.photoUrl}
            aspect={aspect}
            initialCrop={currentCrop}
            onConfirm={handleSlotCropConfirm}
            onReset={currentCrop ? handleSlotCropReset : undefined}
            onCancel={() => setCropTarget(null)}
          />
        );
      })()}
    </DndContext>
  );
}
