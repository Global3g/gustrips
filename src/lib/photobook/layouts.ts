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
};

export const LAYOUT_LIST: LayoutDefinition[] = [
  LAYOUTS['1-hero'],
  LAYOUTS['2-stacked'],
  LAYOUTS['2-side'],
  LAYOUTS['3-mosaic'],
  LAYOUTS['4-grid'],
  LAYOUTS['6-grid'],
  LAYOUTS['text-only'],
];

/** All layouts including the cover, in catalogue order. */
export const ALL_LAYOUTS: LayoutDefinition[] = [
  LAYOUTS.cover,
  ...LAYOUT_LIST,
];
