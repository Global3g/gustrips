/**
 * Dedicated "Reporte de gastos" PDF — a finance-only document built from the
 * SAME analysis object the in-app Analysis tab renders (so screen and report
 * never disagree). Lazy-imported on tap to keep jspdf out of the main bundle.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { formatCurrency, formatDateES } from '@/lib/utils/helpers';
import type { ExpenseAnalysis } from '@/lib/utils/expenseAnalysis';

interface ReportOptions {
  tripTitle: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
}

type RGB = [number, number, number];

export function exportExpenseReportPdf(a: ExpenseAnalysis, opts: ReportOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const cur = a.baseCurrency;
  const amber: RGB = [217, 119, 6];
  const dark: RGB = [30, 41, 59];
  const gray: RGB = [100, 116, 139];

  // ── Header ──
  doc.setFillColor(...dark);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Reporte de gastos', margin, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(opts.tripTitle || 'Viaje', margin, 24);
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const range = opts.startDate && opts.endDate ? `${formatDateES(opts.startDate)} — ${formatDateES(opts.endDate)}` : '';
  const sub = [opts.destination, range].filter(Boolean).join('  ·  ');
  if (sub) doc.text(sub, margin, 30);

  let y = 44;

  // ── Summary block ──
  doc.setTextColor(...gray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL GASTADO', margin, y);
  doc.setTextColor(...dark);
  doc.setFontSize(22);
  doc.text(formatCurrency(a.total, cur), margin, y + 9);
  y += 9;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  const stats: string[] = [];
  if (a.budget !== null && a.budgetPct !== null) {
    stats.push(`${a.budgetPct.toFixed(0)}% de ${formatCurrency(a.budget, cur)}`);
    if (a.budgetLeft !== null) stats.push(a.budgetLeft < 0 ? `excedido ${formatCurrency(-a.budgetLeft, cur)}` : `restan ${formatCurrency(a.budgetLeft, cur)}`);
  }
  stats.push(`${a.count} gastos`);
  stats.push(`prom/día ${formatCurrency(a.avgPerDay, cur)}`);
  stats.push(`prom/persona ${formatCurrency(a.avgPerPerson, cur)}`);
  y += 7;
  doc.text(stats.join('   ·   '), margin, y);

  if (a.perCurrency.length > 1) {
    y += 6;
    doc.setTextColor(...gray);
    doc.text('Original: ' + a.perCurrency.map((c) => formatCurrency(c.amount, c.currency)).join('  ·  '), margin, y);
  }
  if (a.pointsValue > 0) {
    y += 6;
    doc.text(`+ ${formatCurrency(a.pointsValue, cur)} pagado con puntos`, margin, y);
  }
  y += 6;

  const tableOpts = {
    theme: 'grid' as const,
    headStyles: { fillColor: amber, textColor: [255, 255, 255] as RGB, fontStyle: 'bold' as const, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: dark },
    alternateRowStyles: { fillColor: [248, 250, 252] as RGB },
    margin: { left: margin, right: margin },
  };

  const moneyCol = { halign: 'right' as const };
  const sectionTable = (title: string, head: string[], body: (string | number)[][]) => {
    if (body.length === 0) return;
    const startY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...dark);
    doc.text(title, margin, startY + 10);
    autoTable(doc, {
      ...tableOpts,
      startY: startY + 13,
      head: [head],
      body,
      columnStyles: { 1: moneyCol, 2: { halign: 'right' } },
    });
  };

  // First table positions off `y`; subsequent ones off lastAutoTable.
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable = { finalY: y - 3 };

  sectionTable(
    'Por categoría',
    ['Categoría', 'Monto', '%'],
    a.byCategory.map((s) => [s.label, formatCurrency(s.amount, cur), `${s.pct.toFixed(0)}%`]),
  );

  if (a.byPerson.length > 1) {
    sectionTable(
      'Por persona',
      ['Persona', 'Monto', '%'],
      a.byPerson.map((s) => [s.label, formatCurrency(s.amount, cur), `${s.pct.toFixed(0)}%`]),
    );
  }

  sectionTable(
    'Por forma de pago',
    ['Forma de pago', 'Monto', '%'],
    a.byPayment.map((s) => [s.label, formatCurrency(s.amount, cur), `${s.pct.toFixed(0)}%`]),
  );

  sectionTable(
    'Por lugar',
    ['Lugar', 'Monto', '%'],
    a.byCity.map((s) => [s.label, formatCurrency(s.amount, cur), `${s.pct.toFixed(0)}%`]),
  );

  sectionTable(
    'Por día',
    ['Día', 'Monto'],
    a.byDay.filter((d) => d.amount > 0).map((d) => [formatDateES(d.date), formatCurrency(d.amount, cur)]),
  );

  // ── Footer ──
  const generated = format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    doc.text(`GusTrips · Generado el ${generated}`, margin, doc.internal.pageSize.getHeight() - 8);
  }

  const slug = (opts.tripTitle || 'viaje').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`gastos-${slug}.pdf`);
}
