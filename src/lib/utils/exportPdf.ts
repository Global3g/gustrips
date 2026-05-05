import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { EVENT_TYPES, CHECKLIST_PHASES } from '@/config/constants';
import { formatCurrency, formatDateES, formatDateShortES, formatDateHeaderES } from '@/lib/utils/helpers';
import type { Trip, TripEvent, TripMember, ChecklistItem } from '@/types';

// ─── Helpers ────────────────────────────────────────

function formatDate(dateStr: string): string {
  return formatDateES(dateStr);
}

function formatDateShort(dateStr: string): string {
  return formatDateShortES(dateStr);
}

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

// ─── PDF Export ─────────────────────────────────────

export function exportTripPdf(
  trip: Trip,
  events: TripEvent[],
  members: TripMember[],
  checklist: ChecklistItem[],
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Colores ──
  const primary: [number, number, number] = [59, 130, 246]; // blue-500
  const dark: [number, number, number] = [30, 41, 59];       // slate-800
  const gray: [number, number, number] = [100, 116, 139];    // slate-500
  const lightGray: [number, number, number] = [203, 213, 225]; // slate-300

  // ── Helper: nueva pagina si necesario ──
  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Helper: linea separadora ──
  const drawDivider = () => {
    checkPageBreak(8);
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  // ── Helper: titulo de seccion ──
  const drawSectionTitle = (title: string) => {
    checkPageBreak(14);
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

  // ═══════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════

  // Fondo del header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Titulo del viaje
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(trip.title, margin, 22);

  // Destino
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(200, 210, 230);
  doc.text(trip.destination, margin, 32);

  // Fechas
  doc.setFontSize(10);
  doc.setTextColor(160, 175, 200);
  doc.text(
    `${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}`,
    margin,
    42,
  );

  // App branding
  doc.setFontSize(9);
  doc.setTextColor(120, 140, 170);
  doc.text('GusTrips', pageWidth - margin, 42, { align: 'right' });

  y = 60;

  // ═══════════════════════════════════════════════════
  // DESCRIPCION
  // ═══════════════════════════════════════════════════

  if (trip.description) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...gray);
    const descLines = doc.splitTextToSize(trip.description, contentWidth);
    checkPageBreak(descLines.length * 5 + 6);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 6;
    drawDivider();
  }

  // ═══════════════════════════════════════════════════
  // ITINERARIO
  // ═══════════════════════════════════════════════════

  if (events.length > 0) {
    drawSectionTitle('Itinerario');

    const grouped = groupEventsByDate(events);
    const sortedDates = Object.keys(grouped).sort();

    for (let dayIdx = 0; dayIdx < sortedDates.length; dayIdx++) {
      const dateKey = sortedDates[dayIdx];
      const dayEvents = grouped[dateKey];

      // "Dia X" separator
      checkPageBreak(18);
      const dayLabel = `Dia ${dayIdx + 1}`;
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(margin, y - 4, 22, 8, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(dayLabel, margin + 11, y + 1, { align: 'center' });

      // Fecha al lado de la pill
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...dark);
      doc.text(formatDateHeaderES(dateKey), margin + 26, y + 1);
      y += 7;

      // Tabla de eventos del dia
      const tableBody = dayEvents.map((ev) => {
        const typeLabel = EVENT_TYPES[ev.type]?.label || ev.type;
        const timeStr = [ev.startTime, ev.endTime].filter(Boolean).join(' - ');
        const costStr = ev.cost > 0 ? formatCurrency(ev.cost, ev.currency) : '-';
        return [typeLabel, ev.title, timeStr, ev.location || '-', costStr];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Tipo', 'Titulo', 'Horario', 'Ubicacion', 'Costo']],
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
          fillColor: [241, 245, 249],
        },
        columnStyles: {
          0: { cellWidth: 24 },
          2: { cellWidth: 24 },
          4: { cellWidth: 24, halign: 'right' },
        },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    drawDivider();
  }

  // ═══════════════════════════════════════════════════
  // RESUMEN DE PRESUPUESTO
  // ═══════════════════════════════════════════════════

  if (events.some((e) => e.cost > 0)) {
    drawSectionTitle('Resumen de Presupuesto');

    const costByType: Record<string, number> = {};
    let totalCost = 0;

    for (const ev of events) {
      if (ev.cost > 0) {
        const label = EVENT_TYPES[ev.type]?.label || ev.type;
        costByType[label] = (costByType[label] || 0) + ev.cost;
        totalCost += ev.cost;
      }
    }

    const budgetBody = Object.entries(costByType)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => [category, formatCurrency(amount)]);

    // Add allocated budget column if available
    const hasAllocated = trip.budget && trip.budget > 0;
    if (hasAllocated) {
      budgetBody.push(['TOTAL', formatCurrency(totalCost)]);
      budgetBody.push(['PRESUPUESTO', formatCurrency(trip.budget!)]);
      const remaining = trip.budget! - totalCost;
      budgetBody.push(['RESTANTE', formatCurrency(remaining)]);
    } else {
      budgetBody.push(['TOTAL', formatCurrency(totalCost)]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Categoria', 'Monto']],
      body: budgetBody,
      styles: {
        fontSize: 10,
        cellPadding: 3,
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
      },
      didParseCell: (data) => {
        // Resaltar filas de resumen (TOTAL, PRESUPUESTO, RESTANTE)
        const cellText = String(data.cell.raw);
        if (cellText === 'TOTAL' || cellText === 'PRESUPUESTO' || cellText === 'RESTANTE') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
        // Match the row with TOTAL/PRESUPUESTO/RESTANTE labels
        const rowIdx = data.row.index;
        const totalRowStart = budgetBody.length - (hasAllocated ? 3 : 1);
        if (rowIdx >= totalRowStart) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    drawDivider();
  }

  // ═══════════════════════════════════════════════════
  // MIEMBROS
  // ═══════════════════════════════════════════════════

  if (members.length > 0) {
    drawSectionTitle('Viajeros del Viaje');

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

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    drawDivider();
  }

  // ═══════════════════════════════════════════════════
  // CHECKLIST
  // ═══════════════════════════════════════════════════

  if (checklist.length > 0) {
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
          // Green checkbox
          doc.setFillColor(34, 197, 94);
          doc.roundedRect(margin + 2, y - 3, 4, 4, 0.8, 0.8, 'F');
          doc.setTextColor(100, 130, 100);
          doc.setFont('helvetica', 'normal');
          doc.text(item.text, margin + 10, y);
        } else {
          // Empty checkbox
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
  }

  // ═══════════════════════════════════════════════════
  // PIE DE PAGINA
  // ═══════════════════════════════════════════════════

  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(
      `Generado por GusTrips - Pagina ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  // ── Descargar ──
  const fileName = `${trip.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')}_itinerario.pdf`;
  doc.save(fileName);
}
