'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  HelpCircle,
  Users,
  BedDouble,
  Plane,
  Wallet,
  Star,
  Wand2,
  Smile,
  Lightbulb,
  ThumbsUp,
  RotateCcw,
  BookHeart,
  ChevronDown,
  ChevronUp,
  Check,
  X as XIcon,
  Pencil,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  answerQuestion,
  skipQuestion,
} from '@/features/tripshistory/api/endpoints';
import type {
  Question,
  QuestionType,
  Story,
} from '@/features/tripshistory/types';

/** Trip-level question types — shown inside the top banner. */
const TRIP_QUESTION_TYPES: QuestionType[] = [
  'trip_companions',
  'trip_purpose',
  'trip_transport',
  'trip_accommodation',
  'trip_highlight',
  'trip_anecdote',
  'trip_learnings',
  'trip_recommend',
  'trip_would_return',
  'trip_budget_approx',
  'trip_title',
  'trip_dates',
];

const Q_ICON: Partial<Record<QuestionType, LucideIcon>> = {
  trip_companions: Users,
  trip_purpose: BookHeart,
  trip_highlight: Sparkles,
  trip_anecdote: Smile,
  trip_transport: Plane,
  trip_accommodation: BedDouble,
  trip_budget_approx: Wallet,
  trip_learnings: Lightbulb,
  trip_recommend: ThumbsUp,
  trip_would_return: RotateCcw,
  trip_title: Sparkles,
  trip_dates: Wand2,
  day_phrase: Wand2,
  day_weather: Sparkles,
  day_food: Sparkles,
  day_surprise: Sparkles,
  event_name: Pencil,
  event_companions: Users,
  event_rating: Star,
  event_cost_approx: Wallet,
  location: Sparkles,
};

const Q_LABEL: Partial<Record<QuestionType, string>> = {
  trip_companions: 'Con quién',
  trip_purpose: 'Motivo',
  trip_highlight: 'Mejor momento',
  trip_anecdote: 'Anécdota',
  trip_transport: 'Transporte',
  trip_accommodation: 'Hospedaje',
  trip_budget_approx: 'Presupuesto aprox',
  trip_learnings: 'Aprendizajes',
  trip_recommend: '¿Lo recomendás?',
  trip_would_return: '¿Volverías?',
  trip_title: 'Título',
  trip_dates: 'Fechas',
};

interface TripQuestionsBannerProps {
  tripId: string;
  story: Story;
  questions: Question[]; // pending + recently answered (we filter inside)
  /** True when ?fromPhotos=1 is present — switches the copy to celebration mode. */
  fromPhotos?: boolean;
  /** Called after any answer/skip so the parent can refresh its question list. */
  onChanged?: () => void;
  /** Smoothly scroll to first event with pending questions. */
  onStart?: () => void;
}

const DISMISS_KEY = (tripId: string) =>
  `tripshistory-questions-banner-dismissed-${tripId}`;

/**
 * Top-of-page surface for trip-level questions.
 *
 * Header switches tone depending on whether the user just landed from
 * the photo upload flow vs. came back to an old trip.
 *
 * Below the header we render a dense form: one row per trip-level
 * question, with answered rows collapsed to a summary + Editar.
 */
export default function TripQuestionsBanner({
  tripId,
  story,
  questions,
  fromPhotos = false,
  onChanged,
  onStart,
}: TripQuestionsBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(fromPhotos);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(DISMISS_KEY(tripId));
      if (stored === '1') setDismissed(true);
    } catch {
      /* localStorage may be unavailable in private mode */
    }
  }, [tripId]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY(tripId), '1');
    } catch {
      /* ignore */
    }
  }, [tripId]);

  // Filter trip-level questions out of the full pending list.
  const tripQuestions = useMemo(
    () => questions.filter((q) => TRIP_QUESTION_TYPES.includes(q.type)),
    [questions],
  );

  const pendingTripQs = tripQuestions.filter((q) => q.status === 'pending');
  const otherPendingCount = questions.length - tripQuestions.length;
  const totalPending = pendingTripQs.length + otherPendingCount;

  if (dismissed) return null;
  if (totalPending === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/[0.08] via-rose-500/[0.06] to-amber-400/[0.08] backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 border border-amber-400/30 flex items-center justify-center">
          {fromPhotos ? (
            <Sparkles className="w-5 h-5 text-amber-200" />
          ) : (
            <HelpCircle className="w-5 h-5 text-amber-200" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/85">
            Tripshistory
          </p>
          <h2 className="text-white font-bold text-base sm:text-lg leading-tight">
            {fromPhotos
              ? '🎉 Tu viaje está listo. ¿Le agregamos los detalles?'
              : `Tenés ${totalPending} pregunta${totalPending === 1 ? '' : 's'} pendiente${totalPending === 1 ? '' : 's'} para enriquecer este viaje.`}
          </h2>
          <p className="text-white/65 text-xs sm:text-sm mt-0.5">
            {fromPhotos
              ? 'Te hago unas preguntas rápidas (3 min). Aparecen acá y dentro de cada evento.'
              : 'Respondelas en cualquier momento — quedan guardadas viaje por viaje.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {pendingTripQs.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 hover:text-amber-100 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 rounded-lg border border-white/[0.08] transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Ver
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/55 hover:text-white flex items-center justify-center transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick CTA when collapsed */}
      {!expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-wrap items-center gap-2">
          {pendingTripQs.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white text-sm font-bold shadow-lg shadow-amber-500/20"
            >
              Empezar
            </button>
          )}
          {otherPendingCount > 0 && onStart && (
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white text-sm font-semibold border border-white/[0.1] transition-colors"
            >
              Ir a las preguntas de cada evento
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-[12px] text-white/45 hover:text-white/70 underline-offset-2 hover:underline ml-auto"
          >
            Después
          </button>
        </div>
      )}

      {/* Inline trip-level questions */}
      <AnimatePresence initial={false}>
        {expanded && pendingTripQs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="border-t border-white/[0.06]"
          >
            <div className="px-4 sm:px-5 py-4 space-y-2">
              {tripQuestions.map((q) => (
                <InlineQuestionRow
                  key={q.id}
                  storyId={story.id}
                  question={q}
                  onChanged={onChanged}
                />
              ))}
              {otherPendingCount > 0 && onStart && (
                <div className="pt-2 border-t border-white/[0.04] mt-2">
                  <button
                    type="button"
                    onClick={onStart}
                    className="text-[12px] text-amber-300 hover:text-amber-200 font-semibold inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Hay {otherPendingCount} pregunta{otherPendingCount === 1 ? '' : 's'} más dentro de los eventos
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Inline row used by TripQuestionsBanner & EventQuestionsBlock ─── */

interface InlineQuestionRowProps {
  storyId: string;
  question: Question;
  /** Optional override for the label (e.g. event-level rows). */
  labelOverride?: string;
  onChanged?: () => void;
}

export function InlineQuestionRow({
  storyId,
  question,
  labelOverride,
  onChanged,
}: InlineQuestionRowProps) {
  const isAnswered = question.status === 'answered';
  const [editing, setEditing] = useState<boolean>(!isAnswered);
  const [value, setValue] = useState<string>(question.answer?.value ?? '');
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const Icon = Q_ICON[question.type] ?? HelpCircle;
  const label = labelOverride || Q_LABEL[question.type] || question.prompt;
  const placeholder = question.context?.placeholder || 'Escribí tu respuesta…';
  const skippable = question.context?.skippable === true;

  const save = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setSaving(true);
      try {
        await answerQuestion(storyId, question.id, { value: trimmed });
        setSavedFlash(true);
        setEditing(false);
        window.setTimeout(() => setSavedFlash(false), 1500);
        onChanged?.();
      } catch (err) {
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.error('[InlineQuestionRow] answer failed', err);
        }
      } finally {
        setSaving(false);
      }
    },
    [storyId, question.id, onChanged],
  );

  const skip = useCallback(async () => {
    setSkipping(true);
    try {
      await skipQuestion(storyId, question.id);
      onChanged?.();
    } catch (err) {
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.error('[InlineQuestionRow] skip failed', err);
      }
    } finally {
      setSkipping(false);
    }
  }, [storyId, question.id, onChanged]);

  /* Answered & not currently editing — show a compact summary row. */
  if (isAnswered && !editing) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center flex-shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            {label}
          </p>
          <p className="text-white/85 text-sm truncate">
            {question.answer?.value || '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setValue(question.answer?.value ?? '');
            setEditing(true);
          }}
          className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold inline-flex items-center gap-1"
        >
          <Pencil className="w-3 h-3" />
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400/20 to-rose-500/15 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-amber-200" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/85">
            {label}
          </p>
          <p className="text-white/85 text-[13px] leading-snug mt-0.5">
            {question.prompt}
          </p>

          {/* Suggested chips */}
          {(question.suggestedAnswers?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {question.suggestedAnswers!.slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={saving || skipping}
                  onClick={() => {
                    setValue(s);
                    void save(s);
                  }}
                  className="inline-flex items-center text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-amber-500/15 border border-white/[0.08] hover:border-amber-400/30 text-white/85 hover:text-amber-200 transition-all disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex flex-col sm:flex-row gap-2 mt-2.5">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void save(value);
                }
              }}
              onBlur={() => {
                if (value.trim() && value.trim() !== (question.answer?.value ?? '').trim()) {
                  void save(value);
                }
              }}
              placeholder={placeholder}
              disabled={saving || skipping}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/40 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30 disabled:opacity-50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void save(value)}
                disabled={saving || skipping || value.trim().length === 0}
                className="px-3 py-2 rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 text-white text-xs font-bold shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 transition-shadow disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar
              </button>
              {(skippable || isAnswered) && (
                <button
                  type="button"
                  onClick={isAnswered ? () => setEditing(false) : skip}
                  disabled={saving || skipping}
                  className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {skipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isAnswered ? 'Cancelar' : 'Saltar'}
                </button>
              )}
            </div>
          </div>

          {savedFlash && (
            <p className="text-[11px] text-emerald-300 mt-1.5 inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Guardado
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
