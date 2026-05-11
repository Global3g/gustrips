'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { skipQuestion } from '@/features/tripshistory/api/endpoints';
import type {
  Question,
  QuestionType,
} from '@/features/tripshistory/types';
import { InlineQuestionRow } from '@/features/tripshistory/components/TripQuestionsBanner';

const EVENT_LEVEL_TYPES: QuestionType[] = [
  'event_name',
  'location',
  'event_companions',
  'event_rating',
  'event_cost_approx',
];

const DAY_LEVEL_TYPES: QuestionType[] = [
  'day_phrase',
  'day_weather',
  'day_food',
  'day_surprise',
];

const LABEL_OVERRIDES: Partial<Record<QuestionType, string>> = {
  event_name: '¿Qué fue este momento?',
  location: '¿Dónde fue?',
  event_companions: '¿Quiénes estaban?',
  event_rating: '¿Lo recomendarías?',
  event_cost_approx: 'Costo aproximado',
  day_phrase: 'Frase del día',
  day_weather: 'Clima del día',
  day_food: 'Comida memorable',
  day_surprise: 'Algo que te sorprendió',
};

interface EventQuestionsBlockProps {
  storyId: string;
  /** All pending questions whose context.relatedEventId matches this TripEvent's storyEventId. */
  questions: Question[];
  /** Day-level questions to surface here if this is the last event of the day. */
  dayQuestions?: Question[];
  /** Called after any answer/skip — parent should refetch question list. */
  onChanged?: () => void;
  /** Scroll to next event with pending questions. */
  onNext?: () => void;
}

/**
 * Self-contained block rendered inside (or beneath) a TripEvent card on the
 * itinerary. Shows up only when there are matching pending questions.
 *
 * Collapsed: shows a 1-line teaser + counter + chevron.
 * Expanded:  stacks inline question rows + "Guardar y siguiente" / "Saltar".
 */
export default function EventQuestionsBlock({
  storyId,
  questions,
  dayQuestions = [],
  onChanged,
  onNext,
}: EventQuestionsBlockProps) {
  const eventPending = useMemo(
    () => questions.filter((q) => q.status === 'pending' && EVENT_LEVEL_TYPES.includes(q.type)),
    [questions],
  );
  const dayPending = useMemo(
    () => dayQuestions.filter((q) => q.status === 'pending' && DAY_LEVEL_TYPES.includes(q.type)),
    [dayQuestions],
  );

  const total = eventPending.length + dayPending.length;
  const [open, setOpen] = useState<boolean>(false);
  const [skipping, setSkipping] = useState(false);

  const skipAll = useCallback(async () => {
    setSkipping(true);
    try {
      await Promise.all(
        [...eventPending, ...dayPending].map((q) =>
          skipQuestion(storyId, q.id).catch(() => undefined),
        ),
      );
      onChanged?.();
      onNext?.();
    } finally {
      setSkipping(false);
    }
  }, [storyId, eventPending, dayPending, onChanged, onNext]);

  // Save current state and scroll forward. The individual rows already save
  // on blur; this button is mostly for users who clicked "Guardar y siguiente"
  // before tabbing out, so we just nudge to the next event.
  const proceed = useCallback(() => {
    onNext?.();
  }, [onNext]);

  if (total === 0) return null;

  return (
    <div className="mt-2.5 ml-2 sm:ml-4">
      <motion.div
        initial={false}
        className="rounded-xl border border-amber-300/25 bg-gradient-to-br from-amber-500/[0.06] via-rose-500/[0.04] to-amber-400/[0.06] overflow-hidden"
      >
        {/* Header / toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-3.5 h-3.5 text-amber-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/85">
              Tripshistory
            </p>
            <p className="text-white/85 text-[13px] font-semibold leading-tight">
              {open
                ? `Completá ${total} pregunta${total === 1 ? '' : 's'} de este momento`
                : `Tenés ${total} pregunta${total === 1 ? '' : 's'} para enriquecer este momento`}
            </p>
          </div>
          <span className="text-amber-200/80">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="border-t border-amber-300/15"
            >
              <div className="p-3 space-y-2">
                {eventPending.map((q) => (
                  <InlineQuestionRow
                    key={q.id}
                    storyId={storyId}
                    question={q}
                    labelOverride={LABEL_OVERRIDES[q.type]}
                    onChanged={onChanged}
                  />
                ))}

                {dayPending.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-white/[0.05] space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300/85 px-1 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> Día completo
                    </p>
                    {dayPending.map((q) => (
                      <InlineQuestionRow
                        key={q.id}
                        storyId={storyId}
                        question={q}
                        labelOverride={LABEL_OVERRIDES[q.type]}
                        onChanged={onChanged}
                      />
                    ))}
                  </div>
                )}

                {/* Action row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.05] mt-2">
                  {onNext && (
                    <button
                      type="button"
                      onClick={proceed}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 text-white text-xs font-bold shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 transition-shadow"
                    >
                      Guardar y siguiente
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={skipAll}
                    disabled={skipping}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    {skipping ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <SkipForward className="w-3.5 h-3.5" />
                    )}
                    Saltar todas
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
