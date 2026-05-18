/**
 * Slideshow presets — the option lists the editor renders and the viewer
 * applies. Centralised here so adding a new transition / filter / track is
 * a one-file change.
 *
 * `cssFilter` is the actual CSS `filter:` value applied to `<img>` /
 * `<div>` backgrounds. Keep these as strings — no template literals — so
 * the type stays narrow and tree-shaking is trivial.
 *
 * Music URLs are royalty-free preview tracks from Mixkit. They're hot-
 * linked because Mixkit serves them with permissive CORS and we don't want
 * to ship audio in the bundle.
 */

import type {
  CaptionMode,
  FilterId,
  MusicId,
  OverlayThemeId,
  TransitionId,
  SlideshowSettings,
} from './types';

export interface TransitionOption {
  id: TransitionId;
  label: string;
  description: string;
}

export const TRANSITIONS: TransitionOption[] = [
  { id: 'fade',     label: 'Fade',      description: 'Crossfade clásico entre fotos' },
  { id: 'slide',    label: 'Slide',     description: 'Desliza desde la derecha' },
  { id: 'zoom',     label: 'Zoom',      description: 'Pequeño zoom-in al aparecer' },
  { id: 'dissolve', label: 'Dissolve',  description: 'Fade más suave con escala' },
  { id: 'kenburns', label: 'Ken Burns', description: 'Pan y zoom continuo (Apple Memories)' },
  { id: 'cut',      label: 'Cut',       description: 'Instantáneo, sin transición' },
];

export interface FilterOption {
  id: FilterId;
  label: string;
  cssFilter: string;
}

export const FILTERS: FilterOption[] = [
  { id: 'none',    label: 'Ninguno',  cssFilter: 'none' },
  { id: 'sepia',   label: 'Sepia',    cssFilter: 'sepia(0.8)' },
  { id: 'bw',      label: 'B&W',      cssFilter: 'grayscale(1)' },
  { id: 'warm',    label: 'Cálido',   cssFilter: 'saturate(1.3) hue-rotate(-10deg)' },
  { id: 'cool',    label: 'Frío',     cssFilter: 'saturate(1.2) hue-rotate(10deg)' },
  { id: 'vintage', label: 'Vintage',  cssFilter: 'sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.85)' },
];

export interface MusicOption {
  id: MusicId;
  label: string;
  description: string;
  url: string | null;
}

/* ── Music tracks ───────────────────────────────────────────────────
   All URLs point to assets.mixkit.co/music/preview/* — Mixkit's
   royalty-free preview stream. They're served with CORS so HTMLAudio
   can play them without proxying. If a track 404s for any reason the
   viewer silently treats it as `none` (no music). */
export const MUSIC: MusicOption[] = [
  { id: 'none',      label: 'Sin música',     description: 'Solo las fotos', url: null },
  { id: 'chill',     label: 'Chill',          description: 'Relajada y luminosa', url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3' },
  { id: 'cinematic', label: 'Cinematográfica', description: 'Épica y orquestal', url: 'https://assets.mixkit.co/music/preview/mixkit-cinematic-trailer-impact-1232.mp3' },
  { id: 'happy',     label: 'Alegre',          description: 'Upbeat y soleada', url: 'https://assets.mixkit.co/music/preview/mixkit-happy-relax-day-642.mp3' },
  { id: 'romantic',  label: 'Romántica',       description: 'Emocional, instrumental', url: 'https://assets.mixkit.co/music/preview/mixkit-love-and-romance-emotional-cinematic-622.mp3' },
  { id: 'travel',    label: 'Viaje',           description: 'Aventurera, expansiva', url: 'https://assets.mixkit.co/music/preview/mixkit-adventure-of-life-538.mp3' },
];

export interface CaptionOption {
  id: CaptionMode;
  label: string;
  description: string;
}

export const CAPTIONS: CaptionOption[] = [
  { id: 'all',      label: 'Todo',       description: 'Caption + fecha + evento + lugar' },
  { id: 'dateOnly', label: 'Solo fecha', description: 'Minimalista, solo timestamp' },
  { id: 'none',     label: 'Sin texto',  description: 'Foto limpia, sin overlay' },
];

export interface OverlayThemeOption {
  id: OverlayThemeId;
  label: string;
  description: string;
}

export const OVERLAY_THEMES: OverlayThemeOption[] = [
  { id: 'auto',    label: 'Auto',    description: 'Gradiente abajo + texto blanco' },
  { id: 'cinema',  label: 'Cinema',  description: 'Barras negras + texto centrado' },
  { id: 'minimal', label: 'Minimal', description: 'Texto pequeño en esquina' },
];

/** Helper for converting the 0–100 musicVolume slider into the 0..1
 *  range HTMLMediaElement expects. Kept here so the editor and the
 *  viewer agree on the mapping. */
export function volumeToMedia(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(100, value)) / 100;
}

export const DEFAULT_SETTINGS: SlideshowSettings = {
  version: 1,
  selectedUrls: [],
  order: 'chrono',
  shuffleSeed: 1,
  customOrder: [],
  durationPerSlide: 4,
  transition: 'fade',
  filter: 'none',
  music: 'none',
  musicVolume: 50,
  caption: 'all',
  overlayTheme: 'auto',
  loop: true,
};

/** Format a total runtime in seconds as a human-friendly "Xm Ys" string.
 *  Used both in the editor preview ("Total: 2m 30s") and in the viewer's
 *  "end of show" overlay if/when we add one. */
export function formatRuntime(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/** Deterministic shuffle. Same seed → same order. The collage page uses
 *  this exact LCG, so behaviour is consistent across features. */
export function shuffleWithSeed<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
