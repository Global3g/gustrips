'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useStory } from '@/features/tripshistory/hooks/useStory';
import { useAnalysisState } from '@/features/tripshistory/hooks/useAnalysisState';
import { useNextQuestion } from '@/features/tripshistory/hooks/useNextQuestion';
import { useStoryboard } from '@/features/tripshistory/hooks/useStoryboard';
import { useAnswerQuestion } from '@/features/tripshistory/hooks/useAnswerQuestion';
import { usePhotoBatch } from '@/features/tripshistory/hooks/usePhotoBatch';
import PhotoSelector from '@/features/tripshistory/components/PhotoSelector';
import type { PhotoMetadata, Story } from '@/features/tripshistory/types';

const AnalysisProgress = dynamic(
  () => import('@/features/tripshistory/components/AnalysisProgress'),
  { ssr: false },
);
const QuestionCard = dynamic(
  () => import('@/features/tripshistory/components/QuestionCard'),
  { ssr: false },
);
const StoryboardView = dynamic(
  () => import('@/features/tripshistory/components/StoryboardView'),
  { ssr: false },
);

interface StoryWizardProps {
  storyId: string;
  /** Optional thumbnail map for storyboard rendering (photoId -> url). */
  thumbnailById?: Record<string, string>;
}

/**
 * Top-level wizard shell. Renders the right step based on story.status:
 *   draft       -> photo picker
 *   analyzing   -> analysis progress
 *   questioning -> question card loop
 *   ready /
 *   finalized   -> storyboard view
 */
export default function StoryWizard({
  storyId,
  thumbnailById,
}: StoryWizardProps) {
  const {
    data: story,
    loading: storyLoading,
    error: storyError,
    refetch: refetchStory,
  } = useStory(storyId);

  const status = story?.status;

  // Poll analysis while engine processes.
  const analysisPolling = status === 'analyzing' || status === 'draft' ? 3000 : undefined;
  const { data: analysis } = useAnalysisState(
    status === 'analyzing' || status === 'draft' ? storyId : null,
    analysisPolling,
  );

  // Pull next question when in questioning state.
  const questionPolling = status === 'questioning' ? 5000 : undefined;
  const {
    data: question,
    refetch: refetchQuestion,
    done: noMoreQuestions,
  } = useNextQuestion(
    status === 'questioning' ? storyId : null,
    questionPolling,
  );

  // Storyboard when ready.
  const { data: storyboard, refetch: refetchStoryboard } = useStoryboard(
    status === 'ready' || status === 'finalized' ? storyId : null,
  );

  // Mutations.
  const { mutate: submitAnswer, skip: skipQ, loading: answering } = useAnswerQuestion();
  const { mutate: uploadBatch, loading: uploading } = usePhotoBatch();

  const [uploadError, setUploadError] = useState<string | null>(null);

  // Once we run out of questions, nudge story status forward.
  useEffect(() => {
    if (status === 'questioning' && noMoreQuestions) {
      refetchStory();
    }
  }, [status, noMoreQuestions, refetchStory]);

  /**
   * Called by PhotoSelector once EXIF + pHash + Firebase Storage upload
   * are done for every picked file. We then forward the metadata array to
   * the engine via the batch endpoint, which transitions the story from
   * `draft` -> `analyzing`.
   */
  const handlePhotosReady = async (photos: PhotoMetadata[]) => {
    if (!storyId || photos.length === 0) return;
    setUploadError(null);
    try {
      await uploadBatch(storyId, photos);
      // Refresh story to pick up status transitions (-> analyzing).
      await refetchStory();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'No pudimos subir tus fotos.',
      );
    }
  };

  const handleAnswer = async (questionId: string, value: string) => {
    try {
      const result = await submitAnswer(storyId, questionId, { value });
      if (result.nextQuestion === null) {
        await refetchStory();
      } else {
        await refetchQuestion();
      }
    } catch {
      // error surfaced by hook
    }
  };

  const handleSkip = async (questionId: string) => {
    try {
      await skipQ(storyId, questionId);
      await refetchQuestion();
    } catch {
      // error surfaced by hook
    }
  };

  /* ─── Render branches ───────────────────────────── */

  if (storyLoading && !story) {
    return <WizardCenter><Loader2 className="w-6 h-6 animate-spin text-amber-300" /></WizardCenter>;
  }

  if (storyError) {
    return (
      <WizardCenter>
        <p className="text-white/80">No pudimos cargar la historia.</p>
        <p className="text-xs text-white/50 mt-1">{storyError.message}</p>
      </WizardCenter>
    );
  }

  if (!story) {
    return <WizardCenter><p className="text-white/70">Historia no encontrada.</p></WizardCenter>;
  }

  return (
    <div className="space-y-6">
      <WizardHeader story={story} />

      <AnimatePresence mode="wait">
        {status === 'draft' && (
          <motion.div
            key="draft"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <PhotoSelector
              storyId={storyId}
              onPhotosReady={handlePhotosReady}
              disabled={uploading}
            />
            {uploadError && (
              <p className="text-sm text-rose-300">{uploadError}</p>
            )}
            {uploading && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-amber-300 inline-block mr-2" />
                <span className="text-sm text-white/80">
                  Enviando metadata al motor...
                </span>
              </div>
            )}
          </motion.div>
        )}

        {status === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <AnalysisProgress state={analysis} totalExpected={story.photoCount} />
          </motion.div>
        )}

        {status === 'questioning' && (
          <motion.div
            key="questioning"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {question ? (
              <QuestionCard
                question={question}
                loading={answering}
                onAnswer={({ value }) => handleAnswer(question.id, value ?? '')}
                onSkip={() => handleSkip(question.id)}
              />
            ) : (
              <WizardCenter>
                <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
                <p className="text-white/70 text-sm mt-2">
                  Buscando la siguiente pregunta...
                </p>
              </WizardCenter>
            )}
          </motion.div>
        )}

        {(status === 'ready' || status === 'finalized') && storyboard && (
          <motion.div
            key="storyboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <StoryboardView
              storyboard={storyboard}
              thumbnailById={thumbnailById}
            />
          </motion.div>
        )}

        {(status === 'ready' || status === 'finalized') && !storyboard && (
          <WizardCenter key="storyboard-loading">
            <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
          </WizardCenter>
        )}
      </AnimatePresence>

      {/* Tiny debug action: in finalized state, let users re-fetch the board. */}
      {(status === 'ready' || status === 'finalized') && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => refetchStoryboard()}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          >
            Refrescar storyboard
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────── */

function WizardHeader({ story }: { story: Story }) {
  const STATUS_LABEL: Record<Story['status'], string> = {
    draft: 'Esperando fotos',
    analyzing: 'Analizando fotos',
    questioning: 'Llenando huecos',
    ready: 'Listo',
    finalized: 'Finalizado',
  };
  return (
    <header className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
            Tripshistory
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
            {story.title || 'Historia sin título'}
          </h1>
        </div>
        <span className="flex-shrink-0 text-[11px] font-bold text-white bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1.5">
          {STATUS_LABEL[story.status]}
        </span>
      </div>
    </header>
  );
}

function WizardCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 text-center flex flex-col items-center justify-center">
      {children}
    </div>
  );
}
