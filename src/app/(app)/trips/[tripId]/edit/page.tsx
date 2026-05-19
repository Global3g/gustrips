'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import TripForm from '@/components/trips/TripForm';
// Trip comes from the layout-level TripDataProvider.
import { useTripFromContext as useTrip } from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { ROUTES } from '@/config/constants';

export default function EditTripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip, loading, updateTrip } = useTrip();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

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
      setSaving(true);
      await updateTrip({
        title: data.title,
        destination: data.destination,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description ?? '',
        status: data.status,
        coverImage: data.coverImage ?? null,
        travelerIds: data.travelerIds ?? trip?.travelerIds ?? [],
      });
      toast('Viaje actualizado', 'success');
      router.push(ROUTES.app.trip(tripId));
    } catch (err) {
      console.error('Error updating trip:', err);
      toast('Error al guardar los cambios', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/70">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando viaje...
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center text-white/80">
        <p className="mb-4">No encontramos este viaje.</p>
        <Link
          href={ROUTES.app.dashboard}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 pb-32 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={ROUTES.app.trip(tripId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/85 hover:text-white text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al viaje
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">
          Editar viaje
        </h1>
        <p className="text-white/70 text-sm mb-6">
          Cambiá los datos básicos. Itinerario, fotos y gastos se mantienen.
        </p>

        <TripForm
          initialData={trip}
          onSubmit={handleSubmit}
          loading={saving}
        />
      </motion.div>
    </div>
  );
}
