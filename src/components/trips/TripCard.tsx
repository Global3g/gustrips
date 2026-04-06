'use client';

import Link from 'next/link';
import { MapPin, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TRIP_STATUS, ROUTES } from '@/config/constants';
import { glassStyle } from '@/lib/utils/helpers';
import type { Trip } from '@/types';

interface TripCardProps {
  trip: Trip;
  index?: number;
}

export default function TripCard({ trip, index = 0 }: TripCardProps) {
  const status = TRIP_STATUS[trip.status];

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "d MMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link href={ROUTES.app.trip(trip.id)} className="block">
        <div
          className="rounded-2xl overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-xl"
          style={glassStyle}
        >
          {/* Cover gradient */}
          <div className="h-28 bg-gradient-to-br from-blue-500/40 via-purple-500/30 to-teal-500/20 relative">
            <div className="absolute bottom-3 left-4">
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
          </div>

          {/* Card body */}
          <div className="p-5">
            <h3 className="text-white font-semibold text-lg mb-1 truncate">
              {trip.title}
            </h3>

            <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>

            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
              </span>
            </div>

            {trip.description && (
              <p className="text-white/40 text-xs mt-3 line-clamp-2">
                {trip.description}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
