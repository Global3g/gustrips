/**
 * Slideshow domain types.
 *
 * Everything the editor + viewer agree on lives here so we have a single
 * source of truth for serialisation to localStorage and for the prop
 * contracts between the configuration screen and the fullscreen viewer.
 *
 * The shape is versioned (`version: 1`) so future migrations can read old
 * stored state without crashing.
 */

import type { AlbumPhoto } from '@/types';

/** A photo as it travels through the slideshow stack. Extends AlbumPhoto
 *  with an optional `eventTitle` for the caption overlay so the viewer
 *  doesn't have to keep peeking at the events map. */
export interface SlideshowPhoto extends AlbumPhoto {
  eventTitle?: string;
}

export type TransitionId =
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'dissolve'
  | 'kenburns'
  | 'cut';

export type FilterId =
  | 'none'
  | 'sepia'
  | 'bw'
  | 'warm'
  | 'cool'
  | 'vintage';

export type MusicId =
  | 'none'
  | 'chill'
  | 'cinematic'
  | 'happy'
  | 'romantic'
  | 'travel';

/** What the caption overlay renders.
 *  - `all`     → caption + date + event + location
 *  - `dateOnly`→ minimal "date" stamp
 *  - `none`    → no text overlay at all
 */
export type CaptionMode = 'all' | 'dateOnly' | 'none';

/** Visual theme of the caption overlay. */
export type OverlayThemeId = 'auto' | 'cinema' | 'minimal';

/** Photo order — `custom` keeps the user's hand-sorted list. */
export type OrderMode = 'chrono' | 'shuffle' | 'custom';

/** Persisted slideshow configuration. The viewer treats this as
 *  read-only; the editor mutates it through setSettings(...). */
export interface SlideshowSettings {
  version: 1;
  /** URLs the user kept in the show. Subset of the pool. */
  selectedUrls: string[];
  /** Source order. `custom` is the only mode that uses `customOrder`. */
  order: OrderMode;
  /** Stable seed so `shuffle` is reproducible across reloads. */
  shuffleSeed: number;
  /** Explicit URL ordering for `order === 'custom'`. */
  customOrder: string[];
  /** Seconds each photo stays on screen. 1–15. */
  durationPerSlide: number;
  transition: TransitionId;
  filter: FilterId;
  music: MusicId;
  /** 0–100, mapped to HTMLMediaElement.volume. */
  musicVolume: number;
  caption: CaptionMode;
  overlayTheme: OverlayThemeId;
  loop: boolean;
}

/** Returned by the viewer on exit so the page can route back. */
export type SlideshowExitReason = 'user' | 'ended';
