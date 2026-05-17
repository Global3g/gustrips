'use client';

import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Shuffle, Download, Pin, Loader2, Eraser, Wand2, Hand, X, GripVertical, Plus, Trash2 } from 'lucide-react';
import { photoboothStripsCount } from '@/components/trips/photos/collage/PhotoboothTemplate';
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
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-amber-300/60 ring-1 ring-amber-300/30 shadow-md cursor-grab active:cursor-grabbing"
    >
      {/* draggable=false stops the browser's native image-drag from
          fighting dnd-kit for the pointer events. Without this, on some
          browsers the user just ends up dragging a ghost copy of the
          image and the sortable callback never fires. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" draggable={false} />
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

/* ── Free text overlays ────────────────────────────────────────────
   Lightweight free-position text labels the user can add to ANY
   template. Lives inside the export root so html-to-image captures
   them; positioning is in 1080×1080 stage coordinates and the drag
   converts screen deltas back to stage coords via the previewScale. */

type TextOverlayFamily = 'serif' | 'script' | 'display' | 'sans';

interface TextOverlay {
  id: string;
  x: number; // stage coords (0-1080), centered
  y: number;
  text: string;
  size: number;
  color: string;
  family: TextOverlayFamily;
  bold?: boolean;
  italic?: boolean;
}

const TEXT_FAMILIES: Record<TextOverlayFamily, string> = {
  sans: 'var(--font-dm-sans), Inter, sans-serif',
  serif: 'var(--font-playfair), Georgia, serif',
  script: 'var(--font-caveat), cursive',
  display: 'var(--font-bebas), Impact, sans-serif',
};

const TEXT_COLOR_PRESETS = ['#ffffff', '#0a1628', '#f59e0b', '#f43f5e', '#10b981', '#3b82f6', '#a855f7', '#fbcfe8'];

function newTextOverlay(): TextOverlay {
  return {
    id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    x: 540,
    y: 540,
    text: 'Tu texto',
    size: 64,
    color: '#ffffff',
    family: 'serif',
  };
}

function DraggableTextOverlay({
  overlay,
  selected,
  onSelect,
  onChange,
  previewScale,
}: {
  overlay: TextOverlay;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TextOverlay>) => void;
  previewScale: number;
}) {
  const startRef = useRef<{ mx: number; my: number; ox: number; oy: number; pid: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: overlay.x,
      oy: overlay.y,
      pid: e.pointerId,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = (e.clientX - startRef.current.mx) / previewScale;
    const dy = (e.clientY - startRef.current.my) / previewScale;
    onChange({ x: Math.max(0, Math.min(1080, startRef.current.ox + dx)), y: Math.max(0, Math.min(1080, startRef.current.oy + dy)) });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startRef.current && (e.currentTarget as HTMLElement).hasPointerCapture(startRef.current.pid)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(startRef.current.pid);
    }
    startRef.current = null;
    setDragging(false);
  };

  return (
    <div
      data-text-overlay
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        left: overlay.x,
        top: overlay.y,
        transform: 'translate(-50%, -50%)',
        fontFamily: TEXT_FAMILIES[overlay.family],
        fontSize: overlay.size,
        color: overlay.color,
        fontWeight: overlay.bold ? 900 : 400,
        fontStyle: overlay.italic ? 'italic' : 'normal',
        lineHeight: 1.05,
        textAlign: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        whiteSpace: 'pre',
        textShadow: overlay.color === '#ffffff' ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
        outline: selected ? '2px dashed rgba(245,158,11,0.8)' : 'none',
        outlineOffset: 6,
        padding: 4,
        zIndex: 200,
      }}
    >
      {overlay.text || ' '}
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
  // Per-strip captions for the Photobooth template.
  const [photoboothCaptions, setPhotoboothCaptions] = useState<{ line1: string; line2: string }[]>([]);
  /** Drag-to-swap permutation applied on top of the computed sample.
   *  permutation[slot] = index in the underlying sample. Identity by
   *  default. Used in auto mode; in manual mode swap rewrites the
   *  selection directly so the "Orden" strip stays in sync. */
  const [slotPermutation, setSlotPermutation] = useState<number[]>([]);
  // Drag state. Ref for the in-flight pointer data (avoids closures on
  // pointermove); state mirrors for the React-rendered hover ring.
  const dragSrcRef = useRef<{ url: string; idx: number; startX: number; startY: number } | null>(null);
  // Sticky flag — once the pointer travels far enough we lock this in
  // until release, so a wobble back to (0,0) still counts as a drag.
  const draggedRef = useRef(false);
  const [dragSrcUrl, setDragSrcUrl] = useState<string | null>(null);
  const [dragMoving, setDragMoving] = useState(false);
  /** URL of the photo currently under the cursor during drag. Drives the
   *  hover ring. Using a URL instead of an index makes it template-agnostic
   *  — Pinterest's DOM order doesn't match the array order. */
  const [dragHoverUrl, setDragHoverUrl] = useState<string | null>(null);
  // Free-position text labels — apply to any template.
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Root of the export — wraps both the template and the free text
  // overlays so the PNG includes them. Stage (template's own root)
  // remains the source for slot measurements.
  const exportRootRef = useRef<HTMLDivElement | null>(null);
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

  /** Sample with the user's drag-to-swap permutation applied. The
   *  template only ever sees this; sample stays the "raw" derived
   *  state. */
  const displaySample = useMemo(() => {
    if (slotPermutation.length === 0) return sample;
    return sample.map((_, i) => sample[slotPermutation[i] ?? i] ?? sample[i]);
  }, [sample, slotPermutation]);

  /** Swap the photos at two slot positions. Manual mode rewrites
   *  manualSelection so the Orden strip mirrors the new order; auto
   *  mode tracks the swap in slotPermutation. */
  const swapSlots = useCallback(
    (a: number, b: number) => {
      if (a === b || a < 0 || b < 0) return;
      if (mode === 'manual') {
        setManualSelection((prev) => {
          if (a >= prev.length || b >= prev.length) return prev;
          const next = [...prev];
          [next[a], next[b]] = [next[b], next[a]];
          return next;
        });
      } else {
        setSlotPermutation((prev) => {
          const max = Math.max(a, b, prev.length - 1);
          const next: number[] = [];
          for (let i = 0; i <= max; i++) next[i] = prev[i] ?? i;
          [next[a], next[b]] = [next[b], next[a]];
          return next;
        });
      }
    },
    [mode],
  );

  const resetPositions = useCallback(() => setSlotPermutation([]), []);

  // Reset the drag permutation when mode or count changes — those make
  // the slot indices stop meaning the same thing.
  useEffect(() => {
    setSlotPermutation([]);
  }, [mode, effectiveCount]);

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

  // Text-overlay handlers
  const addTextOverlay = useCallback(() => {
    const o = newTextOverlay();
    setTextOverlays((prev) => [...prev, o]);
    setSelectedOverlayId(o.id);
  }, []);
  const updateOverlay = useCallback((id: string, patch: Partial<TextOverlay>) => {
    setTextOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);
  const removeOverlay = useCallback((id: string) => {
    setTextOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId((cur) => (cur === id ? null : cur));
  }, []);

  // Photobooth captions: keep length in sync with the strip count.
  const photoboothStrips = useMemo(
    () => (template === 'photobooth' ? photoboothStripsCount(effectiveCount) : 0),
    [template, effectiveCount],
  );
  useEffect(() => {
    if (template !== 'photobooth') return;
    setPhotoboothCaptions((prev) => {
      if (prev.length === photoboothStrips) return prev;
      const next = [...prev];
      while (next.length < photoboothStrips) {
        next.push({
          line1: customDestination ?? trip?.destination ?? '',
          line2: dateRange?.split('—')[0]?.trim() ?? '',
        });
      }
      next.length = photoboothStrips;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, photoboothStrips]);

  const handleSelectionDragEnd = useCallback((e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setManualSelection((prev) => {
      const oldIdx = prev.indexOf(String(e.active.id));
      const newIdx = prev.indexOf(String(e.over!.id));
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  /** Pointer-down on a photo starts tracking. If the pointer travels
   *  more than DRAG_THRESHOLD before release we treat it as a swap;
   *  otherwise it's a tap → pin/unpin or remove from selection.
   *
   *  Once down, we attach document-level listeners so the drag keeps
   *  working even when the cursor passes over text overlays, scrolls
   *  off the wrapper, or crosses a transform boundary (Polaroid/Tilted
   *  rotations made setPointerCapture unreliable). */
  const DRAG_THRESHOLD = 8;

  /** Returns the array index in displaySample of the photo whose URL
   *  the wrapper exposes via data-photo-url. */
  const slotIndexOfUrl = (url: string): number =>
    displaySample.findIndex((p) => p.url === url);

  /** Walk every layer at (x, y) until we find one that's a photo
   *  wrapper. Skips the source URL so swapping onto yourself is a
   *  no-op. */
  const slotInfoAtPoint = (x: number, y: number, excludeUrl?: string): { idx: number; url: string } | null => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const w = (el as HTMLElement).closest('[data-photo-url]') as HTMLElement | null;
      if (!w) continue;
      const u = w.getAttribute('data-photo-url');
      if (!u) continue;
      if (excludeUrl && u === excludeUrl) continue;
      const idx = slotIndexOfUrl(u);
      if (idx >= 0) return { idx, url: u };
    }
    return null;
  };

  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-text-overlay]')) return;
      const wrapper = target.closest('[data-photo-url]') as HTMLElement | null;
      if (!wrapper) return;
      const url = wrapper.getAttribute('data-photo-url');
      if (!url) return;
      const srcIdx = slotIndexOfUrl(url);
      if (srcIdx < 0) return;

      dragSrcRef.current = { url, idx: srcIdx, startX: e.clientX, startY: e.clientY };
      draggedRef.current = false;
      setDragSrcUrl(url);
      setDragMoving(false);
      setDragHoverUrl(null);

      // Document-level listeners so events keep flowing while cursor moves
      // across template boundaries / transforms.
      const onDocMove = (ev: PointerEvent) => {
        const src = dragSrcRef.current;
        if (!src) return;
        const dx = ev.clientX - src.startX;
        const dy = ev.clientY - src.startY;
        if (!draggedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!draggedRef.current) {
          draggedRef.current = true;
          setDragMoving(true);
        }
        const hit = slotInfoAtPoint(ev.clientX, ev.clientY, src.url);
        setDragHoverUrl(hit ? hit.url : null);
        // Suppress browser scroll / selection while dragging.
        ev.preventDefault();
      };
      let removeUp = () => {};
      const cleanup = () => {
        document.removeEventListener('pointermove', onDocMove);
        removeUp();
      };
      const onDocUp = (ev: PointerEvent) => {
        const src = dragSrcRef.current;
        const wasDragging = draggedRef.current;
        dragSrcRef.current = null;
        draggedRef.current = false;
        setDragSrcUrl(null);
        setDragMoving(false);
        setDragHoverUrl(null);
        cleanup();
        if (!src) return;
        if (wasDragging) {
          const hit = slotInfoAtPoint(ev.clientX, ev.clientY, src.url);
          if (hit) swapSlots(src.idx, hit.idx);
        } else {
          // Tap, not drag
          if (mode === 'manual') removeFromManual(src.url);
          else togglePin(src.url);
          setSelectedOverlayId(null);
        }
      };
      removeUp = () => {
        document.removeEventListener('pointerup', onDocUp);
        document.removeEventListener('pointercancel', onDocUp);
      };
      document.addEventListener('pointermove', onDocMove, { passive: false });
      document.addEventListener('pointerup', onDocUp);
      document.addEventListener('pointercancel', onDocUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displaySample, mode, removeFromManual, togglePin, swapSlots],
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
  }, [displaySample, template, previewScale, mode, pinnedUrls, manualSelection]);

  const handleDownload = async () => {
    if (!exportRootRef.current) return;
    setDownloading(true);
    try {
      // Wait for Google Fonts to land so the export uses Playfair/Caveat
      // instead of a system fallback.
      try {
        if (typeof document !== 'undefined' && 'fonts' in document) {
          await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
        }
      } catch {/* ignore */}
      // Deselect any text overlay before capturing so the amber outline
      // doesn't show up in the PNG.
      setSelectedOverlayId(null);
      // Wait one frame for the outline to disappear.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(exportRootRef.current, {
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
    photos: displaySample,
    tripTitle: effectiveTitle,
    destination: effectiveDestination || undefined,
    dateRange,
    seed: shuffleSeed + 1,
    count: effectiveCount,
    ref: stageRef,
  };
  const photoboothProps = { ...commonProps, captions: photoboothCaptions };

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
      case 'photobooth': return <PhotoboothTemplate {...photoboothProps} />;
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
                // touchAction: 'none' stops mobile browsers from
                // scrolling/zooming while the user is dragging a photo,
                // so pointermove events keep firing.
                touchAction: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
              onPointerDown={handleStagePointerDown}
            >
              <div
                ref={exportRootRef}
                style={{
                  position: 'relative',
                  width: 1080,
                  height: 1080,
                }}
              >
                {renderTemplate()}
                {/* Free-position text overlays live INSIDE the export root
                    so they get baked into the downloaded PNG. */}
                {textOverlays.map((o) => (
                  <DraggableTextOverlay
                    key={o.id}
                    overlay={o}
                    selected={selectedOverlayId === o.id}
                    onSelect={() => setSelectedOverlayId(o.id)}
                    onChange={(patch) => updateOverlay(o.id, patch)}
                    previewScale={previewScale}
                  />
                ))}
              </div>
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
            {/* Drag-source dim — shows which photo you're holding. */}
            {dragMoving && dragSrcUrl &&
              slotMeasures
                .map((s, i) => s.url === dragSrcUrl ? { s, i } : null)
                .filter(Boolean)
                .map((entry) => {
                  const { s } = entry as { s: typeof slotMeasures[number]; i: number };
                  return (
                    <div
                      key={`src-${s.url}`}
                      style={{
                        position: 'absolute',
                        left: s.left,
                        top: s.top,
                        width: s.width,
                        height: s.height,
                        background: 'rgba(0,0,0,0.45)',
                        border: '3px dashed rgba(255,255,255,0.85)',
                        borderRadius: 6,
                        pointerEvents: 'none',
                        zIndex: 75,
                      }}
                    />
                  );
                })}
            {/* Drag-target hover ring — find the slot measure by URL so
                this works on templates whose DOM order differs from the
                array order (Pinterest masonry, Big Hero's hero slot, etc). */}
            {dragMoving && dragHoverUrl && slotMeasures
              .filter((s) => s.url === dragHoverUrl)
              .slice(0, 1)
              .map((s) => (
                <div
                  key="drag-hover"
                  style={{
                    position: 'absolute',
                    left: s.left,
                    top: s.top,
                    width: s.width,
                    height: s.height,
                    border: '4px solid rgba(34,197,94,0.95)',
                    borderRadius: 6,
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 2px rgba(0,0,0,0.4), 0 8px 24px rgba(34,197,94,0.55)',
                    zIndex: 80,
                  }}
                />
              ))}
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
              {mode === 'auto' && slotPermutation.some((v, i) => v !== i) && (
                <button
                  type="button"
                  onClick={resetPositions}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition-colors"
                  title="Vuelve las fotos a su orden original"
                >
                  ↺ Posiciones
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

          {/* Free text overlays — apply to any template */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider">Texto libre</p>
              <button
                type="button"
                onClick={addTextOverlay}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/40 text-amber-100 text-[11px] font-bold uppercase tracking-wider"
              >
                <Plus className="w-3 h-3" />
                Agregar
              </button>
            </div>
            {textOverlays.length === 0 ? (
              <p className="text-white/35 text-[11px] leading-snug">
                Agregá títulos, fechas o frases — y arrastralos en el preview para acomodarlos donde quieras.
              </p>
            ) : (
              <div className="space-y-3">
                {textOverlays.map((o) => {
                  const isSel = selectedOverlayId === o.id;
                  return (
                    <div
                      key={o.id}
                      className={`p-3 rounded-xl border ${isSel ? 'bg-amber-400/10 border-amber-300/60' : 'bg-white/[0.03] border-white/10'}`}
                      onClick={() => setSelectedOverlayId(o.id)}
                    >
                      <input
                        type="text"
                        value={o.text}
                        onChange={(e) => updateOverlay(o.id, { text: e.target.value })}
                        placeholder="Tu texto"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 focus:border-amber-300/60 focus:bg-white/[0.10] text-white text-sm font-semibold placeholder-white/30 outline-none"
                      />
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {(['serif', 'script', 'display', 'sans'] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => updateOverlay(o.id, { family: f })}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              o.family === f
                                ? 'bg-white text-black border-white'
                                : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.10]'
                            }`}
                            style={{ fontFamily: TEXT_FAMILIES[f] }}
                          >
                            {f === 'serif' ? 'Aa' : f === 'script' ? 'Aa' : f === 'display' ? 'AA' : 'Aa'}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="range"
                          min={16}
                          max={220}
                          value={o.size}
                          onChange={(e) => updateOverlay(o.id, { size: Number(e.target.value) })}
                          className="flex-1 accent-amber-400"
                        />
                        <span className="text-white/60 text-[10px] tabular-nums w-8 text-right">{o.size}px</span>
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {TEXT_COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateOverlay(o.id, { color: c })}
                            className={`w-6 h-6 rounded-full border-2 ${o.color === c ? 'border-amber-300 ring-1 ring-amber-300/50' : 'border-white/20'}`}
                            style={{ background: c }}
                            aria-label="color"
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => updateOverlay(o.id, { bold: !o.bold })}
                            className={`px-2 py-1 rounded-md text-[11px] font-black border ${o.bold ? 'bg-white text-black border-white' : 'bg-white/[0.04] text-white/70 border-white/10'}`}
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOverlay(o.id, { italic: !o.italic })}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold italic border ${o.italic ? 'bg-white text-black border-white' : 'bg-white/[0.04] text-white/70 border-white/10'}`}
                          >
                            I
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOverlay(o.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[11px] font-semibold"
                        >
                          <Trash2 className="w-3 h-3" />
                          Quitar
                        </button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-white/35 text-[10px] leading-snug">
                  💡 Arrastrá cada texto en el preview para moverlo.
                </p>
              </div>
            )}
          </div>

          {/* Photobooth captions — only when that template is active */}
          {template === 'photobooth' && photoboothStrips > 0 && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
              <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider mb-3">
                Pies de foto · Photobooth
              </p>
              <div className="space-y-3">
                {Array.from({ length: photoboothStrips }).map((_, s) => {
                  const cap = photoboothCaptions[s] || { line1: '', line2: '' };
                  return (
                    <div key={s} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                      <p className="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        Tira #{s + 1}
                      </p>
                      <input
                        type="text"
                        value={cap.line1}
                        onChange={(e) =>
                          setPhotoboothCaptions((prev) =>
                            prev.map((c, i) => (i === s ? { ...c, line1: e.target.value } : c)),
                          )
                        }
                        placeholder="Lugar"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 focus:border-amber-300/60 text-white text-sm font-semibold placeholder-white/30 outline-none"
                      />
                      <input
                        type="text"
                        value={cap.line2}
                        onChange={(e) =>
                          setPhotoboothCaptions((prev) =>
                            prev.map((c, i) => (i === s ? { ...c, line2: e.target.value } : c)),
                          )
                        }
                        placeholder="Fecha"
                        className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 focus:border-amber-300/60 text-white text-sm placeholder-white/30 outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
