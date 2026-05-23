'use client';

/**
 * CeremonyStep — generic full-screen stepper used by the Closing Ceremony.
 *
 * The Ceremony is a chained sequence of single-screen "scenes". Each scene
 * shows its content for `durationMs` and then advances. This component owns
 * the timer plumbing and the framer-motion enter/exit transitions, so each
 * scene's body can stay declarative.
 *
 * Why this is a separate component
 * --------------------------------
 * Building this inline inside the page would have meant duplicating the
 * timer plumbing per scene. With a generic stepper, scenes become tiny
 * `() => <JSX />` thunks the parent passes in.
 *
 * Behaviour
 * ---------
 * - When `active` is true, mount the children, fade them in, and schedule
 *   `onComplete` after `durationMs`. Closing the parent ceremony (skip
 *   button, navigation) unmounts us — the timer is cleared in the cleanup.
 * - When the user taps anywhere on the step, we treat that as "advance now":
 *   the same `onComplete` runs immediately. Mobile users will tend to tap
 *   through faster than the default cadence.
 * - The animation uses a generous spring + opacity fade. We keep the
 *   transform overshoot small so text doesn't wobble.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

export interface CeremonyStepProps {
  /** Whether this step is currently the active scene. */
  active: boolean;
  /** Auto-advance delay in milliseconds. */
  durationMs: number;
  /** Called when the step has been visible for `durationMs` (or tapped). */
  onComplete: () => void;
  /** Optional background overlay (e.g. a faded destination photo). */
  background?: ReactNode;
  /** Step content rendered above the background. */
  children: ReactNode;
}

export default function CeremonyStep({
  active,
  durationMs,
  onComplete,
  background,
  children,
}: CeremonyStepProps) {
  // Hold the latest onComplete in a ref so the timer effect below doesn't
  // need to re-arm itself if the parent passes a new closure each render
  // (which is common when the callback closes over component state).
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      completeRef.current();
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [active, durationMs]);

  return (
    <AnimatePresence mode="wait">
      {active && (
        <motion.div
          key="step"
          // Tap-to-advance: skip the remaining auto-progress wait. We don't
          // use onClick on a button because the whole screen is the target
          // and we want both pointer + touch with no double-tap delay.
          onClick={() => completeRef.current()}
          role="button"
          tabIndex={0}
          aria-label="Avanzar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="absolute inset-0 flex items-center justify-center overflow-hidden cursor-pointer select-none"
        >
          {/* Background slot, behind the content. */}
          {background && (
            <div className="absolute inset-0 pointer-events-none">{background}</div>
          )}

          {/* Foreground content with a slight upward float-in. */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative z-10 w-full max-w-3xl px-6 sm:px-10 text-center"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
