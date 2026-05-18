/**
 * Photo Book PDF generator.
 *
 * Produces a multi-page "photo book" style export of a trip: a hero cover, an
 * intro page, one spread per event, an optional rough GPS map, and a closing
 * stats page. Three visual styles are supported (Editorial / Magazine /
 * Vintage) and two page sizes (A4 portrait or square).
 *
 * This file is intentionally self-contained and does NOT depend on
 * exportRecapPdf.ts — the recap export has a fixed layout tuned for the
 * recap screen, while this one is its own thing. Some helpers (fetch via
 * /api/photo-proxy, hex parsing, filename sanitization, etc.) are
 * reimplemented locally to keep that contract.
 */

import jsPDF from 'jspdf';
import type { Trip, TripEvent, AlbumPhoto } from '@/types';

// ─── Public types ──────────────────────────────────

export type PhotoBookSize = 'a4' | 'square';
export type PhotoBookStyle = 'editorial' | 'magazine' | 'vintage';

export interface PhotoBookOptions {
  size: PhotoBookSize;
  style: PhotoBookStyle;
}

export interface ExportPhotoBookInput {
  trip: Trip;
  albumPhotos: AlbumPhoto[];
  events: TripEvent[];
  options: PhotoBookOptions;
}

type RGB = [number, number, number];

// ─── Style theme ───────────────────────────────────

interface BookTheme {
  background: RGB;        // page background fill
  paper: RGB;             // inner "paper" surface (where photos sit)
  ink: RGB;               // primary text
  inkSoft: RGB;           // secondary text
  accent: RGB;            // titles, decorations
  rule: RGB;              // hairline rules / borders
  // Font family identifier mapped to jsPDF built-ins.
  titleFont: 'helvetica' | 'times' | 'courier';
  bodyFont: 'helvetica' | 'times' | 'courier';
  // Whether to draw a sepia-tone overlay on photos (vintage).
  sepia: boolean;
  // Whether to draw decorative dots/lines in margins.
  decorative: boolean;
}

function getTheme(style: PhotoBookStyle): BookTheme {
  switch (style) {
    case 'magazine':
      return {
        background: [255, 255, 255],
        paper: [248, 248, 248],
        ink: [15, 15, 15],
        inkSoft: [90, 90, 90],
        accent: [232, 65, 80],
        rule: [220, 220, 220],
        titleFont: 'helvetica',
        bodyFont: 'helvetica',
        sepia: false,
        decorative: false,
      };
    case 'vintage':
      return {
        background: [245, 235, 215],
        paper: [252, 244, 224],
        ink: [60, 40, 20],
        inkSoft: [120, 90, 60],
        accent: [150, 80, 30],
        rule: [200, 180, 140],
        titleFont: 'times',
        bodyFont: 'times',
        sepia: true,
        decorative: true,
      };
    case 'editorial':
    default:
      return {
        background: [253, 250, 246],
        paper: [255, 255, 255],
        ink: [30, 30, 35],
        inkSoft: [115, 115, 125],
        accent: [180, 100, 60],
        rule: [220, 215, 205],
        titleFont: 'times',
        bodyFont: 'times',
        sepia: false,
        decorative: true,
      };
  }
}

// ─── Misc helpers ──────────────────────────────────

const SHORT_MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function formatShortDateES(dateStr: string): string {
  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    if (!m) return dateStr;
    const day = m[3];
    const monthIdx = parseInt(m[2], 10) - 1;
    return `${day} ${SHORT_MONTHS_ES[monthIdx] ?? ''}`.trim();
  } catch {
    return dateStr;
  }
}

function formatHeroDateRange(startDate: string, endDate: string): string {
  const start = formatShortDateES(startDate);
  const end = formatShortDateES(endDate);
  let year = '';
  const m = /^(\d{4})-/.exec(endDate);
  if (m) year = m[1];
  return `${start} — ${end}${year ? ` ${year}` : ''}`;
}

function sanitizeForFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  if (isNaN(startMs) || isNaN(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 86400000)) + 1;
}

function uniqueCities(events: TripEvent[]): number {
  const set = new Set<string>();
  for (const ev of events) {
    const head = (ev.city || ev.location?.split(',')[0] || '').trim().toLowerCase();
    if (head) set.add(head);
  }
  return set.size;
}

// ─── Image fetching ────────────────────────────────

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const isFirebase = url.includes('firebasestorage.googleapis.com');
    const fetchUrl = isFirebase
      ? `/api/photo-proxy?url=${encodeURIComponent(url)}`
      : url;
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    return dataUrl;
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
 * Apply a quick sepia transform to a data URL using a hidden canvas. Used by
 * the vintage style. Best-effort: if anything fails we just return the
 * original data URL.
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
      px[i]     = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      px[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      px[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return dataUrl;
  }
}

// ─── Event-aware photo grouping ────────────────────

interface EventGroup {
  event: TripEvent;
  photos: AlbumPhoto[];
}

function groupPhotosByEvent(events: TripEvent[], album: AlbumPhoto[]): EventGroup[] {
  const groups: EventGroup[] = [];
  const sortedEvents = [...events].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
  for (const ev of sortedEvents) {
    const linked = album.filter((p) => p.eventId === ev.id);
    if (linked.length > 0) groups.push({ event: ev, photos: linked });
  }
  return groups;
}

// ─── Main export ───────────────────────────────────

/**
 * Generates the Photo Book and returns it as a Blob. The caller decides what
 * to do with the blob (download via `URL.createObjectURL`, share, etc.).
 *
 * NOTE: This function is browser-only — it depends on `document` (canvas for
 * sepia) and `fetch` (for the proxy). Do not call from a Server Component.
 */
export async function exportPhotoBookPdf(input: ExportPhotoBookInput): Promise<Blob> {
  const { trip, albumPhotos, events, options } = input;
  const theme = getTheme(options.style);

  // Page geometry. jsPDF accepts a [w, h] format array in millimetres when
  // we use unit: 'mm'.
  const pageDims: [number, number] = options.size === 'square' ? [200, 200] : [210, 297];
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageDims,
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = options.size === 'square' ? 12 : 16;

  const setText = (rgb: RGB) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb: RGB) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setStroke = (rgb: RGB) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const drawBackground = () => {
    setFill(theme.background);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const drawFooter = (pageLabel: string) => {
    pdf.setFont(theme.bodyFont, 'italic');
    pdf.setFontSize(8);
    setText(theme.inkSoft);
    pdf.text(pageLabel, pageWidth / 2, pageHeight - 8, { align: 'center' });
  };

  // Tiny decorative trio of dots; used by editorial + vintage styles.
  const drawDotsRow = (cx: number, y: number, color: RGB) => {
    setFill(color);
    pdf.circle(cx - 3, y, 0.6, 'F');
    pdf.circle(cx, y, 0.9, 'F');
    pdf.circle(cx + 3, y, 0.6, 'F');
  };

  // Draw a horizontal hairline with side accents.
  const drawAccentRule = (y: number) => {
    setStroke(theme.rule);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, pageWidth - margin, y);
  };

  /**
   * Image placement helper. Maintains aspect ratio inside the given box and
   * supports the vintage sepia transform. If the image cannot be fetched we
   * fall back to a soft "paper" rectangle so the layout still feels intact.
   */
  const placeImage = async (
    rawUrl: string | null,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!rawUrl) {
      setFill(theme.paper);
      setStroke(theme.rule);
      pdf.setLineWidth(0.3);
      pdf.rect(x, y, w, h, 'FD');
      pdf.setFont(theme.bodyFont, 'italic');
      pdf.setFontSize(8);
      setText(theme.inkSoft);
      pdf.text('sin foto', x + w / 2, y + h / 2 + 1, { align: 'center' });
      return;
    }
    let dataUrl = await fetchImageAsDataUrl(rawUrl);
    if (!dataUrl) {
      setFill(theme.paper);
      setStroke(theme.rule);
      pdf.setLineWidth(0.3);
      pdf.rect(x, y, w, h, 'FD');
      pdf.setFont(theme.bodyFont, 'italic');
      pdf.setFontSize(8);
      setText(theme.inkSoft);
      pdf.text('foto no disponible', x + w / 2, y + h / 2 + 1, { align: 'center' });
      return;
    }
    if (theme.sepia) dataUrl = await sepiaTone(dataUrl);
    try {
      const fmt = imageFormatFromDataUrl(dataUrl);
      // Paper backing so any transparency lands on theme-correct white-ish.
      setFill(theme.paper);
      pdf.rect(x, y, w, h, 'F');
      pdf.addImage(dataUrl, fmt, x, y, w, h, undefined, 'FAST');
      // Thin frame.
      setStroke(theme.rule);
      pdf.setLineWidth(0.2);
      pdf.rect(x, y, w, h, 'S');
    } catch {
      setFill(theme.paper);
      pdf.rect(x, y, w, h, 'F');
    }
  };

  // ═══════════════════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════════════════

  drawBackground();

  // Hero photo background — pick the first album photo if present.
  const heroPhoto = albumPhotos[0];
  if (heroPhoto) {
    // Frame in the upper 60% of the page, full-bleed-ish with margin.
    const heroX = margin;
    const heroY = margin + 18;
    const heroW = pageWidth - margin * 2;
    const heroH = pageHeight * 0.5;
    await placeImage(heroPhoto.fullUrl || heroPhoto.url, heroX, heroY, heroW, heroH);
  }

  // Eyebrow
  pdf.setFont(theme.titleFont, 'bold');
  pdf.setFontSize(10);
  setText(theme.accent);
  pdf.text('PHOTO BOOK', pageWidth / 2, margin + 8, { align: 'center' });

  if (theme.decorative) {
    drawDotsRow(pageWidth / 2, margin + 12.5, theme.accent);
  }

  // Title block below the hero.
  const titleY = heroPhoto ? margin + 18 + pageHeight * 0.5 + 18 : pageHeight / 2 - 12;
  pdf.setFont(theme.titleFont, 'bold');
  pdf.setFontSize(options.size === 'square' ? 28 : 34);
  setText(theme.ink);
  const titleLines = pdf.splitTextToSize(trip.title, pageWidth - margin * 2);
  pdf.text(titleLines, pageWidth / 2, titleY, { align: 'center' });

  // Subtitle
  const subtitleParts: string[] = [];
  if (trip.destination) subtitleParts.push(trip.destination);
  if (trip.startDate && trip.endDate) {
    subtitleParts.push(formatHeroDateRange(trip.startDate, trip.endDate));
  }
  if (subtitleParts.length > 0) {
    pdf.setFont(theme.bodyFont, 'normal');
    pdf.setFontSize(12);
    setText(theme.inkSoft);
    const subY = titleY + titleLines.length * (options.size === 'square' ? 10 : 12) + 4;
    pdf.text(subtitleParts.join('  ·  '), pageWidth / 2, subY, { align: 'center' });
  }

  drawFooter('GusTrips · Photo Book');

  // ═══════════════════════════════════════════════════
  // INTRO PAGE
  // ═══════════════════════════════════════════════════

  pdf.addPage();
  drawBackground();

  const totalDays = trip.startDate && trip.endDate ? daysBetweenInclusive(trip.startDate, trip.endDate) : 0;
  const cityCount = uniqueCities(events);
  const photoCount = albumPhotos.length;

  // Decorative top
  if (theme.decorative) {
    drawAccentRule(margin + 4);
    drawDotsRow(pageWidth / 2, margin + 9, theme.accent);
  }

  pdf.setFont(theme.titleFont, 'italic');
  pdf.setFontSize(18);
  setText(theme.accent);
  pdf.text('Una historia', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

  pdf.setFont(theme.bodyFont, 'normal');
  pdf.setFontSize(12);
  setText(theme.ink);

  const intro = [
    trip.destination
      ? `Un viaje a ${trip.destination}`
      : `Un viaje`,
    trip.startDate && trip.endDate
      ? `entre ${formatShortDateES(trip.startDate)} y ${formatShortDateES(trip.endDate)}`
      : '',
    `con ${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}`,
    cityCount > 0
      ? `a través de ${cityCount} ${cityCount === 1 ? 'ciudad' : 'ciudades'}.`
      : '.',
  ].filter(Boolean).join(' ');

  const introLines = pdf.splitTextToSize(intro, pageWidth - margin * 2 - 30);
  pdf.text(introLines, pageWidth / 2, pageHeight / 2 - 4, { align: 'center' });

  // Decorative bottom
  if (theme.decorative) {
    drawDotsRow(pageWidth / 2, pageHeight / 2 + 18, theme.accent);
    drawAccentRule(pageHeight - margin - 4);
  }

  drawFooter('Introducción');

  // ═══════════════════════════════════════════════════
  // SPREADS PER EVENT
  // ═══════════════════════════════════════════════════

  const groups = groupPhotosByEvent(events, albumPhotos);

  for (const group of groups) {
    pdf.addPage();
    drawBackground();

    const ev = group.event;
    const photos = group.photos;

    // Header: small uppercase date/location and event title.
    pdf.setFont(theme.bodyFont, 'bold');
    pdf.setFontSize(8);
    setText(theme.accent);
    const eyebrow = [
      ev.date ? formatShortDateES(ev.date) : '',
      ev.city || ev.location?.split(',')[0] || '',
    ].filter(Boolean).join('  ·  ').toUpperCase();
    if (eyebrow) {
      pdf.text(eyebrow, margin, margin + 4);
    }

    pdf.setFont(theme.titleFont, 'bold');
    pdf.setFontSize(options.size === 'square' ? 18 : 22);
    setText(theme.ink);
    const eventTitleLines = pdf.splitTextToSize(ev.title || 'Sin título', pageWidth - margin * 2);
    pdf.text(eventTitleLines, margin, margin + 12);
    const titleBlockBottom = margin + 12 + eventTitleLines.length * (options.size === 'square' ? 6 : 8);

    if (theme.decorative) {
      drawAccentRule(titleBlockBottom + 2);
    }

    // Photo layout. The hero photo takes most of the page; up to 3 thumbs
    // go in a strip below it. If there are fewer than 4 photos we keep the
    // hero large and place the rest in a smaller row.
    const heroY = titleBlockBottom + 7;
    const stripHeight = options.size === 'square' ? 32 : 38;
    const captionReserve = (ev.notes || '').trim() ? 18 : 8;
    const heroH = pageHeight - heroY - stripHeight - captionReserve - margin - 4;
    const heroW = pageWidth - margin * 2;

    await placeImage(
      photos[0]?.fullUrl || photos[0]?.url || null,
      margin,
      heroY,
      heroW,
      heroH,
    );

    // Optional photo caption beneath hero.
    if (photos[0]?.caption) {
      pdf.setFont(theme.bodyFont, 'italic');
      pdf.setFontSize(9);
      setText(theme.inkSoft);
      const cap = pdf.splitTextToSize(photos[0].caption, heroW - 10)[0] || photos[0].caption;
      pdf.text(cap, margin + 2, heroY + heroH + 5);
    }

    // Thumbnail strip.
    const thumbs = photos.slice(1, 4);
    if (thumbs.length > 0) {
      const stripY = heroY + heroH + 8;
      const gap = 3;
      const thumbW = (heroW - gap * (thumbs.length - 1)) / Math.max(thumbs.length, 1);
      for (let i = 0; i < thumbs.length; i++) {
        const tx = margin + i * (thumbW + gap);
        await placeImage(
          thumbs[i].fullUrl || thumbs[i].url,
          tx,
          stripY,
          thumbW,
          stripHeight,
        );
      }
    }

    // Event notes (small, bottom of page).
    if ((ev.notes || '').trim()) {
      pdf.setFont(theme.bodyFont, 'italic');
      pdf.setFontSize(9);
      setText(theme.inkSoft);
      const noteLines = pdf.splitTextToSize(ev.notes, pageWidth - margin * 2);
      const noteTop = pageHeight - margin - 4 - Math.min(noteLines.length, 3) * 4;
      pdf.text(noteLines.slice(0, 3), margin, noteTop);
    }

    drawFooter(ev.location || ev.title || '');
  }

  // ═══════════════════════════════════════════════════
  // MAP PAGE (only if at least one event has coordinates)
  // ═══════════════════════════════════════════════════

  const geoEvents = events.filter(
    (e) => typeof e.latitude === 'number' && typeof e.longitude === 'number',
  );
  if (geoEvents.length >= 2) {
    pdf.addPage();
    drawBackground();

    pdf.setFont(theme.titleFont, 'bold');
    pdf.setFontSize(options.size === 'square' ? 22 : 26);
    setText(theme.ink);
    pdf.text('El recorrido', margin, margin + 10);

    pdf.setFont(theme.bodyFont, 'normal');
    pdf.setFontSize(10);
    setText(theme.inkSoft);
    pdf.text(
      `${geoEvents.length} puntos en el mapa`,
      margin,
      margin + 17,
    );

    // Compute bounding box of coordinates.
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const ev of geoEvents) {
      const lat = ev.latitude as number;
      const lon = ev.longitude as number;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    // Pad the bbox so points don't touch edges.
    const latPad = Math.max((maxLat - minLat) * 0.1, 0.01);
    const lonPad = Math.max((maxLon - minLon) * 0.1, 0.01);
    minLat -= latPad; maxLat += latPad;
    minLon -= lonPad; maxLon += lonPad;

    const mapX = margin;
    const mapY = margin + 24;
    const mapW = pageWidth - margin * 2;
    const mapH = pageHeight - mapY - margin - 12;

    // Map "paper" rectangle.
    setFill(theme.paper);
    setStroke(theme.rule);
    pdf.setLineWidth(0.3);
    pdf.rect(mapX, mapY, mapW, mapH, 'FD');

    // Project lat/lon → x/y. Lat is inverted because PDF y grows downward.
    const project = (lat: number, lon: number): { x: number; y: number } => {
      const tx = (lon - minLon) / Math.max(maxLon - minLon, 1e-6);
      const ty = (lat - minLat) / Math.max(maxLat - minLat, 1e-6);
      return {
        x: mapX + tx * mapW,
        y: mapY + (1 - ty) * mapH,
      };
    };

    // Connecting line (in event chronological order).
    const sortedGeo = [...geoEvents].sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
    setStroke(theme.accent);
    pdf.setLineWidth(0.4);
    for (let i = 1; i < sortedGeo.length; i++) {
      const a = project(sortedGeo[i - 1].latitude!, sortedGeo[i - 1].longitude!);
      const b = project(sortedGeo[i].latitude!, sortedGeo[i].longitude!);
      pdf.line(a.x, a.y, b.x, b.y);
    }

    // Dots.
    setFill(theme.accent);
    for (const ev of sortedGeo) {
      const p = project(ev.latitude!, ev.longitude!);
      pdf.circle(p.x, p.y, 1.4, 'F');
    }

    drawFooter('Mapa del viaje');
  }

  // ═══════════════════════════════════════════════════
  // CLOSING PAGE
  // ═══════════════════════════════════════════════════

  pdf.addPage();
  drawBackground();

  if (theme.decorative) {
    drawAccentRule(margin + 4);
    drawDotsRow(pageWidth / 2, margin + 9, theme.accent);
  }

  pdf.setFont(theme.titleFont, 'bold');
  pdf.setFontSize(options.size === 'square' ? 22 : 26);
  setText(theme.ink);
  pdf.text('El viaje en números', pageWidth / 2, pageHeight / 2 - 28, { align: 'center' });

  // Three line stats — keep it minimal.
  pdf.setFont(theme.bodyFont, 'normal');
  pdf.setFontSize(13);
  setText(theme.inkSoft);
  const statLines = [
    `Ciudades visitadas: ${cityCount}`,
    `Fotos: ${photoCount}`,
    `Días: ${totalDays}`,
  ];
  let cursorY = pageHeight / 2 - 12;
  for (const line of statLines) {
    pdf.text(line, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 8;
  }

  // Final phrase.
  pdf.setFont(theme.titleFont, 'italic');
  pdf.setFontSize(14);
  setText(theme.accent);
  pdf.text(
    'Cada foto, un instante guardado.',
    pageWidth / 2,
    cursorY + 12,
    { align: 'center' },
  );

  if (theme.decorative) {
    drawDotsRow(pageWidth / 2, cursorY + 22, theme.accent);
    drawAccentRule(pageHeight - margin - 4);
  }

  drawFooter('GusTrips · Photo Book');

  // ─── Output ──────────────────────────────────────
  const blob: Blob = pdf.output('blob');
  return blob;
}

/**
 * Convenience wrapper: generate the book and trigger a browser download.
 * Returns the filename used (callers may want it for analytics).
 */
export async function exportAndDownloadPhotoBookPdf(
  input: ExportPhotoBookInput,
): Promise<string> {
  const blob = await exportPhotoBookPdf(input);
  const slug = sanitizeForFilename(input.trip.title) || 'viaje';
  const start = (input.trip.startDate || '').slice(0, 10);
  const fileName = `photobook_${slug}${start ? `_${start}` : ''}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the click handler doesn't choke.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}
