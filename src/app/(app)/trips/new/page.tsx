'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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

  // Same reasoning as /trips/[tripId]/layout — router.back() is unreliable
  // when there's no usable history. Always go to the dashboard.
  const handleBack = () => {
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
        toast('🎉 ¡Tu primer viaje está listo! Ahora agrega tu itinerario', 'success');
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
          className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors border border-white/[0.06]"
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </button>
        <div>
          <h1 className="text-white text-2xl font-bold">Nuevo viaje</h1>
          <p className="text-white/55 text-sm">Cargá título, destino, fechas y construí el itinerario.</p>
        </div>
      </motion.div>

      <TripForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
