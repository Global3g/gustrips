'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookHeart, Sparkles, ArrowRight, Camera } from 'lucide-react';

/**
 * Tripshistory home for a trip.
 *
 * MVP behavior: until the engine is live and we can list stories by tripId,
 * this page shows a CTA to start a new story. Once a story exists, the user
 * is expected to navigate via the deep-linked /tripshistory/[storyId] route
 * (e.g. from the sidebar / dashboard). When listing is wired, this page
 * will redirect / render the most recent story.
 */
export default function TripshistoryHomePage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

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
