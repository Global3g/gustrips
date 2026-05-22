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
  | 'text-only'
  // Vol. 2 (Mixbook/Shutterfly-grade catalogue)
  | 'map-full'         // decorative SVG map with photo "pins"
  | 'polaroid-grid'    // 6 polaroids scattered with rotation
  | 'quote-callout'    // small photo + giant pull quote
  | 'magazine-3col'    // hero photo + 3-column body
  | 'timeline-strip'   // 5 photos in a horizontal strip
  | 'panorama-bleed'   // full-bleed wide hero
  | 'journal-page'     // diary entry + 1 photo
  | 'chapter-divider'  // chapter number + giant title
  | 'mosaic-9'         // dense 3×3 grid
  | 'split-vertical';  // 50/50 text + photo

export type ThemeId =
  | 'editorial'
  | 'magazine'
  | 'vintage'
  | 'modern'
  | 'brutalist'   // Neo-brutalist: oversized mono type + raw black borders
  | 'y2k'         // Cybernetic neon gradients + holographic accents
  | 'zine'        // Punk DIY collage with mixed type + washi tape
  | 'glass'       // Glassmorphism: frosted translucent layers + soft blur
  | 'psychedelic' // 70s maximalist: vibrant dreamy gradients + groovy frame
  | 'wes'         // Wes Anderson Symétrie: powdered pastels + symmetric crests
  | 'postal'      // Postal Vintage Junk Drawer: stamps + washi tape + airmail
  | 'cinemagraph' // Editorial Cinema: bone cream + deep cherry + serif display
  | 'riso'        // Risograph: 2-color flat halftone + offset registration
  | 'japandi'     // Japandi / Wabi-Sabi: smokey jade + walnut, enso accent
  | 'earthy'      // Neo-Minimal Earthy: olive + chocolate + ivory, grid 12
  | 'botanical'   // Botanical Press: pressed flowers + latin labels herbarium
  | 'doodle';     // Naive Doodle / Notes App Chic: handdrawn arrows + smileys

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
    | 'psychedelic-frame' // maximalist: concentric color rings in corners
    | 'wes-symmetry'      // wes anderson: 8-point stars + double rule frame
    | 'postal-junk'       // postal junk drawer: stamps + washi tape + stripes
    | 'editorial-cinema'  // editorial cinema: hairline rule + romanish folio
    | 'riso-halftone'     // risograph: halftone dots + offset 2-color frames
    | 'enso-accent'       // japandi: lone hairline circle + vertical hairline
    | 'linen-grid'        // earthy: linen texture + 12-col gridlines + folio
    | 'herbarium-press'   // botanical: pressed leaves + latin label band
    | 'doodle-marks';     // naive: scribbled arrows + smiley sun + asterisks
  /** A handful of curated swatches for quick page-bg picks. */
  swatches: string[];
}

/* ── Vol. 2: per-photo filter ───────────────────────────────
   Cada slot puede tener su propio filtro (CSS para preview + pixel
   manipulation para PDF). `null` = sin filtro. */
export type PhotoFilter =
  | 'none'
  | 'sepia'
  | 'bw'
  | 'vintage'
  | 'cool'
  | 'warm'
  | 'highContrast'
  | 'soft'
  | 'duotone-blue'
  | 'duotone-rose';

/* ── Vol. 2: per-photo frame ────────────────────────────────
   El frame envuelve al slot — borde polaroid, redondeado, círculo,
   hexágono, washi tape, borde envejecido. */
export type PhotoFrame =
  | 'none'
  | 'polaroid'
  | 'rounded'
  | 'circle'
  | 'hexagon'
  | 'tape'
  | 'vintage-edge';

/* ── Vol. 2: sticker library ────────────────────────────────
   SVG stickers temáticos viajeros. Cada uno posicionado en
   coords 0-1 + scale + rotation. */
export type StickerKind =
  | 'airplane'
  | 'suitcase'
  | 'camera'
  | 'passport'
  | 'compass'
  | 'globe'
  | 'map-pin'
  | 'palm-tree'
  | 'mountain'
  | 'sun'
  | 'stamp-postal'
  | 'ticket-stub'
  | 'heart'
  | 'star'
  | 'arrow'
  | 'route-dashed'
  | 'text-adventures'
  | 'text-memories'
  | 'text-wanderlust';

export interface Sticker {
  id: string;
  kind: StickerKind;
  /** 0-1 relative to page width. */
  x: number;
  /** 0-1 relative to page height. */
  y: number;
  /** 0.4–2. */
  scale: number;
  /** Degrees, -180..180. */
  rotation: number;
  /** Optional hex override; otherwise sticker uses a default tone. */
  color?: string;
}

/* ── Vol. 2: background patterns ────────────────────────────
   Overlay encima del color de fondo. */
export type BookPatternId =
  | 'none'
  | 'paper'
  | 'dots'
  | 'stripes-diagonal'
  | 'grid'
  | 'map'
  | 'confetti';

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
  /* ── Vol. 2 ───────────────────────────────────────────────
     All optional — pages that pre-date the expansion stay valid. */
  /** Length must equal photoUrls.length when present. */
  photoFilters?: (PhotoFilter | null)[];
  /** Length must equal photoUrls.length when present. */
  photoFrames?: (PhotoFrame | null)[];
  /** Per-slot captions (used by polaroid-grid, timeline-strip, etc.). */
  slotCaptions?: (string | null)[];
  /** Per-slot custom crop (overrides default cover-fit framing). */
  slotCrops?: (SlotCrop | null)[];
  /** Decorative stickers floating on top of the page. */
  stickers?: Sticker[];
  /** Pattern overlay on top of the bg color. */
  backgroundPattern?: BookPatternId;
}

/**
 * Manual crop rectangle for a photo inside a slot. All values are normalized
 * 0..1 against the original image's natural dimensions, so the same crop
 * survives when the slot is resized by a layout change. When absent the
 * renderer falls back to centered cover-fit (the default behaviour).
 */
export interface SlotCrop {
  x: number; // left edge (0..1)
  y: number; // top edge (0..1)
  w: number; // width (0..1)
  h: number; // height (0..1)
}

export interface BookState {
  theme: ThemeId;
  size: BookSize;
  cover: BookPage;
  pages: BookPage[];
}
