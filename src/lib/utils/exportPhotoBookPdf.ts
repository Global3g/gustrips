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
 *    as exportRecapPdf.ts) and applies a pixel-level sepia for vintage.
 *
 * Browser-only: depends on `document` (canvas), `Image`, and `fetch`.
 */

import jsPDF from 'jspdf';
import type { BookPage, BookState, BookTheme, LayoutDefinition, ThemeId } from '@/lib/photobook/types';
import { LAYOUTS } from '@/lib/photobook/layouts';
import { getTheme } from '@/lib/photobook/themes';

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

/**
 * Map the theme's CSS font key to one of jsPDF's three built-in families.
 * We don't embed custom fonts (yet) — the editor preview uses real custom
 * faces, but the PDF leans on the universally-available builtins to keep
 * the bundle small and the output portable.
 */
function pdfFontFor(theme: BookTheme, kind: 'title' | 'body'): PdfFontFamily {
  const key = kind === 'title' ? theme.titleFontKey : theme.bodyFontKey;
  if (key === 'sans') return 'helvetica';
  if (key === 'serif') return 'times';
  return 'times'; // 'script' has no PDF builtin; fall back to times-italic-ish.
}

// ─── Image fetching ───────────────────────────────────────

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const isFirebase = url.includes('firebasestorage.googleapis.com');
    const fetchUrl = isFirebase
      ? `/api/photo-proxy?url=${encodeURIComponent(url)}`
      : url;
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' {
  const lower = dataUrl.slice(0, 30).toLowerCase();
  if (lower.includes('image/png')) return 'PNG';
  if (lower.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

/**
 * Apply a quick sepia transform via a hidden canvas. Used by vintage.
 * Best-effort: if anything fails we return the original data URL.
 */
async function sepiaTone(dataUrl: string): Promise<string> {
  try {
    if (typeof document === 'undefined') return dataUrl;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('img load failed'));
      i.src = dataUrl;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      px[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      px[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      px[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return dataUrl;
  }
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

function drawDecorations(ctx: DrawCtx) {
  const { pdf, theme, pageW, pageH } = ctx;
  if (theme.decorations === 'none') return;

  if (theme.decorations === 'dashed-borders') {
    // Hand-drawn dashed border using short line segments. jsPDF exposes a
    // setLineDashPattern at runtime but it isn't in the type defs, so we
    // approximate to avoid an `any` cast.
    const [r, g, b] = hexToRgb(theme.rule);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.2);
    const dash = 1.6;
    const gap = 1.2;
    const step = dash + gap;
    const inset = 4;
    // Top and bottom
    for (let x = inset; x < pageW - inset; x += step) {
      const x2 = Math.min(x + dash, pageW - inset);
      pdf.line(x, inset, x2, inset);
      pdf.line(x, pageH - inset, x2, pageH - inset);
    }
    // Left and right
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
    // Top-left
    pdf.line(inset, inset, inset + len, inset);
    pdf.line(inset, inset, inset, inset + len);
    // Top-right
    pdf.line(pageW - inset - len, inset, pageW - inset, inset);
    pdf.line(pageW - inset, inset, pageW - inset, inset + len);
    // Bottom-left
    pdf.line(inset, pageH - inset, inset + len, pageH - inset);
    pdf.line(inset, pageH - inset - len, inset, pageH - inset);
    // Bottom-right
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
    // Sparse, deterministic dot pattern stands in for paper texture in PDF.
    const [r, g, b] = hexToRgb(theme.rule);
    pdf.setFillColor(r, g, b);
    const dots = 70;
    // Use a simple LCG seeded by a constant for stable output.
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

  /* ── Brutalist: thick black frame ── */
  if (theme.decorations === 'mono-borders') {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(1.4);
    pdf.rect(3, 3, pageW - 6, pageH - 6, 'S');
    pdf.setLineWidth(0.4);
    pdf.rect(6, 6, pageW - 12, pageH - 12, 'S');
    return;
  }

  /* ── Y2K: thick accent border (PDF can't do real neon glow) ── */
  if (theme.decorations === 'neon-glow') {
    const [r, g, b] = hexToRgb(theme.accent);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.9);
    pdf.rect(4, 4, pageW - 8, pageH - 8, 'S');
    pdf.setLineWidth(0.3);
    pdf.rect(6.5, 6.5, pageW - 13, pageH - 13, 'S');
    return;
  }

  /* ── Zine: tape strips drawn as small rotated rectangles in corners.
        jsPDF can't rotate easily so we use color blocks aligned to corners. */
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

  /* ── Glass: translucent overlay rect (jsPDF doesn't do real blur). */
  if (theme.decorations === 'glass-blur') {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(pageW * 0.06, pageH * 0.06, pageW * 0.88, pageH * 0.88, 'F');
    const [r, g, b] = hexToRgb(theme.accent);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.3);
    pdf.rect(pageW * 0.06, pageH * 0.06, pageW * 0.88, pageH * 0.88, 'S');
    return;
  }

  /* ── Psychedelic: colored rings in opposite corners. */
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
 * Place an image inside a slot rectangle. Maintains aspect ratio using
 * "cover" semantics (the image fills the slot and we crop the overflow).
 *
 * jsPDF's `addImage` doesn't natively do cover-fit, so we compute the
 * cropped portion ourselves via an offscreen canvas.
 */
async function placeImageCover(
  pdf: jsPDF,
  rawUrl: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: BookTheme,
) {
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
    return;
  }

  const dataUrl = await fetchImageAsDataUrl(rawUrl);
  if (!dataUrl) {
    fallbackFill();
    return;
  }

  try {
    // Load into Image so we know its natural size and can crop.
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('img load failed'));
      i.src = dataUrl;
    });

    // Compute cover-fit crop.
    const slotRatio = w / h;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgRatio > slotRatio) {
      // Image is wider — crop horizontally.
      sw = img.naturalHeight * slotRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      // Image is taller — crop vertically.
      sh = img.naturalWidth / slotRatio;
      sy = (img.naturalHeight - sh) / 2;
    }

    // Render the cropped region to a canvas, optionally sepia.
    const canvas = document.createElement('canvas');
    // Target ~150 DPI at the slot size — overkill for small slots, but
    // keeps large heroes crisp. Clamp to avoid runaway canvases.
    const targetW = Math.min(Math.round(w * 6), 2400);
    const targetH = Math.min(Math.round(h * 6), 2400);
    canvas.width = targetW;
    canvas.height = targetH;
    const cctx = canvas.getContext('2d');
    if (!cctx) {
      fallbackFill();
      return;
    }
    cctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    if (theme.sepia) {
      const data = cctx.getImageData(0, 0, targetW, targetH);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        px[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        px[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        px[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
      cctx.putImageData(data, 0, 0);
    }

    const out = canvas.toDataURL('image/jpeg', 0.86);
    const fmt = imageFormatFromDataUrl(out);
    pdf.addImage(out, fmt, x, y, w, h, undefined, 'FAST');

    // Thin frame for definition.
    const [rr, rg, rb] = hexToRgb(theme.rule);
    pdf.setDrawColor(rr, rg, rb);
    pdf.setLineWidth(0.15);
    pdf.rect(x, y, w, h, 'S');
  } catch {
    fallbackFill();
  }
}

/**
 * Draw a soft dark scrim at the bottom of the page — used on the cover so
 * the title (white) stays readable over arbitrary photos.
 *
 * jsPDF's GState-based opacity isn't in the type defs, so we render the
 * scrim into an offscreen canvas (where we DO have alpha) and embed it as
 * an image. Same visual result, cleaner types.
 */
function drawCoverScrim(pdf: jsPDF, w: number, h: number) {
  if (typeof document === 'undefined') return;
  const scrimH = h * 0.5;
  // Use a moderate resolution — gradients don't need DPI to look smooth.
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

/**
 * Render the text zones of a page.
 *
 * Note: text colour rules
 *  - On the cover, title/subtitle render in white (high contrast over
 *    the photo).
 *  - On regular pages, titles use `theme.ink`, body/caption use
 *    `theme.inkSoft`.
 */
function drawTextZones(
  pdf: jsPDF,
  page: BookPage,
  layout: LayoutDefinition,
  theme: BookTheme,
  pageW: number,
  pageH: number,
) {
  const isCover = page.layoutId === 'cover';

  for (const zone of layout.textZones) {
    const value = textValueFor(page, zone.kind);
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

    const color = isCover
      ? ([255, 255, 255] as RGB)
      : zone.kind === 'title' || zone.kind === 'subtitle'
        ? hexToRgb(theme.ink)
        : hexToRgb(theme.inkSoft);
    pdf.setTextColor(color[0], color[1], color[2]);

    let display = value;
    if (zone.upper) display = display.toUpperCase();

    // Wrap text. The font baseline sits a bit below `y`, so use `y` as the
    // first-line baseline. jsPDF text() uses baseline by default when no
    // baseline option is given.
    const lines = pdf.splitTextToSize(display, w);
    // Restrict to the height of the zone (rough: line height ≈ size * 1.2 / pt-to-mm ≈ size * 0.42).
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

// ─── Render a single page ─────────────────────────────────

async function renderPage(ctx: DrawCtx, page: BookPage) {
  const layout = LAYOUTS[page.layoutId];
  const { pdf, theme, pageW, pageH } = ctx;

  drawBackground(ctx, page.background);

  // Cover photo: full bleed, no slot frame.
  const isCover = page.layoutId === 'cover';

  for (let i = 0; i < layout.slots.length; i++) {
    const slot = layout.slots[i];
    const x = slot.x * pageW;
    const y = slot.y * pageH;
    const w = slot.w * pageW;
    const h = slot.h * pageH;
    const url = page.photoUrls[i] ?? null;
    await placeImageCover(pdf, url, x, y, w, h, theme);
  }

  if (isCover && page.photoUrls[0]) {
    drawCoverScrim(pdf, pageW, pageH);
  }

  // Decorations under the text but above the photo (covers excluded).
  if (!isCover) drawDecorations(ctx);

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
export async function exportPhotoBookPdf(state: BookState): Promise<Blob> {
  const theme = getTheme(state.theme);
  const [w, h] = SIZE_MM[state.size];

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [w, h],
    compress: true,
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ctx: DrawCtx = { pdf, theme, pageW, pageH };

  // Cover first.
  await renderPage(ctx, state.cover);

  // Then each page in order.
  for (const page of state.pages) {
    pdf.addPage();
    await renderPage(ctx, page);
  }

  return pdf.output('blob');
}

/**
 * Generate and trigger a download.
 */
export async function exportAndDownloadPhotoBookPdf(
  state: BookState,
  filename: string,
): Promise<void> {
  const blob = await exportPhotoBookPdf(state);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
