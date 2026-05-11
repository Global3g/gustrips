'use client';

import { motion } from 'framer-motion';
import {
  MapPin,
  HelpCircle,
  Users,
  Calendar,
  ArrowRightLeft,
  Tag,
  Sparkles,
  BookHeart,
  Plane,
  BedDouble,
  Wallet,
  Star,
  Smile,
  Sun,
  UtensilsCrossed,
  Wand2,
  Lightbulb,
  ThumbsUp,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import AnswerInput from '@/features/tripshistory/components/AnswerInput';
import type {
  Question,
  QuestionType,
  AnswerRequest,
} from '@/features/tripshistory/types';

const QUESTION_ICONS: Record<QuestionType, LucideIcon> = {
  // existing
  location: MapPin,
  event_name: Tag,
  companions: Users,
  day_gap: Calendar,
  transition: ArrowRightLeft,
  trip_dates: Calendar,
  trip_title: Sparkles,
  // trip-level
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
  // day-level
  day_phrase: Wand2,
  day_weather: Sun,
  day_food: UtensilsCrossed,
  day_surprise: Sparkles,
  // event-level
  event_companions: Users,
  event_rating: Star,
  event_cost_approx: Wallet,
};

const QUESTION_LABELS: Record<QuestionType, string> = {
  location: 'Ubicación',
  event_name: 'Evento',
  companions: 'Compañía',
  day_gap: 'Día sin fotos',
  transition: 'Transición',
  trip_dates: 'Fechas',
  trip_title: 'Título del viaje',
  trip_companions: 'Con quién viajaron',
  trip_purpose: 'Motivo del viaje',
  trip_highlight: 'Mejor momento',
  trip_anecdote: 'Anécdota',
  trip_transport: 'Transporte',
  trip_accommodation: 'Hospedaje',
  trip_budget_approx: 'Presupuesto',
  trip_learnings: 'Aprendizajes',
  trip_recommend: '¿Lo recomendarías?',
  trip_would_return: '¿Volverías?',
  day_phrase: 'Frase del día',
  day_weather: 'Clima',
  day_food: 'Comida memorable',
  day_surprise: 'Algo sorprendió',
  event_companions: '¿Quiénes estaban?',
  event_rating: 'Recomendación',
  event_cost_approx: 'Costo aprox',
};

interface QuestionCardProps {
  question: Question;
  onAnswer: (body: AnswerRequest) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
  loading?: boolean;
}

export default function QuestionCard({
  question,
  onAnswer,
  onSkip,
  loading = false,
}: QuestionCardProps) {
  const Icon = QUESTION_ICONS[question.type] ?? HelpCircle;
  const label = QUESTION_LABELS[question.type] ?? 'Pregunta';

  const dateRange = question.context?.dateRange;
  const formattedRange = (() => {
    if (!dateRange?.start) return null;
    try {
      const start = format(parseISO(dateRange.start), "d 'de' MMMM", { locale: es });
      if (!dateRange.end) return start;
      const end = format(parseISO(dateRange.end), "d 'de' MMMM", { locale: es });
      return `${start} — ${end}`;
    } catch {
      return null;
    }
  })();

  const skippable = question.context?.skippable === true;
  const multiline = question.context?.multiline === true;
  const placeholder = question.context?.placeholder;
  const helperText = question.context?.helperText;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#152339] to-[#1c2f4f] p-6 shadow-2xl shadow-black/30"
    >
      <header className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 border border-amber-400/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
            {label}
          </p>
          {formattedRange && (
            <p className="text-xs text-white/60 mt-0.5">{formattedRange}</p>
          )}
        </div>
        {question.context?.photoCount !== undefined && (
          <span className="text-[11px] font-bold text-white/80 bg-white/[0.06] rounded-full px-3 py-1 border border-white/[0.08]">
            {question.context.photoCount} fotos
          </span>
        )}
        {skippable && (
          <span className="text-[10px] font-bold text-white/55 bg-white/[0.03] rounded-full px-2.5 py-1 border border-white/[0.06] uppercase tracking-wide">
            Opcional
          </span>
        )}
      </header>

      <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-2">
        {question.prompt}
      </h2>

      {skippable && (
        <p className="text-xs text-white/55 mb-4">
          Esta es opcional — si no te acordás, saltala con el botón de la derecha.
        </p>
      )}

      <AnswerInput
        suggestedAnswers={question.suggestedAnswers}
        placeholder={placeholder}
        helperText={helperText}
        multiline={multiline}
        skippable={skippable}
        disabled={loading}
        onSubmit={(value) => onAnswer({ value })}
        onSkip={onSkip}
      />
    </motion.article>
  );
}
