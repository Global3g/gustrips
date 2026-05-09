import confetti from 'canvas-confetti';

export type ConfettiLevel = 'small' | 'big' | 'huge';

// Palette aligned with the app — amber, emerald, sky, violet
const PALETTE = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6'];

/**
 * Trigger celebratory confetti at one of three intensity levels.
 *
 * - `small`: a single 50-particle burst from center.
 * - `big`: 100 particles split between two side bursts.
 * - `huge`: 250 particles spread across three staggered bursts over ~1s.
 */
export function triggerConfetti(level: ConfettiLevel = 'small'): void {
  if (typeof window === 'undefined') return;

  if (level === 'small') {
    confetti({
      particleCount: 50,
      spread: 70,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.6 },
      colors: PALETTE,
      ticks: 200,
      scalar: 0.9,
    });
    return;
  }

  if (level === 'big') {
    // Two simultaneous bursts from the lower corners
    confetti({
      particleCount: 100,
      spread: 60,
      startVelocity: 45,
      angle: 60,
      origin: { x: 0, y: 0.7 },
      colors: PALETTE,
      ticks: 220,
    });
    confetti({
      particleCount: 100,
      spread: 60,
      startVelocity: 45,
      angle: 120,
      origin: { x: 1, y: 0.7 },
      colors: PALETTE,
      ticks: 220,
    });
    return;
  }

  // huge — three staggered bursts over 1s, broad spread, multiple colors
  const burst = (delay: number, origin: { x: number; y: number }, particleCount: number) => {
    window.setTimeout(() => {
      confetti({
        particleCount,
        spread: 100,
        startVelocity: 55,
        origin,
        colors: PALETTE,
        ticks: 280,
        scalar: 1.1,
      });
    }, delay);
  };
  burst(0, { x: 0.2, y: 0.7 }, 90);
  burst(350, { x: 0.5, y: 0.6 }, 90);
  burst(700, { x: 0.8, y: 0.7 }, 70);
}

/**
 * Public helper that fires confetti AND broadcasts a `gustrips:milestone`
 * window event so any listener (e.g. the global toast banner) can react.
 *
 * The optional `level` controls the confetti burst intensity; defaults to
 * `small`. The dispatched CustomEvent has `detail: { milestone, message }`.
 */
export function fireMilestone(
  milestone: string,
  message: string,
  level: ConfettiLevel = 'small',
): void {
  if (typeof window === 'undefined') return;

  triggerConfetti(level);

  window.dispatchEvent(
    new CustomEvent('gustrips:milestone', {
      detail: { milestone, message },
    }),
  );
}
