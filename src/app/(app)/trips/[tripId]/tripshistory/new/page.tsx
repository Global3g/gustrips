'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookHeart, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { tripshistoryApi, TripshistoryError } from '@/features/tripshistory';
import { useTrip } from '@/hooks/useTrip';

/**
 * Entry point to create a new Tripshistory story tied to this trip.
 * Creates the story immediately and redirects to the wizard.
 */
export default function NewTripshistoryPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip } = useTrip(tripId);
  const [error, setError] = useState<string | null>(null);
  const createdRef = useRef(false);

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const story = await tripshistoryApi.createStory({
          tripId,
          title: trip?.title,
          approximateDates:
            trip?.startDate && trip?.endDate
              ? { start: trip.startDate, end: trip.endDate }
              : undefined,
        });
        if (cancelled) return;
        router.replace(`/trips/${tripId}/tripshistory/${story.id}`);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof TripshistoryError
            ? e.message
            : 'No pudimos crear la historia. Intentá de nuevo en un momento.';
        setError(msg);
        createdRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId, trip?.title, trip?.startDate, trip?.endDate, router]);

  return (
    <div className="p-3 sm:p-6 pb-32 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#1a1230] via-[#2a1640] to-[#3a1f55] p-8 sm:p-12 shadow-2xl shadow-black/30 text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-rose-500/20 border border-fuchsia-400/20 mb-5">
          <BookHeart className="w-8 h-8 text-fuchsia-300" />
        </div>

        {error ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-200">
                No se pudo crear
              </span>
            </div>
            <p className="text-white/85 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-6">
              {error}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href={`/trips/${tripId}/tripshistory`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Link>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  createdRef.current = false;
                  router.refresh();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white font-bold shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 transition-shadow"
              >
                Reintentar
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Creando tu historia...
            </h1>
            <p className="mt-3 text-white/75 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              Estamos preparando todo para que puedas reconstruir este viaje desde
              tus fotos.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-white/70 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Un momento...
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
