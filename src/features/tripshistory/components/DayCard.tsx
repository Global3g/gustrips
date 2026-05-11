'use client';

import { motion } from 'framer-motion';
import { CalendarDays, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import EventCard from '@/features/tripshistory/components/EventCard';
import type { StoryboardDay } from '@/features/tripshistory/types';

interface DayCardProps {
  day: StoryboardDay;
  thumbnailById?: Record<string, string>;
  coverUrl?: string;
}

/**
 * One day in the storyboard. Shows cover photo, title/summary, events grid.
 */
export default function DayCard({ day, thumbnailById, coverUrl }: DayCardProps) {
  const dayLabel = (() => {
    try {
      return format(parseISO(day.date), "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return day.date;
    }
  })();
  const capitalizedLabel =
    dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0e1b30] to-[#152339] overflow-hidden shadow-xl shadow-black/30"
    >
      {/* Cover */}
      {coverUrl ? (
        <div className="relative h-44 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1b30] via-[#0e1b30]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/[0.08]">
              <CalendarDays className="w-3 h-3 text-amber-300" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/85">
                {capitalizedLabel}
              </span>
            </div>
            {day.title && (
              <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">
                {day.title}
              </h2>
            )}
            {day.primaryLocation && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/85">
                <MapPin className="w-3.5 h-3.5 text-rose-300" />
                {day.primaryLocation}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-5 pt-5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            <CalendarDays className="w-3 h-3 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/85">
              {capitalizedLabel}
            </span>
          </div>
          {day.title && (
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white">
              {day.title}
            </h2>
          )}
          {day.primaryLocation && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/70">
              <MapPin className="w-3.5 h-3.5 text-rose-300" />
              {day.primaryLocation}
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      {day.summary && (
        <p className="px-5 pt-4 text-sm text-white/75 leading-relaxed">
          {day.summary}
        </p>
      )}

      {/* Events */}
      <div className="p-5 space-y-3">
        {day.events && day.events.length > 0 ? (
          day.events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              thumbnailById={thumbnailById}
            />
          ))
        ) : (
          <p className="text-sm text-white/60 italic text-center py-4">
            Sin eventos asignados en este día.
          </p>
        )}
      </div>
    </motion.section>
  );
}
