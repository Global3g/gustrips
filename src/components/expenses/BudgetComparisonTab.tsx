'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import {
  Plane,
  Hotel,
  CarFront,
  MapPin,
  UtensilsCrossed,
  Car,
  Ship,
  MoreHorizontal,
  AlertCircle,
  Layers,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  Zap,
  ChevronDown,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
// Trip + events come from the layout-level TripDataProvider — this tab is
// only ever rendered inside `/trips/[tripId]/expenses`.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import Particles from '@/components/ui/Particles';
import { EVENT_TYPES, CURRENCIES } from '@/config/constants';
import { classNames, formatCurrency, formatDateES } from '@/lib/utils/helpers';
import { EmptyState } from '@/components/EmptyState';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import type { EventType, TripExpense } from '@/types';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<EventType, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: CarFront,
  activity: MapPin,
  restaurant: UtensilsCrossed,
  transport: Car,
  cruise: Ship,
  souvenirs: Gift,
  snacks: Coffee,
  clothing: ShoppingBag,
  fuel: Fuel,
  misc: Package,
};

type ViewMode = 'category' | 'event';

interface BudgetComparisonTabProps {
  tripId: string;
}

interface CategoryComparison {
  type: EventType;
  label: string;
  color: string;
  planned: number;
  actual: number;
  percentage: number;
  dailySpend: number[];
}

interface EventComparison {
  eventId: string;
  title: string;
  type: EventType;
  date: string;
  color: string;
  planned: number;
  actual: number;
  percentage: number;
  paidWithPoints: boolean;
  pointsUsed: number;
  pointsValue: number;
}

/* ─── CircularGauge ──────────────────────────────── */
function CircularGauge({
  percentage,
  size = 180,
  stroke = 14,
  color,
}: {
  percentage: number;
  size?: number;
  stroke?: number;
  color: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(percentage, 100);
  const dash = (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90 drop-shadow-[0_0_22px_rgba(255,255,255,0.06)]">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      {/* Glow trail */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke + 4}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        initial={{ strokeDasharray: `0 ${circumference}` }}
        animate={{ strokeDasharray: `${dash} ${circumference}` }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ filter: 'blur(8px)', opacity: 0.45 }}
      />
      {/* Main arc */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        initial={{ strokeDasharray: `0 ${circumference}` }}
        animate={{ strokeDasharray: `${dash} ${circumference}` }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Tip dot */}
      {clamped > 0 && clamped < 100 && (
        <motion.circle
          cx={size / 2 + radius * Math.cos((clamped / 100) * 2 * Math.PI)}
          cy={size / 2 + radius * Math.sin((clamped / 100) * 2 * Math.PI)}
          r={stroke / 2 + 2}
          fill="#fff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        />
      )}
    </svg>
  );
}

/* ─── Mini sparkline ─────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 120;
  const h = 22;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = `sg-${color.replace('#', '')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Status helpers ─────────────────────────────── */
function statusColor(pct: number): string {
  if (pct < 80) return '#10b981'; // emerald
  if (pct <= 100) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function statusLabel(pct: number): string {
  if (pct < 80) return 'En camino';
  if (pct <= 100) return 'Cerca del límite';
  return 'Sobre presupuesto';
}

export function BudgetComparisonTab({ tripId }: BudgetComparisonTabProps) {
  const { trip, loading: tripLoading } = useTrip();
  const { expenses, loading: expensesLoading, updateExpense, deleteExpense } = useExpenses(tripId);
  const { events, loading: eventsLoading, updateEvent } = useEvents();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('category');

  // Inline edit state for "Por evento" view
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [tempPlanned, setTempPlanned] = useState('');
  const [savingPlanned, setSavingPlanned] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [tempDesc, setTempDesc] = useState('');
  const [tempAmount, setTempAmount] = useState('');
  const [tempCurrency, setTempCurrency] = useState('MXN');
  const [savingExpense, setSavingExpense] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const loading = tripLoading || expensesLoading || eventsLoading;
  const budgetCategories = trip?.budgetCategories ?? [];
  const currency = trip?.budgetCurrency ?? 'MXN';
  const { convert: fxConvert, rates } = useExchangeRates(currency);

  // Track whether any conversion was applied for the info note
  const hasMixedCurrencies = useMemo(() => {
    return expenses.some((e) => (e.currency || currency).toUpperCase() !== currency.toUpperCase()) ||
      events.some((e) => (e.currency || currency).toUpperCase() !== currency.toUpperCase() && (e.cost || 0) > 0);
  }, [expenses, events, currency]);

  /* ─── Trip progress ─────────────────────────────── */
  const tripProgress = useMemo(() => {
    if (!trip?.startDate || !trip?.endDate) return null;
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const today = new Date();
      const totalDays = Math.max(differenceInCalendarDays(end, start) + 1, 1);
      const daysIn = Math.max(0, Math.min(differenceInCalendarDays(today, start) + 1, totalDays));
      const pct = (daysIn / totalDays) * 100;
      return { totalDays, daysIn, pct };
    } catch {
      return null;
    }
  }, [trip?.startDate, trip?.endDate]);

  /* ─── Category comparison + daily sparkline data ─── */
  const categoryComparison = useMemo((): CategoryComparison[] => {
    if (budgetCategories.length === 0) return [];

    const actualByCategory = new Map<EventType, number>();
    const dailyByCategory = new Map<EventType, Map<string, number>>();

    for (const expense of expenses) {
      if (expense.paymentMethod === 'points') continue;
      const cat = ((expense as { category?: string }).category ?? 'misc') as EventType;
      const amountInBase = fxConvert(expense.amount, expense.currency || currency);
      actualByCategory.set(cat, (actualByCategory.get(cat) ?? 0) + amountInBase);
      const dayMap = dailyByCategory.get(cat) ?? new Map<string, number>();
      dayMap.set(expense.date, (dayMap.get(expense.date) ?? 0) + amountInBase);
      dailyByCategory.set(cat, dayMap);
    }

    // Build daily array per category over trip days
    const tripStart = trip?.startDate ? parseISO(trip.startDate) : null;
    const tripEnd = trip?.endDate ? parseISO(trip.endDate) : null;
    const totalDays = tripStart && tripEnd ? differenceInCalendarDays(tripEnd, tripStart) + 1 : 0;

    return budgetCategories.map((cat) => {
      const cfg = EVENT_TYPES[cat.type];
      const actual = actualByCategory.get(cat.type) ?? 0;
      const percentage = cat.allocated > 0 ? (actual / cat.allocated) * 100 : 0;
      const dayMap = dailyByCategory.get(cat.type) ?? new Map();
      const dailySpend: number[] = [];
      if (tripStart && totalDays > 0) {
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(tripStart);
          d.setDate(d.getDate() + i);
          const key = format(d, 'yyyy-MM-dd');
          dailySpend.push(dayMap.get(key) ?? 0);
        }
      }
      return {
        type: cat.type,
        label: cfg.label,
        color: cfg.color,
        planned: cat.allocated,
        actual,
        percentage,
        dailySpend,
      };
    });
  }, [budgetCategories, expenses, trip?.startDate, trip?.endDate, currency, fxConvert]);

  /* ─── Event comparison ───────────────────────────── */
  const eventComparison = useMemo((): EventComparison[] => {
    const expenseByEvent = new Map<string, number>();
    const pointsByEvent = new Map<string, { points: number; value: number }>();

    for (const expense of expenses) {
      if (expense.eventId) {
        if (expense.paymentMethod === 'points') {
          const prev = pointsByEvent.get(expense.eventId) ?? { points: 0, value: 0 };
          const ptsValue = (expense as { equivalentValue?: number }).equivalentValue ?? 0;
          const ptsValueCur = (expense as { realValueCurrency?: string }).realValueCurrency || currency;
          pointsByEvent.set(expense.eventId, {
            points: prev.points + ((expense as { pointsUsed?: number }).pointsUsed ?? 0),
            value: prev.value + fxConvert(ptsValue, ptsValueCur),
          });
        } else {
          const prev = expenseByEvent.get(expense.eventId) ?? 0;
          const amountInBase = fxConvert(expense.amount, expense.currency || currency);
          expenseByEvent.set(expense.eventId, prev + amountInBase);
        }
      }
    }

    return events
      .filter((e) => e.cost > 0 || expenseByEvent.has(e.id) || pointsByEvent.has(e.id))
      .map((e) => {
        const cfg = EVENT_TYPES[e.type] ?? EVENT_TYPES.misc;
        const planned = fxConvert(e.cost ?? 0, e.currency || currency);
        const actual = expenseByEvent.get(e.id) ?? 0;
        const pts = pointsByEvent.get(e.id);
        const hasPts = !!pts && pts.value > 0;
        const percentage = planned > 0 ? (actual / planned) * 100 : actual > 0 ? 100 : 0;
        return {
          eventId: e.id,
          title: e.title,
          type: e.type,
          date: e.date,
          color: cfg.color,
          planned,
          actual,
          percentage,
          paidWithPoints: hasPts,
          pointsUsed: pts?.points ?? 0,
          pointsValue: pts?.value ?? 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, expenses, currency, fxConvert]);

  /* ─── Linked expenses by event (for inline edit) ── */
  const linkedExpensesByEvent = useMemo(() => {
    const map = new Map<string, TripExpense[]>();
    for (const e of expenses) {
      if (!e.eventId) continue;
      const list = map.get(e.eventId) || [];
      list.push(e);
      map.set(e.eventId, list);
    }
    return map;
  }, [expenses]);

  const toggleExpandEvent = (eventId: string) => {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      setEditingExpenseId(null);
      setConfirmingDeleteId(null);
      return;
    }
    const ev = events.find((x) => x.id === eventId);
    setExpandedEventId(eventId);
    setEditingExpenseId(null);
    setConfirmingDeleteId(null);
    setTempPlanned(String(ev?.cost ?? 0));
  };

  const handleSavePlanned = async (eventId: string) => {
    setSavingPlanned(true);
    try {
      const newCost = parseFloat(tempPlanned) || 0;
      await updateEvent(eventId, { cost: newCost });
      toast('Presupuesto actualizado', 'success');
    } catch {
      toast('Error al actualizar presupuesto', 'error');
    } finally {
      setSavingPlanned(false);
    }
  };

  const startEditExpense = (expense: TripExpense) => {
    setEditingExpenseId(expense.id);
    setTempDesc(expense.description);
    setTempAmount(String(expense.amount));
    setTempCurrency(expense.currency);
  };

  const cancelEditExpense = () => {
    setEditingExpenseId(null);
  };

  const handleSaveExpense = async (expenseId: string) => {
    if (!tempDesc.trim()) {
      toast('La descripción no puede estar vacía', 'error');
      return;
    }
    setSavingExpense(true);
    try {
      await updateExpense(expenseId, {
        description: tempDesc.trim(),
        amount: parseFloat(tempAmount) || 0,
        currency: tempCurrency,
      });
      setEditingExpenseId(null);
      toast('Gasto actualizado', 'success');
    } catch {
      toast('Error al actualizar gasto', 'error');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleConfirmDelete = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      setConfirmingDeleteId(null);
      toast('Gasto eliminado', 'success');
    } catch {
      toast('Error al eliminar', 'error');
    }
  };

  /* ─── Totals ─────────────────────────────────────── */
  const categoryTotals = useMemo(() => {
    const totalPlanned = categoryComparison.reduce((sum, c) => sum + c.planned, 0);
    const totalSpent = categoryComparison.reduce((sum, c) => sum + c.actual, 0);
    return { totalPlanned, totalSpent, difference: totalPlanned - totalSpent };
  }, [categoryComparison]);

  const eventTotals = useMemo(() => {
    const totalPlanned = eventComparison.reduce((sum, e) => sum + e.planned, 0);
    const totalSpent = eventComparison.reduce((sum, e) => sum + e.actual, 0);
    return { totalPlanned, totalSpent, difference: totalPlanned - totalSpent };
  }, [eventComparison]);

  const totals = viewMode === 'category' ? categoryTotals : eventTotals;
  const overallPct = totals.totalPlanned > 0 ? (totals.totalSpent / totals.totalPlanned) * 100 : 0;
  const overallColor = statusColor(overallPct);

  /* ─── Forecast ───────────────────────────────────── */
  const forecast = useMemo(() => {
    if (!tripProgress || tripProgress.pct === 0) return null;
    if (totals.totalSpent === 0) return null;
    const projected = (totals.totalSpent / tripProgress.pct) * 100;
    return projected;
  }, [tripProgress, totals.totalSpent]);

  /* ─── Insights ───────────────────────────────────── */
  const insights = useMemo(() => {
    const items = viewMode === 'category' ? categoryComparison : eventComparison;
    let topOver: typeof items[number] | null = null;
    let topUnder: typeof items[number] | null = null;

    for (const item of items) {
      if (item.planned <= 0) continue;
      const diff = item.actual - item.planned;
      if (diff > 0) {
        if (!topOver || diff > topOver.actual - topOver.planned) topOver = item;
      } else if (item.actual > 0) {
        if (!topUnder || (item.planned - item.actual) > (topUnder.planned - topUnder.actual)) topUnder = item;
      }
    }

    let pointsTotal = 0;
    let pointsCount = 0;
    for (const e of expenses) {
      if (e.paymentMethod === 'points') {
        const v = (e as { equivalentValue?: number }).equivalentValue ?? 0;
        const cur = (e as { realValueCurrency?: string }).realValueCurrency || currency;
        pointsTotal += fxConvert(v, cur);
        pointsCount += (e as { pointsUsed?: number }).pointsUsed ?? 0;
      }
    }

    return { topOver, topUnder, pointsTotal, pointsCount };
  }, [viewMode, categoryComparison, eventComparison, expenses, currency, fxConvert]);

  /* ─── Loading ────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-amber-300 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const hasNoBudget = budgetCategories.length === 0;
  const hasNoEvents = eventComparison.length === 0;

  if (hasNoBudget && hasNoEvents) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 p-12 text-center"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <Particles count={20} />
        </div>
        <div className="relative">
          <EmptyState
            variant="budget"
            title="Sin datos para comparar"
            description="Configura el presupuesto por categorías o agrega costos a tus eventos del itinerario"
          />
        </div>
      </motion.div>
    );
  }

  /* ─── Render ─────────────────────────────────────── */

  const paceDelta = tripProgress ? overallPct - tripProgress.pct : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30"
      style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
    >
      {/* Visual layer */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        <Particles count={30} />
        <motion.div
          key={overallColor}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute -top-12 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${overallColor}33, transparent 70%)` }}
        />
        <div
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }}
        />
        <div
          className="absolute bottom-12 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* ─── HERO: Gauge + Pace ───────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Gauge card */}
          <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5 overflow-hidden">
            <div className="text-white/45 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">
              Presupuesto consumido
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <CircularGauge percentage={overallPct} color={overallColor} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl sm:text-4xl font-black tabular-nums"
                    style={{ color: overallColor, textShadow: `0 0 20px ${overallColor}66` }}
                  >
                    {Math.round(overallPct)}%
                  </motion.div>
                  <div className="text-white/55 text-[10px] uppercase tracking-wider font-bold mt-0.5">
                    {statusLabel(overallPct)}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Gastado</div>
                  <div className="text-white text-lg font-bold tabular-nums truncate">
                    {formatCurrency(totals.totalSpent, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider font-bold">de</div>
                  <div className="text-white/75 text-base font-semibold tabular-nums truncate">
                    {formatCurrency(totals.totalPlanned, currency)}
                  </div>
                </div>
                <div className="pt-1.5 border-t border-white/[0.06]">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider font-bold">
                    {totals.difference >= 0 ? 'Disponible' : 'Sobre lo planeado'}
                  </div>
                  <div
                    className={classNames(
                      'text-sm font-bold tabular-nums',
                      totals.difference >= 0 ? 'text-emerald-300' : 'text-red-300',
                    )}
                  >
                    {totals.difference >= 0 ? '' : '−'}
                    {formatCurrency(Math.abs(totals.difference), currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pace card */}
          <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-white/45 text-[10px] uppercase tracking-[0.2em] font-bold">Ritmo</div>
              {tripProgress && (
                <div className="text-white/55 text-[11px]">
                  Día {tripProgress.daysIn} de {tripProgress.totalDays}
                </div>
              )}
            </div>

            {tripProgress ? (
              <>
                {/* Trip progress bar */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-white/55 text-[11px] font-medium">Viaje</span>
                    <span className="text-white/85 text-[11px] font-bold tabular-nums">{Math.round(tripProgress.pct)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${tripProgress.pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>
                {/* Budget consumed bar */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-white/55 text-[11px] font-medium">Presupuesto</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: overallColor }}>
                      {Math.round(overallPct)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: overallColor, boxShadow: `0 0 8px ${overallColor}66` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(overallPct, 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                    />
                  </div>
                </div>

                {/* Verdict */}
                <div className="pt-2 mt-2 border-t border-white/[0.06]">
                  {Math.abs(paceDelta) < 5 ? (
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                      <Zap className="w-3.5 h-3.5" />
                      Vas en el ritmo correcto
                    </div>
                  ) : paceDelta > 0 ? (
                    <div className="flex items-center gap-2 text-red-300 text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Gastas {Math.round(paceDelta)}% más rápido que el avance del viaje
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Gastas {Math.round(Math.abs(paceDelta))}% más lento que el viaje
                    </div>
                  )}
                  {forecast !== null && (
                    <div className="text-white/55 text-[11px] mt-1.5">
                      Proyección al cierre:{' '}
                      <span
                        className="font-bold tabular-nums"
                        style={{ color: forecast > totals.totalPlanned ? '#fca5a5' : '#86efac' }}
                      >
                        {formatCurrency(forecast, currency)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-white/45 text-xs">Sin fechas de viaje configuradas</div>
            )}
          </div>
        </div>

        {/* ─── Currency conversion note ──────────────── */}
        {hasMixedCurrencies && (
          <div
            className={classNames(
              'rounded-xl border px-3 py-2 text-[11px] flex items-center gap-2',
              rates
                ? 'border-emerald-300/20 bg-emerald-400/[0.05] text-emerald-200/85'
                : 'border-amber-300/30 bg-amber-400/[0.06] text-amber-200/85',
            )}
          >
            <span className="text-base leading-none">💱</span>
            {rates ? (
              <span>
                Valores convertidos a <span className="font-bold">{currency}</span> con tipo de cambio del{' '}
                <span className="font-bold">{rates.date || 'día'}</span>.
              </span>
            ) : (
              <span>Hay gastos en otra moneda — el tipo de cambio aún no carga, los valores se muestran sin convertir.</span>
            )}
          </div>
        )}

        {/* ─── INSIGHTS ROW ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Top over */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3"
          >
            <div className="flex items-center gap-1.5 text-red-300/80 text-[9px] uppercase tracking-wider font-bold mb-1.5">
              <TrendingUp className="w-3 h-3" />
              Sobregirado
            </div>
            {insights.topOver ? (
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  {viewMode === 'category' ? (
                    (() => {
                      const Icon = CATEGORY_ICONS[(insights.topOver as CategoryComparison).type] || MoreHorizontal;
                      return (
                        <span className="w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: `${insights.topOver.color}33` }}>
                          <Icon className="w-3 h-3" style={{ color: insights.topOver.color }} />
                        </span>
                      );
                    })()
                  ) : (
                    (() => {
                      const Icon = CATEGORY_ICONS[(insights.topOver as EventComparison).type] || MoreHorizontal;
                      return (
                        <span className="w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: `${insights.topOver.color}33` }}>
                          <Icon className="w-3 h-3" style={{ color: insights.topOver.color }} />
                        </span>
                      );
                    })()
                  )}
                  <span className="text-white/85 text-[11px] font-semibold truncate">
                    {viewMode === 'category'
                      ? (insights.topOver as CategoryComparison).label
                      : (insights.topOver as EventComparison).title}
                  </span>
                </div>
                <div className="text-red-300 text-base font-black tabular-nums">
                  +{Math.round(insights.topOver.percentage - 100)}%
                </div>
                <div className="text-white/45 text-[10px] tabular-nums">
                  +{formatCurrency(insights.topOver.actual - insights.topOver.planned, currency)}
                </div>
              </>
            ) : (
              <div className="text-white/45 text-xs mt-1">Nada en rojo</div>
            )}
          </motion.div>

          {/* Top under */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3"
          >
            <div className="flex items-center gap-1.5 text-emerald-300/80 text-[9px] uppercase tracking-wider font-bold mb-1.5">
              <TrendingDown className="w-3 h-3" />
              Mejor ahorro
            </div>
            {insights.topUnder ? (
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  {(() => {
                    const type = viewMode === 'category'
                      ? (insights.topUnder as CategoryComparison).type
                      : (insights.topUnder as EventComparison).type;
                    const Icon = CATEGORY_ICONS[type] || MoreHorizontal;
                    return (
                      <span className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: `${insights.topUnder.color}33` }}>
                        <Icon className="w-3 h-3" style={{ color: insights.topUnder.color }} />
                      </span>
                    );
                  })()}
                  <span className="text-white/85 text-[11px] font-semibold truncate">
                    {viewMode === 'category'
                      ? (insights.topUnder as CategoryComparison).label
                      : (insights.topUnder as EventComparison).title}
                  </span>
                </div>
                <div className="text-emerald-300 text-base font-black tabular-nums">
                  −{Math.round(100 - insights.topUnder.percentage)}%
                </div>
                <div className="text-white/45 text-[10px] tabular-nums">
                  {formatCurrency(insights.topUnder.planned - insights.topUnder.actual, currency)}
                </div>
              </>
            ) : (
              <div className="text-white/45 text-xs mt-1">Aún sin datos</div>
            )}
          </motion.div>

          {/* Points savings */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-amber-300/30 backdrop-blur-sm p-3 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))' }}
          >
            <div className="flex items-center gap-1.5 text-amber-200/90 text-[9px] uppercase tracking-wider font-bold mb-1.5">
              <Sparkles className="w-3 h-3" />
              Ahorro con puntos
            </div>
            {insights.pointsTotal > 0 ? (
              <>
                <div className="text-amber-200 text-base font-black tabular-nums">
                  −{formatCurrency(insights.pointsTotal, currency)}
                </div>
                <div className="text-amber-200/60 text-[10px] tabular-nums">
                  {insights.pointsCount.toLocaleString()} pts
                </div>
              </>
            ) : (
              <div className="text-white/45 text-xs mt-1">Sin pagos con puntos</div>
            )}
          </motion.div>
        </div>

        {/* ─── View toggle ──────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-full">
          <button
            type="button"
            onClick={() => setViewMode('category')}
            className={classNames(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all',
              viewMode === 'category'
                ? 'bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                : 'text-white/50 hover:text-white/80',
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Por categoría
          </button>
          <button
            type="button"
            onClick={() => setViewMode('event')}
            className={classNames(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all',
              viewMode === 'event'
                ? 'bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                : 'text-white/50 hover:text-white/80',
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Por evento
          </button>
        </div>

        {/* ─── BREAKDOWN ────────────────────────────── */}
        {viewMode === 'category' ? (
          hasNoBudget ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-8 text-center">
              <p className="text-white/55 text-xs">
                Configura tu presupuesto por categorías en la sección de Presupuesto
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryComparison.map((item, idx) => {
                const Icon = CATEGORY_ICONS[item.type] || MoreHorizontal;
                const clampedPct = Math.min(item.percentage, 100);
                const itemColor = statusColor(item.percentage);
                const barColor = item.percentage > 100 ? '#ef4444' : item.color;
                return (
                  <motion.div
                    key={item.type}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3.5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `${item.color}22`,
                          boxShadow: item.percentage > 100 ? `0 0 14px ${item.color}66` : 'none',
                        }}
                      >
                        <Icon className="w-4 h-4" style={{ color: item.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-white text-sm font-semibold truncate">{item.label}</span>
                          <span
                            className="text-sm font-black tabular-nums whitespace-nowrap"
                            style={{ color: itemColor }}
                          >
                            {Math.round(item.percentage)}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
                          <span className="text-white/55">
                            {formatCurrency(item.actual, currency)} de {formatCurrency(item.planned, currency)}
                          </span>
                          {item.dailySpend.length > 1 && item.actual > 0 && (
                            <span className="opacity-80">
                              <Sparkline data={item.dailySpend} color={item.color} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: barColor, boxShadow: `0 0 6px ${barColor}66` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${clampedPct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + idx * 0.04 }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : hasNoEvents ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-8 text-center">
            <p className="text-white/55 text-xs">Agrega costos estimados a tus eventos del itinerario</p>
          </div>
        ) : (
          <div className="space-y-2">
            {eventComparison.map((item, idx) => {
              const Icon = CATEGORY_ICONS[item.type] || MoreHorizontal;
              const clampedPct = item.planned > 0 ? Math.min(item.percentage, 100) : 0;
              const itemColor = statusColor(item.percentage);
              const barColor = item.paidWithPoints ? '#10b981' : item.percentage > 100 ? '#ef4444' : item.color;
              const isExpanded = expandedEventId === item.eventId;
              const linkedExpenses = linkedExpensesByEvent.get(item.eventId) || [];
              const plannedChanged = parseFloat(tempPlanned || '0') !== item.planned;

              return (
                <motion.div
                  key={item.eventId}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden"
                >
                  {/* Clickable summary row */}
                  <button
                    type="button"
                    onClick={() => toggleExpandEvent(item.eventId)}
                    className="w-full text-left p-3.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${item.color}22` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: item.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-white text-sm font-semibold truncate">{item.title}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.paidWithPoints ? (
                              <span className="inline-flex items-center gap-1 text-emerald-300 text-[11px] font-bold whitespace-nowrap">
                                <Sparkles className="w-3 h-3" />
                                Con puntos
                              </span>
                            ) : item.planned > 0 ? (
                              <span className="text-sm font-black tabular-nums whitespace-nowrap" style={{ color: itemColor }}>
                                {Math.round(item.percentage)}%
                              </span>
                            ) : item.actual > 0 ? (
                              <span className="text-amber-200 text-[11px] font-semibold whitespace-nowrap">Sin presupuesto</span>
                            ) : null}
                            <motion.span
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-white/40"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.span>
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums text-white/55">
                          <span>{formatDateES(item.date)}</span>
                          <span>
                            {item.paidWithPoints ? (
                              <span className="text-emerald-300">
                                {item.pointsUsed.toLocaleString()} pts · {formatCurrency(item.pointsValue, currency)}
                              </span>
                            ) : item.planned > 0 ? (
                              <>
                                {formatCurrency(item.actual, currency)} de {formatCurrency(item.planned, currency)}
                              </>
                            ) : item.actual > 0 ? (
                              formatCurrency(item.actual, currency)
                            ) : (
                              'Pendiente'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    {(item.planned > 0 || item.paidWithPoints) && (
                      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: barColor, boxShadow: `0 0 6px ${barColor}66` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${item.paidWithPoints ? 100 : clampedPct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + idx * 0.04 }}
                        />
                      </div>
                    )}
                  </button>

                  {/* Expanded edit panel */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-white/[0.06]"
                      >
                        <div className="p-3.5 space-y-4">
                          {/* Planned cost editor */}
                          <div>
                            <label className="block text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
                              Presupuesto planeado
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="decimal"
                                value={tempPlanned}
                                onChange={(e) => setTempPlanned(e.target.value)}
                                placeholder="0.00"
                                className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors tabular-nums"
                              />
                              <span className="text-white/45 text-xs font-bold px-2">{currency}</span>
                              <button
                                type="button"
                                onClick={() => handleSavePlanned(item.eventId)}
                                disabled={!plannedChanged || savingPlanned}
                                className={classNames(
                                  'px-3 py-2 rounded-xl text-xs font-bold transition-all',
                                  plannedChanged
                                    ? 'bg-amber-400/20 border border-amber-300/50 text-amber-100 hover:bg-amber-400/30'
                                    : 'bg-white/[0.04] border border-white/[0.06] text-white/30 cursor-not-allowed',
                                )}
                              >
                                {savingPlanned ? '…' : 'Guardar'}
                              </button>
                            </div>
                          </div>

                          {/* Linked expenses */}
                          <div>
                            <div className="flex items-baseline justify-between mb-2">
                              <label className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold">
                                Gastos vinculados
                              </label>
                              <span className="text-white/40 text-[11px] tabular-nums">
                                {linkedExpenses.length} · total {formatCurrency(item.actual + item.pointsValue, currency)}
                              </span>
                            </div>
                            {linkedExpenses.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-white/[0.1] p-3 text-center text-white/35 text-xs">
                                Aún no hay gastos vinculados a este evento
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {linkedExpenses.map((exp) => {
                                  const isEditing = editingExpenseId === exp.id;
                                  const isConfirming = confirmingDeleteId === exp.id;
                                  const isPts = exp.paymentMethod === 'points';

                                  if (isEditing) {
                                    return (
                                      <div
                                        key={exp.id}
                                        className="rounded-xl bg-white/[0.06] border border-amber-300/40 p-2.5 space-y-2"
                                      >
                                        <input
                                          type="text"
                                          value={tempDesc}
                                          onChange={(e) => setTempDesc(e.target.value)}
                                          placeholder="Descripción"
                                          className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60"
                                        />
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            value={tempAmount}
                                            onChange={(e) => setTempAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60 tabular-nums"
                                          />
                                          <select
                                            value={tempCurrency}
                                            onChange={(e) => setTempCurrency(e.target.value)}
                                            className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-white text-sm font-bold outline-none focus:border-amber-300/60 [color-scheme:dark]"
                                          >
                                            {CURRENCIES.map((c) => (
                                              <option key={c} value={c}>{c}</option>
                                            ))}
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveExpense(exp.id)}
                                            disabled={savingExpense}
                                            className="w-8 h-8 rounded-lg bg-emerald-400/20 border border-emerald-300/50 text-emerald-200 hover:bg-emerald-400/30 transition-colors flex items-center justify-center disabled:opacity-50"
                                            title="Guardar"
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={cancelEditExpense}
                                            className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white/70 hover:bg-white/10 transition-colors flex items-center justify-center"
                                            title="Cancelar"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={exp.id}
                                      className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white/85 text-sm font-medium truncate">
                                          {exp.description}
                                          {isPts && (
                                            <span className="ml-2 text-amber-200 text-[10px] font-bold">★ pts</span>
                                          )}
                                        </p>
                                        <p className="text-white/40 text-[11px] tabular-nums">
                                          {formatCurrency(exp.amount, exp.currency)}
                                          {isPts && exp.equivalentValue ? (
                                            <span className="text-emerald-300/80 ml-2">
                                              · valor real {formatCurrency(exp.equivalentValue, exp.realValueCurrency || currency)}
                                            </span>
                                          ) : null}
                                        </p>
                                      </div>
                                      {isConfirming ? (
                                        <div className="flex items-center gap-1">
                                          <span className="text-white/55 text-[11px] mr-1">¿Borrar?</span>
                                          <button
                                            type="button"
                                            onClick={() => handleConfirmDelete(exp.id)}
                                            className="px-2 py-1 text-[11px] font-bold rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                                          >
                                            Sí
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmingDeleteId(null)}
                                            className="px-2 py-1 text-[11px] font-bold rounded-md bg-white/10 text-white/70 hover:bg-white/15 transition-colors"
                                          >
                                            No
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => startEditExpense(exp)}
                                            className="w-7 h-7 rounded-md text-white/50 hover:text-amber-200 hover:bg-amber-300/10 transition-colors flex items-center justify-center"
                                            title="Editar gasto"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmingDeleteId(exp.id)}
                                            className="w-7 h-7 rounded-md text-white/50 hover:text-red-300 hover:bg-red-400/10 transition-colors flex items-center justify-center"
                                            title="Eliminar gasto"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <p className="text-white/35 text-[10px] mt-2 leading-relaxed">
                              Para cambios completos (split, fecha, recibo) usa la pestaña Historial.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
