'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { formatDateES, classNames } from '@/lib/utils/helpers';
import type { AlbumPhoto, TripEvent } from '@/types';

/**
 * Fullscreen, one-photo-at-a-time slideshow. Owns the keyboard, click-zone
 * and auto-advance state internally — page just feeds it photos + a way to
 * resolve event metadata for the caption overlay.
 *
 * Designed to render as a top-level fixed overlay (z-[100]) above the app
 * sidebar; it also opts into the browser's real fullscreen API when the user
 * hits the dedicated button so it can hide the OS chrome on supported
 * platforms. We don't auto-enter fullscreen on mount because that requires a
 * user gesture in most browsers — instead the entry CTA on /photos calls us
 * already inside a gesture, so the page-side launcher can request it before
 * navigating if desired.
 */
export interface SlideshowPhoto extends AlbumPhoto {
  eventTitle?: string;
}

interface SlideshowViewerProps {
  photos: SlideshowPhoto[];
  tripTitle?: string;
  eventsById: Map<string, TripEvent>;
  onExit: () => void;
  initialIndex?: number;
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 4000;
const FADE_MS = 300;

export default function SlideshowViewer({
  photos,
  tripTitle,
  eventsById,
  onExit,
  initialIndex = 0,
  intervalMs = DEFAULT_INTERVAL_MS,
}: SlideshowViewerProps) {
  const [index, setIndex] = useState(() => {
    if (!photos.length) return 0;
    return Math.max(0, Math.min(initialIndex, photos.length - 1));
  });
  const [isPlaying, setIsPlaying] = useState(true);
  // Resets to 0 every time we advance; drives the bottom progress bar so it
  // visually tracks the auto-advance cadence even after we pause.
  const [progressKey, setProgressKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = photos.length;
  const current = total > 0 ? photos[index] : null;
  const linkedEvent = current?.eventId ? eventsById.get(current.eventId) : undefined;

  const goNext = useCallback(() => {
    if (total === 0) return;
    setIndex((i) => (i + 1) % total);
    setProgressKey((k) => k + 1);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total === 0) return;
    setIndex((i) => (i - 1 + total) % total);
    setProgressKey((k) => k + 1);
  }, [total]);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
    setProgressKey((k) => k + 1);
  }, []);

  /* ── Auto-advance timer ──
     Re-armed every time index or play state changes. Cleared on unmount and
     whenever the user manually navigates so the progress bar stays in sync. */
  useEffect(() => {
    if (!isPlaying || total === 0) return;
    const id = window.setTimeout(goNext, intervalMs);
    return () => window.clearTimeout(id);
  }, [index, isPlaying, intervalMs, goNext, total]);

  /* ── Keyboard shortcuts ──
     Listening on window so focus state inside the viewer doesn't matter. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, togglePlay, onExit]);

  /* ── Lock body scroll while open ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Best-effort fullscreen on mount ──
     Browsers gate the Fullscreen API behind a user gesture, but navigations
     triggered from a click on /photos count as one, so this typically lands.
     If it doesn't, the position:fixed overlay still covers everything. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const req = (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
      .requestFullscreen?.bind(el)
      ?? (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
        .webkitRequestFullscreen?.bind(el);
    if (typeof req === 'function') {
      try { void req(); } catch { /* user-gesture missing, fall back to overlay */ }
    }
    return () => {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => { /* already exited */ });
      }
    };
  }, []);

  const handleZoneClick = (side: 'left' | 'right') => () => {
    if (side === 'left') goPrev();
    else goNext();
  };

  if (total === 0 || !current) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-zinc-100"
      >
        <p className="text-lg">No hay fotos para mostrar.</p>
        <button
          onClick={onExit}
          className="mt-6 rounded-full bg-white/10 px-5 py-2 text-sm hover:bg-white/20"
        >
          Volver
        </button>
      </div>
    );
  }

  const photoSrc = current.fullUrl || current.url;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] select-none bg-black text-zinc-100"
      role="dialog"
      aria-modal="true"
      aria-label="Slideshow de fotos"
    >
      {/* ── Click zones (left / right halves of the frame) ──
          Sit below the image but above the background so taps on the photo
          margins navigate without intercepting the floating control buttons. */}
      <button
        type="button"
        aria-label="Foto anterior"
        onClick={handleZoneClick('left')}
        className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-w-resize focus:outline-none"
      />
      <button
        type="button"
        aria-label="Foto siguiente"
        onClick={handleZoneClick('right')}
        className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-e-resize focus:outline-none"
      />

      {/* ── The photo, with crossfade between indices ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${index}-${current.url}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000, ease: 'easeOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {/* Next/Image with `fill` keeps the photo entirely visible and lets
              Next handle responsive sizing + format negotiation. */}
          <Image
            src={photoSrc}
            alt={current.caption || current.eventTitle || tripTitle || 'Foto del viaje'}
            fill
            sizes="100vw"
            priority
            className="object-contain"
            // The slideshow blasts through photos quickly, so disable the
            // shimmer placeholder — it's more flicker than help here.
            placeholder="empty"
            unoptimized
          />
        </motion.div>
      </AnimatePresence>

      {/* ── Top-left: trip title + counter ── */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-[60vw] sm:left-6 sm:top-6">
        {tripTitle ? (
          <p className="truncate text-xs uppercase tracking-[0.18em] text-zinc-400 sm:text-sm">
            {tripTitle}
          </p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-zinc-200 sm:text-base">
          {index + 1} <span className="text-zinc-500">de</span> {total}
        </p>
      </div>

      {/* ── Top-right: floating controls ── */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-5 sm:top-5">
        <FloatingButton
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          title={isPlaying ? 'Pausar (espacio)' : 'Reproducir (espacio)'}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </FloatingButton>
        <FloatingButton
          onClick={onExit}
          aria-label="Salir"
          title="Salir (Esc)"
        >
          <X className="h-5 w-5" />
        </FloatingButton>
      </div>

      {/* ── Side nav arrows (large screens only — mobile users tap zones) ── */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden items-center pl-4 md:flex">
        <FloatingButton
          onClick={goPrev}
          aria-label="Foto anterior"
          title="Anterior (←)"
          className="pointer-events-auto"
        >
          <ChevronLeft className="h-6 w-6" />
        </FloatingButton>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden items-center pr-4 md:flex">
        <FloatingButton
          onClick={goNext}
          aria-label="Foto siguiente"
          title="Siguiente (→)"
          className="pointer-events-auto"
        >
          <ChevronRight className="h-6 w-6" />
        </FloatingButton>
      </div>

      {/* ── Caption overlay (bottom) ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/55 to-transparent pb-8 pt-16 sm:pb-10">
        <div className="mx-auto max-w-3xl px-6">
          {current.caption ? (
            <p className="text-base font-medium leading-snug text-white drop-shadow sm:text-lg">
              {current.caption}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-300 sm:text-sm">
            {current.date ? (
              <span className="capitalize text-amber-200/90">
                {formatDateES(current.date)}
              </span>
            ) : null}
            {linkedEvent?.title || current.eventTitle ? (
              <span className="flex items-center gap-1.5 text-rose-200/90">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-rose-300/70" />
                {linkedEvent?.title || current.eventTitle}
              </span>
            ) : null}
            {linkedEvent?.city || linkedEvent?.country ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-zinc-500" />
                {[linkedEvent?.city, linkedEvent?.country].filter(Boolean).join(', ')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Progress bar ──
          Keyed off (index, isPlaying, progressKey) so it visibly restarts
          every time we advance/reset and freezes while paused. */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] overflow-hidden bg-white/10">
        <motion.div
          key={`${index}-${progressKey}-${isPlaying ? 'p' : 's'}`}
          initial={{ width: '0%' }}
          animate={{ width: isPlaying ? '100%' : '0%' }}
          transition={{ duration: isPlaying ? intervalMs / 1000 : 0, ease: 'linear' }}
          className="h-full bg-gradient-to-r from-amber-300 to-rose-300"
        />
      </div>
    </div>
  );
}

interface FloatingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

function FloatingButton({ children, className, ...rest }: FloatingButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={classNames(
        'pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full',
        'bg-white/10 text-zinc-100 backdrop-blur-md transition',
        'hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70',
        className,
      )}
    >
      {children}
    </button>
  );
}
