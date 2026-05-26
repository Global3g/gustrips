/**
 * Pure financial-analysis engine for a trip's expenses. Kept framework-free
 * so BOTH the in-app Analysis tab and the PDF export run the exact same math
 * (no drift between screen and report).
 *
 * Multi-currency: every breakdown is consolidated into the trip's base
 * currency via the injected `convert` fn (same FX the budget uses), so
 * categories/days/people are comparable on one scale. The original spend is
 * also kept per-currency (`perCurrency`) for transparency.
 *
 * Points: payments made with points are NOT cash-out, so they're excluded
 * from `total` and the breakdowns; their real value is surfaced separately
 * as `pointsValue`.
 */

import type { TripExpense, TripEvent, ExpenseCategory } from '@/types';
import { EXPENSE_CATEGORIES } from '@/config/constants';
import { inferDateLocation } from '@/lib/utils/photoLocation';

export interface ExpenseAnalysisInput {
  expenses: TripExpense[];
  events: TripEvent[];
  trip: {
    budget?: number;
    budgetCurrency?: string;
    startDate?: string;
    endDate?: string;
    dayLocations?: Record<string, string>;
    travelerIds?: string[];
  } | null;
  baseCurrency: string;
  /** Convert an amount from `from` currency into the base currency. */
  convert: (amount: number, from: string) => number;
  /** uid -> display name. */
  memberName: (uid: string) => string;
  /** cardId -> short label, or null if unknown. */
  cardLabelById: (cardId: string) => string | null;
}

export interface Slice {
  key: string;
  label: string;
  amount: number;
  pct: number;
  color?: string;
}

export interface DaySlice {
  date: string;
  amount: number;
}

export interface ExpenseAnalysis {
  baseCurrency: string;
  total: number;
  count: number;
  budget: number | null;
  budgetPct: number | null;
  budgetLeft: number | null;
  tripDays: number;
  avgPerDay: number;
  avgPerPerson: number;
  travelerCount: number;
  pointsValue: number;
  byCategory: Slice[];
  byDay: DaySlice[];
  byPerson: Slice[];
  byPayment: Slice[];
  byCity: Slice[];
  perCurrency: { currency: string; amount: number }[];
  topCategory: Slice | null;
  topDay: DaySlice | null;
}

const MS_DAY = 86_400_000;

/** Inclusive list of YYYY-MM-DD between two dates (capped to avoid runaways). */
function dateRange(start?: string, end?: string): string[] {
  if (!start || !end) return [];
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return [];
  const out: string[] = [];
  for (let t = s; t <= e && out.length < 400; t += MS_DAY) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function isPoints(e: TripExpense): boolean {
  return e.paymentMethod === 'points';
}

/** Cash value of an expense in the base currency (0 for points). */
function cashBase(e: TripExpense, base: string, convert: ExpenseAnalysisInput['convert']): number {
  if (isPoints(e)) return 0;
  return convert(e.amount || 0, e.currency || base);
}

// ── Per-expense group keys (single source of truth for both aggregation
//    and drill-down filtering) ──
export type AnalysisDim = 'category' | 'day' | 'person' | 'city' | 'payment';

export function expensePaymentKey(e: TripExpense): string {
  if ((e.paymentMethod === 'credit' || e.paymentMethod === 'debit') && e.cardId) {
    return `card:${e.cardId}`;
  }
  return `m:${e.paymentMethod || 'other'}`;
}

export function expenseCityKey(
  e: TripExpense,
  events: TripEvent[],
  trip: ExpenseAnalysisInput['trip'],
  eventsById?: Map<string, TripEvent>,
): string {
  const linked = e.eventId ? (eventsById?.get(e.eventId) ?? events.find((x) => x.id === e.eventId)) : undefined;
  let city = (linked?.city || '').trim();
  if (!city && e.date) city = inferDateLocation(e.date, events, trip).city;
  return city || '__none';
}

/** Which group this expense belongs to, for a given dimension. */
export function expenseDimKey(
  e: TripExpense,
  dim: AnalysisDim,
  events: TripEvent[],
  trip: ExpenseAnalysisInput['trip'],
): string {
  switch (dim) {
    case 'category': return (e.category || 'misc') as string;
    case 'day': return e.date || '';
    case 'person': return e.paidBy || 'unknown';
    case 'payment': return expensePaymentKey(e);
    case 'city': return expenseCityKey(e, events, trip);
  }
}

function toSlices(map: Map<string, { label: string; amount: number; color?: string }>, total: number): Slice[] {
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      amount: v.amount,
      color: v.color,
      pct: total > 0 ? (v.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function analyzeExpenses(input: ExpenseAnalysisInput): ExpenseAnalysis {
  const { expenses, events, trip, baseCurrency, convert, memberName, cardLabelById } = input;

  const eventsById = new Map(events.map((e) => [e.id, e]));

  let total = 0;
  let pointsValue = 0;

  const catMap = new Map<string, { label: string; amount: number; color?: string }>();
  const dayMap = new Map<string, number>();
  const personMap = new Map<string, { label: string; amount: number }>();
  const payMap = new Map<string, { label: string; amount: number }>();
  const cityMap = new Map<string, { label: string; amount: number }>();
  const curMap = new Map<string, number>();

  for (const e of expenses) {
    if (isPoints(e)) {
      // Real value paid with points, surfaced separately.
      pointsValue += convert(e.equivalentValue || 0, e.realValueCurrency || baseCurrency);
      continue;
    }
    const amt = cashBase(e, baseCurrency, convert);
    if (amt <= 0) continue;
    total += amt;

    // Original currency (raw, not converted).
    const cur = e.currency || baseCurrency;
    curMap.set(cur, (curMap.get(cur) || 0) + (e.amount || 0));

    // Category.
    const cat = (e.category || 'misc') as ExpenseCategory;
    const cfg = EXPENSE_CATEGORIES[cat];
    const prevCat = catMap.get(cat) || { label: cfg?.label || cat, amount: 0, color: cfg?.color };
    prevCat.amount += amt;
    catMap.set(cat, prevCat);

    // Day.
    if (e.date) dayMap.set(e.date, (dayMap.get(e.date) || 0) + amt);

    // Person (who paid).
    const uid = e.paidBy || 'unknown';
    const prevP = personMap.get(uid) || { label: memberName(uid) || 'Sin asignar', amount: 0 };
    prevP.amount += amt;
    personMap.set(uid, prevP);

    // Payment method / card.
    const payKey = expensePaymentKey(e);
    let payLabel: string;
    if (payKey.startsWith('card:') && e.cardId) {
      payLabel = cardLabelById(e.cardId) || (e.paymentMethod === 'credit' ? 'Tarjeta de crédito' : 'Tarjeta de débito');
    } else {
      const m = e.paymentMethod || 'other';
      const labels: Record<string, string> = {
        cash: 'Efectivo', debit: 'Débito (sin tarjeta)', credit: 'Crédito (sin tarjeta)',
        transfer: 'Transferencia', other: 'Otro',
      };
      payLabel = labels[m] || m;
    }
    const prevPay = payMap.get(payKey) || { label: payLabel, amount: 0 };
    prevPay.amount += amt;
    payMap.set(payKey, prevPay);

    // City: linked event's city, else inferred from the date.
    const cityKey = expenseCityKey(e, events, trip, eventsById);
    const cityLabel = cityKey === '__none' ? 'Sin ubicación' : cityKey;
    const prevCity = cityMap.get(cityKey) || { label: cityLabel, amount: 0 };
    prevCity.amount += amt;
    cityMap.set(cityKey, prevCity);
  }

  // By day: fill the full trip range so the timeline has no gaps.
  const range = dateRange(trip?.startDate, trip?.endDate);
  const byDay: DaySlice[] = (range.length > 0
    ? range
    : Array.from(dayMap.keys()).sort()
  ).map((date) => ({ date, amount: dayMap.get(date) || 0 }));

  const budget = typeof trip?.budget === 'number' && trip.budget > 0 ? trip.budget : null;
  const tripDays = range.length || byDay.length || 1;
  const travelerCount = Math.max(1, trip?.travelerIds?.length || personMap.size || 1);

  const byCategory = toSlices(catMap, total);
  const byPerson = toSlices(personMap, total).map((s) => ({ ...s }));
  const byPayment = toSlices(payMap, total);
  const byCity = toSlices(cityMap, total);

  const topDay = byDay.reduce<DaySlice | null>(
    (best, d) => (d.amount > 0 && (!best || d.amount > best.amount) ? d : best),
    null,
  );

  return {
    baseCurrency,
    total,
    count: expenses.filter((e) => !isPoints(e)).length,
    budget,
    budgetPct: budget ? (total / budget) * 100 : null,
    budgetLeft: budget !== null ? budget - total : null,
    tripDays,
    avgPerDay: tripDays > 0 ? total / tripDays : 0,
    avgPerPerson: travelerCount > 0 ? total / travelerCount : 0,
    travelerCount,
    pointsValue,
    byCategory,
    byDay,
    byPerson,
    byPayment,
    byCity,
    perCurrency: Array.from(curMap.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => b.amount - a.amount),
    topCategory: byCategory[0] || null,
    topDay,
  };
}
