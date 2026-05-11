'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookHeart,
  Sparkles,
  ArrowRight,
  Camera,
  Loader2,
  Plus,
  ChevronRight,
  CalendarDays,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react';
import { useStoriesByTrip } from '@/features/tripshistory/hooks/useStoriesByTrip';
import type { Story, StoryStatus } from '@/features/tripshistory/types';

/**
 * Tripshistory home for a trip.
 *
 * If the trip already has at least one story, we list those stories
 * (linking to /tripshistory/{storyId}) and offer a smaller "Crear nueva
 * historia" affordance. Otherwise we show the hero CTA to start one.
 */
export default function TripshistoryHomePage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { stories, loading, error } = useStoriesByTrip(tripId);

  if (loading) {
    return (
      <div className="p-3 sm:p-6 pb-32 max-w-3xl mx-auto">
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0d1b2e] via-[#1e3a5f] to-[#28406a] p-10 flex items-center justify-center min-h-[200px] shadow-2xl shadow-black/30">
          <Loader2 className="w-6 h-6 text-amber-300 animate-spin" />
        </div>
      </div>
    );
  }

  if (stories.length > 0) {
    return (
      <div className="p-3 sm:p-6 pb-32 max-w-3xl mx-auto">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0d1b2e] via-[#1e3a5f] to-[#28406a] p-6 sm:p-8 shadow-2xl shadow-black/30"
        >
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
            <BookHeart className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
              Historias del viaje
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {stories.length === 1
              ? 'Tenés una historia armada'
              : `Tenés ${stories.length} historias armadas`}
          </h1>
          <p className="mt-2 text-white/70 text-sm">
            Seguí donde lo dejaste o empezá una nueva.
          </p>

          <ul className="mt-6 space-y-3">
            {stories.map((story, idx) => (
              <StoryListItem
                key={story.id}
                story={story}
                tripId={tripId}
                index={idx}
              />
            ))}
          </ul>

          <div className="mt-6">
            <Link
              href={`/trips/${tripId}/tripshistory/new`}
              className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear nueva historia
            </Link>
          </div>

          {error ? (
            <p className="mt-4 text-xs text-rose-300/80">
              No pudimos cargar todas las historias. Probá recargar la página.
            </p>
          ) : null}
        </motion.section>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 pb-32 max-w-3xl mx-auto">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0d1b2e] via-[#1e3a5f] to-[#28406a] p-6 sm:p-10 shadow-2xl shadow-black/30"
      >
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
          <BookHeart className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
            Historia del viaje
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Reconstruí este viaje desde tus fotos
        </h1>
        <p className="mt-4 text-white/75 text-sm sm:text-base max-w-xl leading-relaxed">
          Subí tus fotos y dejá que el motor agrupe los días, detecte los
          eventos y te haga las preguntas justas para armar la historia
          completa.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FeatureChip icon={<Camera className="w-4 h-4" />} label="Análisis automático" />
          <FeatureChip icon={<Sparkles className="w-4 h-4" />} label="Preguntas inteligentes" />
          <FeatureChip icon={<BookHeart className="w-4 h-4" />} label="Storyboard navegable" />
        </div>

        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/trips/${tripId}/tripshistory/new`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-shadow"
          >
            <Sparkles className="w-4 h-4" />
            Crear historia
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/photos`)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold transition-colors"
          >
            Ver fotos del viaje
          </button>
        </div>
      </motion.section>
    </div>
  );
}

function FeatureChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 flex items-center gap-2">
      <span className="text-amber-300">{icon}</span>
      <span className="text-sm font-semibold text-white">{label}</span>
    </div>
  );
}

const STATUS_LABEL: Record<StoryStatus, string> = {
  draft: 'Borrador',
  analyzing: 'Analizando',
  questioning: 'Respondiendo preguntas',
  ready: 'Lista',
  finalized: 'Finalizada',
};

const STATUS_CLASS: Record<StoryStatus, string> = {
  draft: 'bg-white/[0.06] text-white/70 border-white/[0.08]',
  analyzing: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  questioning: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  ready: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  finalized: 'bg-violet-500/15 text-violet-200 border-violet-400/30',
};

function StoryListItem({
  story,
  tripId,
  index,
}: {
  story: Story;
  tripId: string;
  index: number;
}) {
  const photoCount = story.photoCount ?? 0;
  const dayCount = story.dayCount ?? 0;
  const eventCount = story.eventCount ?? 0;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 * index, ease: 'easeOut' }}
    >
      <Link
        href={`/trips/${tripId}/tripshistory/${story.id}`}
        className="group flex items-center gap-4 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-colors"
      >
        <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/30 to-rose-500/30 border border-white/[0.08] flex items-center justify-center">
          <BookHeart className="w-5 h-5 text-amber-200" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-bold text-base truncate">
              {story.title?.trim() || 'Historia sin título'}
            </h3>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_CLASS[story.status]}`}
            >
              {STATUS_LABEL[story.status]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
            </span>
            {dayCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {dayCount} {dayCount === 1 ? 'día' : 'días'}
              </span>
            ) : null}
            {eventCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {eventCount} {eventCount === 1 ? 'evento' : 'eventos'}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
      </Link>
    </motion.li>
  );
}
