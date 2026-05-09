'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MilestoneToast {
  id: number;
  milestone: string;
  message: string;
}

interface MilestoneEventDetail {
  milestone: string;
  message: string;
}

const DURATION_MS = 4000;
const MAX_STACK = 3;

/**
 * Splits a message that begins with an emoji into `{ emoji, text }`.
 * The emoji is the first grapheme cluster (1-2 code points typically) up to
 * the first whitespace; if no leading emoji is detected, `emoji` is empty.
 */
function splitEmoji(message: string): { emoji: string; text: string } {
  const trimmed = message.trim();
  // Match a leading emoji-ish character or sequence followed by whitespace.
  // We accept any non-letter/digit/whitespace prefix to keep it simple while
  // covering "🏆", "★", etc.
  const match = trimmed.match(/^([^\w\s]+)\s+(.*)$/u);
  if (match) return { emoji: match[1], text: match[2] };
  return { emoji: '', text: trimmed };
}

/**
 * Global listener for `gustrips:milestone` window events. Renders a centered,
 * stacked toast banner near the top of the viewport for ~4s per milestone.
 */
export default function MilestoneBanner() {
  const [toasts, setToasts] = useState<MilestoneToast[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<MilestoneEventDetail>;
      const detail = ce.detail;
      if (!detail || !detail.message) return;

      const id = Date.now() + Math.random();
      setToasts((prev) => {
        const next = [
          ...prev,
          { id, milestone: detail.milestone, message: detail.message },
        ];
        // Keep at most MAX_STACK visible — drop the oldest first.
        return next.slice(-MAX_STACK);
      });

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DURATION_MS);
    };

    window.addEventListener('gustrips:milestone', handler as EventListener);
    return () => {
      window.removeEventListener('gustrips:milestone', handler as EventListener);
    };
  }, []);

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { emoji, text } = splitEmoji(t.message);
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="pointer-events-auto relative rounded-2xl px-5 py-3.5 max-w-[92vw]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(13,27,46,0.92) 0%, rgba(22,42,68,0.92) 100%)',
                border: '1px solid transparent',
                backgroundClip: 'padding-box',
                boxShadow:
                  '0 0 30px rgba(245,158,11,0.45), 0 0 60px rgba(245,158,11,0.18), 0 8px 24px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            >
              {/* Amber gradient border via masked overlay */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  padding: 1,
                  background:
                    'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fde68a 100%)',
                  WebkitMask:
                    'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />
              <div className="relative flex items-center gap-3">
                {emoji && (
                  <span
                    className="text-3xl leading-none flex-shrink-0"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' }}
                  >
                    {emoji}
                  </span>
                )}
                <p className="text-white font-semibold text-sm sm:text-base tracking-tight">
                  {text}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
