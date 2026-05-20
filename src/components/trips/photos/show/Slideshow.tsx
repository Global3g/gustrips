'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';
import { FILTERS, MUSIC, volumeToMedia } from '@/lib/slideshow/presets';
import type {
  SlideshowPhoto,
  SlideshowSettings as SlideshowSettingsType,
} from '@/lib/slideshow/types';
import type { TripEvent } from '@/types';
import CaptionOverlay from './CaptionOverlay';

interface SlideshowProps {
  photos: SlideshowPhoto[];
  settings: SlideshowSettingsType;
  tripTitle?: string;
  eventsById: Map<string, TripEvent>;
  onExit: () => void;
  initialIndex?: number;
}

const MIN_FADE_MS = 220;
const MAX_FADE_MS = 700;
/** Auto-hide controls after this many ms of mouse idle. */
const CONTROLS_IDLE_MS = 3000;

/** Same hash + ken-burns helpers as the mini preview. Inlined to avoid
 *  pulling MiniPreview into the viewer bundle. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function kenBurnsForSeed(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(n) * 10000;
    return (x - Math.floor(x)) * 2 - 1;
  };
  const dx = rand(seed) * 5;
  const dy = rand(seed + 1) * 5;
  return {
    initial: { scale: 1.05, x: '0%', y: '0%' },
    animate: { scale: 1.18, x: `${dx}%`, y: `${dy}%` },
  };
}

/** Narrow ease type so TS doesn't widen the string-literal to `string`. */
type EaseName = 'easeIn' | 'easeOut' | 'easeInOut' | 'linear';

/** Pick motion props that match the user's chosen transition. */
function motionForTransition(
  transition: SlideshowSettingsType['transition'],
  slideMs: number,
): {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
} {
  const fadeMs = Math.min(MAX_FADE_MS, Math.max(MIN_FADE_MS, slideMs * 0.25));
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
        initial: { opacity: 0, x: '10%' },
        animate: { opacity: 1, x: '0%' },
        exit:    { opacity: 0, x: '-10%' },
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
        initial: { opacity: 0, scale: 1.03 },
        animate: { opacity: 1, scale: 1 },
        exit:    { opacity: 0, scale: 0.99 },
        transition: { duration: t * 1.5, ease },
      };
    case 'kenburns':
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

function FloatingButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={classNames(
        'pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full',
        'bg-white/10 text-zinc-100 backdrop-blur-md transition',
        'hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70',
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function Slideshow({
  photos,
  settings,
  tripTitle,
  eventsById,
  onExit,
  initialIndex = 0,
}: SlideshowProps) {
  const total = photos.length;
  const [index, setIndex] = useState(() => {
    if (total === 0) return 0;
    return Math.max(0, Math.min(initialIndex, total - 1));
  });
  const [isPlaying, setIsPlaying] = useState(true);
  const [progressKey, setProgressKey] = useState(0);
  /** Lets the user toggle the filter off temporarily (with `f`) so they
   *  can see the unfiltered original — useful for power users. */
  const [filterEnabled, setFilterEnabled] = useState(true);
  /** Muted state is independent of musicVolume so the user can mute
   *  without losing their volume. */
  const [muted, setMuted] = useState(false);
  /** True while the user is moving the mouse or recently was. Drives the
   *  auto-hide of the floating control bar. */
  const [controlsVisible, setControlsVisible] = useState(true);
  /** True if HTMLAudio's autoplay was blocked. We surface a full-bleed
   *  overlay so the user can manually unlock it with one tap. */
  const [audioBlocked, setAudioBlocked] = useState(false);
  /** When true, the floating volume slider hovers below the mute icon.
   *  Toggled by hovering the music icon on desktop, or by long-press
   *  on touch devices (handled via the button's onPointerDown). */
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  /** Live volume state — mirrors settings.musicVolume but owned by the
   *  viewer so the slider can be tweaked without going through page
   *  state. Persisted via the keyboard shortcut handler too. */
  const [localVolume, setLocalVolume] = useState(settings.musicVolume);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const filterDef = useMemo(
    () => FILTERS.find((f) => f.id === settings.filter) ?? FILTERS[0],
    [settings.filter],
  );

  const musicDef = useMemo(
    () => MUSIC.find((m) => m.id === settings.music) ?? MUSIC[0],
    [settings.music],
  );

  const current = total > 0 ? photos[index] : null;
  const linkedEvent = current?.eventId ? eventsById.get(current.eventId) : undefined;
  const slideMs = Math.max(500, settings.durationPerSlide * 1000);

  // ── Navigation ────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (total === 0) return;
    setIndex((i) => {
      const next = i + 1;
      if (next >= total) {
        // Reached the end. Loop or freeze on the last frame.
        if (settings.loop) return 0;
        setIsPlaying(false);
        return total - 1;
      }
      return next;
    });
    setProgressKey((k) => k + 1);
  }, [total, settings.loop]);

  const goPrev = useCallback(() => {
    if (total === 0) return;
    setIndex((i) => (i - 1 + total) % total);
    setProgressKey((k) => k + 1);
  }, [total]);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
    setProgressKey((k) => k + 1);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  // ── Auto-advance ────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || total === 0) return;
    const id = window.setTimeout(goNext, slideMs);
    return () => window.clearTimeout(id);
  }, [index, isPlaying, slideMs, goNext, total]);

  // ── Pause on tab hidden ──────────────────────────────────
  // Always enabled (per spec). Resume on visibility return is intentionally
  // opt-in via the play button so we don't surprise the user mid-room.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setIsPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowUp':
          e.preventDefault();
          // Drive the slider through React state instead of the bare DOM
          // node so the visible volume readout (and the popover slider)
          // stay in sync with what's actually applied to the audio.
          setLocalVolume((v) => Math.min(100, v + 5));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setLocalVolume((v) => Math.max(0, v - 5));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setFilterEnabled((v) => !v);
          break;
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          togglePlay();
          break;
        case 'Escape':
          e.preventDefault();
          onExit();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, togglePlay, toggleMute, onExit]);

  // ── Body scroll lock ─────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Best-effort browser fullscreen ───────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    type FSEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const fsEl = el as FSEl;
    const req = fsEl.requestFullscreen?.bind(el) ?? fsEl.webkitRequestFullscreen?.bind(el);
    if (typeof req === 'function') {
      try { void req(); } catch { /* user-gesture missing → overlay still covers everything */ }
    }
    return () => {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => { /* already exited */ });
      }
    };
  }, []);

  // ── Audio: track + volume + autoplay handshake ───────────
  // The audio element is recreated whenever the chosen track changes
  // (different `key` prop below). We set volume + muted imperatively on
  // every change because the React `defaultVolume` / `muted` attrs only
  // apply on mount, and we want live updates while the user scrubs.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volumeToMedia(localVolume);
    audio.muted = muted;
  }, [localVolume, muted, musicDef.url]);

  // Autoplay handshake. Re-runs whenever the chosen track URL changes
  // or play/pause is toggled. We intentionally do NOT depend on
  // `settings.musicVolume` or `muted` here — those are mutated through
  // the imperative effect above, so changing them shouldn't restart the
  // track from 0:00.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicDef.url) return;
    // Browsers gate autoplay-with-sound on a user gesture. The viewer
    // is mounted right after the user clicks "Iniciar", so the gesture
    // is still considered active here and play() usually succeeds. If
    // it doesn't (e.g. browser has stricter Media Engagement settings
    // for this site), we surface a big overlay CTA so the user can
    // unlock audio with one tap. We do NOT silently fall back to mute.
    const tryPlay = async () => {
      try {
        await audio.play();
        setAudioBlocked(false);
      } catch (err) {
        // Helpful in DevTools; users see the CTA instead of a console.
        if (process.env.NODE_ENV !== 'production') {
           
          console.warn('[Slideshow] audio.play() blocked:', err);
        }
        setAudioBlocked(true);
      }
    };
    if (isPlaying) void tryPlay();
    else audio.pause();
  }, [isPlaying, musicDef.url]);

  const handleUnlockAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Calling .play() inside this click handler is the textbook way to
    // satisfy the autoplay policy — the click is a fresh user gesture
    // that browsers treat as sufficient activation.
    try {
      audio.muted = false;
      await audio.play();
      setMuted(false);
      setAudioBlocked(false);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
         
        console.warn('[Slideshow] manual unlock failed:', err);
      }
      setAudioBlocked(true);
    }
  }, []);

  // ── Controls auto-hide ───────────────────────────────────
  useEffect(() => {
    const reset = () => {
      setControlsVisible(true);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
    };
    reset();
    window.addEventListener('mousemove', reset);
    window.addEventListener('touchstart', reset);
    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('touchstart', reset);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

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
  const motionProps = motionForTransition(settings.transition, slideMs);
  const kbSeed = hash(current.url);
  const kb = kenBurnsForSeed(kbSeed);
  const appliedFilter = filterEnabled ? filterDef.cssFilter : 'none';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] select-none bg-black text-zinc-100"
      role="dialog"
      aria-modal="true"
      aria-label="Slideshow de fotos"
    >
      {/* ── Music ── */}
      {musicDef.url ? (
        <audio
          key={musicDef.id}
          ref={audioRef}
          src={musicDef.url}
          loop
          preload="auto"
        />
      ) : null}

      {/* ── Click zones (left / right halves) ── */}
      <button
        type="button"
        aria-label="Foto anterior"
        onClick={goPrev}
        className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-w-resize focus:outline-none"
      />
      <button
        type="button"
        aria-label="Foto siguiente"
        onClick={goNext}
        className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-e-resize focus:outline-none"
      />

      {/* ── Photo + transition ── */}
      <AnimatePresence mode={settings.transition === 'cut' ? 'wait' : 'sync'} initial={false}>
        <motion.div
          key={`${index}-${current.url}`}
          {...motionProps}
          className="absolute inset-0"
        >
          {settings.transition === 'kenburns' ? (
            // Ken-burns: inner div pans+zooms across the entire slide
            // length. Outer motion.div handles the crossfade.
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={kb.initial}
              animate={kb.animate}
              transition={{ duration: settings.durationPerSlide, ease: 'linear' as EaseName }}
              style={{ filter: appliedFilter, transformOrigin: 'center' }}
            >
              <Image
                src={photoSrc}
                alt={current.caption || current.eventTitle || tripTitle || 'Foto del viaje'}
                fill
                sizes="100vw"
                priority
                className="object-contain"
                placeholder="empty"
                unoptimized
              />
            </motion.div>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ filter: appliedFilter }}
            >
              <Image
                src={photoSrc}
                alt={current.caption || current.eventTitle || tripTitle || 'Foto del viaje'}
                fill
                sizes="100vw"
                priority
                className="object-contain"
                placeholder="empty"
                unoptimized
              />
            </div>
          )}

          {settings.caption !== 'none' && (
            <CaptionOverlay
              photo={current}
              event={linkedEvent}
              mode={settings.caption}
              theme={settings.overlayTheme}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Top-left counter ── */}
      <div
        className={classNames(
          'pointer-events-none absolute left-4 top-4 z-20 max-w-[60vw] sm:left-6 sm:top-6 transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        {tripTitle ? (
          <p className="truncate text-xs uppercase tracking-[0.18em] text-zinc-400 sm:text-sm">
            {tripTitle}
          </p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-zinc-200 sm:text-base">
          {index + 1} <span className="text-zinc-500">de</span> {total}
        </p>
      </div>

      {/* ── Top-right floating controls ── */}
      <div
        className={classNames(
          'absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-5 sm:top-5 transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <FloatingButton
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          title={isPlaying ? 'Pausar (espacio)' : 'Reproducir (espacio)'}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </FloatingButton>
        {musicDef.url ? (
          // Wrapper so the popover anchors below the icon. We open the
          // popover on hover (desktop) and on click (touch) — toggling
          // mute remains the primary click action.
          <div
            className="relative"
            onMouseEnter={() => setVolumePopoverOpen(true)}
            onMouseLeave={() => setVolumePopoverOpen(false)}
          >
            <FloatingButton
              onClick={toggleMute}
              aria-label={muted ? 'Activar audio' : 'Silenciar'}
              title={muted ? 'Activar audio (m)' : 'Silenciar (m) · ↑↓ volumen'}
              className={muted ? 'ring-1 ring-rose-300/60' : ''}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </FloatingButton>
            {volumePopoverOpen && !muted ? (
              <div
                role="group"
                aria-label="Volumen"
                className="absolute right-0 top-12 z-30 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 backdrop-blur-md shadow-2xl shadow-black/60 ring-1 ring-white/10"
              >
                <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold whitespace-nowrap">
                  Vol
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={localVolume}
                  onChange={(e) => setLocalVolume(Number(e.target.value))}
                  aria-label="Volumen de la música"
                  className="w-28 accent-emerald-400"
                />
                <span className="text-[10px] text-white/70 tabular-nums w-7 text-right">
                  {localVolume}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
        <FloatingButton
          onClick={() => setFilterEnabled((v) => !v)}
          aria-label={filterEnabled ? 'Quitar filtro' : 'Aplicar filtro'}
          title={filterEnabled ? 'Quitar filtro (f)' : 'Aplicar filtro (f)'}
        >
          <SlidersHorizontal className={classNames('h-5 w-5', filterEnabled ? '' : 'opacity-50')} />
        </FloatingButton>
        <FloatingButton
          onClick={onExit}
          aria-label="Salir"
          title="Salir (Esc)"
        >
          <X className="h-5 w-5" />
        </FloatingButton>
      </div>

      {/* ── Side nav arrows (desktop) ── */}
      <div
        className={classNames(
          'pointer-events-none absolute inset-y-0 left-0 z-20 hidden items-center pl-4 md:flex transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <FloatingButton onClick={goPrev} aria-label="Foto anterior" title="Anterior (←)" className="pointer-events-auto">
          <ChevronLeft className="h-6 w-6" />
        </FloatingButton>
      </div>
      <div
        className={classNames(
          'pointer-events-none absolute inset-y-0 right-0 z-20 hidden items-center pr-4 md:flex transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <FloatingButton onClick={goNext} aria-label="Foto siguiente" title="Siguiente (→)" className="pointer-events-auto">
          <ChevronRight className="h-6 w-6" />
        </FloatingButton>
      </div>

      {/* ── Audio-blocked overlay ──
          Big, central, dismissable. The browser blocked our autoplay
          (rare, since the user just clicked "Iniciar") — make it
          painfully obvious why they aren't hearing anything and give
          them a one-tap escape hatch. */}
      {audioBlocked && musicDef.url ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-zinc-950/85 px-8 py-7 ring-1 ring-white/10 shadow-2xl shadow-black/70 max-w-sm mx-4 text-center">
            <div className="rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/40 p-3">
              <Volume2 className="h-7 w-7 text-emerald-300" />
            </div>
            <div>
              <p className="text-white text-lg font-bold">Activá la música</p>
              <p className="text-white/60 text-sm mt-1 leading-snug">
                Tu navegador bloqueó la reproducción automática. Tocá el botón
                para escuchar el soundtrack del slideshow.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUnlockAudio}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-emerald-950 text-base font-black px-6 py-3 shadow-[0_8px_30px_rgba(16,185,129,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              <Volume2 className="h-5 w-5" strokeWidth={2.5} />
              Activar audio
            </button>
            <button
              type="button"
              onClick={() => setAudioBlocked(false)}
              className="text-white/45 hover:text-white/75 text-xs font-semibold uppercase tracking-wider"
            >
              Seguir sin audio
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Progress bar ── */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] overflow-hidden bg-white/10">
        <motion.div
          key={`${index}-${progressKey}-${isPlaying ? 'p' : 's'}`}
          initial={{ width: '0%' }}
          animate={{ width: isPlaying ? '100%' : '0%' }}
          transition={{ duration: isPlaying ? slideMs / 1000 : 0, ease: 'linear' as EaseName }}
          className="h-full bg-gradient-to-r from-amber-300 via-emerald-300 to-rose-300"
        />
      </div>
    </div>
  );
}
