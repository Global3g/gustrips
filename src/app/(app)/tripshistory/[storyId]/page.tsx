'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, BookHeart, Loader2 } from 'lucide-react';
import StoryWizard from '@/features/tripshistory/components/StoryWizard';
import ConvertToTripBanner from '@/features/tripshistory/components/ConvertToTripBanner';
import { useStory } from '@/features/tripshistory/hooks/useStory';

/**
 * Standalone story page (no tripId).
 *
 * Renders the same StoryWizard the in-trip version uses, plus a
 * convert-to-trip banner once the story is ready and not yet linked to
 * a real Trip.
 */
export default function StandaloneStoryPage() {
  const params = useParams();
  const storyId = params.storyId as string;

  const { data: story, loading, error } = useStory(storyId);

  const showConvertBanner =
    !!story &&
    !story.tripId &&
    (story.status === 'ready' || story.status === 'finalized');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/tripshistory"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/85 hover:text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </Link>
        {story && !story.tripId && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 text-[11px] font-bold uppercase tracking-[0.12em]">
            <BookHeart className="w-3 h-3" />
            Reconstruyendo viaje desde fotos
          </span>
        )}
      </div>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-24 text-white/70"
        >
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Cargando historia...
        </motion.div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-100">
          <p className="font-semibold mb-1">No pudimos cargar la historia.</p>
          <p className="text-sm text-rose-200/85">{error.message}</p>
        </div>
      )}

      {!loading && !error && story && (
        <StoryWizard
          storyId={story.id}
          storyboardBanner={
            showConvertBanner ? <ConvertToTripBanner story={story} /> : null
          }
        />
      )}
    </div>
  );
}
