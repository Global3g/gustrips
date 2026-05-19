/**
 * Photo Book editor — layout catalogue.
 *
 * Each layout defines:
 *  - photo slots (rectangles in 0-1 relative coords)
 *  - text zones (where to render title/caption/etc.)
 *
 * Both the HTML preview and the PDF generator consume these definitions so
 * the WYSIWYG promise actually holds.
 *
 * Coordinates are anchored to the page (0,0 = top-left, 1,1 = bottom-right).
 * We intentionally keep generous outer margins (~6%) so nothing crowds the
 * edge of the print.
 */

import type { LayoutDefinition, LayoutId } from './types';

const M = 0.06; // page margin (relative)

export const LAYOUTS: Record<LayoutId, LayoutDefinition> = {
  // ─── Cover ─────────────────────────────────────────
  // Full-bleed photo with the title block laid over the lower third.
  cover: {
    id: 'cover',
    label: 'Tapa',
    slotCount: 1,
    slots: [{ x: 0, y: 0, w: 1, h: 1 }],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: 0.62,
        w: 1 - M * 2,
        h: 0.18,
        align: 'center',
        size: 38,
      },
      {
        kind: 'subtitle',
        x: M,
        y: 0.82,
        w: 1 - M * 2,
        h: 0.08,
        align: 'center',
        size: 14,
        upper: true,
      },
    ],
  },

  // ─── 1 hero ────────────────────────────────────────
  // Big hero photo at the top ~62% of the page, caption + body below.
  '1-hero': {
    id: '1-hero',
    label: '1 foto',
    slotCount: 1,
    slots: [{ x: M, y: M, w: 1 - M * 2, h: 0.62 }],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: 0.7,
        w: 1 - M * 2,
        h: 0.07,
        align: 'left',
        size: 22,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.78,
        w: 1 - M * 2,
        h: 0.04,
        align: 'left',
        size: 10,
        italic: true,
      },
      {
        kind: 'body',
        x: M,
        y: 0.83,
        w: 1 - M * 2,
        h: 0.11,
        align: 'left',
        size: 11,
      },
    ],
  },

  // ─── 2 stacked ─────────────────────────────────────
  // Two photos vertically stacked (top + bottom). Caption between.
  '2-stacked': {
    id: '2-stacked',
    label: '2 verticales',
    slotCount: 2,
    slots: [
      { x: M, y: M, w: 1 - M * 2, h: 0.4 },
      { x: M, y: 0.54, w: 1 - M * 2, h: 0.36 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: 0.47,
        w: 1 - M * 2,
        h: 0.05,
        align: 'left',
        size: 16,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.92,
        w: 1 - M * 2,
        h: 0.05,
        align: 'center',
        size: 10,
        italic: true,
      },
    ],
  },

  // ─── 2 side by side ────────────────────────────────
  '2-side': {
    id: '2-side',
    label: '2 lado a lado',
    slotCount: 2,
    slots: [
      { x: M, y: M + 0.06, w: 0.5 - M - 0.01, h: 0.74 },
      { x: 0.5 + 0.01, y: M + 0.06, w: 0.5 - M - 0.01, h: 0.74 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M,
        w: 1 - M * 2,
        h: 0.06,
        align: 'center',
        size: 18,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.87,
        w: 1 - M * 2,
        h: 0.06,
        align: 'center',
        size: 10,
        italic: true,
      },
    ],
  },

  // ─── 3 mosaic ──────────────────────────────────────
  // 1 large hero on left, 2 small stacked on right.
  '3-mosaic': {
    id: '3-mosaic',
    label: 'Mosaico 3',
    slotCount: 3,
    slots: [
      { x: M, y: M + 0.06, w: 0.58, h: 0.74 },
      { x: M + 0.6, y: M + 0.06, w: 1 - M * 2 - 0.6, h: 0.355 },
      { x: M + 0.6, y: M + 0.06 + 0.385, w: 1 - M * 2 - 0.6, h: 0.355 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M,
        w: 1 - M * 2,
        h: 0.06,
        align: 'left',
        size: 18,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.87,
        w: 1 - M * 2,
        h: 0.06,
        align: 'left',
        size: 10,
        italic: true,
      },
    ],
  },

  // ─── 4 grid ────────────────────────────────────────
  '4-grid': {
    id: '4-grid',
    label: 'Grid 2×2',
    slotCount: 4,
    slots: [
      { x: M, y: M + 0.06, w: 0.435, h: 0.36 },
      { x: 0.5 + 0.0125, y: M + 0.06, w: 0.435, h: 0.36 },
      { x: M, y: M + 0.06 + 0.39, w: 0.435, h: 0.36 },
      { x: 0.5 + 0.0125, y: M + 0.06 + 0.39, w: 0.435, h: 0.36 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M,
        w: 1 - M * 2,
        h: 0.06,
        align: 'center',
        size: 18,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.88,
        w: 1 - M * 2,
        h: 0.06,
        align: 'center',
        size: 10,
        italic: true,
      },
    ],
  },

  // ─── 6 grid ────────────────────────────────────────
  '6-grid': {
    id: '6-grid',
    label: 'Grid 3×2',
    slotCount: 6,
    slots: [
      { x: M, y: M + 0.06, w: 0.285, h: 0.36 },
      { x: M + 0.305, y: M + 0.06, w: 0.285, h: 0.36 },
      { x: M + 0.61, y: M + 0.06, w: 0.285, h: 0.36 },
      { x: M, y: M + 0.06 + 0.39, w: 0.285, h: 0.36 },
      { x: M + 0.305, y: M + 0.06 + 0.39, w: 0.285, h: 0.36 },
      { x: M + 0.61, y: M + 0.06 + 0.39, w: 0.285, h: 0.36 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M,
        w: 1 - M * 2,
        h: 0.06,
        align: 'left',
        size: 16,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.88,
        w: 1 - M * 2,
        h: 0.06,
        align: 'left',
        size: 10,
        italic: true,
      },
    ],
  },

  // ─── Text only ─────────────────────────────────────
  // Chapter page — big serif italic title, body underneath. No photos.
  'text-only': {
    id: 'text-only',
    label: 'Solo texto',
    slotCount: 0,
    slots: [],
    textZones: [
      {
        kind: 'title',
        x: 0.12,
        y: 0.28,
        w: 0.76,
        h: 0.14,
        align: 'center',
        size: 44,
        italic: true,
      },
      {
        kind: 'body',
        x: 0.18,
        y: 0.5,
        w: 0.64,
        h: 0.3,
        align: 'center',
        size: 14,
      },
    ],
  },

  /* ═══════════════════════════════════════════════════════════
     Vol. 2 — Mixbook/Shutterfly grade layouts
     ═══════════════════════════════════════════════════════════ */

  // ─── Map-full ──────────────────────────────────────
  // A decorative SVG map fills the page; 5 photo "pins" sit at hand-
  // tuned coordinates. The map artwork is drawn by the preview/PDF
  // (not from this rect data) — we only declare the slots & text zones.
  'map-full': {
    id: 'map-full',
    label: 'Mapa con pines',
    slotCount: 5,
    slots: [
      { x: 0.14, y: 0.22, w: 0.12, h: 0.12 },
      { x: 0.42, y: 0.32, w: 0.12, h: 0.12 },
      { x: 0.72, y: 0.24, w: 0.12, h: 0.12 },
      { x: 0.28, y: 0.58, w: 0.12, h: 0.12 },
      { x: 0.62, y: 0.62, w: 0.12, h: 0.12 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M,
        w: 1 - M * 2,
        h: 0.07,
        align: 'center',
        size: 22,
      },
      {
        kind: 'body',
        x: M,
        y: 0.78,
        w: 1 - M * 2,
        h: 0.16,
        align: 'center',
        size: 11,
        italic: true,
      },
    ],
  },

  // ─── Polaroid grid ─────────────────────────────────
  // 6 polaroids scattered with playful rotation. Rotation lives on
  // the FRAME (handled at render time, derived from index parity).
  'polaroid-grid': {
    id: 'polaroid-grid',
    label: 'Polaroids',
    slotCount: 6,
    slots: [
      { x: 0.08, y: 0.10, w: 0.28, h: 0.24 },
      { x: 0.42, y: 0.07, w: 0.28, h: 0.24 },
      { x: 0.66, y: 0.18, w: 0.28, h: 0.24 },
      { x: 0.06, y: 0.42, w: 0.28, h: 0.24 },
      { x: 0.36, y: 0.48, w: 0.28, h: 0.24 },
      { x: 0.66, y: 0.42, w: 0.28, h: 0.24 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: 0.78,
        w: 1 - M * 2,
        h: 0.07,
        align: 'center',
        size: 22,
        italic: true,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.86,
        w: 1 - M * 2,
        h: 0.07,
        align: 'center',
        size: 10,
        italic: true,
      },
    ],
  },

  // ─── Quote callout ─────────────────────────────────
  // Tiny photo bottom-right + giant magazine-style pull quote centered.
  'quote-callout': {
    id: 'quote-callout',
    label: 'Cita destacada',
    slotCount: 1,
    slots: [{ x: 0.66, y: 0.72, w: 0.24, h: 0.20 }],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M,
        w: 1 - M * 2,
        h: 0.05,
        align: 'left',
        size: 12,
        upper: true,
      },
      {
        kind: 'body',
        x: 0.08,
        y: 0.22,
        w: 0.84,
        h: 0.46,
        align: 'center',
        size: 28,
        italic: true,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.76,
        w: 0.5,
        h: 0.08,
        align: 'left',
        size: 11,
      },
    ],
  },

  // ─── Magazine 3-col ────────────────────────────────
  // 1 wide hero photo + 3 columns of body text below.
  'magazine-3col': {
    id: 'magazine-3col',
    label: 'Magazine 3 col.',
    slotCount: 1,
    slots: [{ x: M, y: M + 0.04, w: 1 - M * 2, h: 0.42 }],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M - 0.005,
        w: 1 - M * 2,
        h: 0.05,
        align: 'left',
        size: 22,
        upper: true,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.52,
        w: 1 - M * 2,
        h: 0.04,
        align: 'left',
        size: 10,
        italic: true,
      },
      // Three columns of body — same `kind: 'body'`. The renderer will
      // split the body text equally across them.
      {
        kind: 'body',
        x: M,
        y: 0.58,
        w: (1 - M * 2) / 3 - 0.012,
        h: 0.36,
        align: 'left',
        size: 10,
      },
      {
        kind: 'body',
        x: M + (1 - M * 2) / 3 + 0.006,
        y: 0.58,
        w: (1 - M * 2) / 3 - 0.012,
        h: 0.36,
        align: 'left',
        size: 10,
      },
      {
        kind: 'body',
        x: M + ((1 - M * 2) / 3) * 2 + 0.012,
        y: 0.58,
        w: (1 - M * 2) / 3 - 0.012,
        h: 0.36,
        align: 'left',
        size: 10,
      },
    ],
  },

  // ─── Timeline strip ────────────────────────────────
  // 5 small photos in a horizontal strip + date caption below each.
  'timeline-strip': {
    id: 'timeline-strip',
    label: 'Timeline',
    slotCount: 5,
    slots: [
      { x: 0.04, y: 0.40, w: 0.17, h: 0.20 },
      { x: 0.23, y: 0.40, w: 0.17, h: 0.20 },
      { x: 0.42, y: 0.40, w: 0.17, h: 0.20 },
      { x: 0.61, y: 0.40, w: 0.17, h: 0.20 },
      { x: 0.80, y: 0.40, w: 0.17, h: 0.20 },
    ],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M + 0.06,
        w: 1 - M * 2,
        h: 0.08,
        align: 'center',
        size: 26,
        upper: true,
      },
      {
        kind: 'subtitle',
        x: M,
        y: 0.26,
        w: 1 - M * 2,
        h: 0.06,
        align: 'center',
        size: 11,
        italic: true,
      },
      {
        kind: 'body',
        x: M,
        y: 0.66,
        w: 1 - M * 2,
        h: 0.20,
        align: 'center',
        size: 11,
      },
    ],
  },

  // ─── Panorama bleed ────────────────────────────────
  // 1 photo full-bleed across the top half + title overlay.
  'panorama-bleed': {
    id: 'panorama-bleed',
    label: 'Panorámica',
    slotCount: 1,
    slots: [{ x: 0, y: 0, w: 1, h: 0.55 }],
    textZones: [
      // Title overlaid on the photo (white text + shadow handled by renderer).
      {
        kind: 'title',
        x: M,
        y: 0.40,
        w: 1 - M * 2,
        h: 0.10,
        align: 'left',
        size: 32,
      },
      {
        kind: 'subtitle',
        x: M,
        y: 0.62,
        w: 1 - M * 2,
        h: 0.06,
        align: 'left',
        size: 12,
        upper: true,
      },
      {
        kind: 'body',
        x: M,
        y: 0.70,
        w: 1 - M * 2,
        h: 0.24,
        align: 'left',
        size: 11,
      },
    ],
  },

  // ─── Journal page ──────────────────────────────────
  // Diary entry — date+location top, body left, photo right.
  'journal-page': {
    id: 'journal-page',
    label: 'Diario',
    slotCount: 1,
    slots: [{ x: 0.52, y: 0.18, w: 0.42, h: 0.60 }],
    textZones: [
      {
        kind: 'date',
        x: M,
        y: M,
        w: 0.4,
        h: 0.05,
        align: 'left',
        size: 11,
        italic: true,
      },
      {
        kind: 'location',
        x: 0.5,
        y: M,
        w: 0.44,
        h: 0.05,
        align: 'right',
        size: 11,
        italic: true,
      },
      {
        kind: 'title',
        x: M,
        y: 0.14,
        w: 0.42,
        h: 0.08,
        align: 'left',
        size: 24,
        italic: true,
      },
      {
        kind: 'body',
        x: M,
        y: 0.26,
        w: 0.42,
        h: 0.62,
        align: 'left',
        size: 12,
        italic: true,
      },
    ],
  },

  // ─── Chapter divider ───────────────────────────────
  // Zero photos. Giant number + title + subtitle. Pure breath page.
  'chapter-divider': {
    id: 'chapter-divider',
    label: 'Capítulo',
    slotCount: 0,
    slots: [],
    textZones: [
      // The chapter number lives in the SUBTITLE field by convention
      // (e.g. "Capítulo 02"). We use 'subtitle' for the number to keep
      // the BookPage shape unchanged.
      {
        kind: 'subtitle',
        x: M,
        y: 0.18,
        w: 1 - M * 2,
        h: 0.08,
        align: 'center',
        size: 14,
        upper: true,
      },
      {
        kind: 'title',
        x: 0.08,
        y: 0.36,
        w: 0.84,
        h: 0.24,
        align: 'center',
        size: 64,
        italic: true,
      },
      {
        kind: 'body',
        x: 0.18,
        y: 0.66,
        w: 0.64,
        h: 0.18,
        align: 'center',
        size: 12,
      },
    ],
  },

  // ─── Mosaic 9 ──────────────────────────────────────
  // Dense 3×3 grid, zero gaps for a tiled-wallpaper feel.
  'mosaic-9': {
    id: 'mosaic-9',
    label: 'Mosaico 3×3',
    slotCount: 9,
    slots: (() => {
      const cell = (1 - M * 2) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push({
            x: M + c * cell,
            y: M + 0.06 + r * cell * 0.95,
            w: cell - 0.002,
            h: cell * 0.95 - 0.002,
          });
        }
      }
      return out;
    })(),
    textZones: [
      {
        kind: 'title',
        x: M,
        y: M,
        w: 1 - M * 2,
        h: 0.05,
        align: 'left',
        size: 14,
        upper: true,
      },
      {
        kind: 'caption',
        x: M,
        y: 0.93,
        w: 1 - M * 2,
        h: 0.04,
        align: 'left',
        size: 9,
        italic: true,
      },
    ],
  },

  // ─── Split vertical ────────────────────────────────
  // Left half: title + body + date. Right half: hero photo.
  'split-vertical': {
    id: 'split-vertical',
    label: 'Split 50/50',
    slotCount: 1,
    slots: [{ x: 0.5, y: 0, w: 0.5, h: 1 }],
    textZones: [
      {
        kind: 'title',
        x: M,
        y: 0.18,
        w: 0.42,
        h: 0.16,
        align: 'left',
        size: 28,
      },
      {
        kind: 'subtitle',
        x: M,
        y: 0.36,
        w: 0.42,
        h: 0.05,
        align: 'left',
        size: 11,
        upper: true,
      },
      {
        kind: 'body',
        x: M,
        y: 0.45,
        w: 0.42,
        h: 0.30,
        align: 'left',
        size: 11,
      },
      {
        kind: 'date',
        x: M,
        y: 0.82,
        w: 0.42,
        h: 0.05,
        align: 'left',
        size: 10,
        italic: true,
      },
    ],
  },
};

export const LAYOUT_LIST: LayoutDefinition[] = [
  LAYOUTS['1-hero'],
  LAYOUTS['2-stacked'],
  LAYOUTS['2-side'],
  LAYOUTS['3-mosaic'],
  LAYOUTS['4-grid'],
  LAYOUTS['6-grid'],
  LAYOUTS['mosaic-9'],
  LAYOUTS['panorama-bleed'],
  LAYOUTS['split-vertical'],
  LAYOUTS['polaroid-grid'],
  LAYOUTS['timeline-strip'],
  LAYOUTS['magazine-3col'],
  LAYOUTS['journal-page'],
  LAYOUTS['quote-callout'],
  LAYOUTS['map-full'],
  LAYOUTS['chapter-divider'],
  LAYOUTS['text-only'],
];

/** All layouts including the cover, in catalogue order. */
export const ALL_LAYOUTS: LayoutDefinition[] = [
  LAYOUTS.cover,
  ...LAYOUT_LIST,
];
