'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
        <Link
          href={ROUTES.app.dashboard}
          className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">Nuevo Viaje</h1>
          <p className="text-gray-500 text-sm">Completa los datos para crear tu viaje</p>
        </div>
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
