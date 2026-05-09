'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Trash2,
  Pencil,
  Receipt,
  Search,
  Plane,
  Hotel,
  CarFront,
  MapPin,
  UtensilsCrossed,
  Car,
  Ship,
  MoreHorizontal,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  ChevronDown,
  Sparkles,
  X,
  Users,
  CreditCard,
  Check,
  CheckSquare,
} from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { useEvents } from '@/hooks/useEvents';
import { useMembers } from '@/hooks/useMembers';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useTrip } from '@/hooks/useTrip';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Particles from '@/components/ui/Particles';
import { SwipeActions, type SwipeAction } from '@/components/SwipeActions';
import { EmptyState } from '@/components/EmptyState';
import { CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/config/constants';
import { classNames, formatCurrency, getInitials, formatDateES } from '@/lib/utils/helpers';
import type { ExpenseCategory, TripExpense, PaymentMethod } from '@/types';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
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

type PeriodFilter = 'all' | 'today' | 'week';

interface HistoryTabProps {
  tripId: string;
}

/* ─── Sparkline component ──────────────────────── */
function Sparkline({ data, color = '#fbbf24' }: { data: number[]; color?: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 32;
  const step = data.length > 1 ? w / (data.length - 1) : 0;

  const points = data.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    return [x, y] as const;
  });

  const pathLine = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const pathArea = `${pathLine} L${w},${h} L0,${h} Z`;
  const id = `spark-grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathArea} fill={`url(#${id})`} />
      <path d={pathLine} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={color} />
      )}
    </svg>
  );
}

/* ─── Day label ────────────────────────────────── */
function dayLabel(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const today = new Date();
    const diff = differenceInCalendarDays(today, d);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    return format(d, "EEEE d 'de' MMM", { locale: es });
  } catch {
    return dateStr;
  }
}

export function HistoryTab({ tripId }: HistoryTabProps) {
  const { expenses, loading, deleteExpense, updateExpense } = useExpenses(tripId);
  const { events } = useEvents(tripId);
  const { members } = useMembers(tripId);
  const { user } = useAuth();
  const { travelers } = useGlobalTravelers();
  const { trip } = useTrip(tripId);
  const { toast } = useToast();

  const tripTravelers = useMemo(() => {
    const ids = trip?.travelerIds || [];
    return travelers.filter((t) => ids.includes(t.id));
  }, [travelers, trip?.travelerIds]);

  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('MXN');
  const [editDate, setEditDate] = useState('');
  const [editEvent, setEditEvent] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editSplit, setEditSplit] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editPayment, setEditPayment] = useState<PaymentMethod>('cash');
  const [editLoading, setEditLoading] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekAgoStr = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (expense: TripExpense) => {
    setEditingExpense(expense);
    setEditDesc(expense.description);
    setEditAmount(String(expense.amount));
    setEditCurrency(expense.currency);
    setEditDate(expense.date);
    setEditEvent(expense.eventId || '');
    setEditPaidBy(expense.paidBy || '');
    setEditSplit(expense.splitBetween || []);
    setEditNotes(expense.notes || '');
    setEditPayment(expense.paymentMethod || 'cash');
  };

  const toggleEditSplit = (id: string) => {
    setEditSplit((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    setEditLoading(true);
    try {
      await updateExpense(editingExpense.id, {
        description: editDesc.trim(),
        amount: parseFloat(editAmount) || 0,
        currency: editCurrency,
        date: editDate,
        eventId: editEvent || undefined,
        paidBy: editPaidBy,
        splitBetween: editSplit,
        paymentMethod: editPayment,
        notes: editNotes.trim() || undefined,
      });
      setEditingExpense(null);
      toast('Gasto actualizado', 'success');
    } catch {
      toast('Error al actualizar', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  /* ─── Filter + sort: today first, then yesterday, then descending ─── */
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    if (filterCategory !== 'all') {
      filtered = filtered.filter((e) => {
        if (e.category) return e.category === filterCategory;
        if (e.eventId) {
          const ev = events.find((x) => x.id === e.eventId);
          return ev?.type === filterCategory;
        }
        return false;
      });
    }

    if (filterPerson !== 'all') {
      filtered = filtered.filter((e) => e.paidBy === filterPerson);
    }

    if (filterPeriod === 'today') {
      filtered = filtered.filter((e) => e.date === todayStr);
    } else if (filterPeriod === 'week') {
      filtered = filtered.filter((e) => e.date >= weekAgoStr);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.notes || '').toLowerCase().includes(q),
      );
    }

    // Newest first (today on top)
    return filtered.sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) return d;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [expenses, events, filterCategory, filterPerson, filterPeriod, search, todayStr, weekAgoStr]);

  /* ─── Group by day ─────────────────────────────── */
  const grouped = useMemo(() => {
    const map = new Map<string, TripExpense[]>();
    for (const e of filteredExpenses) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()];
  }, [filteredExpenses]);

  /* ─── Totals (across all expenses, not filtered) ── */
  const totals = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    for (const e of expenses) {
      byCurrency[e.currency] = (byCurrency[e.currency] || 0) + (e.amount || 0);
    }
    return { byCurrency, count: expenses.length };
  }, [expenses]);

  const sparklineData = useMemo(() => {
    if (expenses.length === 0) return [] as number[];
    const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].date;
    const last = sorted[sorted.length - 1].date;
    const start = parseISO(first);
    const end = parseISO(last);
    const days = differenceInCalendarDays(end, start) + 1;
    const arr = new Array(Math.min(days, 30)).fill(0);
    const baseCur = trip?.budgetCurrency || 'MXN';
    for (const e of sorted) {
      if (e.currency !== baseCur) continue;
      const idx = differenceInCalendarDays(parseISO(e.date), start);
      if (idx < 0 || idx >= arr.length) continue;
      arr[idx] += e.amount || 0;
    }
    return arr;
  }, [expenses, trip?.budgetCurrency]);

  /* ─── Helpers ──────────────────────────────────── */
  const getEventName = (eventId?: string): string | null => {
    if (!eventId) return null;
    return events.find((e) => e.id === eventId)?.title ?? null;
  };

  const getCategory = (e: TripExpense): ExpenseCategory => {
    if (e.category) return e.category;
    if (e.eventId) {
      const ev = events.find((x) => x.id === e.eventId);
      if (ev) return (ev.type as ExpenseCategory) || 'misc';
    }
    return 'misc';
  };

  const getMemberName = (uid: string): string => {
    if (user && uid === user.uid) return user.displayName || user.email?.split('@')[0] || 'Yo';
    const m = members.find((member) => member.uid === uid);
    if (m?.displayName) return m.displayName;
    if (m?.email) return m.email.split('@')[0];
    const t = travelers.find((tr) => tr.id === uid);
    if (t?.fullName) return t.fullName;
    return uid.slice(0, 6);
  };

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      setConfirmingDelete(null);
      toast('Gasto eliminado', 'success');
    } catch {
      toast('Error al eliminar gasto', 'error');
    }
  };

  /* ─── Bulk selection ─────────────────────────────── */
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
    setExpanded(new Set());
    setConfirmingDelete(null);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Borrar ${selectedIds.size} gasto${selectedIds.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
    const ids = [...selectedIds];
    let okCount = 0;
    let failCount = 0;
    for (const id of ids) {
      try {
        await deleteExpense(id);
        okCount++;
      } catch {
        failCount++;
      }
    }
    exitSelectionMode();
    if (failCount === 0) {
      toast(`${okCount} gasto${okCount !== 1 ? 's eliminados' : ' eliminado'}`, 'success');
    } else {
      toast(`${okCount} eliminados, ${failCount} fallaron`, 'error');
    }
  };

  /* ─── Loading ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}>
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-amber-300 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const baseCurrency = trip?.budgetCurrency || 'MXN';
  const activeCount = filteredExpenses.length;
  const totalCategories = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
        {/* Visual layer */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <Particles count={28} />
          <div
            className="absolute top-12 -left-12 w-72 h-72 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.20), transparent 70%)' }}
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
          {/* ─── Hero stats ────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-white/45 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">
                  Total gastado
                </div>
                <div className="text-white text-3xl sm:text-4xl font-black tabular-nums" style={{ textShadow: '0 0 30px rgba(255,255,255,0.12)' }}>
                  {formatCurrency(totals.byCurrency[baseCurrency] || 0, baseCurrency)}
                </div>
                {Object.entries(totals.byCurrency).filter(([c]) => c !== baseCurrency).length > 0 && (
                  <div className="text-white/55 text-xs mt-1 flex flex-wrap gap-x-2">
                    {Object.entries(totals.byCurrency)
                      .filter(([c]) => c !== baseCurrency)
                      .map(([c, amt]) => (
                        <span key={c} className="tabular-nums">
                          + {formatCurrency(amt, c)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-white/40 text-[10px] uppercase tracking-[0.18em] font-bold">Gastos</div>
                <div className="text-white text-2xl font-black tabular-nums">{totals.count}</div>
              </div>
            </div>
            {sparklineData.length > 1 && (
              <div className="mt-3 -mx-1">
                <Sparkline data={sparklineData} color="#fbbf24" />
              </div>
            )}
          </div>

          {/* ─── Search ───────────────────────────────── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar gasto…"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder:text-white/35 outline-none focus:border-amber-300/60 focus:bg-white/[0.08] backdrop-blur-sm transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ─── Filters: period + category + person ──── */}
          <div className="space-y-2.5">
            {/* Period pills */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
              {([
                ['all', 'Todo'],
                ['week', '7 días'],
                ['today', 'Hoy'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilterPeriod(k)}
                  className={classNames(
                    'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                    filterPeriod === k
                      ? 'bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                      : 'text-white/50 hover:text-white/80',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category chips — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={classNames(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap',
                  filterCategory === 'all'
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'bg-white/[0.03] border-white/[0.08] text-white/45 hover:text-white/80',
                )}
              >
                Todas ({totalCategories})
              </button>
              {(Object.entries(EXPENSE_CATEGORIES) as [ExpenseCategory, (typeof EXPENSE_CATEGORIES)[ExpenseCategory]][]).map(
                ([type, cfg]) => {
                  const Icon = CATEGORY_ICONS[type] || MoreHorizontal;
                  const active = filterCategory === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilterCategory(active ? 'all' : type)}
                      className={classNames(
                        'group flex-shrink-0 inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs font-medium transition-all border',
                        active
                          ? 'border-white/30 text-white'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/55 hover:text-white/85 hover:border-white/20',
                      )}
                      style={
                        active
                          ? { background: `${cfg.color}22`, boxShadow: `0 0 14px ${cfg.color}44` }
                          : undefined
                      }
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cfg.color}33` }}
                      >
                        <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                      </span>
                      {cfg.label}
                    </button>
                  );
                },
              )}
            </div>

            {/* Person chips */}
            {tripTravelers.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setFilterPerson('all')}
                  className={classNames(
                    'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border whitespace-nowrap',
                    filterPerson === 'all'
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/45 hover:text-white/80',
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  Todos
                </button>
                {tripTravelers.map((t) => {
                  const active = filterPerson === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFilterPerson(active ? 'all' : t.id)}
                      className={classNames(
                        'flex-shrink-0 inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs font-medium transition-all border whitespace-nowrap',
                        active
                          ? 'bg-emerald-400/15 border-emerald-300/50 text-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.25)]'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/55 hover:text-white/85 hover:border-white/20',
                      )}
                    >
                      <span
                        className={classNames(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                          active
                            ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-emerald-950'
                            : 'bg-white/10 text-white/60',
                        )}
                      >
                        {getInitials(t.fullName)}
                      </span>
                      {t.fullName.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Selection mode toggle ────────────────── */}
          {filteredExpenses.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <div className="text-white/45 text-[11px] uppercase tracking-[0.18em] font-bold">
                {selectionMode
                  ? `${selectedIds.size} seleccionado${selectedIds.size !== 1 ? 's' : ''}`
                  : `${filteredExpenses.length} gasto${filteredExpenses.length !== 1 ? 's' : ''}`}
              </div>
              <button
                type="button"
                onClick={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
                className={classNames(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all',
                  selectionMode
                    ? 'bg-amber-300/15 border-amber-300/40 text-amber-100 hover:bg-amber-300/20'
                    : 'bg-white/[0.04] border-white/[0.1] text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.08]',
                )}
              >
                {selectionMode ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    Cancelar
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    Seleccionar
                  </>
                )}
              </button>
            </div>
          )}

          {/* ─── List grouped by day ──────────────────── */}
          {filteredExpenses.length === 0 ? (
            <EmptyState
              variant="expenses"
              title={expenses.length === 0 ? 'Sin gastos aún' : 'Nada coincide con los filtros'}
              description={
                expenses.length === 0
                  ? 'Captura el primer gasto para empezar a llevar el control de tu viaje'
                  : 'Prueba con otros filtros o limpia la búsqueda'
              }
              action={
                expenses.length === 0
                  ? {
                      label: 'Capturar primer gasto',
                      href: `/trips/${tripId}/expenses?capture=1`,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false} mode="popLayout">
                {grouped.map(([dateStr, items]) => {
                  const daySubtotal = items
                    .filter((e) => e.currency === baseCurrency)
                    .reduce((acc, e) => acc + (e.amount || 0), 0);
                  const otherCurrencies = Array.from(new Set(items.map((e) => e.currency).filter((c) => c !== baseCurrency)));

                  return (
                    <motion.div
                      key={dateStr}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {/* Day header */}
                      <div className="flex items-baseline justify-between mb-2 px-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-white text-sm font-bold capitalize">{dayLabel(dateStr)}</span>
                          <span className="text-white/30 text-[11px]">·</span>
                          <span className="text-white/40 text-[11px]">{items.length} gasto{items.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-amber-200 text-sm font-bold tabular-nums">
                            {formatCurrency(daySubtotal, baseCurrency)}
                          </div>
                          {otherCurrencies.length > 0 && (
                            <div className="text-white/35 text-[10px]">+ otras monedas</div>
                          )}
                        </div>
                      </div>

                      {/* Day items */}
                      <div className="space-y-1.5">
                        {items.map((expense) => {
                          const cat = getCategory(expense);
                          const cfg = EXPENSE_CATEGORIES[cat] ?? EXPENSE_CATEGORIES.misc;
                          const Icon = CATEGORY_ICONS[cat] ?? Package;
                          const eventName = getEventName(expense.eventId);
                          const payerName = getMemberName(expense.paidBy);
                          const isExpanded = !selectionMode && expanded.has(expense.id);
                          const isSelected = selectedIds.has(expense.id);
                          const splitNames = (expense.splitBetween || []).map(getMemberName);
                          const perPerson =
                            (expense.splitBetween?.length || 0) > 0
                              ? expense.amount / (expense.splitBetween?.length || 1)
                              : 0;

                          const swipeActions: SwipeAction[] = [
                            {
                              icon: Pencil,
                              label: 'Editar',
                              color: 'amber',
                              onClick: () => openEdit(expense),
                            },
                            {
                              icon: Trash2,
                              label: 'Borrar',
                              color: 'red',
                              onClick: () => setConfirmingDelete(expense.id),
                            },
                          ];

                          return (
                            <SwipeActions
                              key={expense.id}
                              actions={swipeActions}
                              disabled={selectionMode}
                            >
                            <motion.div
                              layout
                              className={classNames(
                                'rounded-xl border backdrop-blur-md overflow-hidden transition-colors shadow-md shadow-black/20',
                                selectionMode && isSelected
                                  ? 'border-amber-300/50 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
                                  : 'border-white/[0.08]',
                              )}
                              style={
                                selectionMode && isSelected
                                  ? { background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.10) 100%)' }
                                  : { background: 'linear-gradient(135deg, rgba(12,25,41,0.95) 0%, rgba(22,42,68,0.95) 100%)' }
                              }
                              whileHover={{ y: -1 }}
                            >
                              {/* Row */}
                              <button
                                type="button"
                                onClick={() =>
                                  selectionMode ? toggleSelection(expense.id) : toggleExpand(expense.id)
                                }
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                              >
                                {selectionMode ? (
                                  <div
                                    className={classNames(
                                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border transition-all',
                                      isSelected
                                        ? 'bg-amber-300 border-amber-200 text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                                        : 'bg-white/[0.04] border-white/20 text-transparent',
                                    )}
                                  >
                                    <Check className="w-4 h-4" strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-shadow"
                                    style={{
                                      backgroundColor: `${cfg.color}22`,
                                      boxShadow: isExpanded ? `0 0 14px ${cfg.color}55` : 'none',
                                    }}
                                  >
                                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-semibold truncate">{expense.description}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-white/45">
                                    {eventName && <><span className="truncate max-w-[110px]">{eventName}</span><span className="text-white/20">·</span></>}
                                    <span className="truncate">{payerName.split(' ')[0]}</span>
                                    {expense.receiptUrl && (
                                      <>
                                        <span className="text-white/20">·</span>
                                        <Receipt className="w-3 h-3 text-amber-300/80" />
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-white text-sm font-bold tabular-nums">
                                    {formatCurrency(expense.amount, expense.currency)}
                                  </div>
                                  {(expense.splitBetween?.length || 0) > 1 && (
                                    <div className="text-emerald-300/80 text-[10px] tabular-nums">
                                      {formatCurrency(perPerson, expense.currency)} c/u
                                    </div>
                                  )}
                                </div>
                                {!selectionMode && (
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-white/40 flex-shrink-0"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </motion.div>
                                )}
                              </button>

                              {/* Expanded inline details */}
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.05]">
                                      <div className="flex gap-3 mt-3">
                                        {/* Receipt thumb */}
                                        {expense.receiptUrl && (
                                          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/anchor-is-valid
                                          <a
                                            href={expense.receiptUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-white/15 hover:border-amber-300/50 transition-colors"
                                          >
                                            <img
                                              src={expense.receiptUrl}
                                              alt="Recibo"
                                              className="w-full h-full object-cover"
                                            />
                                          </a>
                                        )}
                                        <div className="flex-1 min-w-0 space-y-2 text-[11px]">
                                          {splitNames.length > 0 && (
                                            <div>
                                              <span className="text-white/40 uppercase tracking-wider font-bold mr-2">Dividido</span>
                                              <span className="text-white/80">{splitNames.join(', ')}</span>
                                            </div>
                                          )}
                                          {expense.paymentMethod && (
                                            <div className="flex items-center gap-1.5">
                                              <CreditCard className="w-3 h-3 text-white/40" />
                                              <span className="text-white/70">{PAYMENT_METHODS[expense.paymentMethod]}</span>
                                            </div>
                                          )}
                                          {expense.notes && (
                                            <div>
                                              <span className="text-white/40 uppercase tracking-wider font-bold mr-2">Notas</span>
                                              <span className="text-white/75">{expense.notes}</span>
                                            </div>
                                          )}
                                          {expense.equivalentValue && expense.pointsUsed && (
                                            <div className="text-emerald-300/90">
                                              <Sparkles className="w-3 h-3 inline mr-1" />
                                              {expense.pointsUsed.toLocaleString()} pts · valor real{' '}
                                              {formatCurrency(expense.equivalentValue, expense.realValueCurrency || baseCurrency)}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="flex items-center justify-end gap-2 mt-3">
                                        {confirmingDelete === expense.id ? (
                                          <>
                                            <span className="text-white/60 text-xs mr-auto">¿Eliminar?</span>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
                                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                                            >
                                              Sí, borrar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null); }}
                                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 text-white/80 hover:bg-white/15 transition-colors"
                                            >
                                              Cancelar
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); openEdit(expense); }}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/15 bg-white/[0.05] text-white/85 hover:text-white hover:border-amber-300/50 hover:bg-amber-300/10 transition-all"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                              Editar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(expense.id); }}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/15 bg-white/[0.05] text-white/85 hover:text-red-300 hover:border-red-400/50 hover:bg-red-400/10 transition-all"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              Borrar
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                            </SwipeActions>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ─── Floating bulk action bar ─────────────── */}
        <AnimatePresence>
          {selectionMode && selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50"
            >
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/[0.1] backdrop-blur-xl shadow-2xl shadow-black/50"
                style={{ background: 'rgba(15,23,42,0.85)' }}
              >
                <span className="text-white text-xs font-bold whitespace-nowrap pl-2 pr-1 tabular-nums">
                  {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/90 text-white hover:bg-red-500 transition-colors shadow-[0_0_16px_rgba(239,68,68,0.35)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Edit modal (opens only via "Editar" button) ── */}
      <Modal
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title="Editar gasto"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingExpense(null)}>Cancelar</Button>
            <Button variant="primary" loading={editLoading} onClick={handleSaveEdit}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
              <input
                type="number"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 outline-none focus:border-amber-400"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pagado por</label>
            <select
              value={editPaidBy}
              onChange={(e) => setEditPaidBy(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            >
              {tripTravelers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dividir entre</label>
            <div className="flex flex-wrap gap-2">
              {tripTravelers.map((t) => {
                const isSelected = editSplit.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleEditSplit(t.id)}
                    className={classNames(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      isSelected
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-gray-50 border-gray-200 text-gray-400',
                    )}
                  >
                    {t.fullName.split(' ')[0]}
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a evento</label>
            <select
              value={editEvent}
              onChange={(e) => setEditEvent(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            >
              <option value="">Sin vincular</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title} — {formatDateES(ev.date)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
            <select
              value={editPayment}
              onChange={(e) => setEditPayment(e.target.value as PaymentMethod)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            >
              {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-amber-400 resize-none"
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
