/**
 * Photo Book PDF generator (editor-driven).
 *
 * This module consumes a `BookState` (built by the editor at
 * /trips/[id]/photos/book) and renders it to a multi-page jsPDF document.
 *
 * Architecture:
 *  - Page geometry is derived from `state.size` (a4/square/letter).
 *  - Layout: `LAYOUTS[page.layoutId]` provides slot rectangles + text
 *    zones in 0-1 relative coords. We translate those to mm for jsPDF.
 *  - Theme: `getTheme(state.theme)` provides colours, decorations, sepia
 *    toggle, and which jsPDF built-in font to use.
 *  - Image fetching uses /api/photo-proxy for Firebase URLs (same pattern
 *    as exportRecapPdf.ts) and applies pixel-level filters per slot.
 *
 * Vol. 2 additions (Mixbook-grade):
 *  - Per-slot photo FILTERS (sepia/bw/vintage/cool/warm/contrast/soft/duotone)
 *  - Per-slot photo FRAMES (polaroid pad, rounded, circle, hexagon, tape, vintage edge)
 *  - Background PATTERNS (paper / dots / stripes / grid / map / confetti)
 *  - STICKERS (travel icons, deco shapes, text labels)
 *  - Special-layout renderers (map-full, polaroid-grid auto-rotate, panorama
 *    title overlay, magazine-3col body column split, journal handwriting, etc.)
 *
 * Browser-only: depends on `document` (canvas), `Image`, and `fetch`.
 */

import jsPDF from 'jspdf';
import type {
  BookPage,
  BookPatternId,
  BookState,
  BookTheme,
  LayoutDefinition,
  PhotoFilter,
  PhotoFrame,
  SlotCrop,
  Sticker,
  StickerKind,
  ThemeId,
} from '@/lib/photobook/types';
import { LAYOUTS } from '@/lib/photobook/layouts';
import { getTheme } from '@/lib/photobook/themes';
import { PHOTO_FILTERS } from '@/lib/photobook/filters';
import { framePhotoInset, HEX_POLY } from '@/lib/photobook/frames';
import {
  PRIMITIVE_STICKERS,
  STICKER_LIBRARY,
  rasterStickerToCanvas,
} from '@/lib/photobook/stickers';

type RGB = [number, number, number];

// ─── Page geometry ────────────────────────────────────────

/** Each book size mapped to mm dimensions. */
const SIZE_MM: Record<BookState['size'], [number, number]> = {
  a4: [210, 297],
  square: [200, 200],
  letter: [216, 279],
};

// ─── Colour helpers ───────────────────────────────────────

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// ─── Font mapping ─────────────────────────────────────────

type PdfFontFamily = 'helvetica' | 'times' | 'courier';

function pdfFontFor(theme: BookTheme, kind: 'title' | 'body'): PdfFontFamily {
  const key = kind === 'title' ? theme.titleFontKey : theme.bodyFontKey;
  if (key === 'sans') return 'helvetica';
  if (key === 'serif') return 'times';
  return 'times';
}

// ─── Image fetching ───────────────────────────────────────

/**
 * In-memory cache shared across one export run. Pre-warmed in parallel
 * before the render loop so each photo is fetched at most once even if it
 * appears in multiple pages, and so the network phase doesn't bottleneck
 * the (already CPU-bound) PDF rendering. Cleared at the start of every
 * exportPhotoBookPdf call.
 */
const imageCache = new Map<string, string>();

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  // Cap each fetch so a single hanging photo can't freeze the whole export.
  // Firebase Storage downloads of large originals (HEIC-converted JPEGs can
  // easily hit 20-30MB) sometimes stall on flaky connections — a finite
  // timeout lets the loop skip and continue with the rest of the book.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const isFirebase = url.includes('firebasestorage.googleapis.com');
    const fetchUrl = isFirebase
      ? `/api/photo-proxy?url=${encodeURIComponent(url)}`
      : url;
    const res = await fetch(fetchUrl, { signal: controller.signal });
    if (!res.ok) {
      console.warn('[PhotoBookPdf] fetch non-ok', res.status, url.slice(0, 80));
      return null;
    }
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    imageCache.set(url, dataUrl);
    return dataUrl;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[PhotoBookPdf] fetch timed out (>30s)', url.slice(0, 80));
    } else {
      console.warn('[PhotoBookPdf] fetch failed', err, url.slice(0, 80));
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function imageFormatFromDataUrl(dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' {
  const lower = dataUrl.slice(0, 30).toLowerCase();
  if (lower.includes('image/png')) return 'PNG';
  if (lower.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

/**
 * Apply a per-slot filter to a canvas in-place. Falls back to a theme-level
 * sepia tone when no explicit filter is set.
 */
function applyFilterCanvas(
  canvas: HTMLCanvasElement,
  filter: PhotoFilter | null | undefined,
  themeSepia: boolean,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Pick the effective filter: explicit > theme sepia > none.
  let id: PhotoFilter | null = null;
  if (filter && filter !== 'none') id = filter;
  else if (themeSepia) id = 'sepia';
  if (!id) return;

  const def = PHOTO_FILTERS[id];
  if (!def) return;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  def.apply(data.data);
  ctx.putImageData(data, 0, 0);
}

// ─── Drawing primitives ───────────────────────────────────

interface DrawCtx {
  pdf: jsPDF;
  theme: BookTheme;
  pageW: number;
  pageH: number;
}

function drawBackground(ctx: DrawCtx, override?: string) {
  const { pdf, theme, pageW, pageH } = ctx;
  const rgb = hexToRgb(override || theme.background);
  pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  pdf.rect(0, 0, pageW, pageH, 'F');
}

/**
 * Stamp a background pattern onto the page using jsPDF primitives. Used in
 * addition to the flat colour from drawBackground.
 */
function drawPattern(
  pdf: jsPDF,
  patternId: BookPatternId | null | undefined,
  pageW: number,
  pageH: number,
): void {
  if (!patternId || patternId === 'none') return;

  if (patternId === 'paper') {
    pdf.setFillColor(0, 0, 0);
    for (let y = 1; y < pageH; y += 2.2) {
      for (let x = 1; x < pageW; x += 2.2) {
        // Faux fill alpha by drawing tiny radius dots.
        // (jsPDF GState opacity isn't in the types, so we just draw thin.)
        pdf.setFillColor(0, 0, 0);
        pdf.circle(x, y, 0.12, 'F');
      }
    }
    return;
  }

  if (patternId === 'dots') {
    pdf.setFillColor(0, 0, 0);
    for (let y = 3; y < pageH; y += 5) {
      for (let x = 3; x < pageW; x += 5) {
        pdf.circle(x, y, 0.45, 'F');
      }
    }
    return;
  }

  if (patternId === 'stripes-diagonal') {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.25);
    // 45° stripes spanning the page.
    const step = 3.2;
    const max = pageW + pageH;
    for (let d = -pageH; d < max; d += step) {
      pdf.line(d, 0, d + pageH, pageH);
    }
    return;
  }

  if (patternId === 'grid') {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.15);
    const step = 6;
    for (let x = 0; x <= pageW; x += step) pdf.line(x, 0, x, pageH);
    for (let y = 0; y <= pageH; y += step) pdf.line(0, y, pageW, y);
    return;
  }

  if (patternId === 'map') {
    // Stylised "map" — wavy parallel lines + scattered city dots.
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    for (let y = 8; y < pageH; y += 14) {
      // Approximate a sinus with short line segments.
      let prevX = 0;
      let prevY = y;
      for (let x = 0; x <= pageW; x += 4) {
        const ny = y + Math.sin(x / 12) * 2.4;
        pdf.line(prevX, prevY, x, ny);
        prevX = x;
        prevY = ny;
      }
    }
    pdf.setFillColor(0, 0, 0);
    const dots: [number, number][] = [
      [0.18, 0.22], [0.42, 0.18], [0.62, 0.28], [0.28, 0.52],
      [0.58, 0.62], [0.78, 0.74], [0.32, 0.82], [0.72, 0.42],
    ];
    for (const [px, py] of dots) {
      pdf.circle(px * pageW, py * pageH, 0.7, 'F');
    }
    return;
  }

  if (patternId === 'confetti') {
    const colors: RGB[] = [
      [251, 146, 60],
      [139, 92, 246],
      [244, 114, 182],
      [56, 189, 248],
      [250, 204, 21],
      [52, 211, 153],
    ];
    // Deterministic distribution via LCG.
    let s = 4242;
    for (let i = 0; i < 110; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const x = ((s % 1000) / 1000) * pageW;
      s = (s * 1664525 + 1013904223) >>> 0;
      const y = ((s % 1000) / 1000) * pageH;
      s = (s * 1664525 + 1013904223) >>> 0;
      const c = colors[s % colors.length];
      pdf.setFillColor(c[0], c[1], c[2]);
      pdf.circle(x, y, 0.9, 'F');
    }
    return;
  }
}

function drawDecorations(ctx: DrawCtx) {
  const { pdf, theme, pageW, pageH } = ctx;
  if (theme.decorations === 'none') return;

  if (theme.decorations === 'dashed-borders') {
    const [r, g, b] = hexToRgb(theme.rule);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.2);
    const dash = 1.6;
    const gap = 1.2;
    const step = dash + gap;
    const inset = 4;
    for (let x = inset; x < pageW - inset; x += step) {
      const x2 = Math.min(x + dash, pageW - inset);
      pdf.line(x, inset, x2, inset);
      pdf.line(x, pageH - inset, x2, pageH - inset);
    }
    for (let y = inset; y < pageH - inset; y += step) {
      const y2 = Math.min(y + dash, pageH - inset);
      pdf.line(inset, y, inset, y2);
      pdf.line(pageW - inset, y, pageW - inset, y2);
    }
    return;
  }

  if (theme.decorations === 'corner-flourish') {
    const [r, g, b] = hexToRgb(theme.accent);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.4);
    const inset = 6;
    const len = 14;
    pdf.line(inset, inset, inset + len, inset);
    pdf.line(inset, inset, inset, inset + len);
    pdf.line(pageW - inset - len, inset, pageW - inset, inset);
    pdf.line(pageW - inset, inset, pageW - inset, inset + len);
    pdf.line(inset, pageH - inset, inset + len, pageH - inset);
    pdf.line(inset, pageH - inset - len, inset, pageH - inset);
    pdf.line(pageW - inset - len, pageH - inset, pageW - inset, pageH - inset);
    pdf.line(pageW - inset, pageH - inset - len, pageW - inset, pageH - inset);
    return;
  }

  if (theme.decorations === 'geometric-bars') {
    const [r, g, b] = hexToRgb(theme.accent);
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, 2.5, pageH, 'F');
    pdf.rect(pageW * 0.7, pageH - 2, pageW * 0.3, 2, 'F');
    return;
  }

  if (theme.decorations === 'paper-noise') {
    const [r, g, b] = hexToRgb(theme.rule);
    pdf.setFillColor(r, g, b);
    const dots = 70;
    let s = 1234567;
    for (let i = 0; i < dots; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const x = (s % 1000) / 1000 * pageW;
      s = (s * 1664525 + 1013904223) >>> 0;
      const y = (s % 1000) / 1000 * pageH;
      pdf.circle(x, y, 0.15, 'F');
    }
    return;
  }

  if (theme.decorations === 'mono-borders') {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(1.4);
    pdf.rect(3, 3, pageW - 6, pageH - 6, 'S');
    pdf.setLineWidth(0.4);
    pdf.rect(6, 6, pageW - 12, pageH - 12, 'S');
    return;
  }

  if (theme.decorations === 'neon-glow') {
    const [r, g, b] = hexToRgb(theme.accent);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.9);
    pdf.rect(4, 4, pageW - 8, pageH - 8, 'S');
    pdf.setLineWidth(0.3);
    pdf.rect(6.5, 6.5, pageW - 13, pageH - 13, 'S');
    return;
  }

  if (theme.decorations === 'tape-strips') {
    const tapes: [number, number, number, number, string][] = [
      [10, 4, 22, 5, theme.accent],
      [pageW - 32, 4, 22, 5, '#0a0a0a'],
      [10, pageH - 9, 22, 5, '#ffd400'],
      [pageW - 32, pageH - 9, 22, 5, theme.accent],
    ];
    for (const [x, y, w, h, color] of tapes) {
      const [r, g, bb] = hexToRgb(color);
      pdf.setFillColor(r, g, bb);
      pdf.rect(x, y, w, h, 'F');
    }
    return;
  }

  if (theme.decorations === 'glass-blur') {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(pageW * 0.06, pageH * 0.06, pageW * 0.88, pageH * 0.88, 'F');
    const [r, g, b] = hexToRgb(theme.accent);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.3);
    pdf.rect(pageW * 0.06, pageH * 0.06, pageW * 0.88, pageH * 0.88, 'S');
    return;
  }

  if (theme.decorations === 'psychedelic-frame') {
    const rings: [number, number, number, string][] = [
      [4, 4, 18, '#fb923c'],
      [4, 4, 12, '#f472b6'],
      [pageW - 4, pageH - 4, 24, '#a855f7'],
      [pageW - 4, pageH - 4, 16, '#38bdf8'],
    ];
    for (const [cx, cy, radius, color] of rings) {
      const [r, g, bb] = hexToRgb(color);
      pdf.setDrawColor(r, g, bb);
      pdf.setLineWidth(0.8);
      pdf.circle(cx, cy, radius, 'S');
    }
    return;
  }
}

/**
 * Draw the decorative SVG map behind a `map-full` layout. We rasterise an
 * inline SVG into a canvas and embed it as a PNG — keeps the code small
 * and the map looking smooth at any DPI.
 */
async function drawMapDecoration(
  pdf: jsPDF,
  pageW: number,
  pageH: number,
  inkHex: string,
): Promise<void> {
  if (typeof document === 'undefined') return;
  const ink = inkHex;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" preserveAspectRatio="none" width="${Math.round(pageW * 8)}" height="${Math.round(pageH * 8)}">
    <g stroke="${ink}" stroke-opacity="0.18" fill="none" stroke-width="0.6">
      <path d="M0 40 C 40 30, 80 50, 120 38 S 180 50, 200 42"/>
      <path d="M0 70 C 40 60, 80 78, 120 68 S 180 78, 200 72"/>
      <path d="M0 100 C 40 90, 80 108, 120 98 S 180 108, 200 102"/>
      <path d="M0 200 C 40 190, 80 208, 120 198 S 180 208, 200 202"/>
      <path d="M0 230 C 40 220, 80 238, 120 228 S 180 238, 200 232"/>
      <path d="M0 260 C 40 250, 80 268, 120 258 S 180 268, 200 262"/>
    </g>
    <g fill="${ink}" fill-opacity="0.08" stroke="${ink}" stroke-opacity="0.28" stroke-width="0.8">
      <path d="M14 50 Q 30 30, 60 38 T 110 56 Q 130 70, 120 96 Q 100 110, 70 100 Q 30 92, 18 78 Z"/>
      <path d="M120 110 Q 150 100, 180 116 Q 192 140, 170 160 Q 140 170, 120 152 Q 110 130, 120 110 Z"/>
      <path d="M30 160 Q 60 150, 90 168 Q 100 190, 84 210 Q 60 218, 36 200 Q 22 180, 30 160 Z"/>
    </g>
    <g stroke="${ink}" stroke-opacity="0.55" fill="none" stroke-width="0.8" stroke-dasharray="3 2">
      <path d="M40 80 Q 90 60, 140 80 T 180 130"/>
      <path d="M60 200 Q 100 180, 150 210"/>
    </g>
    <g fill="${ink}" fill-opacity="0.5">
      <circle cx="40" cy="80" r="2"/><circle cx="100" cy="100" r="2"/>
      <circle cx="150" cy="80" r="2"/><circle cx="170" cy="140" r="2"/>
      <circle cx="80" cy="200" r="2"/><circle cx="150" cy="220" r="2"/>
    </g>
  </svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('map svg load failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pageW * 8);
    canvas.height = Math.round(pageH * 8);
    const cctx = canvas.getContext('2d');
    if (!cctx) return;
    cctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    pdf.addImage(png, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
  } catch {
    /* swallow — the page will simply lack the map. */
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ── Frame helpers (PDF) ──────────────────────────────────── */

/** Stroke the frame OUTSIDE the photo area (e.g. polaroid white pad). */
function drawFrameWrapper(
  pdf: jsPDF,
  frame: PhotoFrame | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: BookTheme,
): void {
  if (!frame || frame === 'none') return;

  if (frame === 'polaroid') {
    // White card under the photo + slight shadow line.
    pdf.setFillColor(255, 255, 255);
    pdf.rect(x, y, w, h, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.25);
    pdf.rect(x, y, w, h, 'S');
    return;
  }

  if (frame === 'tape') {
    // Two coloured strips at corners. We draw them after the inner photo
    // so they sit ON TOP — handled separately by drawFrameOverlay below.
    return;
  }

  if (frame === 'vintage-edge') {
    // Warm parchment pad behind the photo.
    pdf.setFillColor(244, 230, 207);
    pdf.rect(x, y, w, h, 'F');
    const [r, g, b] = hexToRgb('#6b4a2b');
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.6);
    pdf.rect(x, y, w, h, 'S');
    return;
  }

  if (frame === 'rounded') {
    // jsPDF roundedRect exists.
    pdf.setDrawColor(...hexToRgb(theme.rule));
    pdf.setLineWidth(0.2);
    pdf.roundedRect(x, y, w, h, 3, 3, 'S');
    return;
  }

  if (frame === 'circle') {
    // Circle frame: draw a thin outline circle (the photo is clipped via
    // canvas elsewhere — see clipImageToShape).
    return;
  }

  if (frame === 'hexagon') {
    // Frame outline drawn around the inner hexagon photo.
    return;
  }
}

/** Stickers / tape strips that sit ON TOP of the photo. */
function drawFrameOverlay(
  pdf: jsPDF,
  frame: PhotoFrame | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!frame || frame === 'none') return;
  if (frame === 'tape') {
    // Tape strip top-left and bottom-right.
    const tapeW = w * 0.28;
    const tapeH = Math.max(2.5, h * 0.06);
    // Amber tape (top-left).
    pdf.setFillColor(251, 191, 36);
    pdf.rect(x + w * 0.08, y - tapeH * 0.4, tapeW, tapeH, 'F');
    // Black tape (bottom-right).
    pdf.setFillColor(10, 10, 10);
    pdf.rect(x + w - w * 0.08 - tapeW, y + h - tapeH * 0.6, tapeW, tapeH, 'F');
  }
}

/**
 * Place an image inside a slot rectangle. Maintains aspect ratio using
 * "cover" semantics (the image fills the slot and we crop the overflow).
 *
 * Applies:
 *  - The per-slot FILTER (vol. 2) or theme sepia fallback.
 *  - The per-slot FRAME (vol. 2): polaroid pad, hexagon mask, circle mask,
 *    vintage edge, rounded corners, tape strips.
 */
async function placeImageCover(
  pdf: jsPDF,
  rawUrl: string | null,
  outerX: number,
  outerY: number,
  outerW: number,
  outerH: number,
  theme: BookTheme,
  filter: PhotoFilter | null,
  frame: PhotoFrame | null,
  slotCaption: string | null,
  slotCrop: SlotCrop | null = null,
) {
  // Frame wrapper (polaroid card, vintage pad) is drawn first so the photo
  // sits ON TOP of it. Then we compute the inner rect respecting frame
  // insets (polaroid has an extra-thick bottom border).
  drawFrameWrapper(pdf, frame, outerX, outerY, outerW, outerH, theme);

  const inset = framePhotoInset(frame);
  const x = outerX + inset.left * outerW;
  const y = outerY + inset.top * outerH;
  const w = outerW * (1 - inset.left - inset.right);
  const h = outerH * (1 - inset.top - inset.bottom);

  const fallbackFill = () => {
    const [pr, pg, pb] = hexToRgb(theme.paper);
    const [rr, rg, rb] = hexToRgb(theme.rule);
    pdf.setFillColor(pr, pg, pb);
    pdf.setDrawColor(rr, rg, rb);
    pdf.setLineWidth(0.2);
    pdf.rect(x, y, w, h, 'FD');
  };

  if (!rawUrl) {
    fallbackFill();
    drawSlotCaption(pdf, slotCaption, outerX, outerY, outerW, outerH, frame, theme);
    drawFrameOverlay(pdf, frame, outerX, outerY, outerW, outerH);
    return;
  }

  const dataUrl = await fetchImageAsDataUrl(rawUrl);
  if (!dataUrl) {
    fallbackFill();
    drawSlotCaption(pdf, slotCaption, outerX, outerY, outerW, outerH, frame, theme);
    drawFrameOverlay(pdf, frame, outerX, outerY, outerW, outerH);
    return;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('img load failed'));
      i.src = dataUrl;
    });

    // Compute source rect: user crop (normalized 0..1) wins; otherwise fall
    // back to centered cover-fit so the slot is fully filled.
    let sx: number, sy: number, sw: number, sh: number;
    if (slotCrop) {
      sx = slotCrop.x * img.naturalWidth;
      sy = slotCrop.y * img.naturalHeight;
      sw = slotCrop.w * img.naturalWidth;
      sh = slotCrop.h * img.naturalHeight;
    } else {
      const slotRatio = w / h;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      sx = 0;
      sy = 0;
      sw = img.naturalWidth;
      sh = img.naturalHeight;
      if (imgRatio > slotRatio) {
        sw = img.naturalHeight * slotRatio;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / slotRatio;
        sy = (img.naturalHeight - sh) / 2;
      }
    }

    const canvas = document.createElement('canvas');
    const targetW = Math.min(Math.round(w * 6), 2400);
    const targetH = Math.min(Math.round(h * 6), 2400);
    canvas.width = targetW;
    canvas.height = targetH;
    const cctx = canvas.getContext('2d');
    if (!cctx) {
      fallbackFill();
      drawFrameOverlay(pdf, frame, outerX, outerY, outerW, outerH);
      return;
    }

    // Mask for circle/hexagon BEFORE drawing the image.
    if (frame === 'circle') {
      cctx.save();
      cctx.beginPath();
      cctx.ellipse(targetW / 2, targetH / 2, targetW / 2, targetH / 2, 0, 0, Math.PI * 2);
      cctx.clip();
    } else if (frame === 'hexagon') {
      cctx.save();
      cctx.beginPath();
      HEX_POLY.forEach(([px, py], i) => {
        const cx = px * targetW;
        const cy = py * targetH;
        if (i === 0) cctx.moveTo(cx, cy);
        else cctx.lineTo(cx, cy);
      });
      cctx.closePath();
      cctx.clip();
    } else if (frame === 'rounded') {
      cctx.save();
      const r = Math.min(targetW, targetH) * 0.08;
      cctx.beginPath();
      cctx.moveTo(r, 0);
      cctx.lineTo(targetW - r, 0);
      cctx.quadraticCurveTo(targetW, 0, targetW, r);
      cctx.lineTo(targetW, targetH - r);
      cctx.quadraticCurveTo(targetW, targetH, targetW - r, targetH);
      cctx.lineTo(r, targetH);
      cctx.quadraticCurveTo(0, targetH, 0, targetH - r);
      cctx.lineTo(0, r);
      cctx.quadraticCurveTo(0, 0, r, 0);
      cctx.clip();
    }

    cctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    if (frame === 'circle' || frame === 'hexagon' || frame === 'rounded') {
      cctx.restore();
    }

    // Apply per-slot filter (or theme sepia fallback).
    applyFilterCanvas(canvas, filter, theme.sepia);

    // Vintage-edge: paint a heavy dark vignette inside the photo bounds.
    if (frame === 'vintage-edge') {
      const grad = cctx.createRadialGradient(
        targetW / 2,
        targetH / 2,
        Math.min(targetW, targetH) * 0.3,
        targetW / 2,
        targetH / 2,
        Math.max(targetW, targetH) * 0.7,
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      cctx.fillStyle = grad;
      cctx.fillRect(0, 0, targetW, targetH);
    }

    const out = canvas.toDataURL('image/png');
    const fmt = imageFormatFromDataUrl(out);
    pdf.addImage(out, fmt, x, y, w, h, undefined, 'FAST');

    // Thin frame around the photo (skip when the wrapper already drew one
    // or when the photo is masked into a non-rect shape).
    if (frame !== 'polaroid' && frame !== 'vintage-edge' && frame !== 'rounded') {
      if (frame !== 'circle' && frame !== 'hexagon') {
        const [rr, rg, rb] = hexToRgb(theme.rule);
        pdf.setDrawColor(rr, rg, rb);
        pdf.setLineWidth(0.15);
        pdf.rect(x, y, w, h, 'S');
      }
    }
  } catch {
    fallbackFill();
  }

  // Slot caption (polaroid white pad usage).
  drawSlotCaption(pdf, slotCaption, outerX, outerY, outerW, outerH, frame, theme);

  // Overlay (tape strips).
  drawFrameOverlay(pdf, frame, outerX, outerY, outerW, outerH);
}

/**
 * Slot-level caption text. Only the polaroid frame has a dedicated text
 * pad; for other frames we still render a small caption under the photo
 * when one is set, but with no special styling.
 */
function drawSlotCaption(
  pdf: jsPDF,
  caption: string | null,
  outerX: number,
  outerY: number,
  outerW: number,
  outerH: number,
  frame: PhotoFrame | null | undefined,
  theme: BookTheme,
): void {
  if (!caption) return;
  if (frame === 'polaroid') {
    const inset = framePhotoInset(frame);
    const stripY = outerY + (inset.top + (1 - inset.top - inset.bottom)) * outerH + 1;
    const stripH = outerH * inset.bottom;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 30, 20);
    pdf.text(caption, outerX + outerW / 2, stripY + stripH * 0.55, {
      align: 'center',
      maxWidth: outerW * (1 - inset.left - inset.right),
    });
    return;
  }
  // Generic fallback — below the photo.
  pdf.setFont(pdfFontFor(theme, 'body'), 'italic');
  pdf.setFontSize(8);
  const [r, g, b] = hexToRgb(theme.inkSoft);
  pdf.setTextColor(r, g, b);
  pdf.text(caption, outerX + outerW / 2, outerY + outerH + 3, {
    align: 'center',
    maxWidth: outerW,
  });
}

function drawCoverScrim(pdf: jsPDF, w: number, h: number) {
  if (typeof document === 'undefined') return;
  const scrimH = h * 0.5;
  const pxW = Math.max(200, Math.round(w * 4));
  const pxH = Math.max(100, Math.round(scrimH * 4));
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const cctx = canvas.getContext('2d');
  if (!cctx) return;
  const grad = cctx.createLinearGradient(0, 0, 0, pxH);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.65)');
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, pxW, pxH);
  const png = canvas.toDataURL('image/png');
  pdf.addImage(png, 'PNG', 0, h - scrimH, w, scrimH, undefined, 'FAST');
}

/** Same gradient idea, applied to a panorama photo from the bottom up. */
function drawPanoramaScrim(pdf: jsPDF, w: number, photoH: number) {
  if (typeof document === 'undefined') return;
  const scrimH = photoH * 0.5;
  const pxW = Math.max(200, Math.round(w * 4));
  const pxH = Math.max(80, Math.round(scrimH * 4));
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const cctx = canvas.getContext('2d');
  if (!cctx) return;
  const grad = cctx.createLinearGradient(0, 0, 0, pxH);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, pxW, pxH);
  const png = canvas.toDataURL('image/png');
  pdf.addImage(png, 'PNG', 0, photoH - scrimH, w, scrimH, undefined, 'FAST');
}

/* ── Text zones ───────────────────────────────────────────── */

/** Split a body string into N roughly-equal columns by sentences. */
function splitBodyIntoColumns(body: string, n: number): string[] {
  if (!body || n <= 1) return [body];
  const sentences = body.match(/[^.!?\n]+[.!?]?[\s]?|\S+/g) ?? [body];
  const out: string[] = Array.from({ length: n }, () => '');
  const total = body.length;
  const target = total / n;
  let bucket = 0;
  let acc = 0;
  for (const s of sentences) {
    if (acc + s.length > target * (bucket + 1) && bucket < n - 1) {
      bucket++;
    }
    out[bucket] += s;
    acc += s.length;
  }
  return out;
}

function drawTextZones(
  pdf: jsPDF,
  page: BookPage,
  layout: LayoutDefinition,
  theme: BookTheme,
  pageW: number,
  pageH: number,
) {
  const isCover = page.layoutId === 'cover';
  const isPanorama = page.layoutId === 'panorama-bleed';
  const isMagazine3Col = page.layoutId === 'magazine-3col';

  // Pre-split body for magazine-3col.
  const bodyColumns = isMagazine3Col
    ? splitBodyIntoColumns(page.body ?? '', 3)
    : null;
  let bodyZoneIndex = 0;

  for (const zone of layout.textZones) {
    let value = textValueFor(page, zone.kind);
    if (isMagazine3Col && zone.kind === 'body' && bodyColumns) {
      value = bodyColumns[bodyZoneIndex] ?? '';
      bodyZoneIndex++;
    }
    if (!value) continue;

    const x = zone.x * pageW;
    const y = zone.y * pageH;
    const w = zone.w * pageW;
    const sizePt = zone.size ?? 12;

    const isTitle = zone.kind === 'title' || zone.kind === 'subtitle';
    const family = pdfFontFor(theme, isTitle ? 'title' : 'body');
    const style: 'normal' | 'italic' | 'bold' | 'bolditalic' =
      zone.kind === 'title'
        ? (zone.italic ? 'bolditalic' : 'bold')
        : zone.italic
          ? 'italic'
          : 'normal';

    pdf.setFont(family, style);
    pdf.setFontSize(sizePt);

    const overPhoto =
      isCover ||
      (isPanorama && (zone.kind === 'title' || zone.kind === 'subtitle'));

    const color: RGB = overPhoto
      ? [255, 255, 255]
      : zone.kind === 'title' || zone.kind === 'subtitle'
        ? hexToRgb(theme.ink)
        : hexToRgb(theme.inkSoft);
    pdf.setTextColor(color[0], color[1], color[2]);

    let display = value;
    if (zone.upper) display = display.toUpperCase();

    const lines = pdf.splitTextToSize(display, w);
    const lineMm = sizePt * 0.42;
    const maxLines = Math.max(1, Math.floor((zone.h * pageH) / lineMm));
    const visible = lines.slice(0, maxLines);

    const align = zone.align ?? 'left';
    const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;

    pdf.text(visible, textX, y + lineMm, {
      align: align as 'left' | 'center' | 'right',
      maxWidth: w,
      lineHeightFactor: 1.2,
    });
  }
}

function textValueFor(page: BookPage, kind: 'title' | 'subtitle' | 'caption' | 'body' | 'date' | 'location'): string | undefined {
  switch (kind) {
    case 'title': return page.title;
    case 'subtitle': return page.subtitle;
    case 'caption': return page.caption;
    case 'body': return page.body;
    case 'date': return page.date;
    case 'location': return page.location;
  }
}

/* ── Stickers (PDF) ───────────────────────────────────────── */

/**
 * Draw a sticker by kind. Simple shape stickers are rendered as jsPDF
 * primitives; complex ones are rasterised from SVG → canvas → addImage.
 */
async function drawSticker(
  pdf: jsPDF,
  sticker: Sticker,
  pageW: number,
  pageH: number,
): Promise<void> {
  const def = STICKER_LIBRARY[sticker.kind];
  if (!def) return;
  const color = sticker.color ?? def.defaultColor;
  // Sticker render size in mm — calibrated so scale=1 reads "medium-sized
  // accent" on an A4 page (~22mm square). Scale multiplies.
  const sizeMm = 22 * sticker.scale;
  const cx = sticker.x * pageW;
  const cy = sticker.y * pageH;

  if (PRIMITIVE_STICKERS.has(sticker.kind as StickerKind)) {
    drawPrimitiveSticker(pdf, sticker.kind, cx, cy, sizeMm, color, sticker.rotation);
    return;
  }

  // Rasterise via SVG. Use a generous pixel size for crispness.
  const px = Math.max(96, Math.round(sizeMm * 12));
  const canvas = await rasterStickerToCanvas(sticker.kind, color, px);
  if (!canvas) return;

  // Rotation: jsPDF can rotate via the 4th-or-5th-arg overload? Easiest is
  // to render the rotated image to ANOTHER canvas and embed that.
  let final = canvas;
  if (sticker.rotation !== 0) {
    final = document.createElement('canvas');
    final.width = canvas.width;
    final.height = canvas.height;
    const fctx = final.getContext('2d');
    if (fctx) {
      fctx.translate(canvas.width / 2, canvas.height / 2);
      fctx.rotate((sticker.rotation * Math.PI) / 180);
      fctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    }
  }

  const png = final.toDataURL('image/png');
  pdf.addImage(png, 'PNG', cx - sizeMm / 2, cy - sizeMm / 2, sizeMm, sizeMm, undefined, 'FAST');
}

/** Draw simple stickers using jsPDF primitives (no SVG raster). */
function drawPrimitiveSticker(
  pdf: jsPDF,
  kind: StickerKind,
  cx: number,
  cy: number,
  size: number,
  colorHex: string,
  rotation: number,
): void {
  const [r, g, b] = hexToRgb(colorHex);
  const half = size / 2;

  // Helper for rotated point.
  const rad = (rotation * Math.PI) / 180;
  const rot = (px: number, py: number): [number, number] => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
  };

  if (kind === 'map-pin') {
    pdf.setFillColor(r, g, b);
    // Teardrop: circle + downward triangle.
    pdf.circle(cx, cy - half * 0.2, half * 0.55, 'F');
    const tipPts: [number, number][] = [
      [cx - half * 0.45, cy - half * 0.1],
      [cx + half * 0.45, cy - half * 0.1],
      [cx, cy + half * 0.85],
    ];
    pdf.triangle(
      tipPts[0][0], tipPts[0][1],
      tipPts[1][0], tipPts[1][1],
      tipPts[2][0], tipPts[2][1],
      'F',
    );
    pdf.setFillColor(255, 255, 255);
    pdf.circle(cx, cy - half * 0.2, half * 0.22, 'F');
    return;
  }

  if (kind === 'heart') {
    pdf.setFillColor(r, g, b);
    const lx = cx - half * 0.35;
    const rx = cx + half * 0.35;
    pdf.circle(lx, cy - half * 0.15, half * 0.42, 'F');
    pdf.circle(rx, cy - half * 0.15, half * 0.42, 'F');
    pdf.triangle(
      cx - half * 0.75, cy - half * 0.05,
      cx + half * 0.75, cy - half * 0.05,
      cx, cy + half * 0.85,
      'F',
    );
    return;
  }

  if (kind === 'star') {
    pdf.setFillColor(r, g, b);
    // 5-point star polygon.
    const points: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? half : half * 0.42;
      const [px, py] = rot(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      points.push([px, py]);
    }
    // jsPDF doesn't expose polygon-fill directly. Use lines via triangles.
    for (let i = 1; i < points.length - 1; i++) {
      pdf.triangle(
        points[0][0], points[0][1],
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1],
        'F',
      );
    }
    return;
  }

  if (kind === 'arrow') {
    pdf.setFillColor(r, g, b);
    // Shaft.
    const sw = size * 0.6;
    const sh = size * 0.18;
    const sx = cx - sw / 2;
    const sy = cy - sh / 2;
    pdf.rect(sx, sy, sw * 0.7, sh, 'F');
    // Head triangle.
    pdf.triangle(
      sx + sw * 0.7, cy - half * 0.45,
      sx + sw, cy,
      sx + sw * 0.7, cy + half * 0.45,
      'F',
    );
    return;
  }

  if (kind === 'route-dashed') {
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.7);
    // Curve approximated by short dashed line segments along a Bezier.
    const steps = 18;
    let prev: [number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const xPt = cx - half + 2 * half * t;
      const yPt = cy + half * 0.5 - Math.sin(t * Math.PI) * half * 0.85;
      if (prev && i % 2 === 0) pdf.line(prev[0], prev[1], xPt, yPt);
      prev = [xPt, yPt];
    }
    pdf.setFillColor(r, g, b);
    pdf.circle(cx - half, cy + half * 0.5, 1.1, 'F');
    pdf.circle(cx + half, cy + half * 0.5 - 0.001, 1.1, 'F');
    return;
  }

  if (kind === 'sun') {
    pdf.setFillColor(r, g, b);
    pdf.circle(cx, cy, half * 0.45, 'F');
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(size * 0.06);
    const rays = 8;
    for (let i = 0; i < rays; i++) {
      const ang = (i * Math.PI * 2) / rays + rad;
      const x1 = cx + Math.cos(ang) * half * 0.62;
      const y1 = cy + Math.sin(ang) * half * 0.62;
      const x2 = cx + Math.cos(ang) * half * 0.95;
      const y2 = cy + Math.sin(ang) * half * 0.95;
      pdf.line(x1, y1, x2, y2);
    }
    return;
  }
}

// ─── Render a single page ─────────────────────────────────

async function renderPage(ctx: DrawCtx, page: BookPage) {
  const layout = LAYOUTS[page.layoutId];
  const { pdf, theme, pageW, pageH } = ctx;

  // 1. Background color.
  drawBackground(ctx, page.background);

  // 2. Background pattern overlay.
  drawPattern(pdf, page.backgroundPattern, pageW, pageH);

  // 3. Layout-specific decoration BEHIND photos.
  if (page.layoutId === 'map-full') {
    await drawMapDecoration(pdf, pageW, pageH, theme.ink);
  }

  const isCover = page.layoutId === 'cover';
  const isPanorama = page.layoutId === 'panorama-bleed';
  const isPolaroidGrid = page.layoutId === 'polaroid-grid';

  // 4. Photos.
  for (let i = 0; i < layout.slots.length; i++) {
    const slot = layout.slots[i];
    const x = slot.x * pageW;
    const y = slot.y * pageH;
    const w = slot.w * pageW;
    const h = slot.h * pageH;
    const url = page.photoUrls[i] ?? null;
    const filter = page.photoFilters?.[i] ?? null;
    let frame = page.photoFrames?.[i] ?? null;
    const caption = page.slotCaptions?.[i] ?? null;
    const slotCrop = page.slotCrops?.[i] ?? null;
    // Polaroid-grid implicitly uses the polaroid frame.
    if (isPolaroidGrid && (!frame || frame === 'none')) {
      frame = 'polaroid';
    }
    await placeImageCover(pdf, url, x, y, w, h, theme, filter, frame, caption, slotCrop);
  }

  // 5. Photo overlays (cover scrim / panorama scrim).
  if (isCover && page.photoUrls[0]) {
    drawCoverScrim(pdf, pageW, pageH);
  }
  if (isPanorama && page.photoUrls[0]) {
    drawPanoramaScrim(pdf, pageW, pageH * 0.55);
  }

  // 6. Theme decorations (over photos, under stickers and text).
  if (!isCover) drawDecorations(ctx);

  // 7. Stickers (decorative, sit on top of photos).
  const stickers: Sticker[] = page.stickers ?? [];
  for (const s of stickers) {
    await drawSticker(pdf, s, pageW, pageH);
  }

  // 8. Text zones (always on top).
  drawTextZones(pdf, page, layout, theme, pageW, pageH);
}

// ─── Public API ───────────────────────────────────────────

export type { BookState } from '@/lib/photobook/types';
export type PhotoBookSize = BookState['size'];
export type PhotoBookStyle = ThemeId;

/**
 * Generate the Photo Book and return it as a Blob.
 * Browser-only.
 */
export type PhotoBookExportProgress = {
  phase: 'fetching' | 'rendering';
  current: number;
  total: number;
};

/** Collect every photo URL that appears anywhere in the book (cover + pages). */
function collectPhotoUrls(state: BookState): string[] {
  const set = new Set<string>();
  const pages = [state.cover, ...state.pages];
  for (const page of pages) {
    for (const url of page.photoUrls) {
      if (url) set.add(url);
    }
  }
  return Array.from(set);
}

/**
 * Pre-warm the imageCache by fetching URLs in parallel with a concurrency
 * cap. The cap keeps us from saturating the browser's network slots (Chrome
 * tops out around 6 per origin anyway) while still being dramatically faster
 * than the previous one-at-a-time loop hidden inside renderPage.
 */
async function prefetchImages(
  urls: string[],
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (urls.length === 0) return;
  let nextIndex = 0;
  let completed = 0;
  const total = urls.length;
  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      await fetchImageAsDataUrl(urls[i]); // result lands in imageCache
      completed += 1;
      onProgress?.(completed, total);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, total) }, worker);
  await Promise.all(workers);
}

export async function exportPhotoBookPdf(
  state: BookState,
  onProgress?: (info: PhotoBookExportProgress) => void,
): Promise<Blob> {
  const theme = getTheme(state.theme);
  const [w, h] = SIZE_MM[state.size];
  const totalPages = state.pages.length + 1; // +1 cover
  const startedAt = performance.now();

  // Fresh cache per export so we don't leak data-URLs across runs.
  imageCache.clear();

  // ── Phase 1: fetch all photos in parallel ──
  const allUrls = collectPhotoUrls(state);
  console.log(`[PhotoBookPdf] prefetching ${allUrls.length} unique photos`);
  if (allUrls.length > 0) {
    onProgress?.({ phase: 'fetching', current: 0, total: allUrls.length });
  }
  const fetchStart = performance.now();
  await prefetchImages(allUrls, 6, (done, totalUrls) => {
    onProgress?.({ phase: 'fetching', current: done, total: totalUrls });
  });
  console.log(`[PhotoBookPdf] prefetch done in ${Math.round(performance.now() - fetchStart)}ms`);

  // ── Phase 2: render pages (fetches now hit the cache instantly) ──
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [w, h],
    compress: true,
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ctx: DrawCtx = { pdf, theme, pageW, pageH };

  console.log(`[PhotoBookPdf] rendering ${totalPages} pages`);
  console.log('[PhotoBookPdf] page 1/' + totalPages + ' (cover)');
  onProgress?.({ phase: 'rendering', current: 1, total: totalPages });
  await renderPage(ctx, state.cover);

  for (let i = 0; i < state.pages.length; i++) {
    pdf.addPage();
    const pageNum = i + 2;
    console.log(`[PhotoBookPdf] page ${pageNum}/${totalPages}`);
    onProgress?.({ phase: 'rendering', current: pageNum, total: totalPages });
    await renderPage(ctx, state.pages[i]);
  }

  const blob = pdf.output('blob');
  console.log(
    `[PhotoBookPdf] done in ${Math.round(performance.now() - startedAt)}ms — ${Math.round(blob.size / 1024)}KB`,
  );
  imageCache.clear();
  return blob;
}

export async function exportAndDownloadPhotoBookPdf(
  state: BookState,
  filename: string,
  onProgress?: (info: PhotoBookExportProgress) => void,
): Promise<void> {
  const blob = await exportPhotoBookPdf(state, onProgress);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
