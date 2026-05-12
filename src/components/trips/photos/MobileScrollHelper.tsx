'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsDown, ChevronsUp } from 'lucide-react';

/**
 * Floating side button on /trips/[id]/photos for mobile that lets the user
 * jump to the bottom of the gallery (or back to the top once they've
 * scrolled past it). Hidden on desktop — desktop already has the scrollbar
 * and the trip sidebar for navigation.
 *
 * Behavior:
 *   - Appears only after the user has scrolled past 200px so it doesn't sit
 *     on top of the page header on first view.
 *   - When the user is closer to the top than the bottom, shows "↓" with
 *     the action "scroll to bottom".
 *   - When the user is closer to the bottom, shows "↑" with "scroll to top".
 *   - Smooth-scrolls. No animation libraries required.
 *   - Auto-hides when no scroll is in progress for 1.5s — keeps the photo
 *     grid clean while the user is browsing, comes back as soon as they
 *     swipe.
 */
export default function MobileScrollHelper() {
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<'down' | 'up'>('down');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const update = (): void => {
      const y = window.scrollY;
      const docH = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      const winH = window.innerHeight;
      const scrollable = docH - winH;

      if (scrollable < 400) {
        // Page barely scrolls — no point in showing the helper.
        setVisible(false);
        return;
      }

      // Show once we're past the first viewport.
      if (y > 200) {
        setVisible(true);
        // Closer to bottom → next action is "back to top".
        setDirection(y > scrollable * 0.5 ? 'up' : 'down');
      } else {
        setVisible(false);
      }

      // Auto-hide after a quiet period.
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 1800);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  const jump = (): void => {
    const target =
      direction === 'down'
        ? Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
          )
        : 0;
    window.scrollTo({ top: target, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={jump}
          aria-label={direction === 'down' ? 'Saltar al final' : 'Volver al inicio'}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          // lg:hidden so this never shows on desktop.
          // Bottom offset clears the mobile bottom nav (h-20 = 5rem).
          className="lg:hidden fixed right-3 bottom-24 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-xl shadow-black/40 backdrop-blur-sm active:scale-95 transition-transform"
        >
          {direction === 'down' ? (
            <ChevronsDown className="w-6 h-6" />
          ) : (
            <ChevronsUp className="w-6 h-6" />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
