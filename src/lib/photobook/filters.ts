/**
 * Photo Book — per-photo filter library.
 *
 * Each filter has two facets:
 *  - `css`: a CSS `filter` string used by the HTML preview. Cheap, GPU-driven.
 *  - `apply`: a pixel-level transformation applied to a canvas before we
 *    embed the image in the PDF (jsPDF can't carry CSS filters).
 *
 * For preview-only theming there's a `label` too (used in the dropdown UI).
 */

import type { PhotoFilter } from './types';

export interface FilterDef {
  id: PhotoFilter;
  label: string;
  /** CSS filter chain for the HTML preview. */
  css: string;
  /** Pixel-level transform applied to a canvas (for PDF output). */
  apply: (pixels: Uint8ClampedArray) => void;
}

/* ── Helpers (pixel space, RGBA) ──────────────────────────── */

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/* Each helper mutates the RGBA buffer in-place. */

function applySepia(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    px[i] = clamp(r * 0.393 + g * 0.769 + b * 0.189);
    px[i + 1] = clamp(r * 0.349 + g * 0.686 + b * 0.168);
    px[i + 2] = clamp(r * 0.272 + g * 0.534 + b * 0.131);
  }
}

function applyBw(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    // ITU-R BT.709 luminance.
    const y = px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
    // Boost contrast a touch.
    const v = clamp((y - 128) * 1.1 + 128);
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
  }
}

function applyVintage(px: Uint8ClampedArray): void {
  // Faded sepia tone: lighter sepia + soft contrast drop + desaturation.
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    // Step 1: light sepia (40% blend).
    const sr = r * 0.393 + g * 0.769 + b * 0.189;
    const sg = r * 0.349 + g * 0.686 + b * 0.168;
    const sb = r * 0.272 + g * 0.534 + b * 0.131;
    let nr = r * 0.6 + sr * 0.4;
    let ng = g * 0.6 + sg * 0.4;
    let nb = b * 0.6 + sb * 0.4;
    // Step 2: contrast 1.1 + brightness 0.95.
    nr = (nr - 128) * 1.1 + 128;
    ng = (ng - 128) * 1.1 + 128;
    nb = (nb - 128) * 1.1 + 128;
    nr *= 0.95;
    ng *= 0.95;
    nb *= 0.95;
    px[i] = clamp(nr);
    px[i + 1] = clamp(ng);
    px[i + 2] = clamp(nb);
  }
}

function applyCool(px: Uint8ClampedArray): void {
  // Saturation 1.15 + cool hue rotate (~+15°). Approximated by lifting B
  // and softening R.
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const y = r * 0.299 + g * 0.587 + b * 0.114;
    const sr = y + (r - y) * 1.15;
    const sg = y + (g - y) * 1.15;
    const sb = y + (b - y) * 1.15;
    px[i] = clamp(sr * 0.95);
    px[i + 1] = clamp(sg * 1.0);
    px[i + 2] = clamp(sb * 1.08);
  }
}

function applyWarm(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const y = r * 0.299 + g * 0.587 + b * 0.114;
    const sr = y + (r - y) * 1.2;
    const sg = y + (g - y) * 1.2;
    const sb = y + (b - y) * 1.2;
    px[i] = clamp(sr * 1.08 * 1.05);
    px[i + 1] = clamp(sg * 1.02 * 1.05);
    px[i + 2] = clamp(sb * 0.92 * 1.05);
  }
}

function applyHighContrast(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const y = r * 0.299 + g * 0.587 + b * 0.114;
    let nr = (r - 128) * 1.4 + 128;
    let ng = (g - 128) * 1.4 + 128;
    let nb = (b - 128) * 1.4 + 128;
    // Saturate 1.1.
    nr = y + (nr - y) * 1.1;
    ng = y + (ng - y) * 1.1;
    nb = y + (nb - y) * 1.1;
    px[i] = clamp(nr);
    px[i + 1] = clamp(ng);
    px[i + 2] = clamp(nb);
  }
}

function applySoft(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const y = r * 0.299 + g * 0.587 + b * 0.114;
    let nr = (r - 128) * 0.92 + 128;
    let ng = (g - 128) * 0.92 + 128;
    let nb = (b - 128) * 0.92 + 128;
    nr = (y + (nr - y) * 0.9) * 1.05;
    ng = (y + (ng - y) * 0.9) * 1.05;
    nb = (y + (nb - y) * 0.9) * 1.05;
    px[i] = clamp(nr);
    px[i + 1] = clamp(ng);
    px[i + 2] = clamp(nb);
  }
}

/**
 * Duotone: map luminance to a gradient between dark + light anchors.
 * Used for both the blue and rose presets.
 */
function applyDuotone(
  px: Uint8ClampedArray,
  dark: [number, number, number],
  light: [number, number, number],
): void {
  for (let i = 0; i < px.length; i += 4) {
    const y = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    px[i] = clamp(dark[0] + (light[0] - dark[0]) * y);
    px[i + 1] = clamp(dark[1] + (light[1] - dark[1]) * y);
    px[i + 2] = clamp(dark[2] + (light[2] - dark[2]) * y);
  }
}

/* ── Public registry ──────────────────────────────────────── */

export const PHOTO_FILTERS: Record<PhotoFilter, FilterDef> = {
  none: {
    id: 'none',
    label: 'Normal',
    css: '',
    apply: () => {},
  },
  sepia: {
    id: 'sepia',
    label: 'Sepia',
    css: 'sepia(0.8) contrast(1.05)',
    apply: applySepia,
  },
  bw: {
    id: 'bw',
    label: 'Blanco y negro',
    css: 'grayscale(1) contrast(1.1)',
    apply: applyBw,
  },
  vintage: {
    id: 'vintage',
    label: 'Vintage',
    css: 'sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.85)',
    apply: applyVintage,
  },
  cool: {
    id: 'cool',
    label: 'Frío',
    css: 'saturate(1.15) hue-rotate(15deg)',
    apply: applyCool,
  },
  warm: {
    id: 'warm',
    label: 'Cálido',
    css: 'saturate(1.2) hue-rotate(-15deg) brightness(1.05)',
    apply: applyWarm,
  },
  highContrast: {
    id: 'highContrast',
    label: 'Alto contraste',
    css: 'contrast(1.4) saturate(1.1)',
    apply: applyHighContrast,
  },
  soft: {
    id: 'soft',
    label: 'Suave',
    css: 'contrast(0.92) brightness(1.05) saturate(0.9)',
    apply: applySoft,
  },
  'duotone-blue': {
    id: 'duotone-blue',
    label: 'Duotono azul',
    css: 'grayscale(1) sepia(1) hue-rotate(180deg) saturate(2)',
    apply: (px) => applyDuotone(px, [10, 18, 60], [180, 220, 255]),
  },
  'duotone-rose': {
    id: 'duotone-rose',
    label: 'Duotono rosa',
    css: 'grayscale(1) sepia(1) hue-rotate(310deg) saturate(2)',
    apply: (px) => applyDuotone(px, [60, 10, 40], [255, 220, 230]),
  },
};

export const FILTER_LIST: FilterDef[] = [
  PHOTO_FILTERS.none,
  PHOTO_FILTERS.sepia,
  PHOTO_FILTERS.bw,
  PHOTO_FILTERS.vintage,
  PHOTO_FILTERS.cool,
  PHOTO_FILTERS.warm,
  PHOTO_FILTERS.highContrast,
  PHOTO_FILTERS.soft,
  PHOTO_FILTERS['duotone-blue'],
  PHOTO_FILTERS['duotone-rose'],
];

/** Convenience: convert filter id (nullable) to a CSS string for previews. */
export function filterCss(id: PhotoFilter | null | undefined): string {
  if (!id || id === 'none') return '';
  return PHOTO_FILTERS[id]?.css ?? '';
}

/**
 * Apply a filter to a canvas in-place (used by the PDF generator).
 * Safe to call with 'none' — it's a no-op.
 */
export function applyFilterToCanvas(
  canvas: HTMLCanvasElement,
  id: PhotoFilter | null | undefined,
): void {
  if (!id || id === 'none') return;
  const def = PHOTO_FILTERS[id];
  if (!def) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  def.apply(data.data);
  ctx.putImageData(data, 0, 0);
}
