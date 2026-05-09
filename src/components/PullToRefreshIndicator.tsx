'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  /** Distance after which the arrow flips to "release to refresh". Default 90. */
  threshold?: number;
}

/**
 * Visual indicator for `usePullToRefresh`. Renders a fixed pill near the top
 * of the viewport. Translates downward with the user's finger (capped at 80px)
 * and shows a spinner once `isRefreshing` flips true.
 *
 * Pure presentation — wire it up via the hook's returned state.
 */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 90,
}: PullToRefreshIndicatorProps) {
  const visible = pullDistance > 0 || isRefreshing;
  const clampedDistance = Math.min(pullDistance, 80);
  const ready = pullDistance >= threshold;
  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: clampedDistance,
          }}
          exit={{ opacity: 0, scale: 0.85, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[300] pointer-events-none"
          aria-hidden={!isRefreshing}
        >
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-lg shadow-black/30"
            style={{
              background: 'linear-gradient(135deg, rgba(13,27,46,0.85) 0%, rgba(30,58,95,0.85) 100%)',
            }}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
            ) : (
              <motion.div
                animate={{ rotate: ready ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ opacity: 0.4 + progress * 0.6 }}
              >
                <ArrowDown className="w-4 h-4 text-amber-200" />
              </motion.div>
            )}
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">
              {isRefreshing ? 'Actualizando' : ready ? 'Suelta' : 'Tira'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
