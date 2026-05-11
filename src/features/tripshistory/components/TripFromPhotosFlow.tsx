'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Sparkles,
  Camera,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import { format } from 'date-fns';
import PhotoSelector from '@/features/tripshistory/components/PhotoSelector';
import {
  createStory,
  uploadPhotoBatch,
  getAnalysisState,
  getStory,
  convertStoryToTrip,
} from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { PhotoMetadata, Story } from '@/features/tripshistory/types';

const MAX_PHOTOS_PER_BATCH = 100;
const ANALYSIS_POLL_MS = 2000;
const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;

type FlowStep =
  | 'pick' // user is picking the title + photos
  | 'creating-story' // POST /stories
  | 'uploading' // sending batches to engine
  | 'analyzing' // polling /analysis
  | 'converting' // POST /stories/:id:convert-to-trip
  | 'redirecting' // success — about to push to /trips/:id
  | 'error';

interface TripFromPhotosFlowProps {
  /** Called by parent to switch back to manual mode. */
  onSwitchToManual?: () => void;
}

function defaultTitle(): string {
  return `Viaje desde fotos · ${format(new Date(), 'dd/MM/yyyy')}`;
}

/**
 * One-flow "Empezar desde fotos":
 *   1. Create a draft Story (so we have a storyId before uploading).
 *   2. Render PhotoSelector — it handles upload to Storage + returns metadata.
 *   3. POST the metadata to /stories/:id/photos:batch.
 *   4. Poll /stories/:id/analysis until the engine flips status to
 *      `questioning` or `ready` (i.e. clustering finished).
 *   5. POST /stories/:id:convert-to-trip to materialize the Trip.
 *   6. Redirect to /trips/:newTripId?fromPhotos=1.
 *
 * Errors at any step show a retry surface that doesn't lose the user's
 * uploaded photos — the story still exists and can be resumed later.
 */
export default function TripFromPhotosFlow({ onSwitchToManual }: TripFromPhotosFlowProps) {
  const router = useRouter();

  const [step, setStep] = useState<FlowStep>('pick');
  const [title, setTitle] = useState<string>(defaultTitle());
  const [story, setStory] = useState<Story | null>(null);
  const [expectedCount, setExpectedCount] = useState<number>(0);
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Used to guard against race conditions while polling.
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  const isBusy =
    step === 'creating-story' ||
    step === 'uploading' ||
    step === 'analyzing' ||
    step === 'converting' ||
    step === 'redirecting';

  /* ── Step A: create the story so we have a storyId for PhotoSelector ── */

  const ensureStory = useCallback(async (): Promise<Story | null> => {
    if (story) return story;
    setStep('creating-story');
    setErrorMsg(null);
    try {
      const created = await createStory({
        title: title.trim() || defaultTitle(),
      });
      setStory(created);
      return created;
    } catch (err) {
      const msg =
        err instanceof TripshistoryError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No pudimos preparar el viaje.';
      setErrorMsg(msg);
      setStep('error');
      return null;
    }
  }, [story, title]);

  // Eagerly create the story when the user lands on the photos flow so the
  // first PhotoSelector mount can begin uploading immediately. Cheap, safe
  // to retry if it fails (handled below).
  useEffect(() => {
    if (story || step !== 'pick') return;
    void ensureStory().then(() => {
      // Stay on 'pick' after a successful pre-create.
      if (!cancelledRef.current) setStep('pick');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Step B: PhotoSelector finished processing files ── */

  const handlePhotosReady = useCallback(
    async (photos: PhotoMetadata[]) => {
      if (photos.length === 0) return;
      const s = story ?? (await ensureStory());
      if (!s) return; // ensureStory already surfaced the error

      setExpectedCount(photos.length);
      setUploadedCount(0);
      setErrorMsg(null);
      setStep('uploading');

      try {
        for (let i = 0; i < photos.length; i += MAX_PHOTOS_PER_BATCH) {
          const slice = photos.slice(i, i + MAX_PHOTOS_PER_BATCH);
          const res = await uploadPhotoBatch(s.id, { photos: slice });
          if (cancelledRef.current) return;
          setUploadedCount((prev) => prev + (res.photosReceived || slice.length));
        }
      } catch (err) {
        const msg =
          err instanceof TripshistoryError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'No pudimos enviar las fotos al motor.';
        setErrorMsg(msg);
        setStep('error');
        return;
      }

      // Hand off to the analyzer.
      setStep('analyzing');
    },
    [story, ensureStory],
  );

  /* ── Step C: poll analysis state until ready ── */

  useEffect(() => {
    if (step !== 'analyzing' || !story) return;

    let cancelled = false;
    const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        // Prefer story.status since it advances strictly: draft → analyzing →
        // questioning → ready. analysis.lastAnalyzedAt also works but is
        // softer (it ticks on every re-analysis pass).
        const fresh = await getStory(story.id);
        if (cancelled) return;
        if (fresh.status === 'questioning' || fresh.status === 'ready' || fresh.status === 'finalized') {
          setStory(fresh);
          setStep('converting');
          return;
        }
        // Fallback signal: analysis state has a non-zero lastAnalyzedAt.
        const a = await getAnalysisState(story.id);
        if (cancelled) return;
        if (
          a.lastAnalyzedAt &&
          a.photoCount >= Math.max(1, expectedCount * 0.9)
        ) {
          setStory(fresh);
          setStep('converting');
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // Soft-fail single tick — keep polling.
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn('[TripFromPhotosFlow] analysis poll error', err);
        }
      }

      if (Date.now() > deadline) {
        setErrorMsg('El análisis está tardando más de lo normal. Probá de nuevo en un momento.');
        setStep('error');
        return;
      }
      window.setTimeout(tick, ANALYSIS_POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [step, story, expectedCount]);

  /* ── Step D: convert to trip ── */

  useEffect(() => {
    if (step !== 'converting' || !story) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await convertStoryToTrip(story.id, {
          title: title.trim() || defaultTitle(),
        });
        if (cancelled) return;
        setStep('redirecting');
        router.push(`/trips/${res.tripId}?fromPhotos=1`);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof TripshistoryError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'No pudimos crear tu viaje a partir de la historia.';
        setErrorMsg(msg);
        setStep('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, story, router, title]);

  /* ── Retry logic ── */

  const handleRetry = useCallback(() => {
    setErrorMsg(null);
    if (!story) {
      setStep('pick');
      return;
    }
    // Re-enter the latest step we were on. If we already uploaded, jump
    // to analyzing. Otherwise let the user reselect photos.
    if (uploadedCount > 0 && uploadedCount >= expectedCount) {
      setStep('analyzing');
    } else if (uploadedCount > 0) {
      // Partial upload — easiest path is to re-trigger analysis.
      setStep('analyzing');
    } else {
      setStep('pick');
    }
  }, [story, uploadedCount, expectedCount]);

  /* ── UI ── */

  return (
    <div className="space-y-5">
      {/* Title input + helper */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-sm">
        <label htmlFor="trip-from-photos-title" className="block text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/80 mb-2">
          Título del viaje
        </label>
        <input
          id="trip-from-photos-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isBusy}
          placeholder={defaultTitle()}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/40 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30 disabled:opacity-50"
        />
        <p className="text-[11px] text-white/55 mt-2">
          Lo podés cambiar después. Pongamos algo lindo cuando termine.
        </p>
      </div>

      {/* Picker — visible only on 'pick' or after error from pick. */}
      <AnimatePresence mode="wait">
        {step === 'pick' || step === 'creating-story' ? (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {story ? (
              <PhotoSelector
                storyId={story.id}
                onPhotosReady={handlePhotosReady}
                disabled={isBusy}
              />
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-amber-300 mx-auto" />
                <p className="text-white/70 text-sm mt-3">Preparando tu viaje...</p>
              </div>
            )}

            {onSwitchToManual && (
              <p className="text-center text-[11px] text-white/40">
                ¿Preferís el formulario clásico?{' '}
                <button
                  type="button"
                  onClick={onSwitchToManual}
                  className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                >
                  Cargá los datos a mano
                </button>
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Progress card — covers upload + analyze + convert */}
      <AnimatePresence>
        {(step === 'uploading' || step === 'analyzing' || step === 'converting' || step === 'redirecting') && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-[#152339] to-[#1c2f4f] p-6 sm:p-8 text-center shadow-2xl shadow-black/30"
          >
            <ProgressIcon step={step} />
            <h2 className="mt-4 text-white text-xl sm:text-2xl font-bold tracking-tight">
              {step === 'uploading' && `Subiendo ${uploadedCount} de ${expectedCount} fotos...`}
              {step === 'analyzing' && 'Analizando agrupamiento...'}
              {step === 'converting' && 'Creando tu viaje...'}
              {step === 'redirecting' && '¡Listo! Llevándote al viaje...'}
            </h2>
            <p className="text-white/60 text-sm mt-2 max-w-md mx-auto">
              {step === 'uploading' && 'Estamos enviando la metadata al motor — esto es rápido.'}
              {step === 'analyzing' && 'Detectando días, eventos y agrupando fotos por momento. Suele tardar unos segundos.'}
              {step === 'converting' && 'Materializando tu viaje con días y eventos. Casi.'}
              {step === 'redirecting' && 'Vamos a abrir tu viaje. Podés ir respondiendo las preguntas desde ahí.'}
            </p>

            {/* Mini progress bar */}
            <div className="mt-5 mx-auto max-w-md">
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500"
                  initial={{ width: 0 }}
                  animate={{
                    width:
                      step === 'uploading'
                        ? `${expectedCount > 0 ? Math.min(100, (uploadedCount / expectedCount) * 80) : 10}%`
                        : step === 'analyzing'
                          ? '88%'
                          : step === 'converting'
                            ? '95%'
                            : '100%',
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-amber-300/80 font-bold">
                <Step active={step === 'uploading'} done={step !== 'uploading'} label="Subir" />
                <Dot />
                <Step
                  active={step === 'analyzing'}
                  done={step === 'converting' || step === 'redirecting'}
                  label="Analizar"
                />
                <Dot />
                <Step
                  active={step === 'converting'}
                  done={step === 'redirecting'}
                  label="Crear"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error surface */}
      <AnimatePresence>
        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 backdrop-blur-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-200" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-base">Algo se trabó</h3>
                <p className="text-white/70 text-sm mt-0.5">
                  {errorMsg || 'No pudimos avanzar con el viaje.'}
                </p>
                {story && (
                  <p className="text-white/50 text-[11px] mt-1.5">
                    Tus fotos ya están guardadas. Podés reintentar sin volver a subir nada.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white text-sm font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-shadow"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reintentar
                  </button>
                  {onSwitchToManual && (
                    <button
                      type="button"
                      onClick={onSwitchToManual}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/75 hover:text-white text-sm font-semibold border border-white/[0.1] transition-colors"
                    >
                      Cargar a mano
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Tiny progress chrome ─────────────────────────── */

function ProgressIcon({ step }: { step: FlowStep }) {
  if (step === 'uploading') {
    return (
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 border border-amber-400/20 flex items-center justify-center">
        <Camera className="w-7 h-7 text-amber-300" />
      </div>
    );
  }
  if (step === 'analyzing') {
    return (
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 border border-amber-400/20 flex items-center justify-center">
        <Wand2 className="w-7 h-7 text-amber-300" />
      </div>
    );
  }
  if (step === 'converting') {
    return (
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 border border-amber-400/20 flex items-center justify-center">
        <Sparkles className="w-7 h-7 text-amber-300" />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400/30 to-emerald-500/20 border border-emerald-400/20 flex items-center justify-center">
      <CheckCircle2 className="w-7 h-7 text-emerald-300" />
    </div>
  );
}

function Step({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? 'text-amber-200'
          : done
            ? 'text-emerald-300/85'
            : 'text-white/30'
      }
    >
      {label}
    </span>
  );
}

function Dot() {
  return <span className="text-white/15">·</span>;
}
