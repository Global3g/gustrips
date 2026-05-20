'use client';

import { motion } from 'framer-motion';
import { Clock, MapPin, Camera } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Event } from '@/features/tripshistory/types';

interface EventCardProps {
  event: Event;
  thumbnailById?: Record<string, string>;
}

/**
 * Storyboard event card — title, time range, location, photo grid.
 * thumbnailById maps photoId -> thumbnailUrl for rendering.
 */
export default function EventCard({ event, thumbnailById }: EventCardProps) {
  const timeRange = (() => {
    if (!event.startTime) return null;
    try {
      const start = format(parseISO(event.startTime), 'HH:mm');
      if (!event.endTime) return start;
      const end = format(parseISO(event.endTime), 'HH:mm');
      return `${start} — ${end}`;
    } catch {
      return null;
    }
  })();

  const photoIds = event.photoIds ?? [];
  const highlights = new Set(event.highlightPhotoIds ?? []);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 hover:border-white/[0.14] transition-colors"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white truncate">
            {event.title || 'Evento sin nombre'}
          </h3>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-white/70">
            {timeRange && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-300" />
                {timeRange}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                <MapPin className="w-3 h-3 text-rose-300" />
                {event.location}
              </span>
            )}
          </div>
        </div>
        {photoIds.length > 0 && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-white/85 bg-white/[0.06] rounded-full px-2.5 py-1 border border-white/[0.08]">
            <Camera className="w-3 h-3" />
            {photoIds.length}
          </span>
        )}
      </header>

      {photoIds.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {photoIds.slice(0, 12).map((pid) => {
            const src = thumbnailById?.[pid];
            const isHighlight = highlights.has(pid);
            return (
              <div
                key={pid}
                className={`relative aspect-square rounded-lg overflow-hidden border ${
                  isHighlight ? 'border-amber-400/50' : 'border-white/[0.06]'
                } bg-white/[0.03]`}
              >
                {src ? (
                  // Use plain <img> — these are Storage URLs already optimized.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                )}
              </div>
            );
          })}
          {photoIds.length > 12 && (
            <div className="aspect-square rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[11px] font-bold text-white/80">
              +{photoIds.length - 12}
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
