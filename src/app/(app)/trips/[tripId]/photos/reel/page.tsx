'use client';

/**
 * Trip Reel builder — UI for generating an MP4 highlight reel from
 * the trip's photos via Shotstack.
 *
 * Flow:
 *   1. User picks up to 24 photos (default = first 18 with caption).
 *   2. User picks style (cinematic / vibrant / slow), aspect (1:1 or
 *      9:16), and music (chill / upbeat / cinematic).
 *   3. POST /api/generate-reel returns a render id.
 *   4. Poll GET /api/generate-reel/status/[id] every 2s until done.
 *   5. Show the resulting MP4 inline with a download button.
 *
 * When SHOTSTACK_API_KEY is missing on the server, both routes return
 * mock data so the UI is still demoable end-to-end.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Film, Download, Loader2, Music, Sparkles, RefreshCw, Play, AlertCircle } from 'lucide-react';
// Trip / events / album come from the layout-level TripDataProvider.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
  useAlbumFromContext as useAlbum,
} from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { MUSIC_LIBRARY, type ReelStyle, type ReelAspect, type ReelMusic, type ReelPhoto } from '@/lib/shotstack';
import { classNames } from '@/lib/utils/helpers';
import type { AlbumPhoto } from '@/types';

const PhotoPicker = dynamic(() => import('@/components/trips/photos/reel/PhotoPicker'), { ssr: false, loading: () => null });
const StyleSelector = dynamic(() => import('@/components/trips/photos/reel/StyleSelector'), { ssr: false, loading: () => null });

const MAX_PHOTOS = 24;
const DEFAULT_PHOTOS = 18;
const POLL_INTERVAL_MS = 2000;
/** Soft ceiling on polls so a wedged render eventually surfaces an
 *  error instead of spinning forever. ~6 minutes at 2s/poll. */
const MAX_POLLS = 180;

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

/* ─── Date-range helper (matches the collage page format) ─── */
function formatDateRange(start?: string, end?: string): string | undefined {
  if (!start || !end) return undefined;
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return `${s.toLocaleDateString('es', { day: 'numeric', month: 'long' })} — ${e.toLocaleDateString('es', opts)}`;
  } catch {
    return undefined;
  }
}

export default function ReelPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip } = useTrip();
  const { events } = useEvents();
  const { albumPhotos } = useAlbum();
  const { toast } = useToast();

  /* ── Pool: same logic as the collage page (captions first, then
   *    event photos) so the user sees their favourite shots up top. */
  const pool = useMemo(() => {
    const seen = new Set<string>();
    const result: AlbumPhoto[] = [];
    const captioned = albumPhotos.filter((p) => p.caption?.trim());
    const rest = albumPhotos.filter((p) => !p.caption?.trim());
    for (const p of [...captioned, ...rest]) {
      if (!p.url || seen.has(p.url)) continue;
      seen.add(p.url);
      result.push(p);
    }
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

  /* ── Selection state ── */
  const [selected, setSelected] = useState<string[]>([]);
  const initializedRef = useRef(false);

  // Seed selection with the first N captioned/event photos once the pool
  // arrives. We only do this once to avoid clobbering user edits.
  useEffect(() => {
    if (initializedRef.current || pool.length === 0) return;
    const seed = pool.slice(0, DEFAULT_PHOTOS).map((p) => p.url);
    setSelected(seed);
    initializedRef.current = true;
  }, [pool]);

  const toggleSelect = useCallback(
    (url: string) => {
      setSelected((cur) => {
        if (cur.includes(url)) return cur.filter((u) => u !== url);
        if (cur.length >= MAX_PHOTOS) return cur;
        return [...cur, url];
      });
    },
    [],
  );

  /* ── Reel options ── */
  const [style, setStyle] = useState<ReelStyle>('cinematic');
  const [aspect, setAspect] = useState<ReelAspect>('1:1');
  const [music, setMusic] = useState<ReelMusic>('chill');

  /* ── Render lifecycle ── */
  const [phase, setPhase] = useState<Phase>('idle');
  const [renderId, setRenderId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');
  const [progressPct, setProgressPct] = useState(0);
  const [isMock, setIsMock] = useState(false);
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  /* ── Submit handler ── */
  const handleGenerate = useCallback(async () => {
    if (selected.length < 2) {
      toast('Elegí al menos 2 fotos', 'warning');
      return;
    }
    stopPolling();
    setPhase('submitting');
    setVideoUrl(null);
    setRenderId(null);
    setErrorText('');
    setProgressPct(5);
    setStatusText('Enviando trabajo a la nube...');
    setIsMock(false);

    // Map URLs back to photo metadata so captions ride along.
    const photoMap = new Map(pool.map((p) => [p.url, p]));
    const photos: ReelPhoto[] = [];
    for (const url of selected) {
      const p = photoMap.get(url);
      if (!p) continue;
      const entry: ReelPhoto = { url: p.url, date: p.date };
      if (p.caption) entry.caption = p.caption;
      photos.push(entry);
    }

    const dateRange = formatDateRange(trip?.startDate, trip?.endDate);

    try {
      const res = await fetch('/api/generate-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos,
          music,
          aspect,
          style,
          tripTitle: trip?.title || 'Mi viaje',
          destination: trip?.destination || undefined,
          dateRange,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const id = String(data.renderId);
      setRenderId(id);
      if (data.mock) {
        setIsMock(true);
        setStatusText('Modo demo (sin Shotstack key) — generando vista previa...');
      } else {
        setStatusText('Tu reel se está generando...');
      }
      setPhase('polling');
      setProgressPct(15);
      pollCountRef.current = 0;
      // Kick off the polling loop on next tick.
      pollTimerRef.current = setTimeout(() => void pollOnce(id), POLL_INTERVAL_MS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorText(msg);
      setPhase('error');
      toast(`Error: ${msg}`, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, pool, music, aspect, style, trip, toast, stopPolling]);

  /* ── Polling loop ── */
  const pollOnce = useCallback(
    async (id: string) => {
      pollCountRef.current += 1;
      if (pollCountRef.current > MAX_POLLS) {
        setErrorText('El render tardó demasiado. Intentá de nuevo.');
        setPhase('error');
        return;
      }
      try {
        const res = await fetch(`/api/generate-reel/status/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const status: string = data.status;
        const url: string | undefined = data.url;
        // Map server status → human text + progress.
        if (status === 'queued' || status === 'fetching') {
          setStatusText('En cola...');
          setProgressPct(25);
        } else if (status === 'rendering') {
          setStatusText('Renderizando video...');
          setProgressPct((p) => Math.min(85, p + 6));
        } else if (status === 'saving') {
          setStatusText('Guardando archivo final...');
          setProgressPct(92);
        } else if (status === 'done' && url) {
          setStatusText('¡Listo!');
          setProgressPct(100);
          setVideoUrl(url);
          setPhase('done');
          return;
        } else if (status === 'failed') {
          throw new Error(data.error || 'El render falló en Shotstack');
        }
        pollTimerRef.current = setTimeout(() => void pollOnce(id), POLL_INTERVAL_MS);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setErrorText(msg);
        setPhase('error');
      }
    },
    [],
  );

  const handleReset = useCallback(() => {
    stopPolling();
    setPhase('idle');
    setVideoUrl(null);
    setRenderId(null);
    setErrorText('');
    setProgressPct(0);
    setStatusText('');
    setIsMock(false);
  }, [stopPolling]);

  const handleRetry = useCallback(() => {
    handleReset();
    void handleGenerate();
  }, [handleReset, handleGenerate]);

  /* ── Aspect preview frame dimensions ── */
  const previewBox =
    aspect === '1:1'
      ? 'aspect-square max-w-md'
      : 'aspect-[9/16] max-w-xs';

  const generating = phase === 'submitting' || phase === 'polling';

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/photos`)}
            className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <Film className="w-6 h-6 text-amber-300" />
              Trip Reel
            </h1>
            <p className="text-white/55 text-xs sm:text-sm mt-0.5">
              Generá un video con las mejores fotos de {trip?.title || 'tu viaje'}.
            </p>
          </div>
        </div>

        {/* ── Result panel (shown only when done) ── */}
        {phase === 'done' && videoUrl && (
          <div className="mb-8 p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-amber-400/10 border border-emerald-300/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/30 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 text-emerald-200" fill="currentColor" />
              </div>
              <h2 className="text-base font-bold">Tu reel está listo</h2>
              {isMock && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[10px] font-bold uppercase tracking-wider">
                  Demo
                </span>
              )}
            </div>
            <div className={classNames('mx-auto rounded-xl overflow-hidden bg-black', previewBox)}>
              <video
                src={videoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <a
                href={videoUrl}
                download={`${(trip?.title || 'trip-reel').replace(/[^a-z0-9-_]/gi, '_')}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:brightness-110 text-amber-950 font-bold text-sm transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                Descargar MP4
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] text-white/85 font-semibold text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Generar otro
              </button>
            </div>
          </div>
        )}

        {/* ── Progress panel (submit + poll phases) ── */}
        {generating && (
          <div className="mb-8 p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-300/30">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-5 h-5 text-indigo-200 animate-spin" />
              <h2 className="text-base font-bold">{statusText || 'Tu reel se está generando...'}</h2>
            </div>
            <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-300 to-purple-300 transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-white/55 text-[11px] mt-2">
              Esto puede tardar entre 30 segundos y 2 minutos según la duración.
            </p>
          </div>
        )}

        {/* ── Error panel ── */}
        {phase === 'error' && (
          <div className="mb-8 p-4 rounded-2xl bg-rose-500/15 border border-rose-400/40 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-300 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-rose-100 mb-1">No pudimos generar el reel</h3>
              <p className="text-rose-200/85 text-sm break-words">{errorText}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 border border-rose-300/40 text-rose-50 text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* ── Controls (hidden while polling so users don't fiddle) ── */}
        {phase !== 'done' && !generating && (
          <div className="space-y-6">
            {/* Style */}
            <section>
              <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Estilo
              </h2>
              <StyleSelector value={style} onChange={setStyle} />
            </section>

            {/* Aspect + Music in a 2-col row on desktop */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h2 className="text-sm font-bold mb-2">Formato</h2>
                <div className="grid grid-cols-2 gap-2">
                  {(['1:1', '9:16'] as ReelAspect[]).map((a) => {
                    const active = aspect === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAspect(a)}
                        className={classNames(
                          'p-3 rounded-xl border-2 transition-all text-left',
                          active
                            ? 'bg-gradient-to-br from-amber-400/20 to-rose-500/20 border-amber-300/50 text-white'
                            : 'bg-white/[0.04] border-white/[0.08] text-white/75 hover:bg-white/[0.07]',
                        )}
                      >
                        <p className="text-sm font-bold">
                          {a === '1:1' ? 'Cuadrado' : 'Story'}
                        </p>
                        <p className="text-[11px] text-white/55">
                          {a === '1:1' ? '1:1 · Feed' : '9:16 · Reels/Story'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-rose-300" />
                  Música
                </h2>
                <div className="space-y-1.5">
                  {(Object.keys(MUSIC_LIBRARY) as ReelMusic[]).map((m) => {
                    const item = MUSIC_LIBRARY[m];
                    const active = music === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMusic(m)}
                        className={classNames(
                          'w-full text-left p-2.5 rounded-xl border-2 transition-all',
                          active
                            ? 'bg-gradient-to-br from-rose-400/20 to-amber-500/20 border-rose-300/50'
                            : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]',
                        )}
                      >
                        <p className="text-sm font-bold">{item.label}</p>
                        <p className="text-[11px] text-white/55">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Photo picker */}
            <section>
              <h2 className="text-sm font-bold mb-2">Fotos</h2>
              <PhotoPicker
                pool={pool}
                selected={selected}
                onToggle={toggleSelect}
                maxPhotos={MAX_PHOTOS}
              />
            </section>

            {/* Generate CTA */}
            <div className="sticky bottom-4 z-10 flex justify-center pt-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={selected.length < 2}
                className={classNames(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-base transition-all shadow-2xl',
                  selected.length >= 2
                    ? 'bg-gradient-to-r from-amber-400 to-rose-500 hover:brightness-110 text-amber-950'
                    : 'bg-white/10 text-white/40 cursor-not-allowed',
                )}
              >
                <Film className="w-5 h-5" />
                Generar reel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
