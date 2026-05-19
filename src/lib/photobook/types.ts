/**
 * Photo Book editor — shared types.
 *
 * The editor models a book as a Cover + a list of BookPage objects. Each
 * page has a layoutId (which dictates how many photo slots there are and
 * where text lives), an array of photo URLs (one per slot, `null` if empty)
 * and free-form text fields.
 *
 * Layouts/themes live in their own modules to keep this file purely a
 * vocabulary of contracts the rest of the editor agrees on.
 */

export type LayoutId =
  | 'cover'
  | '1-hero'
  | '2-stacked'
  | '2-side'
  | '3-mosaic'
  | '4-grid'
  | '6-grid'
  | 'text-only';

export type ThemeId =
  | 'editorial'
  | 'magazine'
  | 'vintage'
  | 'modern'
  | 'brutalist'   // Neo-brutalist: oversized mono type + raw black borders
  | 'y2k'         // Cybernetic neon gradients + holographic accents
  | 'zine'        // Punk DIY collage with mixed type + washi tape
  | 'glass'       // Glassmorphism: frosted translucent layers + soft blur
  | 'psychedelic';// 70s maximalist: vibrant dreamy gradients + groovy frame

export type BookSize = 'a4' | 'square' | 'letter';

/** A rectangle in 0-1 relative coordinates, anchored to the page. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TextZoneKind = 'title' | 'subtitle' | 'caption' | 'body' | 'date' | 'location';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextZone extends Rect {
  kind: TextZoneKind;
  align?: TextAlign;
  /** Pt size used as a hint by PDF generator; preview scales by page width. */
  size?: number;
  /** If true, render in italic. */
  italic?: boolean;
  /** Optional uppercase rendering. */
  upper?: boolean;
}

export interface LayoutDefinition {
  id: LayoutId;
  label: string;
  slotCount: number;
  /** Photo slots in 0-1 space. */
  slots: Rect[];
  /** Text zones. Optional in case a layout has no text. */
  textZones: TextZone[];
}

export interface BookTheme {
  id: ThemeId;
  label: string;
  /** Page background CSS color (HTML) and PDF RGB. */
  background: string;
  /** Inner "paper" surface where photos sit. */
  paper: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Title/accent color. */
  accent: string;
  /** Hairline rules. */
  rule: string;
  /** Font tokens used in the HTML preview. PDF maps these to built-ins. */
  fontFamily: {
    serif: string;
    sans: string;
    script: string;
  };
  /** Which family to use for titles. */
  titleFontKey: 'serif' | 'sans' | 'script';
  /** Which family to use for body. */
  bodyFontKey: 'serif' | 'sans' | 'script';
  /** Apply sepia filter to photos. */
  sepia: boolean;
  /** Optional decorations. */
  decorations:
    | 'none'
    | 'dashed-borders'
    | 'corner-flourish'
    | 'paper-noise'
    | 'geometric-bars'
    | 'mono-borders'      // brutalist: thick exposed black frames
    | 'neon-glow'         // y2k: glowing accent strokes + scanlines
    | 'tape-strips'       // zine: angled washi-tape corners
    | 'glass-blur'        // glassmorphism: soft translucent overlay rect
    | 'psychedelic-frame'; // maximalist: concentric color rings in corners
  /** A handful of curated swatches for quick page-bg picks. */
  swatches: string[];
}

export interface BookPage {
  id: string;
  layoutId: LayoutId;
  /** Length must equal LAYOUTS[layoutId].slotCount. `null` = empty slot. */
  photoUrls: (string | null)[];
  title?: string;
  subtitle?: string;
  caption?: string;
  date?: string;
  location?: string;
  body?: string;
  /** Optional per-page background override (hex). Falls back to theme bg. */
  background?: string;
}

export interface BookState {
  theme: ThemeId;
  size: BookSize;
  cover: BookPage;
  pages: BookPage[];
}
