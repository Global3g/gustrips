'use client';

import Link from 'next/link';
import { Plane, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTrips } from '@/hooks/useTrips';
import TripCard from '@/components/trips/TripCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ROUTES } from '@/config/constants';
import { glassStyle } from '@/lib/utils/helpers';

function TripCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={glassStyle}>
      <div className="h-28 bg-white/5" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-white/10 rounded-lg w-3/4" />
        <div className="h-4 bg-white/5 rounded-lg w-1/2" />
        <div className="h-3 bg-white/5 rounded-lg w-2/3" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { trips, loading, error } = useTrips();

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
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Plane className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">Mis Viajes</h1>
            <p className="text-white/50 text-sm">
              {trips.length > 0
                ? `${trips.length} viaje${trips.length !== 1 ? 's' : ''}`
                : 'Organiza tu proximo viaje'}
            </p>
          </div>
        </div>

        <Link
          href={ROUTES.app.newTrip}
          className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo Viaje</span>
        </Link>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-400/20 p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && trips.length === 0 && !error && (
        <EmptyState
          icon={Plane}
          title="Sin viajes aun"
          description="Crea tu primer viaje y comienza a organizar tu aventura."
          action={
            <Link
              href={ROUTES.app.newTrip}
              className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Viaje
            </Link>
          }
        />
      )}

      {/* Trip grid */}
      {!loading && trips.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {trips.map((trip, index) => (
            <TripCard key={trip.id} trip={trip} index={index} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
