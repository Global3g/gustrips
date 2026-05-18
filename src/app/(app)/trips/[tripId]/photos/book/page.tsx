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
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useTrip } from '@/hooks/useTrip';
import { useAlbum } from '@/hooks/useAlbum';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/context/ToastContext';

import PagePreview from '@/components/trips/photos/book/PagePreview';
import PageList from '@/components/trips/photos/book/PageList';
import LayoutPicker from '@/components/trips/photos/book/LayoutPicker';
import PhotoPool from '@/components/trips/photos/book/PhotoPool';
import TextEditor from '@/components/trips/photos/book/TextEditor';
import ThemeSelector from '@/components/trips/photos/book/ThemeSelector';

import { LAYOUTS } from '@/lib/photobook/layouts';
import { THEMES, getTheme } from '@/lib/photobook/themes';
import {
  applyLayout,
  blankPage,
  layoutForPhotoCount,
  newId,
  seedBookFromTrip,
} from '@/lib/photobook/seed';
import type {
  BookPage,
  BookSize,
  BookState,
  LayoutId,
  ThemeId,
  TextZoneKind,
} from '@/lib/photobook/types';

const STORAGE_KEY = (tripId: string) => `gustrips:book:${tripId}`;

const SIZE_OPTIONS: { id: BookSize; label: string }[] = [
  { id: 'a4', label: 'A4' },
  { id: 'square', label: 'Cuadrado' },
  { id: 'letter', label: 'Letter' },
];

function loadFromStorage(tripId: string): BookState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookState;
    // Light sanity check — if shape looks wrong, discard.
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
    // localStorage may be full or disabled — silently ignore. We've still
    // got the in-memory state; the user just won't survive a refresh.
  }
}

export default function PhotoBookPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { trip } = useTrip(tripId);
  const { events } = useEvents(tripId);
  const { albumPhotos } = useAlbum(tripId, trip);
  const { toast } = useToast();

  const [state, setState] = useState<BookState | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [poolQuery, setPoolQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(420);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);

  /* ─── Initialisation (load or seed) ─────────────────────
     Run once when the trip data is available. We deliberately key off the
     trip ID (not the whole trip object) so updates to title/description
     don't wipe the user's edits. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (!trip || seededRef.current) return;
    seededRef.current = true;
    const restored = loadFromStorage(tripId);
    if (restored) {
      setState(restored);
      setActivePageId(restored.cover.id);
    } else {
      const fresh = seedBookFromTrip(trip, events, albumPhotos);
      setState(fresh);
      setActivePageId(fresh.cover.id);
    }
  }, [trip, tripId, events, albumPhotos]);

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
      // Cap the preview so it never overflows the column. Subtract a bit
      // of padding (24px on each side) for breathing room.
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
      // Don't allow swapping the cover into a different layout — keeps the
      // cover-photo + overlay logic simple.
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
        // Avoid leaving the editor pointing at a deleted page.
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

  /* ─── Auto-fill: one page per event with photos, default layout ──── */
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

  /* ─── Reset to auto-generated baseline ─────────────────── */
  const handleReset = useCallback(() => {
    if (!trip) return;
    const ok = typeof window !== 'undefined'
      ? window.confirm('¿Regenerar el libro desde los eventos? Vas a perder los cambios actuales.')
      : true;
    if (!ok) return;
    const fresh = seedBookFromTrip(trip, events, albumPhotos);
    setState(fresh);
    setActivePageId(fresh.cover.id);
    setSelectedSlot(null);
  }, [trip, events, albumPhotos]);

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
        return { ...p, photoUrls: next };
      });
    },
    [updatePage],
  );

  /* ─── Tap-to-fill (mobile-friendly) ────────────────────── */
  const handleTapPhoto = useCallback(
    (url: string) => {
      if (!activePage) return;
      const slotCount = LAYOUTS[activePage.layoutId].slotCount;
      if (slotCount === 0) {
        toast('Esta página no tiene fotos', 'info');
        return;
      }
      // If no slot is selected, fill the first empty slot; otherwise the
      // selected one.
      let target = selectedSlot;
      if (target == null) {
        target = activePage.photoUrls.findIndex((u) => !u);
        if (target < 0) target = 0;
      }
      const i = target;
      updatePage(activePage.id, (p) => {
        const next = [...p.photoUrls];
        next[i] = url;
        return { ...p, photoUrls: next };
      });
    },
    [activePage, selectedSlot, updatePage, toast],
  );

  /* ─── Photo slot color helpers ─────────────────────────── */
  const handleBackgroundChange = useCallback((color: string | undefined) => {
    if (!activePage) return;
    updatePage(activePage.id, (p) => ({ ...p, background: color }));
  }, [activePage, updatePage]);

  /* ─── PDF export ───────────────────────────────────────── */
  const handleExport = useCallback(async () => {
    if (!state || !trip) return;
    setIsExporting(true);
    try {
      const mod = await import('@/lib/utils/exportPhotoBookPdf');
      const slug = (trip.title || 'viaje').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      await mod.exportAndDownloadPhotoBookPdf(state, `photobook_${slug}.pdf`);
      toast('Photo book descargado', 'success');
    } catch (err) {
      console.error('Photo book export failed:', err);
      toast('Error al generar el photo book', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [state, trip, toast]);

  /* ─── Loading state ────────────────────────────────────── */
  if (!trip || !state || !activePage) {
    return <div className="p-6 text-white/70 text-sm">Cargando…</div>;
  }

  const theme = getTheme(state.theme);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="max-w-[1400px] mx-auto pb-16">
        {/* Dark glass stage — required because the trip layout uses a
            light pastel background; without this wrapper the white text
            would be invisible. */}
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

              {/* Theme dropdown */}
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

              {/* Size selector */}
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
                title="Regenerar desde los eventos del viaje"
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-zinc-900 font-bold text-sm shadow-lg shadow-amber-500/20 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'Generando…' : 'Descargar PDF'}
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
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px] gap-4">
            {/* ─── Left rail: pages ─── */}
            <aside className="lg:max-h-[78vh] overflow-y-auto pr-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">
                Páginas
              </div>
              <PageList
                state={state}
                activePageId={activePageId!}
                onSelectPage={(id) => {
                  setActivePageId(id);
                  setSelectedSlot(null);
                }}
                onReorder={handleReorderPages}
                onDuplicate={handleDuplicatePage}
                onDelete={handleDeletePage}
                onAdd={handleAddPage}
              />
            </aside>

            {/* ─── Center: preview ─── */}
            <div
              ref={previewWrapRef}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start justify-center"
            >
              <PagePreview
                page={activePage}
                theme={state.theme}
                size={state.size}
                width={previewWidth}
                interactive
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                onTextChange={handleTextChange}
              />
            </div>

            {/* ─── Right panel: edit ─── */}
            <aside className="lg:max-h-[78vh] overflow-y-auto pr-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-4">
              {/* Theme */}
              <section>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">
                  Estilo
                </div>
                <ThemeSelector
                  value={state.theme}
                  onChange={(id) => setState((s) => (s ? { ...s, theme: id } : s))}
                />
              </section>

              {/* Layout */}
              {activePage.layoutId !== 'cover' && (
                <section>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">
                    Layout
                  </div>
                  <LayoutPicker
                    value={activePage.layoutId}
                    onChange={handleLayoutChange}
                  />
                </section>
              )}

              {/* Background */}
              <section>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">
                  Fondo
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {theme.swatches.map((sw) => {
                    const active = (activePage.background || theme.background) === sw;
                    return (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => handleBackgroundChange(sw === theme.background ? undefined : sw)}
                        className={
                          'w-7 h-7 rounded-full border-2 transition-transform ' +
                          (active ? 'border-amber-300 scale-110' : 'border-white/20')
                        }
                        style={{ background: sw }}
                        aria-label={`Fondo ${sw}`}
                        aria-pressed={active}
                      />
                    );
                  })}
                  <label
                    className="w-7 h-7 rounded-full border-2 border-white/20 overflow-hidden cursor-pointer flex items-center justify-center"
                    title="Color personalizado"
                  >
                    <input
                      type="color"
                      value={activePage.background || theme.background}
                      onChange={(e) => handleBackgroundChange(e.target.value)}
                      className="w-12 h-12 -m-2 cursor-pointer"
                    />
                  </label>
                  {activePage.background && (
                    <button
                      type="button"
                      onClick={() => handleBackgroundChange(undefined)}
                      className="text-[10px] text-white/60 hover:text-white underline ml-1"
                    >
                      Restaurar
                    </button>
                  )}
                </div>
              </section>

              {/* Text */}
              <section>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">
                  Textos
                </div>
                <TextEditor page={activePage} onChange={handleTextChange} />
              </section>

              {/* Photo pool */}
              <section>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">
                  Fotos del viaje
                </div>
                <PhotoPool
                  photos={albumPhotos}
                  query={poolQuery}
                  onQueryChange={setPoolQuery}
                  onTapPhoto={handleTapPhoto}
                />
              </section>
            </aside>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
