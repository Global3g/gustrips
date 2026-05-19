'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Loader2, Play, RotateCcw } from 'lucide-react';
// Trip / events / album come from the layout-level TripDataProvider.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
  useAlbumFromContext as useAlbum,
} from '@/context/TripDataContext';
import {
  DEFAULT_SETTINGS,
  formatRuntime,
  shuffleWithSeed,
} from '@/lib/slideshow/presets';
import type {
  SlideshowPhoto,
  SlideshowSettings as SlideshowSettingsType,
} from '@/lib/slideshow/types';
import type { AlbumPhoto, TripEvent } from '@/types';
import SlideshowSettings from '@/components/trips/photos/show/SlideshowSettings';
import MiniPreview from '@/components/trips/photos/show/MiniPreview';

// The viewer pulls in framer-motion + Image fill-fullscreen layer and is
// not needed until the user clicks "Iniciar"; defer it.
const Slideshow = dynamic(
  () => import('@/components/trips/photos/show/Slideshow'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-zinc-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
);

/** localStorage key per trip so settings stay separate across trips. */
const storageKey = (tripId: string) => `gustrips:slideshow:${tripId}`;

/** Read + sanity-check settings from localStorage. Returns null on any
 *  parse error or shape mismatch — the caller falls back to defaults. */
function readStoredSettings(tripId: string): Partial<SlideshowSettingsType> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number } & Partial<SlideshowSettingsType>;
    // Future-proofing: if we ever bump the schema, drop old persisted
    // settings rather than risk crashing the editor.
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSettings(tripId: string, settings: SlideshowSettingsType) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(tripId), JSON.stringify(settings));
  } catch {
    // localStorage may be full or disabled — silently ignore. Settings
    // still work for the current session.
  }
}

export default function SlideshowShowPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { trip, loading: tripLoading } = useTrip();
  const { events, loading: eventsLoading } = useEvents();
  const { albumPhotos } = useAlbum();

  /* ── Build the trip's flat photo pool ──
     Same dedup logic the old viewer used: album first, then unique
     event-only photos, sorted by date → uploadedAt. We store the
     resolved `eventTitle` on each so captions don't need a second
     lookup at render time. */
  const pool = useMemo<SlideshowPhoto[]>(() => {
    const out: SlideshowPhoto[] = [];
    const seen = new Set<string>();
    for (const p of albumPhotos as AlbumPhoto[]) {
      if (!p.url || seen.has(p.url)) continue;
      seen.add(p.url);
      const ev = p.eventId ? events.find((e) => e.id === p.eventId) : undefined;
      out.push({ ...p, eventTitle: ev?.title });
    }
    for (const ev of events) {
      if (!ev.photos || ev.photos.length === 0) continue;
      for (const url of ev.photos) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({
          url,
          date: ev.date,
          uploadedAt: ev.createdAt,
          eventId: ev.id,
          eventTitle: ev.title,
        });
      }
    }
    return out.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.uploadedAt.localeCompare(b.uploadedAt);
    });
  }, [albumPhotos, events]);

  const eventsById = useMemo(() => {
    const m = new Map<string, TripEvent>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  /* ── Settings state ──
     We seed from localStorage (merging with defaults so any future
     fields land safely) and persist on every change. The "all selected"
     default kicks in once we know the pool, since defaults can't know
     the URL list in advance. */
  const [settings, setSettings] = useState<SlideshowSettingsType>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  // Hydrate once the trip + pool resolve. We can't trust the initial
  // render because pool starts empty — we need to wait for it before
  // deciding "select all by default".
  useEffect(() => {
    if (hydrated) return;
    if (tripLoading || eventsLoading) return;
    const stored = readStoredSettings(tripId);
    if (stored) {
      // Keep only URLs that still exist in the pool. The user may have
      // removed photos since their last visit.
      const poolUrls = new Set(pool.map((p) => p.url));
      const cleanSelected = (stored.selectedUrls ?? []).filter((u) => poolUrls.has(u));
      const cleanCustom = (stored.customOrder ?? []).filter((u) => cleanSelected.includes(u));
      setSettings({
        ...DEFAULT_SETTINGS,
        ...stored,
        selectedUrls: cleanSelected.length > 0 ? cleanSelected : pool.map((p) => p.url),
        customOrder: cleanCustom.length > 0 ? cleanCustom : cleanSelected,
      });
    } else {
      // Brand-new visitor → start with everything selected in chrono order.
      setSettings((prev) => ({
        ...prev,
        selectedUrls: pool.map((p) => p.url),
        customOrder: pool.map((p) => p.url),
      }));
    }
    setHydrated(true);
  }, [tripId, pool, tripLoading, eventsLoading, hydrated]);

  // Persist on every settings change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    writeStoredSettings(tripId, settings);
  }, [tripId, settings, hydrated]);

  const selectedSet = useMemo(() => new Set(settings.selectedUrls), [settings.selectedUrls]);

  const selectedPhotos = useMemo<SlideshowPhoto[]>(() => {
    const byUrl = new Map(pool.map((p) => [p.url, p] as const));
    const urls: string[] =
      settings.order === 'custom'
        ? settings.customOrder.filter((u) => selectedSet.has(u))
        : settings.selectedUrls;
    const photos: SlideshowPhoto[] = [];
    for (const u of urls) {
      const p = byUrl.get(u);
      if (p) photos.push(p);
    }
    if (settings.order === 'shuffle') {
      return shuffleWithSeed(photos, settings.shuffleSeed);
    }
    if (settings.order === 'chrono') {
      return [...photos].sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return a.uploadedAt.localeCompare(b.uploadedAt);
      });
    }
    // custom — already in user-defined order
    return photos;
  }, [pool, settings.order, settings.shuffleSeed, settings.selectedUrls, settings.customOrder, selectedSet]);

  const totalRuntime = useMemo(
    () => selectedPhotos.length * settings.durationPerSlide,
    [selectedPhotos.length, settings.durationPerSlide],
  );

  const initialIndex = useMemo(() => {
    const raw = searchParams.get('start');
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(n, Math.max(0, selectedPhotos.length - 1)));
  }, [searchParams, selectedPhotos.length]);

  const handleSelectAll = useCallback(() => {
    const all = pool.map((p) => p.url);
    setSettings((prev) => ({
      ...prev,
      selectedUrls: all,
      customOrder: all,
    }));
  }, [pool]);

  const handleClear = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      selectedUrls: [],
      customOrder: [],
    }));
  }, []);

  const handleReset = useCallback(() => {
    setSettings({
      ...DEFAULT_SETTINGS,
      selectedUrls: pool.map((p) => p.url),
      customOrder: pool.map((p) => p.url),
    });
  }, [pool]);

  const handleStart = useCallback(() => {
    if (selectedPhotos.length === 0) return;
    setShowViewer(true);
  }, [selectedPhotos.length]);

  const handleExitViewer = useCallback(() => {
    setShowViewer(false);
  }, []);

  const handleBack = useCallback(() => {
    router.push(`/trips/${tripId}/photos`);
  }, [router, tripId]);

  const loading = tripLoading || eventsLoading || !hydrated;

  /* ── When the viewer is up, paint the document black so safe-areas
        on iOS/Android don't bleed through. */
  useEffect(() => {
    if (!showViewer) return;
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = '#000';
    return () => { html.style.backgroundColor = prev; };
  }, [showViewer]);

  if (showViewer) {
    return (
      <Slideshow
        photos={selectedPhotos}
        settings={settings}
        tripTitle={trip?.title}
        eventsById={eventsById}
        onExit={handleExitViewer}
        initialIndex={initialIndex}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-16">
      {/* Dark glass stage — the trip layout has a light pastel background;
          without this wrapper the white text on the settings is invisible. */}
      <div
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 p-5 sm:p-7"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver a fotos"
            className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/85 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl font-bold leading-none">Crear slideshow</h1>
            <p className="text-white/55 text-xs mt-1">
              {loading
                ? 'Cargando fotos del viaje…'
                : `${pool.length} fotos disponibles · ${settings.selectedUrls.length} en el show`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-white/60 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparando todo…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            {/* ── Left column: settings ── */}
            <SlideshowSettings
              pool={pool}
              settings={settings}
              setSettings={setSettings}
              selectedSet={selectedSet}
              onSelectAll={handleSelectAll}
              onClear={handleClear}
            />

            {/* ── Right column: live preview + launch ── */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
                <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider mb-3">
                  Previsualización en vivo
                </p>
                <MiniPreview
                  photos={selectedPhotos}
                  eventsById={eventsById}
                  durationPerSlide={settings.durationPerSlide}
                  transition={settings.transition}
                  filter={settings.filter}
                  caption={settings.caption}
                  overlayTheme={settings.overlayTheme}
                />

                <div className="mt-3 flex flex-col gap-1">
                  <p className="text-white/80 text-sm font-semibold">
                    Total: {selectedPhotos.length} fotos
                  </p>
                  <p className="text-white/55 text-xs">{formatRuntime(totalRuntime)}</p>
                </div>

                <button
                  type="button"
                  onClick={handleStart}
                  disabled={selectedPhotos.length === 0}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-emerald-950 text-base font-black shadow-[0_8px_30px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Play className="w-5 h-5" strokeWidth={3} />
                  Iniciar slideshow
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-white/50 hover:text-white/85 text-[11px] font-semibold uppercase tracking-wider"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar valores predeterminados
                </button>
              </div>

              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 text-[11px] text-white/55 leading-relaxed">
                <p className="font-bold text-white/70 mb-1.5 uppercase tracking-wider text-[10px]">
                  Atajos del viewer
                </p>
                <ul className="space-y-1">
                  <li><kbd className="bg-white/10 px-1.5 rounded text-white/85">espacio</kbd> · play / pausa</li>
                  <li><kbd className="bg-white/10 px-1.5 rounded text-white/85">← →</kbd> · navegar</li>
                  <li><kbd className="bg-white/10 px-1.5 rounded text-white/85">↑ ↓</kbd> · volumen</li>
                  <li><kbd className="bg-white/10 px-1.5 rounded text-white/85">m</kbd> · silenciar</li>
                  <li><kbd className="bg-white/10 px-1.5 rounded text-white/85">f</kbd> · filtro on/off</li>
                  <li><kbd className="bg-white/10 px-1.5 rounded text-white/85">Esc</kbd> · salir</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
