import jsPDF from 'jspdf';
import autoTable, { type CellHookData } from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { EVENT_TYPES, CHECKLIST_PHASES, TRIP_STATUS } from '@/config/constants';
import { formatCurrency, formatDateES, formatDateShortES, formatDateHeaderES } from '@/lib/utils/helpers';
import type { Trip, TripEvent, TripMember, ChecklistItem, EventType, TripStatus } from '@/types';

// ─── Color helpers ──────────────────────────────────

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function tintRgb(rgb: RGB, factor: number): RGB {
  // factor 0..1 — higher = lighter
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * factor),
    Math.round(rgb[1] + (255 - rgb[1]) * factor),
    Math.round(rgb[2] + (255 - rgb[2]) * factor),
  ];
}

// ─── Date / grouping helpers ────────────────────────

function formatDate(dateStr: string): string {
  return formatDateES(dateStr);
}

// kept for parity with previous exports; currently unused but cheap to leave.
void formatDateShortES;

function groupEventsByDate(events: TripEvent[]): Record<string, TripEvent[]> {
  return events.reduce(
    (groups, event) => {
      const key = event.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
      return groups;
    },
    {} as Record<string, TripEvent[]>,
  );
}

function dayIndexFor(dateKey: string, sortedDates: string[]): number {
  return sortedDates.indexOf(dateKey) + 1;
}

function eventTypeColor(type: EventType): RGB {
  const cfg = EVENT_TYPES[type];
  return cfg ? hexToRgb(cfg.color) : [148, 163, 184];
}

function statusAccentColor(status: TripStatus): RGB {
  // Green if active, blue if completed, amber if planning, gray otherwise
  if (status === 'active') return hexToRgb('#22c55e');
  if (status === 'completed') return hexToRgb('#3b82f6');
  if (status === 'planning') return hexToRgb('#f59e0b');
  return hexToRgb(TRIP_STATUS[status]?.color ?? '#94a3b8');
}

// ─── Detail-label translation (best-effort, falls back to key) ──

const DETAIL_LABELS: Record<string, string> = {
  flightNumber: 'Vuelo',
  airline: 'Aerolínea',
  departureAirport: 'Salida',
  arrivalAirport: 'Llegada',
  hotelName: 'Hotel',
  reservationNumber: 'Reserva',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  carCompany: 'Empresa',
  carModel: 'Modelo',
  pickupLocation: 'Recogida',
  returnLocation: 'Devolución',
  confirmationCode: 'Código',
  contact: 'Contacto',
  phone: 'Teléfono',
  address: 'Dirección',
  notes: 'Notas',
};

function labelForDetailKey(key: string): string {
  if (DETAIL_LABELS[key]) return DETAIL_LABELS[key];
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ─── PDF Export ─────────────────────────────────────

export function exportTripPdf(
  trip: Trip,
  events: TripEvent[],
  members: TripMember[],
  checklist: ChecklistItem[],
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // ── Palette ──
  const primary: RGB = [59, 130, 246]; // blue-500
  const dark: RGB = [30, 41, 59]; // slate-800
  const gray: RGB = [100, 116, 139]; // slate-500
  const lightGray: RGB = [203, 213, 225]; // slate-300
  const veryLight: RGB = [241, 245, 249]; // slate-100
  const accent: RGB = statusAccentColor(trip.status);

  // Today, formatted in Spanish
  const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });

  // Currency for the trip (default to first event with cost or trip.budgetCurrency)
  const tripCurrency =
    trip.budgetCurrency || events.find((e) => e.cost > 0)?.currency || 'MXN';

  // ── Sums (used by cover + summary) ──
  let totalCost = 0;
  for (const ev of events) {
    if (ev.cost > 0) totalCost += ev.cost;
  }

  // Day totals (for separators and summary)
  const grouped = groupEventsByDate(events);
  const sortedDates = Object.keys(grouped).sort();
  const dayTotals: Record<string, number> = {};
  for (const d of sortedDates) {
    dayTotals[d] = grouped[d].reduce((sum, ev) => sum + (ev.cost > 0 ? ev.cost : 0), 0);
  }

  // ═══════════════════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════════════════

  const drawCoverPage = () => {
    // Subtle accent block at top
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageWidth, 6, 'F');

    // Title — centered vertically in upper third
    const titleY = pageHeight / 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(...dark);
    const titleLines = doc.splitTextToSize(trip.title, contentWidth);
    const titleBlockHeight = titleLines.length * 12;
    doc.text(titleLines, pageWidth / 2, titleY, { align: 'center' });

    // Destination + date range (lighter gray, 16pt)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(...gray);
    const destY = titleY + titleBlockHeight + 4;
    doc.text(trip.destination, pageWidth / 2, destY, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(...gray);
    doc.text(
      `${formatDate(trip.startDate)}  —  ${formatDate(trip.endDate)}`,
      pageWidth / 2,
      destY + 9,
      { align: 'center' },
    );

    // Horizontal accent line in trip-status color
    const accentLineY = destY + 18;
    doc.setDrawColor(...accent);
    doc.setLineWidth(1.2);
    const accentHalf = 30;
    doc.line(
      pageWidth / 2 - accentHalf,
      accentLineY,
      pageWidth / 2 + accentHalf,
      accentLineY,
    );

    // Status pill below the accent line
    const statusLabel = TRIP_STATUS[trip.status]?.label ?? trip.status;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const pillW = doc.getTextWidth(statusLabel) + 10;
    const pillX = pageWidth / 2 - pillW / 2;
    const pillY = accentLineY + 5;
    doc.setFillColor(...accent);
    doc.roundedRect(pillX, pillY, pillW, 7, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(statusLabel.toUpperCase(), pageWidth / 2, pillY + 4.9, { align: 'center' });

    // Stats line (events, travelers, total budget)
    const statsParts: string[] = [];
    statsParts.push(`${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`);
    statsParts.push(`${members.length} ${members.length === 1 ? 'viajero' : 'viajeros'}`);
    if (totalCost > 0) {
      statsParts.push(`Total: ${formatCurrency(totalCost, tripCurrency)}`);
    } else if (trip.budget && trip.budget > 0) {
      statsParts.push(`Presupuesto: ${formatCurrency(trip.budget, tripCurrency)}`);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...dark);
    doc.text(statsParts.join('   ·   '), pageWidth / 2, pillY + 18, { align: 'center' });

    // Description (italic, gray) if present, in middle-lower area
    if (trip.description) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...gray);
      const descLines = doc.splitTextToSize(trip.description, contentWidth - 20);
      const descY = pillY + 32;
      doc.text(descLines, pageWidth / 2, descY, { align: 'center' });
    }

    // Footer at bottom of cover
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(
      `Generado por GusTrips  ·  ${today}`,
      pageWidth / 2,
      pageHeight - 14,
      { align: 'center' },
    );
  };

  drawCoverPage();

  // ═══════════════════════════════════════════════════
  // PAGE 2+: ITINERARIO
  // ═══════════════════════════════════════════════════

  doc.addPage();
  let y = margin + 14; // leave room for header

  // ── Section title helper ──
  const drawSectionTitle = (title: string) => {
    if (y + 14 > pageHeight - 20) {
      doc.addPage();
      y = margin + 14;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primary);
    doc.text(title, margin, y);
    y += 4;
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + 40, y);
    y += 8;
  };

  const drawDivider = () => {
    if (y + 8 > pageHeight - 20) {
      doc.addPage();
      y = margin + 14;
    }
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = margin + 14;
    }
  };

  // ── Itinerario ──
  if (events.length > 0) {
    drawSectionTitle('Itinerario completo');

    for (const dateKey of sortedDates) {
      const dayEvents = grouped[dateKey];
      const dayIdx = dayIndexFor(dateKey, sortedDates);

      // Day separator (filled bg)
      checkPageBreak(20);
      const dayHeaderH = 10;
      doc.setFillColor(...tintRgb(accent, 0.85));
      doc.rect(margin, y, contentWidth, dayHeaderH, 'F');
      // Left accent bar
      doc.setFillColor(...accent);
      doc.rect(margin, y, 2.2, dayHeaderH, 'F');

      // Day name + index
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...dark);
      const dayHeader = `${formatDateHeaderES(dateKey).toUpperCase()} · DÍA ${dayIdx}`;
      doc.text(dayHeader, margin + 5, y + 6.5);

      // Day total on the right
      const dayTotal = dayTotals[dateKey];
      if (dayTotal > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...dark);
        doc.text(
          formatCurrency(dayTotal, tripCurrency),
          pageWidth - margin - 2,
          y + 6.5,
          { align: 'right' },
        );
      }

      y += dayHeaderH + 2;

      // Events table for this day
      const tableBody = dayEvents.map((ev) => {
        const typeLabel = EVENT_TYPES[ev.type]?.label || ev.type;
        const timeStr = [ev.startTime, ev.endTime].filter(Boolean).join(' - ');
        const costStr = ev.cost > 0 ? formatCurrency(ev.cost, ev.currency || tripCurrency) : '-';
        return [typeLabel, ev.title, timeStr, ev.location || '-', costStr];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Tipo', 'Título', 'Horario', 'Ubicación', 'Costo']],
        body: tableBody,
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          textColor: dark,
          lineColor: lightGray,
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: veryLight,
        },
        columnStyles: {
          0: { cellWidth: 26 },
          2: { cellWidth: 24 },
          4: { cellWidth: 26, halign: 'right' },
        },
        // Color-coded left bar in the Tipo cell, per event-type color
        didDrawCell: (data: CellHookData) => {
          if (data.section !== 'body' || data.column.index !== 0) return;
          const ev = dayEvents[data.row.index];
          if (!ev) return;
          const color = eventTypeColor(ev.type);
          doc.setFillColor(...color);
          // 2mm bar at the left of the type cell
          doc.rect(data.cell.x, data.cell.y, 1.8, data.cell.height, 'F');
          // Small colored dot before the title in column 1 — done via separate hook below
        },
      });

      y =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 3;

      // Per-event details block under each row that has details
      for (const ev of dayEvents) {
        const detailEntries = ev.details
          ? Object.entries(ev.details).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
          : [];
        const hasNotes = ev.notes && ev.notes.trim().length > 0;
        if (detailEntries.length === 0 && !hasNotes) continue;

        checkPageBreak(14);
        // Mini header strip with event title
        const color = eventTypeColor(ev.type);
        doc.setFillColor(...tintRgb(color, 0.88));
        doc.rect(margin, y, contentWidth, 6, 'F');
        doc.setFillColor(...color);
        doc.rect(margin, y, 1.8, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...dark);
        doc.text(ev.title, margin + 4, y + 4.2);
        y += 7;

        if (detailEntries.length > 0) {
          const detailsBody = detailEntries.map(([k, v]) => [labelForDetailKey(k), String(v)]);
          autoTable(doc, {
            startY: y,
            margin: { left: margin + 4, right: margin },
            body: detailsBody,
            theme: 'plain',
            styles: {
              fontSize: 9,
              cellPadding: 1.5,
              textColor: dark,
            },
            columnStyles: {
              0: { cellWidth: 36, fontStyle: 'bold', textColor: gray },
            },
          });
          y =
            (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
              .finalY + 1;
        }

        if (hasNotes) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(...gray);
          const noteLines = doc.splitTextToSize(ev.notes, contentWidth - 8);
          checkPageBreak(noteLines.length * 4.5 + 2);
          doc.text(noteLines, margin + 4, y + 3);
          y += noteLines.length * 4.5 + 2;
        }

        y += 2;
      }

      y += 3;
    }

    drawDivider();
  }

  // ═══════════════════════════════════════════════════
  // MIEMBROS
  // ═══════════════════════════════════════════════════

  if (members.length > 0) {
    checkPageBreak(30);
    drawSectionTitle('Viajeros');

    const roleLabels: Record<string, string> = {
      owner: 'Propietario',
      editor: 'Editor',
      viewer: 'Visor',
    };

    const membersBody = members.map((m) => [
      m.displayName || m.email,
      m.email,
      roleLabels[m.role] || m.role,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Nombre', 'Email', 'Rol']],
      body: membersBody,
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: dark,
        lineColor: lightGray,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;
    drawDivider();
  }

  // ═══════════════════════════════════════════════════
  // CHECKLIST
  // ═══════════════════════════════════════════════════

  if (checklist.length > 0) {
    checkPageBreak(20);
    drawSectionTitle('Checklist');

    const groupedByPhase: Record<string, ChecklistItem[]> = {};
    for (const item of checklist) {
      if (!groupedByPhase[item.phase]) groupedByPhase[item.phase] = [];
      groupedByPhase[item.phase].push(item);
    }

    const phaseOrder = ['pre-7d', 'pre-1d', 'airport', 'hotel', 'return'] as const;

    for (const phase of phaseOrder) {
      const items = groupedByPhase[phase];
      if (!items || items.length === 0) continue;

      const phaseLabel = CHECKLIST_PHASES[phase]?.label || phase;

      checkPageBreak(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...dark);
      doc.text(phaseLabel, margin, y);
      y += 5;

      for (const item of items) {
        checkPageBreak(7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        if (item.checked) {
          doc.setFillColor(34, 197, 94);
          doc.roundedRect(margin + 2, y - 3, 4, 4, 0.8, 0.8, 'F');
          doc.setTextColor(100, 130, 100);
          doc.text(item.text, margin + 10, y);
        } else {
          doc.setDrawColor(...gray);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin + 2, y - 3, 4, 4, 0.8, 0.8, 'S');
          doc.setTextColor(...dark);
          doc.text(item.text, margin + 10, y);
        }
        y += 5.5;
      }

      y += 3;
    }

    drawDivider();
  }

  // ═══════════════════════════════════════════════════
  // RESUMEN (last page)
  // ═══════════════════════════════════════════════════

  doc.addPage();
  y = margin + 14;
  drawSectionTitle('Resumen del viaje');

  // Top stats grid
  const statsRows: [string, string][] = [];
  statsRows.push(['Eventos totales', String(events.length)]);
  statsRows.push(['Días con actividades', String(sortedDates.length)]);
  statsRows.push(['Viajeros', String(members.length)]);
  if (totalCost > 0) {
    statsRows.push(['Costo total', formatCurrency(totalCost, tripCurrency)]);
  }
  if (trip.budget && trip.budget > 0) {
    statsRows.push(['Presupuesto asignado', formatCurrency(trip.budget, tripCurrency)]);
    const remaining = trip.budget - totalCost;
    statsRows.push([
      remaining >= 0 ? 'Disponible' : 'Excedido',
      formatCurrency(Math.abs(remaining), tripCurrency),
    ]);
  }
  if (checklist.length > 0) {
    const done = checklist.filter((c) => c.checked).length;
    const pct = Math.round((done / checklist.length) * 100);
    statsRows.push(['Progreso checklist', `${done}/${checklist.length}  (${pct}%)`]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: statsRows,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3,
      textColor: dark,
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: gray, cellWidth: 70 },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    didDrawCell: (data: CellHookData) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      // light bottom rule between rows
      doc.setDrawColor(...lightGray);
      doc.setLineWidth(0.15);
      doc.line(
        data.cell.x,
        data.cell.y + data.cell.height,
        data.cell.x + (pageWidth - margin * 2),
        data.cell.y + data.cell.height,
      );
    },
  });

  y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;

  // Top categories (cost by type)
  if (totalCost > 0) {
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...dark);
    doc.text('Gasto por categoría', margin, y);
    y += 5;

    const costByType: Record<string, { amount: number; type: EventType }> = {};
    for (const ev of events) {
      if (ev.cost > 0) {
        const label = EVENT_TYPES[ev.type]?.label || ev.type;
        if (!costByType[label]) costByType[label] = { amount: 0, type: ev.type };
        costByType[label].amount += ev.cost;
      }
    }

    const sortedCats = Object.entries(costByType).sort(
      ([, a], [, b]) => b.amount - a.amount,
    );

    const catBody = sortedCats.map(([label, { amount }]) => {
      const pct = ((amount / totalCost) * 100).toFixed(1);
      return [label, formatCurrency(amount, tripCurrency), `${pct}%`];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Categoría', 'Monto', '%']],
      body: catBody,
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: dark,
        lineColor: lightGray,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        1: { halign: 'right', cellWidth: 40 },
        2: { halign: 'right', cellWidth: 22 },
      },
      didDrawCell: (data: CellHookData) => {
        if (data.section !== 'body' || data.column.index !== 0) return;
        const entry = sortedCats[data.row.index];
        if (!entry) return;
        const color = eventTypeColor(entry[1].type);
        doc.setFillColor(...color);
        doc.rect(data.cell.x, data.cell.y, 1.8, data.cell.height, 'F');
      },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;
  }

  // ═══════════════════════════════════════════════════
  // PAGE HEADER + FOOTER on every non-cover page
  // ═══════════════════════════════════════════════════

  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    if (i === 1) {
      // Cover page already has its own footer; skip header.
      continue;
    }

    // Header — trip title left, page X of Y right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    const headerTitle = trip.title.length > 70 ? trip.title.slice(0, 67) + '…' : trip.title;
    doc.text(headerTitle, margin, 10);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, 10, { align: 'right' });

    // Thin line below header
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.2);
    doc.line(margin, 12.5, pageWidth - margin, 12.5);

    // Footer — italic gray caption
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(
      `Generado por GusTrips  ·  ${today}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  // ── Descargar ──
  const fileName = `${trip.title
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')
    .replace(/\s+/g, '_')}_itinerario.pdf`;
  doc.save(fileName);
}
