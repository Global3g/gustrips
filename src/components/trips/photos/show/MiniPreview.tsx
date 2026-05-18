'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'framer-motion';
import { FILTERS, TRANSITIONS } from '@/lib/slideshow/presets';
import type {
  FilterId,
  OverlayThemeId,
  SlideshowPhoto,
  TransitionId,
  CaptionMode,
} from '@/lib/slideshow/types';
import type { TripEvent } from '@/types';
import CaptionOverlay from './CaptionOverlay';

interface MiniPreviewProps {
  /** Ordered photos AS THEY WILL APPEAR in the real show. We only sample
   *  the first N below, so passing the full list is fine. */
  photos: SlideshowPhoto[];
  eventsById: Map<string, TripEvent>;
  durationPerSlide: number;
  transition: TransitionId;
  filter: FilterId;
  caption: CaptionMode;
  overlayTheme: OverlayThemeId;
}

/** How many photos the live preview cycles through. Anything more and the
 *  user wastes attention waiting for a loop to come back around. 4 is the
 *  sweet spot Apple Memories uses for its in-editor previews too. */
const MAX_PREVIEW_PHOTOS = 4;

/** Single-photo render: chooses the right motion variants for each
 *  transition. Variants are evaluated by framer-motion and don't allocate
 *  per-render. Ken Burns is a special case — it pans+zooms during the
 *  slide itself, not in the entry/exit. */
/** Narrow type for the `ease` field so TS doesn't widen it to `string`. */
type EaseName = 'easeIn' | 'easeOut' | 'easeInOut' | 'linear';

function getMotionPropsForTransition(
  transition: TransitionId,
  durationMs: number,
): {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
} {
  // Reasonable in/out window — keep transitions snappy so they don't
  // eat the visible portion of the slide.
  const fadeMs = Math.min(700, Math.max(220, durationMs * 0.25));
  const t = fadeMs / 1000;
  const ease: EaseName = transition === 'dissolve' ? 'easeInOut' : 'easeOut';

  switch (transition) {
    case 'cut':
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit:    { opacity: 0 },
        transition: { duration: 0 },
      };
    case 'slide':
      return {
        initial: { opacity: 0, x: '12%' },
        animate: { opacity: 1, x: '0%' },
        exit:    { opacity: 0, x: '-12%' },
        transition: { duration: t, ease },
      };
    case 'zoom':
      return {
        initial: { opacity: 0, scale: 1.08 },
        animate: { opacity: 1, scale: 1 },
        exit:    { opacity: 0, scale: 0.96 },
        transition: { duration: t, ease },
      };
    case 'dissolve':
      return {
        initial: { opacity: 0, scale: 1.04 },
        animate: { opacity: 1, scale: 1 },
        exit:    { opacity: 0, scale: 0.98 },
        transition: { duration: t * 1.4, ease },
      };
    case 'kenburns':
      // Entry/exit are a simple crossfade — the actual ken-burns motion
      // happens via the inner `.ken-burns` animation below.
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit:    { opacity: 0 },
        transition: { duration: t, ease },
      };
    case 'fade':
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit:    { opacity: 0 },
        transition: { duration: t, ease },
      };
  }
}

/** Returns a CSS keyframes-style motion for ken-burns. We randomise the
 *  pan direction per photo (using its URL hash as the seed) so the show
 *  feels alive instead of identical pans every time. */
function kenBurnsTransform(seed: number) {
  // Pseudo-random in [-1, 1]
  const rand = (n: number) => {
    const x = Math.sin(n) * 10000;
    return (x - Math.floor(x)) * 2 - 1;
  };
  const dx = rand(seed) * 4;       // -4% to 4%
  const dy = rand(seed + 1) * 4;
  const startScale = 1.05;
  const endScale = 1.18;
  return {
    initial: { scale: startScale, x: '0%', y: '0%' },
    animate: { scale: endScale, x: `${dx}%`, y: `${dy}%` },
  };
}

/** Hash a string into a small integer — fine for ken-burns seed. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function MiniPreview({
  photos,
  eventsById,
  durationPerSlide,
  transition,
  filter,
  caption,
  overlayTheme,
}: MiniPreviewProps) {
  // We deliberately keep this list short. Even though the user might pick
  // 300 photos for the show, the preview just needs to demonstrate the
  // look — 4 photos is plenty.
  const previewPhotos = useMemo(
    () => photos.slice(0, MAX_PREVIEW_PHOTOS),
    [photos],
  );

  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Reset whenever the preview pool changes (e.g. user adds/removes a
  // photo) so the first frame is always a known one.
  useEffect(() => { setIndex(0); }, [previewPhotos.length]);

  useEffect(() => {
    if (previewPhotos.length === 0) return;
    const tick = () => {
      setIndex((i) => (i + 1) % previewPhotos.length);
    };
    timerRef.current = window.setTimeout(tick, durationPerSlide * 1000);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // The previewPhotos.length keeps the loop running with the current
    // length. We don't depend on `index` directly because that would
    // double-fire the timeout when the index advances.
  }, [index, durationPerSlide, previewPhotos.length]);

  const filterDef = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const transitionDef = TRANSITIONS.find((t) => t.id === transition) ?? TRANSITIONS[0];

  if (previewPhotos.length === 0) {
    return (
      <div className="aspect-video w-full rounded-2xl border border-white/10 bg-black/60 flex flex-col items-center justify-center text-white/55 text-sm gap-1 px-4 text-center">
        <span className="text-2xl">📷</span>
        <p>Elegí al menos una foto para previsualizar.</p>
      </div>
    );
  }

  const current = previewPhotos[index];
  const linkedEvent = current?.eventId ? eventsById.get(current.eventId) : undefined;
  const motionProps = getMotionPropsForTransition(transition, durationPerSlide * 1000);
  const kbSeed = hash(current?.url || '');
  const kb = kenBurnsTransform(kbSeed);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl shadow-black/40"
      aria-label="Previsualización en vivo del slideshow"
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={`${index}-${current.url}`}
          {...motionProps}
          className="absolute inset-0"
        >
          {transition === 'kenburns' ? (
            <motion.div
              className="absolute inset-0"
              initial={kb.initial}
              animate={kb.animate}
              transition={{ duration: durationPerSlide, ease: 'linear' as EaseName }}
              style={{
                backgroundImage: `url(${current.fullUrl || current.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: filterDef.cssFilter,
                transformOrigin: 'center',
              }}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${current.fullUrl || current.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: filterDef.cssFilter,
              }}
            />
          )}

          {caption !== 'none' && (
            <CaptionOverlay
              photo={current}
              event={linkedEvent}
              mode={caption}
              theme={overlayTheme}
              compact
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Tiny badge so the user knows it's a live preview, not the real
          show. Stays out of the way. */}
      <span className="absolute right-2 top-2 z-30 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/80">
        Preview · {transitionDef.label}
      </span>
    </div>
  );
}
