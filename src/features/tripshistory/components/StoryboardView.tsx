'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookHeart, Camera, Calendar, MapPin } from 'lucide-react';
import DayCard from '@/features/tripshistory/components/DayCard';
import UnassignedPhotos from '@/features/tripshistory/components/UnassignedPhotos';
import type { Storyboard } from '@/features/tripshistory/types';

interface StoryboardViewProps {
  storyboard: Storyboard;
  thumbnailById?: Record<string, string>;
  /**
   * Optional content rendered at the very top of the storyboard, above
   * the hero header. Used by callers to surface story-level actions
   * (e.g. "Convertir en viaje" when a standalone story is ready).
   */
  banner?: React.ReactNode;
}

/**
 * Final storyboard view: header + days + unassigned photos.
 */
export default function StoryboardView({
  storyboard,
  thumbnailById,
  banner,
}: StoryboardViewProps) {
  const { story, days, unassignedPhotoCount } = storyboard;

  const totals = useMemo(() => {
    const dayCount = days.length;
    let eventCount = 0;
    let photoCount = 0;
    for (const d of days) {
      eventCount += d.events?.length ?? 0;
      photoCount += d.photoCount ?? 0;
    }
    return { dayCount, eventCount, photoCount };
  }, [days]);

  return (
    <div className="space-y-6">
      {/* Optional top banner (e.g. convert-to-trip CTA) */}
      {banner}

      {/* Hero header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0d1b2e] via-[#1e3a5f] to-[#28406a] p-6 sm:p-8 shadow-2xl shadow-black/30"
      >
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
          <BookHeart className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
            Tu historia
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {story.title || 'Historia sin título'}
        </h1>

        <div className="mt-5 flex flex-wrap gap-3">
          <Pill icon={<Calendar className="w-3.5 h-3.5" />}>
            {totals.dayCount} {totals.dayCount === 1 ? 'día' : 'días'}
          </Pill>
          <Pill icon={<MapPin className="w-3.5 h-3.5" />}>
            {totals.eventCount} {totals.eventCount === 1 ? 'evento' : 'eventos'}
          </Pill>
          <Pill icon={<Camera className="w-3.5 h-3.5" />}>
            {totals.photoCount} {totals.photoCount === 1 ? 'foto' : 'fotos'}
          </Pill>
        </div>
      </motion.header>

      {/* Unassigned warning */}
      {unassignedPhotoCount !== undefined && unassignedPhotoCount > 0 && (
        <UnassignedPhotos count={unassignedPhotoCount} />
      )}

      {/* Days */}
      {days.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-10 text-center">
          <p className="text-white/70">
            Todavía no hay días en esta historia. Subí más fotos o respondé las
            preguntas pendientes.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((day) => {
            const coverUrl = day.coverPhotoId
              ? thumbnailById?.[day.coverPhotoId]
              : undefined;
            return (
              <DayCard
                key={day.id}
                day={day}
                thumbnailById={thumbnailById}
                coverUrl={coverUrl}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-white">
      <span className="text-amber-300">{icon}</span>
      {children}
    </span>
  );
}
