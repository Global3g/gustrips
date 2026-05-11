'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plane, Sparkles, X } from 'lucide-react';
import {
  TripshistoryError,
  tripshistoryApi,
} from '@/features/tripshistory';
import { useToast } from '@/context/ToastContext';
import type { Story } from '@/features/tripshistory/types';

interface ConvertToTripBannerProps {
  story: Story;
}

/**
 * Banner shown on top of the storyboard when a standalone story (no
 * tripId) is finished. Lets the user promote the reconstructed story
 * into a real GusTrips Trip via POST /stories/{id}:convert-to-trip.
 */
export default function ConvertToTripBanner({ story }: ConvertToTripBannerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string>(story.title ?? '');
  const [destination, setDestination] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    // If the story is already attached to a trip (shouldn't usually be the
    // case because the page hides this banner then, but defensive), just go.
    if (story.tripId) {
      router.push(`/trips/${story.tripId}`);
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Necesitamos un título para el viaje.');
      return;
    }
    setLoading(true);
    setError(null);
    console.info('[Tripshistory] convertToTrip start', {
      storyId: story.id,
      title: trimmedTitle,
    });
    try {
      const result = await tripshistoryApi.convertToTrip(story.id, {
        title: trimmedTitle,
        destination: destination.trim() || undefined,
      });
      console.info('[Tripshistory] convertToTrip ok', result);
      toast('Viaje creado. Te llevamos a la ficha.', 'success');
      router.push(`/trips/${result.tripId}`);
    } catch (err) {
      console.error('[Tripshistory] convertToTrip failed', err);
      const msg =
        err instanceof TripshistoryError
          ? `${err.message} (${err.code || 'error'} ${err.status || ''})`.trim()
          : err instanceof Error
            ? err.message
            : 'No pudimos convertir la historia. Probá de nuevo.';
      setError(msg);
      toast(msg, 'error');
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-fuchsia-500/15 p-5 sm:p-6 shadow-xl shadow-amber-500/10"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/30 border border-white/[0.08] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-amber-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
              Casi listo
            </p>
            <h3 className="text-white font-bold text-lg leading-snug">
              Esta historia todavía no es un viaje en GusTrips.
            </h3>
            <p className="mt-1 text-white/75 text-sm">
              ¿Querés convertirla en un viaje real con álbum y eventos?
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setError(null);
              setTitle(story.title ?? '');
              setOpen(true);
              console.info('[Tripshistory] convert banner clicked');
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-shadow whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Convirtiendo...
              </>
            ) : (
              <>
                <Plane className="w-4 h-4" />
                Convertir en viaje
              </>
            )}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => {
              if (!loading) setOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="w-full sm:max-w-md rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0d1b2e] via-[#1e3a5f] to-[#28406a] p-6 shadow-2xl shadow-black/40 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  if (!loading) setOpen(false);
                }}
                aria-label="Cerrar"
                className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
                <Plane className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                  Convertir en viaje
                </span>
              </div>

              <h3 className="text-white font-bold text-xl tracking-tight">
                Confirmá los datos del viaje
              </h3>
              <p className="mt-1.5 text-white/65 text-sm">
                Esto creará un viaje real en tu cuenta con el álbum y los
                eventos detectados. Podés cambiar el resto desde el viaje.
              </p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55 mb-1.5">
                    Título del viaje
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Italia 2023"
                    disabled={loading}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/35 bg-white/[0.04] border border-white/[0.1] outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55 mb-1.5">
                    Destino (opcional)
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ej. Roma, Florencia, Venecia"
                    disabled={loading}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/35 bg-white/[0.04] border border-white/[0.1] outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-3 text-sm text-rose-300/90">{error}</p>
              )}

              <div className="mt-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading || title.trim().length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white font-bold text-sm shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Convirtiendo...
                    </>
                  ) : (
                    <>
                      <Plane className="w-4 h-4" />
                      Crear viaje
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
