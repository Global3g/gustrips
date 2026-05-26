'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, CalendarDays, Users, MapPin, CreditCard, Tag, Download } from 'lucide-react';
import {
  useExpensesFromContext as useExpenses,
  useEventsFromContext as useEvents,
  useTripFromContext as useTrip,
} from '@/context/TripDataContext';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { usePaymentCards } from '@/hooks/usePaymentCards';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { cardLabel } from '@/components/expenses/CardPicker';
import { analyzeExpenses, type Slice, type DaySlice } from '@/lib/utils/expenseAnalysis';
import { formatCurrency } from '@/lib/utils/helpers';

interface AnalysisTabProps {
  tripId: string;
}

/** Horizontal breakdown list — bar + label + amount + %. */
function Breakdown({
  title,
  icon: Icon,
  slices,
  currency,
  emptyHint,
}: {
  title: string;
  icon: typeof Wallet;
  slices: Slice[];
  currency: string;
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
        <div className="space-y-2.5">
          {slices.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-white/80 text-xs truncate flex items-center gap-1.5 min-w-0">
                  {s.color && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  )}
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="text-white/90 text-xs font-semibold tabular-nums flex-shrink-0">
                  {formatCurrency(s.amount, currency)}
                  <span className="text-white/40 ml-1.5">{s.pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${max > 0 ? (s.amount / max) * 100 : 0}%`,
                    background: s.color || 'linear-gradient(90deg,#fbbf24,#f59e0b)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per-day bar chart across the whole trip. */
function DayChart({ days, currency }: { days: DaySlice[]; currency: string }) {
  const max = days.reduce((m, d) => Math.max(m, d.amount), 0);
  if (days.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-white/45" />
        <span className="text-white/85 text-sm font-bold">Gasto por día</span>
      </div>
      <div className="flex items-end gap-1 h-24">
        {days.map((d, i) => {
          const h = max > 0 ? (d.amount / max) * 100 : 0;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center justify-end group"
              title={`${d.date} · ${formatCurrency(d.amount, currency)}`}
            >
              <div className="w-full flex items-end h-full">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max(h, d.amount > 0 ? 4 : 0)}%`,
                    background: d.amount > 0 ? 'linear-gradient(180deg,#fbbf24,#f59e0b)' : 'transparent',
                  }}
                />
              </div>
              <span className="text-[8px] text-white/30 mt-1">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Consolidated financial analysis: total vs budget, per-day timeline, and
 * breakdowns by category / person / city / payment. Multi-currency is
 * consolidated to the trip's base currency (with a per-currency strip for the
 * original spend). Read-only — reuses the same engine the PDF uses.
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

  const a = useMemo(() => {
    const nameById = new Map(travelers.map((t) => [t.id, t.fullName]));
    const cardById = new Map(cards.map((c) => [c.id, c]));
    return analyzeExpenses({
      expenses,
      events,
      trip,
      baseCurrency,
      convert,
      memberName: (uid) => nameById.get(uid) || '',
      cardLabelById: (id) => {
        const c = cardById.get(id);
        return c ? cardLabel(c) : null;
      },
    });
  }, [expenses, events, trip, travelers, cards, baseCurrency, convert]);

  const handleExportPdf = async () => {
    const { exportExpenseReportPdf } = await import('@/lib/utils/exportExpenseReportPdf');
    exportExpenseReportPdf(a, {
      tripTitle: trip?.title || 'Viaje',
      destination: trip?.destination,
      startDate: trip?.startDate,
      endDate: trip?.endDate,
    });
  };

  if (a.count === 0 && a.pointsValue === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center">
        <Wallet className="w-8 h-8 text-white/25 mx-auto mb-3" />
        <p className="text-white/70 text-sm font-medium">Todavía no hay gastos para analizar</p>
        <p className="text-white/40 text-xs mt-1">Captura algunos gastos y acá vas a ver el desglose por día, categoría, persona y más.</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0c1929,#132438 55%,#0f1f33)' }}>
      <div className="relative z-10 p-5 sm:p-6 space-y-4">
        {/* ── Download report ── */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-white/[0.12] bg-white/[0.05] text-white/80 hover:text-white hover:border-white/25 hover:bg-white/[0.1] transition"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar reporte PDF
          </button>
        </div>

        {/* ── Hero: total + budget ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-white/45 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">
                Total gastado{a.baseCurrency !== a.perCurrency[0]?.currency || a.perCurrency.length > 1 ? ` (${a.baseCurrency})` : ''}
              </div>
              <div className="text-white text-3xl sm:text-4xl font-black tabular-nums" style={{ textShadow: '0 0 30px rgba(255,255,255,0.12)' }}>
                {formatCurrency(a.total, a.baseCurrency)}
              </div>
              {a.budget !== null && (
                <div className="mt-1.5">
                  <div className="text-white/55 text-xs">
                    {a.budgetPct!.toFixed(0)}% de {formatCurrency(a.budget, a.baseCurrency)}
                    {a.budgetLeft !== null && (
                      <span className={a.budgetLeft < 0 ? 'text-rose-300 ml-2' : 'text-emerald-300 ml-2'}>
                        {a.budgetLeft < 0 ? 'excedido ' : 'restan '}
                        {formatCurrency(Math.abs(a.budgetLeft), a.baseCurrency)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, a.budgetPct!)}%`,
                        background: a.budgetPct! > 100 ? '#fb7185' : a.budgetPct! > 85 ? '#fbbf24' : '#34d399',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-white/40 text-[10px] uppercase tracking-[0.18em] font-bold">Gastos</div>
              <div className="text-white text-2xl font-black tabular-nums">{a.count}</div>
            </div>
          </div>

          {/* Per-currency strip (original spend) */}
          {a.perCurrency.length > 1 && (
            <div className="text-white/55 text-[11px] flex flex-wrap gap-x-3 gap-y-0.5 border-t border-white/[0.06] pt-2">
              <span className="text-white/35">Original:</span>
              {a.perCurrency.map((c) => (
                <span key={c.currency} className="tabular-nums">{formatCurrency(c.amount, c.currency)}</span>
              ))}
            </div>
          )}
          {a.pointsValue > 0 && (
            <div className="text-violet-200/80 text-[11px] mt-1">
              + {formatCurrency(a.pointsValue, a.baseCurrency)} pagado con puntos
            </div>
          )}
        </div>

        {/* ── Quick stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
            <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-wider font-bold mb-1">
              <TrendingUp className="w-3 h-3" /> Promedio / día
            </div>
            <div className="text-white text-lg font-bold tabular-nums">{formatCurrency(a.avgPerDay, a.baseCurrency)}</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
            <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-wider font-bold mb-1">
              <Users className="w-3 h-3" /> Promedio / persona
            </div>
            <div className="text-white text-lg font-bold tabular-nums">{formatCurrency(a.avgPerPerson, a.baseCurrency)}</div>
          </div>
        </div>

        {/* ── Per-day chart ── */}
        <DayChart days={a.byDay} currency={a.baseCurrency} />

        {/* ── Breakdowns ── */}
        <Breakdown title="Por categoría" icon={Tag} slices={a.byCategory} currency={a.baseCurrency} />
        {a.byPerson.length > 1 && (
          <Breakdown title="Por persona" icon={Users} slices={a.byPerson} currency={a.baseCurrency} />
        )}
        <Breakdown title="Por lugar" icon={MapPin} slices={a.byCity} currency={a.baseCurrency} emptyHint="Sin ubicaciones registradas." />
        <Breakdown title="Por forma de pago" icon={CreditCard} slices={a.byPayment} currency={a.baseCurrency} />
      </div>
    </div>
  );
}
