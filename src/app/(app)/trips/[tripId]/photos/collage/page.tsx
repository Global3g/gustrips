'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Shuffle, Download, Pin, Loader2, Eraser } from 'lucide-react';
import { toPng } from 'html-to-image';
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

type TemplateId =
  | 'mosaic'
  | 'pinterest'
  | 'polaroid'
  | 'scrapbook'
  | 'cinema'
  | 'bighero'
  | 'filmstrip'
  | 'tilted';

const TEMPLATES: { id: TemplateId; label: string; maxPhotos: number; subtitle: string }[] = [
  { id: 'mosaic',    label: 'Mosaic',    maxPhotos: 48, subtitle: 'Auto-split mosaico' },
  { id: 'cinema',    label: 'Cinema',    maxPhotos: 48, subtitle: 'Grilla simétrica' },
  { id: 'pinterest', label: 'Pinterest', maxPhotos: 48, subtitle: 'Columnas masonry' },
  { id: 'bighero',   label: 'Big Hero',  maxPhotos: 48, subtitle: '1 grande + resto' },
  { id: 'tilted',    label: 'Tilted',    maxPhotos: 48, subtitle: 'Cards inclinadas' },
  { id: 'filmstrip', label: 'Filmstrip', maxPhotos: 48, subtitle: 'Cintas de película' },
  { id: 'polaroid',  label: 'Polaroid',  maxPhotos: 24, subtitle: 'Pared cork-board' },
  { id: 'scrapbook', label: 'Scrapbook', maxPhotos: 10, subtitle: 'Página de diario' },
];

const COUNT_OPTIONS = [6, 12, 24, 36, 48] as const;

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

  const [template, setTemplate] = useState<TemplateId>('mosaic');
  const [photoCount, setPhotoCount] = useState<number>(12);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [pinnedUrls, setPinnedUrls] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);
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

  // Sample for the active template: pinned URLs first (preserve order),
  // then random unpinned to fill up to effectiveCount.
  const sample = useMemo(() => {
    if (allPool.length === 0) return [] as AlbumPhoto[];
    const pinnedPhotos: AlbumPhoto[] = [];
    const unpinnedPool: AlbumPhoto[] = [];
    for (const p of allPool) {
      if (pinnedUrls.has(p.url)) pinnedPhotos.push(p);
      else unpinnedPool.push(p);
    }
    const shuffled = shuffleWithSeed(unpinnedPool, shuffleSeed);
    const need = Math.max(0, effectiveCount - pinnedPhotos.length);
    return [...pinnedPhotos, ...shuffled.slice(0, need)];
  }, [allPool, pinnedUrls, shuffleSeed, effectiveCount]);

  const dateRange = useMemo(
    () => formatDateRange(trip?.startDate, trip?.endDate),
    [trip],
  );

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

  const clearPins = useCallback(() => setPinnedUrls(new Set()), []);
  const reshuffle = useCallback(() => setShuffleSeed((s) => s + 1), []);

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
      const slug = slugify(trip?.title || 'viaje');
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
    tripTitle: trip?.title || 'Mi viaje',
    destination: trip?.destination,
    dateRange,
    seed: shuffleSeed + 1,
    count: effectiveCount,
    ref: stageRef,
  };

  const renderTemplate = () => {
    if (sample.length === 0) {
      return (
        <div className="flex items-center justify-center text-white/40 text-sm" style={{ width: 1080, height: 1080 }}>
          No hay fotos en este viaje
        </div>
      );
    }
    switch (template) {
      case 'mosaic':    return <MosaicAutoTemplate {...commonProps} />;
      case 'pinterest': return <PinterestWallTemplate {...commonProps} />;
      case 'polaroid':  return <PolaroidWallTemplate {...commonProps} />;
      case 'scrapbook': return <ScrapbookTemplate {...commonProps} />;
      case 'cinema':    return <CinemaGridTemplate {...commonProps} />;
      case 'bighero':   return <BigHeroTemplate {...commonProps} />;
      case 'filmstrip': return <FilmstripGridTemplate {...commonProps} />;
      case 'tilted':    return <TiltedStackTemplate {...commonProps} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}/photos`)}
          aria-label="Volver a fotos"
          className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/85 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-white text-2xl font-bold leading-none">Crear collage</h1>
          <p className="text-white/55 text-xs mt-1">
            {allPool.length} fotos disponibles · {pinnedUrls.size} bloqueadas
          </p>
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
            >
              {renderTemplate()}
            </div>
          </div>

          {/* Action bar — sticky on mobile so download is always reachable */}
          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={reshuffle}
                disabled={sample.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition-colors disabled:opacity-40"
              >
                <Shuffle className="w-4 h-4" />
                Mezclar
              </button>
              {pinnedUrls.size > 0 && (
                <button
                  type="button"
                  onClick={clearPins}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition-colors"
                >
                  <Eraser className="w-4 h-4" />
                  Limpiar bloqueos
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

          {/* Pool with pin toggles */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
            <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider mb-3">
              Bloquea las fotos que querés conservar
            </p>
            <div
              className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-1.5 max-h-[520px] overflow-y-auto pr-1"
              style={{ scrollbarWidth: 'thin' }}
            >
              {allPool.slice(0, 80).map((p) => {
                const pinned = pinnedUrls.has(p.url);
                return (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() => togglePin(p.url)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      pinned
                        ? 'border-amber-300 ring-2 ring-amber-300/50 shadow-[0_4px_18px_rgba(245,158,11,0.45)]'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    aria-label={pinned ? 'Desbloquear' : 'Bloquear'}
                    title={pinned ? 'Bloqueada — clic para desbloquear' : 'Clic para bloquear'}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {pinned && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-300 flex items-center justify-center shadow-md">
                        <Pin className="w-3 h-3 text-amber-950" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {allPool.length > 80 && (
              <p className="text-white/40 text-[10px] mt-2 text-center">
                Mostrando primeras 80 de {allPool.length}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
