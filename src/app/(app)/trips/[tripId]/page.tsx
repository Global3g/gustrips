'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Pencil,
  X,
  Users,
  FileText,
  CheckSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTrip } from '@/hooks/useTrip';
import { useToast } from '@/context/ToastContext';
import TripForm from '@/components/trips/TripForm';
import { TRIP_STATUS, ROUTES } from '@/config/constants';
import { TRIP_NAV_ITEMS } from '@/config/navigation';
import { glassStyle, classNames } from '@/lib/utils/helpers';

const NAV_ICONS: Record<string, typeof MapPin> = {
  MapPin,
  Calendar,
  Users,
  FileText,
  CheckSquare,
};

function TripDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/10 rounded-xl" />
        <div className="space-y-2">
          <div className="h-6 bg-white/10 rounded-lg w-48" />
          <div className="h-4 bg-white/5 rounded-lg w-32" />
        </div>
      </div>
      <div className="rounded-2xl p-6 space-y-4" style={glassStyle}>
        <div className="h-5 bg-white/10 rounded-lg w-3/4" />
        <div className="h-4 bg-white/5 rounded-lg w-1/2" />
        <div className="h-4 bg-white/5 rounded-lg w-2/3" />
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip, loading, updateTrip } = useTrip(tripId);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <TripDetailSkeleton />;
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <p className="text-white/60 text-lg">Viaje no encontrado</p>
        <Link
          href={ROUTES.app.dashboard}
          className="text-blue-400 hover:text-blue-300 text-sm mt-4 inline-block"
        >
          Volver al dashboard
        </Link>
      </div>
    );
  }

  const status = TRIP_STATUS[trip.status];

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "d 'de' MMMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const handleUpdate = async (data: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    description?: string;
    status: 'planning' | 'active' | 'completed' | 'cancelled';
  }) => {
    try {
      setSaving(true);
      await updateTrip({
        title: data.title,
        destination: data.destination,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description || '',
        status: data.status,
      });
      toast('Viaje actualizado', 'success');
      setEditing(false);
    } catch (err) {
      console.error('Error al actualizar viaje:', err);
      toast('Error al actualizar el viaje', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.app.dashboard}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-white text-2xl font-bold">{trip.title}</h1>
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <MapPin className="w-3.5 h-3.5" />
              <span>{trip.destination}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setEditing(!editing)}
          className={classNames(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
            editing
              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
              : 'bg-white/10 hover:bg-white/15 text-white',
          )}
        >
          {editing ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
        </button>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div
          className="rounded-xl overflow-x-auto scrollbar-none"
          style={glassStyle}
        >
          <nav className="flex min-w-max">
            {TRIP_NAV_ITEMS.map((item) => {
              const href = item.href
                ? ROUTES.app.trip(tripId) + item.href
                : ROUTES.app.trip(tripId);
              const isActive = item.href === '';
              const Icon = NAV_ICONS[item.icon] || MapPin;

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={classNames(
                    'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap relative',
                    isActive
                      ? 'text-blue-400'
                      : 'text-white/50 hover:text-white/80',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="trip-tab-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-400 rounded-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </motion.div>

      {/* Content: View or Edit */}
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <TripForm
              initialData={trip}
              onSubmit={handleUpdate}
              loading={saving}
            />
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Trip Info Card */}
            <div className="rounded-2xl p-6" style={glassStyle}>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: `${status.color}22`,
                    color: status.color,
                    border: `1px solid ${status.color}44`,
                  }}
                >
                  {status.label}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-3 text-white/70">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Destino</p>
                    <p className="text-white text-sm font-medium">{trip.destination}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-white/70">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Fechas</p>
                    <p className="text-white text-sm font-medium">
                      {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                    </p>
                  </div>
                </div>
              </div>

              {trip.description && (
                <div className="pt-4 border-t border-white/10">
                  <p className="text-white/40 text-xs mb-1">Descripcion</p>
                  <p className="text-white/70 text-sm leading-relaxed">
                    {trip.description}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
