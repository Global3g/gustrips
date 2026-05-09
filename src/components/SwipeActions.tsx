'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useAnimationControls, type PanInfo } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface SwipeAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  color: 'red' | 'amber' | 'emerald' | 'blue';
}

interface SwipeActionsProps {
  actions: SwipeAction[];
  children: React.ReactNode;
  /** When true, swipe is disabled and children render normally. */
  disabled?: boolean;
}

const ACTION_WIDTH = 80;

const COLOR_MAP: Record<SwipeAction['color'], string> = {
  red: 'bg-red-500/90 text-white',
  amber: 'bg-amber-500/90 text-white',
  emerald: 'bg-emerald-500/90 text-white',
  blue: 'bg-blue-500/90 text-white',
};

/**
 * Mobile swipe-to-reveal actions. Wrap a row in this component and pass an
 * array of actions — they'll appear behind the row when the user swipes left.
 *
 * Desktop: drag is disabled. The actions never show, so existing buttons
 * inside the row continue to work as before.
 */
export function SwipeActions({ actions, children, disabled = false }: SwipeActionsProps) {
  const [isTouch, setIsTouch] = useState(false);
  const [open, setOpen] = useState(false);
  const x = useMotionValue(0);
  const controls = useAnimationControls();
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect touch capability on mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsTouch('ontouchstart' in window);
  }, []);

  const fullyOpen = -ACTION_WIDTH * actions.length;
  const dragEnabled = isTouch && !disabled && actions.length > 0;

  const close = () => {
    setOpen(false);
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 36 } });
  };

  const openTo = (target: number) => {
    setOpen(true);
    controls.start({ x: target, transition: { type: 'spring', stiffness: 400, damping: 36 } });
  };

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    if (!dragEnabled) return;
    const currentX = x.get();
    const velocity = info.velocity.x;

    // Decide based on a mix of distance and fling velocity.
    const halfway = fullyOpen / 2;
    const flingingOpen = velocity < -300;
    const flingingClosed = velocity > 300;

    if (flingingOpen || (currentX < halfway && !flingingClosed)) {
      openTo(fullyOpen);
    } else {
      close();
    }
  };

  // Close when tapping outside the row.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Trigger an action and close the drawer.
  const handleActionClick = (action: SwipeAction) => {
    action.onClick();
    close();
  };

  // If swipe is disabled (desktop or explicit), bypass framer-motion entirely.
  if (!dragEnabled) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* Action buttons sit behind the row, revealed as it slides left. */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch z-0"
        style={{ width: ACTION_WIDTH * actions.length }}
        aria-hidden={!open}
      >
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={`${action.label}-${i}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleActionClick(action);
              }}
              tabIndex={open ? 0 : -1}
              className={`flex flex-col items-center justify-center gap-1 ${COLOR_MAP[action.color]} transition-colors active:brightness-90`}
              style={{ width: ACTION_WIDTH }}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Draggable row. Tapping it while open closes the drawer. */}
      <motion.div
        drag="x"
        dragConstraints={{ left: fullyOpen, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onClickCapture={(e) => {
          if (open) {
            e.stopPropagation();
            e.preventDefault();
            close();
          }
        }}
        animate={controls}
        style={{ x }}
        className="relative z-10 bg-transparent touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
