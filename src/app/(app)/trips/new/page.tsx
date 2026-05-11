'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookHeart, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTrips } from '@/hooks/useTrips';
import { useToast } from '@/context/ToastContext';
import TripForm from '@/components/trips/TripForm';
import { ROUTES } from '@/config/constants';

export default function NewTripPage() {
  const router = useRouter();
  const { trips, createTrip } = useTrips();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (typeof window !== 'undefined' && document.referrer) {
      try {
        const refOrigin = new URL(document.referrer).origin;
        if (refOrigin === window.location.origin) {
          router.back();
          return;
        }
      } catch {
        /* fall through */
      }
    }
    router.push(ROUTES.app.dashboard);
  };

  const handleSubmit = async (data: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    description?: string;
    status: 'planning' | 'active' | 'completed' | 'cancelled';
    coverImage?: string | null;
    travelerIds?: string[];
  }) => {
    try {
      setLoading(true);
      const isFirstTrip = trips.length === 0;
      const tripId = await createTrip({
        title: data.title,
        destination: data.destination,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description || '',
        status: data.status,
        coverImage: data.coverImage ?? null,
        travelerIds: data.travelerIds || [],
      });

      if (isFirstTrip) {
        toast('\ud83c\udf89 \u00a1Tu primer viaje est\u00e1 listo! Ahora agrega tu itinerario', 'success');
      } else {
        toast('Viaje creado exitosamente', 'success');
      }
      router.push(ROUTES.app.trip(tripId));
    } catch (err) {
      console.error('Error al crear viaje:', err);
      toast('Error al crear el viaje', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Volver"
          className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">Nuevo Viaje</h1>
          <p className="text-gray-500 text-sm">Completa los datos para crear tu viaje</p>
        </div>
      </motion.div>

      {/* Alternate path: reconstruct past trip from photos */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Link
          href="/tripshistory/new"
          className="group block rounded-2xl p-4 sm:p-5 border border-fuchsia-300/50 bg-gradient-to-br from-fuchsia-100 via-rose-50 to-amber-50 hover:from-fuchsia-200 hover:via-rose-100 hover:to-amber-100 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center shadow-md shadow-fuchsia-500/20">
              <BookHeart className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-700">
                Tripshistory
              </p>
              <h3 className="text-gray-900 font-bold text-base sm:text-lg leading-tight">
                ¿Tenés fotos de un viaje que ya pasó?
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm mt-0.5">
                Reconstruí el viaje desde tu galería en lugar de cargarlo a mano.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-fuchsia-700 text-sm font-bold whitespace-nowrap">
              <Sparkles className="w-4 h-4" />
              Reconstruir
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            <ArrowRight className="sm:hidden w-5 h-5 text-fuchsia-700 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <TripForm onSubmit={handleSubmit} loading={loading} />
      </motion.div>
    </div>
  );
}
