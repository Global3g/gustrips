'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { TRIP_STATUS, ROUTES } from '@/config/constants';
import { formatDateES } from '@/lib/utils/helpers';
import type { Trip } from '@/types';

interface TripCardProps {
  trip: Trip;
  index?: number;
}

/** Generate a deterministic gradient from destination string */
function destinationGradient(destination: string): string {
  let hash = 0;
  for (let i = 0; i < destination.length; i++) {
    hash = destination.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 60%, 40%) 0%, hsl(${hue2}, 50%, 25%) 100%)`;
}

export default function TripCard({ trip, index = 0 }: TripCardProps) {
  const status = TRIP_STATUS[trip.status];

  const formatDate = (dateStr: string) => {
    return formatDateES(dateStr);
  };

  const hasCover = !!trip.coverImage;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link href={ROUTES.app.trip(trip.id)} className="block">
        <div
          className="rounded-2xl overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-lg bg-white border border-gray-200"
        >
          {/* Cover / gradient header */}
          <div
            className="h-36 relative overflow-hidden"
            style={
              hasCover
                ? undefined
                : { background: destinationGradient(trip.destination) }
            }
          >
            {hasCover && (
              <Image
                src={trip.coverImage!}
                alt={trip.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                onLoad={() => setImgLoaded(true)}
                className={`object-cover transition-transform duration-500 group-hover:scale-105 ${imgLoaded ? 'img-loaded' : 'img-loading'}`}
              />
            )}

            {/* Dark overlay gradient for text readability on the image */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

            {/* Title and destination over image — white text OK on dark overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white font-semibold text-lg truncate drop-shadow-lg">
                {trip.title}
              </h3>
              <div className="flex items-center gap-1.5 text-white/80 text-sm mt-0.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{trip.destination}</span>
              </div>
            </div>

            {/* Status badge */}
            <div className="absolute top-3 left-4">
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm"
                style={{
                  backgroundColor: `${status.color}25`,
                  color: status.color,
                  border: `1px solid ${status.color}44`,
                }}
              >
                {status.label}
              </span>
            </div>
          </div>

          {/* Card body — light background, dark text */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
              </span>
            </div>

            {trip.description && (
              <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                {trip.description}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
