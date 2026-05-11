'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import StoryWizard from '@/features/tripshistory/components/StoryWizard';
import { useStory } from '@/features/tripshistory/hooks/useStory';

/**
 * Per-story page. The StoryWizard component decides what to render based on
 * story.status (draft / analyzing / questioning / ready / finalized).
 */
export default function StoryPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const storyId = params.storyId as string;

  const { data: story, loading, error } = useStory(storyId);

  return (
    <div className="p-3 sm:p-6 pb-32 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/trips/${tripId}/tripshistory`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/85 hover:text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </Link>
        {story?.title && (
          <span className="text-white/70 text-sm font-medium truncate max-w-xs">
            {story.title}
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

      {!loading && !error && story && <StoryWizard storyId={story.id} />}
    </div>
  );
}
