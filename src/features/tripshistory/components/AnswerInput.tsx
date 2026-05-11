'use client';

import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Send, SkipForward, Sparkles } from 'lucide-react';

interface AnswerInputProps {
  suggestedAnswers?: string[];
  placeholder?: string;
  disabled?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
}

/**
 * Free-form input + optional suggested-answer chips.
 * Used inside QuestionCard. Submits on enter / button.
 */
export default function AnswerInput({
  suggestedAnswers = [],
  placeholder = 'Escribí tu respuesta...',
  disabled = false,
  onSubmit,
  onSkip,
}: AnswerInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    await onSubmit(trimmed);
    setValue('');
  };

  const handleChip = async (suggestion: string) => {
    if (disabled) return;
    await onSubmit(suggestion);
    setValue('');
  };

  return (
    <div className="space-y-3">
      {suggestedAnswers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestedAnswers.map((s) => (
            <motion.button
              key={s}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleChip(s)}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-amber-500/15 border border-white/[0.08] hover:border-amber-400/30 text-sm font-medium text-white/85 hover:text-amber-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              {s}
            </motion.button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/40 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          className="px-4 py-3 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Saltar pregunta"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}
