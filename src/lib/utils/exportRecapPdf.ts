import jsPDF from 'jspdf';
import { formatCurrency, formatDateES, getInitials } from '@/lib/utils/helpers';
import type {
  Trip,
  TripEvent,
  TripExpense,
  AlbumPhoto,
  TripMember,
  GlobalTraveler,
} from '@/types';

// ─── Types ──────────────────────────────────────────

export interface ExportRecapInput {
  trip: Trip;
  events: TripEvent[];
  expenses: TripExpense[];
  albumPhotos: AlbumPhoto[];
  members: TripMember[];
  travelers: GlobalTraveler[];
  baseCurrency: string;
  totalSpent: number;
  totalSavings: number;
  pacePercent: number;
  cities: number;
  kmTraveled: number;
  daysVisited: number;
  topPhotos: AlbumPhoto[];
  peakDayDate?: string;
  peakDaySpent?: number;
  topCategory?: { type: string; label: string; total: number };
  topEvent?: { id: string; title: string; cost: number; photoCount: number };
}

type RGB = [number, number, number];

// ─── Color helpers ──────────────────────────────────

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Mix two RGBs by a factor (0..1, higher = more b)
function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// ─── Date helpers ───────────────────────────────────

const SHORT_MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function formatShortDateES(dateStr: string): string {
  // Returns "DD MMM" (e.g., "06 may")
  try {
    // dateStr is YYYY-MM-DD; parse manually to avoid TZ offsets
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

// ─── Image fetch via proxy ──────────────────────────

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    // Firebase Storage URLs need the proxy; for other URLs we still try the proxy
    // but fall back to direct fetch if the proxy rejects the host.
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

// ─── Filename ───────────────────────────────────────

function sanitizeForFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
}

// ─── Main export ────────────────────────────────────

export async function exportRecapPdf(input: ExportRecapInput): Promise<void> {
  const {
    trip,
    events,
    albumPhotos: rawAlbumPhotos,
    members,
    travelers,
    baseCurrency,
    totalSpent,
    totalSavings,
    pacePercent,
    cities,
    kmTraveled,
    daysVisited,
    topPhotos: rawTopPhotos,
    peakDayDate,
    peakDaySpent,
    topCategory,
    topEvent,
  } = input;

  // Soft-deleted photos must not appear in the recap PDF.
  const albumPhotos = rawAlbumPhotos.filter((p) => !p.deletedAt);
  const topPhotos = rawTopPhotos.filter((p) => !p.deletedAt);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Palette mirroring the on-screen recap (deep navy gradient)
  const navyTop: RGB = hexToRgb('#0d1b2e');
  const navyMid: RGB = hexToRgb('#1e3a5f');
  const navyBot: RGB = hexToRgb('#28406a');
  const white: RGB = [255, 255, 255];
  const amber: RGB = hexToRgb('#fbbf24');
  const cardFill: RGB = hexToRgb('#162a44'); // approx white/0.06 over navy
  const cardBorder: RGB = hexToRgb('#2a3f5f');
  const subtleText: RGB = hexToRgb('#cbd5e1');
  const fadedText: RGB = hexToRgb('#94a3b8');

  // Reusable: draw vertical-gradient navy background by horizontal slabs
  const drawBackground = () => {
    const slices = 60;
    const sliceH = pageHeight / slices;
    for (let i = 0; i < slices; i++) {
      const t = i / (slices - 1);
      // 0 -> navyTop, 0.5 -> navyMid, 1 -> navyBot
      const color: RGB =
        t < 0.5
          ? mixRgb(navyTop, navyMid, t / 0.5)
          : mixRgb(navyMid, navyBot, (t - 0.5) / 0.5);
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(0, i * sliceH, pageWidth, sliceH + 0.5, 'F');
    }
  };

  // Reusable: card rectangle with border + subtle fill
  const drawCard = (x: number, y: number, w: number, h: number) => {
    pdf.setFillColor(cardFill[0], cardFill[1], cardFill[2]);
    pdf.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, y, w, h, 3, 3, 'FD');
  };

  const setText = (rgb: RGB) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);

  // ═══════════════════════════════════════════════════
  // PAGE 1 — Hero
  // ═══════════════════════════════════════════════════

  drawBackground();

  // Eyebrow with sparkle decoration
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  setText(amber);
  pdf.text('TU VIAJE EN', pageWidth / 2, pageHeight / 2 - 36, { align: 'center' });

  // Decorative tiny line
  pdf.setDrawColor(amber[0], amber[1], amber[2]);
  pdf.setLineWidth(0.6);
  const lineHalf = 14;
  pdf.line(
    pageWidth / 2 - lineHalf,
    pageHeight / 2 - 31,
    pageWidth / 2 + lineHalf,
    pageWidth / 2 - 31 > 0 ? pageHeight / 2 - 31 : pageHeight / 2 - 31,
  );

  // Trip title — huge
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(36);
  setText(white);
  const titleLines = pdf.splitTextToSize(trip.title, pageWidth - 30);
  const titleY = pageHeight / 2 - 10;
  pdf.text(titleLines, pageWidth / 2, titleY, { align: 'center' });

  // Subtitle: destination · date range · X días
  const subtitleParts: string[] = [];
  if (trip.destination) subtitleParts.push(trip.destination);
  if (trip.startDate && trip.endDate) {
    subtitleParts.push(formatHeroDateRange(trip.startDate, trip.endDate));
  }
  // Days
  let totalDays = 0;
  try {
    const startMs = Date.parse(trip.startDate);
    const endMs = Date.parse(trip.endDate);
    if (!isNaN(startMs) && !isNaN(endMs)) {
      totalDays = Math.max(0, Math.round((endMs - startMs) / 86400000)) + 1;
    }
  } catch {
    totalDays = 0;
  }
  if (totalDays > 0) {
    subtitleParts.push(`${totalDays} ${totalDays === 1 ? 'día' : 'días'}`);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  setText(subtleText);
  const subtitleY = titleY + titleLines.length * 12 + 6;
  const subLines = pdf.splitTextToSize(subtitleParts.join('  ·  '), pageWidth - 30);
  pdf.text(subLines, pageWidth / 2, subtitleY, { align: 'center' });

  // Decorative arc - simple circle outline below subtitle
  pdf.setDrawColor(amber[0], amber[1], amber[2]);
  pdf.setLineWidth(0.4);
  const arcY = subtitleY + 14;
  // Draw a tiny three-dot decorative row
  pdf.setFillColor(amber[0], amber[1], amber[2]);
  pdf.circle(pageWidth / 2 - 4, arcY, 0.7, 'F');
  pdf.circle(pageWidth / 2, arcY, 1.0, 'F');
  pdf.circle(pageWidth / 2 + 4, arcY, 0.7, 'F');

  // Footer hint at bottom
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  setText(fadedText);
  pdf.text('GusTrips · Recap', pageWidth / 2, pageHeight - 12, { align: 'center' });

  // ═══════════════════════════════════════════════════
  // PAGE 2 — Stats grid
  // ═══════════════════════════════════════════════════

  pdf.addPage();
  drawBackground();

  // Section title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  setText(white);
  pdf.text('Resumen', 18, 24);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setText(subtleText);
  pdf.text(trip.title, 18, 31);

  // Stat cards 2x2
  const gridX = 18;
  const gridY = 42;
  const gridGap = 5;
  const cardW = (pageWidth - gridX * 2 - gridGap) / 2;
  const cardH = 38;

  const showSavings = totalSavings > 0;

  // Compute event+album photos
  const albumUrls = new Set(albumPhotos.map((p) => p.url));
  let extraEventPhotos = 0;
  for (const ev of events) {
    const evPhotos = ev.photos ?? [];
    for (const url of evPhotos) {
      if (!albumUrls.has(url)) extraEventPhotos += 1;
    }
  }
  const totalPhotos = albumPhotos.length + extraEventPhotos;

  type StatCard = {
    label: string;
    value: string;
    sub: string;
    accent: RGB;
  };

  const cards: StatCard[] = [
    {
      label: 'TOTAL GASTADO',
      value: formatCurrency(totalSpent, baseCurrency),
      sub:
        trip.budget && trip.budget > 0
          ? `${pacePercent.toFixed(0)}% del presupuesto`
          : 'sin presupuesto',
      accent: hexToRgb('#34d399'), // emerald-400
    },
    {
      label: 'EVENTOS',
      value: String(events.length),
      sub: `${cities} ${cities === 1 ? 'ciudad' : 'ciudades'} · ${kmTraveled.toFixed(0)} km`,
      accent: hexToRgb('#60a5fa'), // blue-400
    },
    {
      label: 'FOTOS',
      value: String(totalPhotos),
      sub: `${daysVisited} ${daysVisited === 1 ? 'día documentado' : 'días documentados'}`,
      accent: hexToRgb('#fbbf24'), // amber-400
    },
  ];
  if (showSavings) {
    cards.push({
      label: 'AHORRADO CON PUNTOS',
      value: formatCurrency(totalSavings, baseCurrency),
      sub: 'Valor equivalente',
      accent: hexToRgb('#e879f9'), // fuchsia
    });
  }

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gridX + col * (cardW + gridGap);
    const y = gridY + row * (cardH + gridGap);

    drawCard(x, y, cardW, cardH);

    // Accent bar at top
    pdf.setFillColor(c.accent[0], c.accent[1], c.accent[2]);
    pdf.roundedRect(x, y, cardW, 1.6, 0.8, 0.8, 'F');

    // Label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    setText(fadedText);
    pdf.text(c.label, x + 5, y + 9);

    // Value
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    setText(white);
    pdf.text(c.value, x + 5, y + 23);

    // Sub
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setText(subtleText);
    pdf.text(c.sub, x + 5, y + 32);
  }

  // ─── Momentos top ───
  const rowsCount = Math.ceil(cards.length / 2);
  let momentsY = gridY + rowsCount * (cardH + gridGap) + 8;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  setText(amber);
  pdf.text('MOMENTOS TOP', 18, momentsY);
  momentsY += 6;

  type MomentRow = {
    accent: RGB;
    title: string;
    subtitle: string;
    stat: string;
  };

  const momentRows: MomentRow[] = [];
  if (topCategory) {
    momentRows.push({
      accent: hexToRgb('#fb923c'), // orange-400
      title: 'Top categoría',
      subtitle: topCategory.label,
      stat: formatCurrency(topCategory.total, baseCurrency),
    });
  }
  if (peakDayDate && typeof peakDaySpent === 'number') {
    momentRows.push({
      accent: hexToRgb('#fb7185'), // rose-400
      title: 'Día más caro',
      subtitle: formatDateES(peakDayDate),
      stat: formatCurrency(peakDaySpent, baseCurrency),
    });
  }
  if (topEvent) {
    const stat =
      topEvent.photoCount > 0
        ? `${topEvent.photoCount} ${topEvent.photoCount === 1 ? 'foto' : 'fotos'}`
        : topEvent.cost > 0
        ? formatCurrency(topEvent.cost, baseCurrency)
        : '';
    momentRows.push({
      accent: hexToRgb('#fbbf24'),
      title: 'Evento estrella',
      subtitle: topEvent.title,
      stat,
    });
  }

  const rowH = 14;
  const rowGap = 3;
  for (let i = 0; i < momentRows.length; i++) {
    const m = momentRows[i];
    const y = momentsY + i * (rowH + rowGap);
    drawCard(18, y, pageWidth - 36, rowH);

    // Icon-shaped accent square
    pdf.setFillColor(m.accent[0], m.accent[1], m.accent[2]);
    pdf.roundedRect(22, y + 2.5, 9, 9, 2, 2, 'F');

    // Title (small uppercase)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    setText(fadedText);
    pdf.text(m.title.toUpperCase(), 35, y + 5.5);

    // Subtitle
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    setText(white);
    const subMax = pageWidth - 36 - 13 - 50; // leave room for stat
    const sub = pdf.splitTextToSize(m.subtitle, subMax)[0] || m.subtitle;
    pdf.text(sub, 35, y + 11);

    // Stat (right-aligned)
    if (m.stat) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      setText(white);
      pdf.text(m.stat, pageWidth - 22, y + 8.5, { align: 'right' });
    }
  }

  if (momentRows.length === 0) {
    drawCard(18, momentsY, pageWidth - 36, 18);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    setText(fadedText);
    pdf.text(
      'Aún no hay suficientes datos para destacar momentos.',
      pageWidth / 2,
      momentsY + 11,
      { align: 'center' },
    );
  }

  // Footer
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  setText(fadedText);
  pdf.text('GusTrips · Recap', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // ═══════════════════════════════════════════════════
  // PAGE 3 — Photo highlights
  // ═══════════════════════════════════════════════════

  if (topPhotos.length > 0) {
    pdf.addPage();
    drawBackground();

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    setText(white);
    pdf.text('Fotos destacadas', 18, 24);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    setText(subtleText);
    pdf.text(`Las mejores ${topPhotos.length} fotos del viaje`, 18, 31);

    // Fetch all photos in parallel
    const photoUrls = topPhotos.slice(0, 9);
    const dataUrls = await Promise.all(
      photoUrls.map((p) => fetchImageAsDataUrl(p.fullUrl || p.url)),
    );

    // 3x3 grid
    const gridStartX = 18;
    const gridStartY = 42;
    const gap = 4;
    const photosPerRow = 3;
    const cellSize = (pageWidth - gridStartX * 2 - gap * (photosPerRow - 1)) / photosPerRow;

    for (let i = 0; i < photoUrls.length; i++) {
      const photo = photoUrls[i];
      const dataUrl = dataUrls[i];
      const col = i % photosPerRow;
      const row = Math.floor(i / photosPerRow);
      const x = gridStartX + col * (cellSize + gap);
      const y = gridStartY + row * (cellSize + gap + (photo.caption ? 5 : 0));

      // Card frame
      pdf.setFillColor(cardFill[0], cardFill[1], cardFill[2]);
      pdf.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, cellSize, cellSize, 2, 2, 'FD');

      if (dataUrl) {
        try {
          const fmt = imageFormatFromDataUrl(dataUrl);
          // Inset by 1mm so border shows
          pdf.addImage(
            dataUrl,
            fmt,
            x + 1,
            y + 1,
            cellSize - 2,
            cellSize - 2,
            undefined,
            'FAST',
          );
        } catch {
          // If addImage fails, leave the empty card
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(7);
          setText(fadedText);
          pdf.text('foto', x + cellSize / 2, y + cellSize / 2, { align: 'center' });
        }
      } else {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7);
        setText(fadedText);
        pdf.text('sin imagen', x + cellSize / 2, y + cellSize / 2, { align: 'center' });
      }

      // Caption below if present
      if (photo.caption) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7);
        setText(subtleText);
        const captionLines = pdf.splitTextToSize(photo.caption, cellSize);
        const captionLine = captionLines[0] || '';
        pdf.text(captionLine, x + cellSize / 2, y + cellSize + 3.5, { align: 'center' });
      }
    }

    // Footer
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    setText(fadedText);
    pdf.text('GusTrips · Recap', pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // ═══════════════════════════════════════════════════
  // PAGE 4 — Travelers + footer
  // ═══════════════════════════════════════════════════

  // Resolve traveler chips: prefer trip.travelerIds via globals, else members
  type ChipPerson = { name: string; color: string };
  const chips: ChipPerson[] = [];

  if (trip.travelerIds && trip.travelerIds.length > 0) {
    for (const id of trip.travelerIds) {
      const g = travelers.find((t) => t.id === id);
      chips.push({
        name: g?.fullName || 'Viajero',
        color: g?.avatarColor || '#6366f1',
      });
    }
  } else if (members.length > 0) {
    for (const m of members) {
      chips.push({
        name: m.displayName || m.email,
        color: '#6366f1',
      });
    }
  }

  if (chips.length > 0) {
    pdf.addPage();
    drawBackground();

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    setText(white);
    pdf.text('Viajeros', 18, 24);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    setText(subtleText);
    pdf.text(`${chips.length} ${chips.length === 1 ? 'persona' : 'personas'} en este viaje`, 18, 31);

    // Chip layout: flow horizontally with wrap
    let cursorX = 18;
    let cursorY = 46;
    const chipHeight = 12;
    const chipPaddingX = 4;
    const circleR = 4;

    for (const chip of chips) {
      // Compute chip width based on text
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      const textWidth = pdf.getTextWidth(chip.name);
      const chipW = circleR * 2 + chipPaddingX * 2 + textWidth + 4;

      if (cursorX + chipW > pageWidth - 18) {
        cursorX = 18;
        cursorY += chipHeight + 4;
      }

      // Chip background
      pdf.setFillColor(cardFill[0], cardFill[1], cardFill[2]);
      pdf.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(cursorX, cursorY, chipW, chipHeight, chipHeight / 2, chipHeight / 2, 'FD');

      // Initials circle
      const circleColor = hexToRgb(chip.color.startsWith('#') ? chip.color : '#6366f1');
      pdf.setFillColor(circleColor[0], circleColor[1], circleColor[2]);
      pdf.circle(cursorX + circleR + 2, cursorY + chipHeight / 2, circleR, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      setText(white);
      pdf.text(
        getInitials(chip.name),
        cursorX + circleR + 2,
        cursorY + chipHeight / 2 + 2.3,
        { align: 'center' },
      );

      // Name
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      setText(white);
      pdf.text(chip.name, cursorX + circleR * 2 + chipPaddingX + 2, cursorY + chipHeight / 2 + 1.5);

      cursorX += chipW + 3;
    }

    // Final footer at bottom
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    setText(white);
    pdf.text('Generado por GusTrips', pageWidth / 2, pageHeight - 18, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    setText(fadedText);
    pdf.text('gustrips.app', pageWidth / 2, pageHeight - 12, { align: 'center' });
  }

  // ─── Save ───
  const slug = sanitizeForFilename(trip.title) || 'viaje';
  const start = (trip.startDate || '').slice(0, 10);
  const fileName = `recap_${slug}${start ? `_${start}` : ''}.pdf`;
  pdf.save(fileName);
}
