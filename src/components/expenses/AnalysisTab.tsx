'use client';

import { useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, CalendarDays, Users, MapPin, CreditCard, Tag, Download, X, ChevronRight,
} from 'lucide-react';
import {
  useExpensesFromContext as useExpenses,
  useEventsFromContext as useEvents,
  useTripFromContext as useTrip,
} from '@/context/TripDataContext';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { usePaymentCards } from '@/hooks/usePaymentCards';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { cardLabel } from '@/components/expenses/CardPicker';
import {
  analyzeExpenses, expenseDimKey, type Slice, type DaySlice, type AnalysisDim,
} from '@/lib/utils/expenseAnalysis';
import { formatCurrency, formatDateES } from '@/lib/utils/helpers';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/config/constants';
import type { TripExpense } from '@/types';

interface AnalysisTabProps {
  tripId: string;
}

interface Focus {
  dim: AnalysisDim;
  key: string;
  label: string;
}

/** Tappable breakdown list — bars open a drill-down for that slice. */
function Breakdown({
  title, icon: Icon, slices, currency, dim, onSelect, emptyHint,
}: {
  title: string;
  icon: typeof Wallet;
  slices: Slice[];
  currency: string;
  dim: AnalysisDim;
  onSelect: (dim: AnalysisDim, s: Slice) => void;
  emptyHint?: string;
}) {
  const max = slices.reduce((m, s) => Math.max(m, s.amount), 0);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-white/45" />
        <span className="text-white/85 text-sm font-bold">{title}</span>
      </div>
      {slices.length === 0 ? (
        <p className="text-white/40 text-xs">{emptyHint || 'Sin datos.'}</p>
      ) : (
        <div className="space-y-2">
          {slices.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(dim, s)}
              className="w-full text-left group rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-white/80 text-xs truncate flex items-center gap-1.5 min-w-0">
                  {s.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />}
                  <span className="truncate">{s.label}</span>
                  <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors" />
                </span>
                <span className="text-white/90 text-xs font-semibold tabular-nums flex-shrink-0">
                  {formatCurrency(s.amount, currency)}
                  <span className="text-white/40 ml-1.5">{s.pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${max > 0 ? (s.amount / max) * 100 : 0}%`, background: s.color || 'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per-day bar chart — bars open that day's drill-down. */
function DayChart({ days, currency, onSelect }: { days: DaySlice[]; currency: string; onSelect: (d: DaySlice) => void }) {
  const max = days.reduce((m, d) => Math.max(m, d.amount), 0);
  if (days.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-white/45" />
        <span className="text-white/85 text-sm font-bold">Gasto por día</span>
        <span className="text-white/30 text-[10px] ml-auto">tocá una barra</span>
      </div>
      <div className="flex items-end gap-1 h-24">
        {days.map((d, i) => {
          const h = max > 0 ? (d.amount / max) * 100 : 0;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => d.amount > 0 && onSelect(d)}
              className="flex-1 flex flex-col items-center justify-end group"
              title={`${d.date} · ${formatCurrency(d.amount, currency)}`}
            >
              <div className="w-full flex items-end h-full">
                <div
                  className="w-full rounded-t-sm transition-all group-hover:brightness-125"
                  style={{ height: `${Math.max(h, d.amount > 0 ? 4 : 0)}%`, background: d.amount > 0 ? 'linear-gradient(180deg,#fbbf24,#f59e0b)' : 'transparent' }}
                />
              </div>
              <span className="text-[8px] text-white/30 mt-1">{i + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Line-item detail of the expenses in the current scope. */
function ExpenseList({
  items, baseCurrency, convert, memberName, cardName,
}: {
  items: TripExpense[];
  baseCurrency: string;
  convert: (a: number, f: string) => number;
  memberName: (uid: string) => string;
  cardName: (id: string) => string | null;
}) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 100);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
      <div className="text-white/85 text-sm font-bold mb-3">Detalle ({items.length})</div>
      <div className="space-y-2">
        {sorted.map((e) => {
          const cfg = EXPENSE_CATEGORIES[e.category];
          const cur = e.currency || baseCurrency;
          const converted = cur !== baseCurrency ? convert(e.amount, cur) : null;
          const payLabel = (e.paymentMethod === 'credit' || e.paymentMethod === 'debit') && e.cardId
            ? cardName(e.cardId) || PAYMENT_METHODS[e.paymentMethod]
            : e.paymentMethod ? PAYMENT_METHODS[e.paymentMethod] : '';
          return (
            <div key={e.id} className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-white/85 text-xs font-medium truncate">{e.description || cfg?.label || 'Gasto'}</div>
                <div className="text-white/40 text-[10px] flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span>{formatDateES(e.date)}</span>
                  {cfg && (
                    <span className="inline-flex items-center gap-1">
                      · <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />{cfg.label}
                    </span>
                  )}
                  {memberName(e.paidBy) && <span>· {memberName(e.paidBy)}</span>}
                  {payLabel && <span>· {payLabel}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-white/90 text-xs font-semibold tabular-nums">{formatCurrency(e.amount, cur)}</div>
                {converted !== null && (
                  <div className="text-white/35 text-[10px] tabular-nums">≈ {formatCurrency(converted, baseCurrency)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Consolidated financial analysis with drill-down: tap any category / day /
 * person / city / payment to re-scope the whole view to that slice (its own
 * per-day chart, sub-breakdowns and the line-item detail). Multi-currency is
 * consolidated to the trip's base currency via the app FX.
 */
export function AnalysisTab({ tripId }: AnalysisTabProps) {
  void tripId;
  const { expenses } = useExpenses();
  const { events } = useEvents();
  const { trip } = useTrip();
  const { travelers } = useGlobalTravelers();
  const { cards } = usePaymentCards();

  const baseCurrency = trip?.budgetCurrency || 'MXN';
  const { convert } = useExchangeRates(baseCurrency);

  const [focus, setFocus] = useState<Focus | null>(null);

  const nameById = useMemo(() => new Map(travelers.map((t) => [t.id, t.fullName])), [travelers]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const memberName = (uid: string) => nameById.get(uid) || '';
  const cardName = (id: string) => { const c = cardById.get(id); return c ? cardLabel(c) : null; };

  // Expenses in the current scope (filtered by the active drill-down focus).
  const scoped = useMemo(() => {
    if (!focus) return expenses;
    return expenses.filter(
      (e) => e.paymentMethod !== 'points' && expenseDimKey(e, focus.dim, events, trip) === focus.key,
    );
  }, [expenses, focus, events, trip]);

  const a = useMemo(
    () => analyzeExpenses({
      expenses: scoped, events, trip, baseCurrency, convert,
      memberName, cardLabelById: cardName,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, events, trip, baseCurrency, convert, nameById, cardById],
  );

  const handleExportPdf = async () => {
    const { exportExpenseReportPdf } = await import('@/lib/utils/exportExpenseReportPdf');
    exportExpenseReportPdf(a, {
      tripTitle: (trip?.title || 'Viaje') + (focus ? ` — ${focus.label}` : ''),
      destination: trip?.destination,
      startDate: trip?.startDate,
      endDate: trip?.endDate,
    });
  };

  const selectSlice = (dim: AnalysisDim, s: Slice) => setFocus({ dim, key: s.key, label: s.label });
  const selectDay = (d: DaySlice) => setFocus({ dim: 'day', key: d.date, label: formatDateES(d.date) });

  if (expenses.filter((e) => e.paymentMethod !== 'points').length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center">
        <Wallet className="w-8 h-8 text-white/25 mx-auto mb-3" />
        <p className="text-white/70 text-sm font-medium">Todavía no hay gastos para analizar</p>
        <p className="text-white/40 text-xs mt-1">Captura algunos gastos y acá vas a ver el desglose por día, categoría, persona y más — y vas a poder tocar cualquiera para abrir el detalle.</p>
      </div>
    );
  }

  const showBudget = !focus && a.budget !== null;

  return (
    <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0c1929,#132438 55%,#0f1f33)' }}>
      <div className="relative z-10 p-5 sm:p-6 space-y-4">
        {/* Top bar: focus chip + download */}
        <div className="flex items-center gap-2">
          {focus ? (
            <button
              type="button"
              onClick={() => setFocus(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-300/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25 transition"
            >
              {focus.label}
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-white/40 text-xs">Tocá una categoría, día o lugar para ver el detalle</span>
          )}
          <button
            type="button"
            onClick={handleExportPdf}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-white/[0.12] bg-white/[0.05] text-white/80 hover:text-white hover:border-white/25 hover:bg-white/[0.1] transition"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>

        {/* Hero */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white/45 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">
                {focus ? focus.label : 'Total gastado'} ({a.baseCurrency})
              </div>
              <div className="text-white text-3xl sm:text-4xl font-black tabular-nums" style={{ textShadow: '0 0 30px rgba(255,255,255,0.12)' }}>
                {formatCurrency(a.total, a.baseCurrency)}
              </div>
              {showBudget && (
                <div className="mt-1.5">
                  <div className="text-white/55 text-xs">
                    {a.budgetPct!.toFixed(0)}% de {formatCurrency(a.budget!, a.baseCurrency)}
                    {a.budgetLeft !== null && (
                      <span className={a.budgetLeft < 0 ? 'text-rose-300 ml-2' : 'text-emerald-300 ml-2'}>
                        {a.budgetLeft < 0 ? 'excedido ' : 'restan '}{formatCurrency(Math.abs(a.budgetLeft), a.baseCurrency)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, a.budgetPct!)}%`, background: a.budgetPct! > 100 ? '#fb7185' : a.budgetPct! > 85 ? '#fbbf24' : '#34d399' }} />
                  </div>
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-white/40 text-[10px] uppercase tracking-[0.18em] font-bold">Gastos</div>
              <div className="text-white text-2xl font-black tabular-nums">{a.count}</div>
            </div>
          </div>
          {a.perCurrency.length > 1 && (
            <div className="text-white/55 text-[11px] flex flex-wrap gap-x-3 gap-y-0.5 border-t border-white/[0.06] pt-2 mt-2">
              <span className="text-white/35">Original:</span>
              {a.perCurrency.map((c) => <span key={c.currency} className="tabular-nums">{formatCurrency(c.amount, c.currency)}</span>)}
            </div>
          )}
          {a.pointsValue > 0 && !focus && (
            <div className="text-violet-200/80 text-[11px] mt-1">+ {formatCurrency(a.pointsValue, a.baseCurrency)} pagado con puntos</div>
          )}
        </div>

        {/* Quick stats (only on the global view) */}
        {!focus && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
              <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-wider font-bold mb-1"><TrendingUp className="w-3 h-3" /> Promedio / día</div>
              <div className="text-white text-lg font-bold tabular-nums">{formatCurrency(a.avgPerDay, a.baseCurrency)}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
              <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-wider font-bold mb-1"><Users className="w-3 h-3" /> Promedio / persona</div>
              <div className="text-white text-lg font-bold tabular-nums">{formatCurrency(a.avgPerPerson, a.baseCurrency)}</div>
            </div>
          </div>
        )}

        {/* Per-day chart — hidden when already focused on a single day */}
        {focus?.dim !== 'day' && <DayChart days={a.byDay} currency={a.baseCurrency} onSelect={selectDay} />}

        {/* Breakdowns — skip the dimension we're already focused on */}
        {focus?.dim !== 'category' && (
          <Breakdown title="Por categoría" icon={Tag} slices={a.byCategory} currency={a.baseCurrency} dim="category" onSelect={selectSlice} />
        )}
        {focus?.dim !== 'person' && a.byPerson.length > 1 && (
          <Breakdown title="Por persona" icon={Users} slices={a.byPerson} currency={a.baseCurrency} dim="person" onSelect={selectSlice} />
        )}
        {focus?.dim !== 'city' && (
          <Breakdown title="Por lugar" icon={MapPin} slices={a.byCity} currency={a.baseCurrency} dim="city" onSelect={selectSlice} emptyHint="Sin ubicaciones registradas." />
        )}
        {focus?.dim !== 'payment' && (
          <Breakdown title="Por forma de pago" icon={CreditCard} slices={a.byPayment} currency={a.baseCurrency} dim="payment" onSelect={selectSlice} />
        )}

        {/* Line-item detail — shown while drilled in */}
        {focus && (
          <ExpenseList items={scoped} baseCurrency={a.baseCurrency} convert={convert} memberName={memberName} cardName={cardName} />
        )}
      </div>
    </div>
  );
}
