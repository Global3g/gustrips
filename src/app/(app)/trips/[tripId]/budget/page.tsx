'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  Plane,
  Hotel,
  CarFront,
  MapPin,
  UtensilsCrossed,
  Car,
  Ship,
  Pencil,
  Plus,
  Trash2,
  ArrowRightLeft,
  Check,
  Filter,
  ArrowUpDown,
  Receipt,
  PiggyBank,
  Trophy,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
} from 'lucide-react';
// Trip + events come from the layout-level TripDataProvider so we don't
// double-mount their Firestore listeners.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { useMembers } from '@/hooks/useMembers';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardBody } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Particles from '@/components/ui/Particles';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { classNames, formatCurrency, getInitials, formatDateES } from '@/lib/utils/helpers';
import { groupAndOrderEvents, todayISO } from '@/lib/utils/eventOrdering';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useToast } from '@/context/ToastContext';
import { EVENT_TYPES, CURRENCIES } from '@/config/constants';
import type { EventType, TripEvent, BudgetCategory, SharedExpense, TripMember } from '@/types';
import type { LucideIcon } from 'lucide-react';

/* ─── Icon map for event types ─────────────────────── */

const EVENT_ICON_MAP: Record<EventType, LucideIcon> = {
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

/* ─── Helpers ──────────────────────────────────────── */

interface TypeBreakdown {
  type: EventType;
  label: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
  allocated: number;
}

function aggregateByType(
  events: TripEvent[],
  totalSpent: number,
  categories: BudgetCategory[],
): TypeBreakdown[] {
  const map = new Map<EventType, { total: number; count: number }>();

  for (const event of events) {
    if (event.cost > 0) {
      const existing = map.get(event.type) ?? { total: 0, count: 0 };
      map.set(event.type, {
        total: existing.total + event.cost,
        count: existing.count + 1,
      });
    }
  }

  const catMap = new Map<EventType, number>();
  for (const cat of categories) {
    catMap.set(cat.type, cat.allocated);
  }

  const breakdowns: TypeBreakdown[] = [];
  for (const [type, data] of map.entries()) {
    const cfg = EVENT_TYPES[type];
    breakdowns.push({
      type,
      label: cfg.label,
      color: cfg.color,
      total: data.total,
      count: data.count,
      percentage: totalSpent > 0 ? (data.total / totalSpent) * 100 : 0,
      allocated: catMap.get(type) ?? 0,
    });
  }

  // Add categories that have allocations but no spending yet
  for (const cat of categories) {
    if (cat.allocated > 0 && !map.has(cat.type)) {
      const cfg = EVENT_TYPES[cat.type];
      breakdowns.push({
        type: cat.type,
        label: cfg.label,
        color: cfg.color,
        total: 0,
        count: 0,
        percentage: 0,
        allocated: cat.allocated,
      });
    }
  }

  return breakdowns.sort((a, b) => b.total - a.total);
}

function getBudgetMessage(
  percentage: number,
  hasBudget: boolean,
): { text: string; color: string } {
  if (!hasBudget)
    return { text: 'Define un presupuesto para controlar tus gastos', color: 'text-gray-500' };
  if (percentage <= 50)
    return { text: 'Vas muy bien con tu presupuesto \uD83D\uDC4D', color: 'text-emerald-600' };
  if (percentage <= 80) return { text: 'Llevas buen ritmo, sigue asi', color: 'text-blue-600' };
  if (percentage <= 100)
    return { text: 'Cuidado, te acercas al limite', color: 'text-amber-600' };
  return { text: 'Te pasaste del presupuesto', color: 'text-red-600' };
}

function getMemberName(members: TripMember[], uid: string, travelers?: { id: string; fullName: string }[]): string {
  // Check travelers first
  const t = travelers?.find((tr) => tr.id === uid);
  if (t?.fullName) return t.fullName;
  // Check members
  const m = members.find((member) => member.uid === uid);
  return m?.displayName || m?.email || uid.slice(0, 6);
}

/* ─── Animation variants ───────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

/* ─── Summary Card Component ──────────────────────── */

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconColor,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  accent?: string;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="shadow-md">
        <CardBody className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            <Icon className="w-6 h-6" style={{ color: iconColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-gray-500 text-xs font-medium truncate">{label}</p>
            <p className={classNames('text-lg font-bold truncate', accent ?? 'text-gray-900')}>
              {value}
            </p>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}

/* ─── Progress Bar Component ──────────────────────── */

function AnimatedProgressBar({
  percentage,
  color,
  height = 'h-3',
}: {
  percentage: number;
  color: string;
  height?: string;
}) {
  const clamped = Math.min(Math.max(percentage, 0), 100);

  return (
    <div className={classNames('w-full bg-gray-200 rounded-full overflow-hidden relative', height)}>
      <motion.div
        className="h-full rounded-full flex items-center justify-end"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
      >
        {clamped > 15 && (
          <span className="text-white text-[9px] font-bold pr-1.5 leading-none">
            {Math.round(clamped)}%
          </span>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Avatar Pill ─────────────────────────────────── */

function AvatarPill({ name }: { name: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-[10px]">
        {getInitials(name)}
      </div>
      <span className="text-gray-700 text-xs">{name.split(' ')[0]}</span>
    </div>
  );
}

/* ─── Budget Edit Modal ───────────────────────────── */

function BudgetEditModal({
  open,
  onClose,
  initialBudget,
  initialCurrency,
  initialCategories,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialBudget: number;
  initialCurrency: string;
  initialCategories: BudgetCategory[];
  onSave: (budget: number, currency: string, categories: BudgetCategory[]) => Promise<void>;
}) {
  const [budget, setBudget] = useState(initialBudget > 0 ? initialBudget.toString() : '');
  const [currency, setCurrency] = useState(initialCurrency || 'MXN');
  const [categories, setCategories] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const cat of initialCategories) {
      map[cat.type] = cat.allocated > 0 ? cat.allocated.toString() : '';
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  const totalAllocated = Object.values(categories).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0,
  );
  const budgetNum = parseFloat(budget) || 0;
  const overAllocated = budgetNum > 0 && totalAllocated > budgetNum;

  const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const budgetCategories: BudgetCategory[] = (
        Object.entries(categories) as [string, string][]
      )
        .filter(([, val]) => parseFloat(val) > 0)
        .map(([type, val]) => ({ type: type as EventType, allocated: parseFloat(val) }));

      await onSave(budgetNum, currency, budgetCategories);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (type: string, value: string) => {
    setCategories((prev) => ({ ...prev, [type]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar Presupuesto"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Presupuesto Total"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0.00"
              compact
            />
          </div>
          <Select
            label="Moneda"
            options={currencyOptions}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            compact
          />
        </div>

        <div>
          <h4 className="text-gray-700 text-sm font-medium mb-3">
            Asignar por categoria (opcional)
          </h4>
          <div className="space-y-2">
            {(
              Object.entries(EVENT_TYPES) as [EventType, (typeof EVENT_TYPES)[EventType]][]
            ).map(([type, cfg]) => {
              const Icon = EVENT_ICON_MAP[type];
              return (
                <div key={type} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cfg.color}20` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-gray-700 text-sm flex-1 min-w-0 truncate">
                    {cfg.label}
                  </span>
                  <input
                    type="number"
                    value={categories[type] || ''}
                    onChange={(e) => updateCategory(type, e.target.value)}
                    placeholder="0"
                    className="w-24 bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 text-sm outline-none focus:border-blue-400/50 text-right"
                  />
                </div>
              );
            })}
          </div>

          {budgetNum > 0 && totalAllocated > 0 && (
            <div
              className={classNames(
                'mt-3 text-xs px-3 py-2 rounded-lg',
                overAllocated
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-gray-50 text-gray-500',
              )}
            >
              Asignado: {formatCurrency(totalAllocated, currency)} de{' '}
              {formatCurrency(budgetNum, currency)}
              {overAllocated && ' (excede el presupuesto total)'}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─── Add Expense Modal ───────────────────────────── */

function AddExpenseModal({
  open,
  onClose,
  members,
  events,
  currency,
  currentUserId,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  members: TripMember[];
  events: TripEvent[];
  currency: string;
  currentUserId: string;
  onSave: (data: Omit<SharedExpense, 'id' | 'createdAt'>) => Promise<void>;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState(currency);
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitBetween, setSplitBetween] = useState<string[]>(() =>
    members.map((m) => m.uid),
  );
  const [eventId, setEventId] = useState('');
  const [saving, setSaving] = useState(false);

  const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));
  const memberOptions = members.map((m) => ({
    value: m.uid,
    label: m.displayName || m.email,
  }));
  // Order with today first, then upcoming days, then past days (reverse).
  // Flat list with date prefix so the Select component (no optgroup support)
  // still shows the temporal grouping in the label.
  const eventOptions = useMemo(() => {
    const ordered = groupAndOrderEvents(events);
    const today = todayISO();
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'Sin vincular' },
    ];
    for (const [dateStr, evts] of ordered) {
      const dayLabel = dateStr === today ? `Hoy · ${formatDateES(dateStr)}` : formatDateES(dateStr);
      const sortedEvts = evts.slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      for (const e of sortedEvts) {
        opts.push({
          value: e.id,
          label: `${dayLabel} — ${e.startTime ? `${e.startTime} ` : ''}${e.title}`,
        });
      }
    }
    return opts;
  }, [events]);

  const toggleMember = (uid: string) => {
    setSplitBetween((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const perPerson =
    splitBetween.length > 0 ? (parseFloat(amount) || 0) / splitBetween.length : 0;

  const handleSave = async () => {
    if (!description.trim() || !amount || splitBetween.length === 0) return;
    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: parseFloat(amount),
        currency: expCurrency,
        paidBy,
        splitBetween,
        eventId: eventId || undefined,
        date: new Date().toISOString().split('T')[0],
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar Gasto Compartido"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            loading={saving}
            onClick={handleSave}
            disabled={!description.trim() || !amount || splitBetween.length === 0}
          >
            Agregar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Descripcion"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cena en restaurante..."
          compact
          required
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Monto"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              compact
              required
            />
          </div>
          <Select
            label="Moneda"
            options={currencyOptions}
            value={expCurrency}
            onChange={(e) => setExpCurrency(e.target.value)}
            compact
          />
        </div>

        <Select
          label="Pagado por"
          options={memberOptions}
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          compact
        />

        <div>
          <label className="block text-xs text-gray-500 font-medium mb-2">
            Dividir entre
          </label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const isSelected = splitBetween.includes(m.uid);
              return (
                <button
                  key={m.uid}
                  type="button"
                  onClick={() => toggleMember(m.uid)}
                  className={classNames(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                    isSelected
                      ? 'bg-red-50 border-red-300 text-red-600'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600',
                  )}
                >
                  <div
                    className={classNames(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                      isSelected
                        ? 'bg-gradient-to-br from-red-400 to-red-500 text-white'
                        : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {getInitials(m.displayName || m.email)}
                  </div>
                  {(m.displayName || m.email).split(' ')[0]}
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
          {splitBetween.length > 0 && parseFloat(amount) > 0 && (
            <p className="text-gray-400 text-xs mt-2">
              {formatCurrency(perPerson, expCurrency)} por persona ({splitBetween.length})
            </p>
          )}
        </div>

        <Select
          label="Vincular a evento (opcional)"
          options={eventOptions}
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          compact
        />
      </div>
    </Modal>
  );
}

/* ─── Main Page ────────────────────────────────────── */

type SortMode = 'amount' | 'date';

export default function BudgetPage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const { trip, loading: tripLoading, updateTrip } = useTrip();
  const { events, loading: eventsLoading } = useEvents();
  const { members, loading: membersLoading } = useMembers(tripId);
  const { travelers: allTravelers } = useGlobalTravelers();
  const {
    expenses,
    loading: expensesLoading,
    addExpense,
    deleteExpense,
    getBalances,
  } = useExpenses(tripId);
  const { toast } = useToast();
  const { user } = useAuth();

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<EventType | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('amount');

  const loading = tripLoading || eventsLoading || membersLoading || expensesLoading;

  const handleSaveBudget = async (
    budget: number,
    currency: string,
    categories: BudgetCategory[],
  ) => {
    try {
      await updateTrip({
        budget,
        budgetCurrency: currency,
        budgetCategories: categories,
      });
      toast('Presupuesto actualizado', 'success');
    } catch {
      toast('Error al guardar presupuesto', 'error');
    }
  };

  const handleAddExpense = async (data: Omit<SharedExpense, 'id' | 'createdAt'>) => {
    try {
      await addExpense(data);
      toast('Gasto agregado', 'success');
    } catch {
      toast('Error al agregar gasto', 'error');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      toast('Gasto eliminado', 'success');
    } catch {
      toast('Error al eliminar gasto', 'error');
    }
  };

  /* ─── Exchange rates for cross-currency aggregation ─── */
  const baseCurrency = trip?.budgetCurrency ?? 'MXN';
  const { convert: fxConvert } = useExchangeRates(baseCurrency);

  /* ─── Computed data ────────────────────────────── */

  const budgetData = useMemo(() => {
    const budget = trip?.budget ?? 0;
    const currency = trip?.budgetCurrency ?? 'MXN';
    const categories = trip?.budgetCategories ?? [];

    const eventsWithCost = events
      .filter((e) => e.cost > 0)
      .sort((a, b) => b.cost - a.cost);

    // Group spending by currency
    const spentByCurrency: Record<string, number> = {};
    for (const e of eventsWithCost) {
      const cur = e.currency || currency;
      spentByCurrency[cur] = (spentByCurrency[cur] || 0) + e.cost;
    }
    for (const e of expenses) {
      const cur = e.currency || currency;
      spentByCurrency[cur] = (spentByCurrency[cur] || 0) + e.amount;
    }

    // Convert every event/expense to the trip's base currency before summing —
    // a 9 EUR dinner against a 1500 MXN budget is now compared correctly.
    const eventSpentSameCurrency = eventsWithCost.reduce(
      (sum, e) => sum + fxConvert(e.cost, e.currency || currency),
      0,
    );
    const expenseSpentSameCurrency = expenses.reduce(
      (sum, e) => sum + fxConvert(e.amount, e.currency || currency),
      0,
    );
    const totalSpentSameCurrency = eventSpentSameCurrency + expenseSpentSameCurrency;

    const totalSpentAll = Object.values(spentByCurrency).reduce((a, b) => a + b, 0);
    const remaining = budget - totalSpentSameCurrency;
    const spentPercentage = budget > 0 ? (totalSpentSameCurrency / budget) * 100 : 0;
    const memberCount = Math.max(members.length, 1);
    const perPersonByCurrency: Record<string, number> = {};
    for (const [cur, amount] of Object.entries(spentByCurrency)) {
      perPersonByCurrency[cur] = amount / memberCount;
    }
    const breakdown = aggregateByType(events, totalSpentAll, categories);

    return {
      budget,
      currency,
      categories,
      totalSpent: totalSpentSameCurrency,
      spentByCurrency,
      perPersonByCurrency,
      remaining,
      spentPercentage,
      memberCount,
      breakdown,
      eventsWithCost,
    };
  }, [trip, events, members, expenses, fxConvert]);

  const balances = useMemo(() => getBalances(), [getBalances]);

  const isOverBudget = budgetData.budget > 0 && budgetData.remaining < 0;
  const budgetMessage = getBudgetMessage(
    budgetData.spentPercentage,
    budgetData.budget > 0,
  );

  const filteredEvents = useMemo(() => {
    let filtered = budgetData.eventsWithCost;
    if (filterCategory !== 'all') {
      filtered = filtered.filter((e) => e.type === filterCategory);
    }
    if (sortMode === 'date') {
      return [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    }
    return filtered;
  }, [budgetData.eventsWithCost, filterCategory, sortMode]);

  const categoryFilterOptions = useMemo(() => {
    const types = new Set(budgetData.eventsWithCost.map((e) => e.type));
    return [
      { value: 'all', label: 'Todas las categorias' },
      ...[...types].map((t) => ({ value: t, label: EVENT_TYPES[t].label })),
    ];
  }, [budgetData.eventsWithCost]);

  /* ─── Render ───────────────────────────────────── */

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="budget-stage relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
    >
      {/* Visual layer */}
      <div className="absolute inset-0 pointer-events-none">
        <Particles count={28} />
        <div
          className="absolute -top-12 left-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.16), transparent 70%)' }}
        />
        <div
          className="absolute bottom-12 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.14), transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 p-5 sm:p-7 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-emerald-300/30"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))',
            boxShadow: '0 0 20px rgba(34,197,94,0.2)',
          }}
        >
          <Wallet className="w-6 h-6 text-emerald-200" />
        </div>
        <div className="flex-1 min-w-0">
          <h1
            className="text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #d1fae5 60%, #6ee7b7 100%)' }}
          >
            Presupuesto
          </h1>
          <p className="text-white/55 text-[12px] mt-0.5">Control de gastos del viaje</p>
        </div>
        <button
          type="button"
          onClick={() => setShowBudgetModal(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-sm transition-colors flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Definir presupuesto</span>
          <span className="sm:hidden">Editar</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-white/40 backdrop-blur-sm border border-gray-200/60 p-4 flex items-center gap-4 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                  <div className="h-5 w-20 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar skeleton */}
          <div
            className="rounded-2xl bg-white/40 backdrop-blur-sm border border-gray-200/60 p-6 animate-pulse"
            style={{ animationDelay: '320ms' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-12 bg-gray-200 rounded" />
            </div>
            <div className="h-4 w-full bg-gray-200 rounded-full" />
            <div className="flex items-center justify-between mt-3">
              <div className="h-3 w-32 bg-gray-100 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          </div>

          {/* Category breakdown skeleton */}
          <div
            className="rounded-2xl bg-white/40 backdrop-blur-sm border border-gray-200/60 p-6 space-y-4 animate-pulse"
            style={{ animationDelay: '400ms' }}
          >
            <div className="h-4 w-48 bg-gray-200 rounded" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-200" />
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>

          {/* Detailed list skeleton */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-2xl bg-white/40 backdrop-blur-sm border border-gray-200/60 animate-pulse"
              style={{ animationDelay: `${500 + i * 80}ms` }}
            />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Section A: Budget Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Total Presupuesto"
              value={
                budgetData.budget > 0
                  ? formatCurrency(budgetData.budget, budgetData.currency)
                  : 'Sin definir'
              }
              icon={Wallet}
              iconColor="#3b82f6"
            />
            <SummaryCard
              label={`Gastado (${budgetData.currency})`}
              value={formatCurrency(budgetData.totalSpent, budgetData.currency)}
              icon={TrendingUp}
              iconColor="#f97316"
            />
            <SummaryCard
              label="Restante"
              value={
                budgetData.budget > 0
                  ? formatCurrency(budgetData.remaining, budgetData.currency)
                  : '--'
              }
              icon={TrendingDown}
              iconColor={isOverBudget ? '#ef4444' : '#22c55e'}
              accent={isOverBudget ? 'text-red-600' : 'text-emerald-600'}
            />
            <SummaryCard
              label={`Por Persona (${budgetData.memberCount})`}
              value={Object.entries(budgetData.perPersonByCurrency)
                .map(([cur, amt]) => formatCurrency(amt, cur))
                .join(' + ') || '$0'}
              icon={Users}
              iconColor="#8b5cf6"
            />
          </div>

          {/* Gastos en otras monedas */}
          {Object.keys(budgetData.spentByCurrency).length > 1 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardBody>
                  <h3 className="text-gray-900 font-semibold text-sm mb-3">Gastos por moneda</h3>
                  <div className="space-y-2">
                    {Object.entries(budgetData.spentByCurrency).map(([cur, amount]) => (
                      <div key={cur} className="flex items-center justify-between py-1.5">
                        <span className="text-gray-600 text-sm font-medium">{cur}</span>
                        <span className="text-gray-900 text-sm font-bold">{formatCurrency(amount, cur)}</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* Overall Progress + emotional message */}
          {budgetData.budget > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 text-sm font-medium">
                      Progreso del presupuesto
                    </span>
                    <span
                      className={classNames(
                        'text-sm font-bold',
                        isOverBudget ? 'text-red-600' : 'text-gray-900',
                      )}
                    >
                      {Math.round(budgetData.spentPercentage)}%
                    </span>
                  </div>
                  <AnimatedProgressBar
                    percentage={budgetData.spentPercentage}
                    color={isOverBudget ? '#ef4444' : '#3b82f6'}
                    height="h-4"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      {formatCurrency(budgetData.totalSpent, budgetData.currency)} gastado
                    </span>
                    <span className={budgetMessage.color}>{budgetMessage.text}</span>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* Budget celebration: under or exactly at budget */}
          {budgetData.budget > 0 &&
            budgetData.totalSpent > 0 &&
            budgetData.totalSpent <= budgetData.budget && (
            <motion.div variants={itemVariants}>
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 100%)',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-emerald-700 text-sm font-semibold">
                    Excelente manejo del presupuesto!
                  </p>
                  <p className="text-emerald-600/70 text-xs mt-0.5">
                    {budgetData.totalSpent === budgetData.budget
                      ? 'Usaste exactamente tu presupuesto asignado'
                      : `Te quedan ${formatCurrency(budgetData.remaining, budgetData.currency)} disponibles`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Emotional message when no budget */}
          {budgetData.budget === 0 && (
            <motion.div variants={itemVariants}>
              <div className="text-center py-3">
                <p className={classNames('text-sm', budgetMessage.color)}>
                  {budgetMessage.text}
                </p>
              </div>
            </motion.div>
          )}

          {/* Section B: Budget by Category */}
          {budgetData.breakdown.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-gray-900 font-semibold text-sm">
                      Presupuesto por Categoria
                    </h3>
                    <button
                      onClick={() => setShowBudgetModal(true)}
                      className="text-blue-600 hover:text-blue-500 text-xs font-medium transition-colors"
                    >
                      Asignar presupuesto
                    </button>
                  </div>

                  <div className="space-y-3">
                    {budgetData.breakdown.map((item) => {
                      const Icon = EVENT_ICON_MAP[item.type];
                      const allocatedPct =
                        item.allocated > 0
                          ? (item.total / item.allocated) * 100
                          : item.percentage;
                      const isOverCategory =
                        item.allocated > 0 && item.total > item.allocated;

                      return (
                        <motion.div
                          key={item.type}
                          className="space-y-1.5"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${item.color}20` }}
                              >
                                <Icon
                                  className="w-3.5 h-3.5"
                                  style={{ color: item.color }}
                                />
                              </div>
                              <span className="text-gray-700 text-sm">{item.label}</span>
                              <span className="text-gray-300 text-xs">
                                ({item.count}{' '}
                                {item.count === 1 ? 'evento' : 'eventos'})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={classNames(
                                  'text-sm font-medium',
                                  isOverCategory ? 'text-red-600' : 'text-gray-900',
                                )}
                              >
                                {formatCurrency(item.total, budgetData.currency)}
                              </span>
                              {item.allocated > 0 && (
                                <span className="text-gray-300 text-xs">
                                  /{' '}
                                  {formatCurrency(
                                    item.allocated,
                                    budgetData.currency,
                                  )}
                                </span>
                              )}
                              <span className="text-gray-400 text-xs w-10 text-right">
                                {Math.round(
                                  item.allocated > 0
                                    ? allocatedPct
                                    : item.percentage,
                                )}
                                %
                              </span>
                            </div>
                          </div>
                          <AnimatedProgressBar
                            percentage={
                              item.allocated > 0 ? allocatedPct : item.percentage
                            }
                            color={isOverCategory ? '#ef4444' : item.color}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* Section C: Shared Expenses */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardBody className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <h3 className="text-gray-900 font-semibold text-sm">
                      Gastos Compartidos
                    </h3>
                    {expenses.length > 0 && (
                      <span className="text-gray-300 text-xs">
                        ({expenses.length})
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    icon={Plus}
                    onClick={() => setShowExpenseModal(true)}
                  >
                    Agregar Gasto
                  </Button>
                </div>

                {expenses.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Receipt className="w-7 h-7 text-blue-300" />
                    </div>
                    <p className="text-gray-400 text-sm">
                      Registra gastos compartidos para dividir cuentas
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((expense) => {
                      const payerName = getMemberName(members, expense.paidBy, allTravelers);

                      return (
                        <motion.div
                          key={expense.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors group"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                            {getInitials(payerName)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">
                              {expense.description}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-gray-400 text-xs">
                                Pago {payerName.split(' ')[0]}
                              </span>
                              <span className="text-gray-200 text-xs">
                                &middot;
                              </span>
                              <span className="text-gray-400 text-xs">
                                {expense.date}
                              </span>
                              <span className="text-gray-200 text-xs">
                                &middot;
                              </span>
                              <div className="flex items-center gap-0.5">
                                {expense.splitBetween.slice(0, 3).map((uid) => (
                                  <div
                                    key={uid}
                                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[7px] text-gray-500 font-bold -ml-0.5 first:ml-0"
                                    title={getMemberName(members, uid, allTravelers)}
                                  >
                                    {getInitials(getMemberName(members, uid, allTravelers))}
                                  </div>
                                ))}
                                {expense.splitBetween.length > 3 && (
                                  <span className="text-gray-300 text-[10px] ml-0.5">
                                    +{expense.splitBetween.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="text-gray-900 font-semibold text-sm flex-shrink-0">
                            {formatCurrency(expense.amount, expense.currency)}
                          </span>

                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-1.5 rounded-lg text-transparent group-hover:text-gray-300 hover:!text-red-600 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* Section D: Balances / Settlement */}
          {(expenses.length > 0 || balances.length > 0) && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                    <h3 className="text-gray-900 font-semibold text-sm">Balances</h3>
                  </div>

                  {balances.length === 0 ? (
                    <div className="text-center py-6">
                      <PiggyBank className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">
                        Todas las cuentas estan saldadas
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {balances.map((debt, idx) => {
                        const fromName = getMemberName(members, debt.from, allTravelers);
                        const toName = getMemberName(members, debt.to, allTravelers);

                        return (
                          <motion.div
                            key={`${debt.from}-${debt.to}`}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <AvatarPill name={fromName} />

                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-red-600 text-xs font-medium">
                                debe
                              </span>
                              <span className="text-gray-900 font-bold text-sm">
                                {formatCurrency(debt.amount, budgetData.currency)}
                              </span>
                              <span className="text-gray-400 text-xs">a</span>
                            </div>

                            <AvatarPill name={toName} />
                          </motion.div>
                        );
                      })}

                      <div className="pt-2">
                        <p className="text-gray-300 text-xs text-center">
                          {balances.length === 1
                            ? '1 transaccion'
                            : `${balances.length} transacciones`}{' '}
                          para saldar cuentas
                        </p>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* Section E: Detailed Events/Expenses */}
          {budgetData.eventsWithCost.length > 0 ? (
            <motion.div variants={itemVariants}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-gray-900 font-semibold text-sm">
                      Gastos detallados
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={filterCategory}
                          onChange={(e) =>
                            setFilterCategory(
                              e.target.value as EventType | 'all',
                            )
                          }
                          className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 pl-7 text-gray-600 text-xs outline-none focus:border-blue-400/50 cursor-pointer pr-6"
                        >
                          {categoryFilterOptions.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-gray-800 text-white"
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <Filter className="w-3 h-3 text-gray-300 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      <button
                        onClick={() =>
                          setSortMode((prev) =>
                            prev === 'amount' ? 'date' : 'amount',
                          )
                        }
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 text-xs hover:text-gray-700 transition-colors"
                        title={
                          sortMode === 'amount'
                            ? 'Ordenar por fecha'
                            : 'Ordenar por monto'
                        }
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        {sortMode === 'amount' ? 'Monto' : 'Fecha'}
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {filteredEvents.map((event, idx) => {
                      const cfg = EVENT_TYPES[event.type];
                      const Icon = EVENT_ICON_MAP[event.type];
                      return (
                        <motion.div
                          key={event.id}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: idx * 0.04,
                            duration: 0.3,
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: `${cfg.color}20`,
                            }}
                          >
                            <Icon
                              className="w-4 h-4"
                              style={{ color: cfg.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">
                              {event.title}
                            </p>
                            <p className="text-gray-400 text-xs truncate">
                              {cfg.label} &middot; {event.date}
                            </p>
                          </div>
                          <span className="text-gray-900 font-semibold text-sm flex-shrink-0">
                            {formatCurrency(
                              event.cost,
                              event.currency || budgetData.currency,
                            )}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  {filteredEvents.length === 0 && (
                    <p className="text-gray-300 text-sm text-center py-4">
                      No hay gastos en esta categoria
                    </p>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          ) : (
            expenses.length === 0 && (
              <motion.div variants={itemVariants} className="text-center py-12">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="absolute w-24 h-24 bg-blue-50 rounded-full animate-empty-glow" />
                  <div className="relative w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <Wallet className="w-10 h-10 text-violet-300" />
                  </div>
                </div>
                <h3 className="text-gray-700 text-lg font-bold mb-2">
                  Sin gastos registrados
                </h3>
                <p className="text-gray-400 text-sm max-w-xs mx-auto">
                  Agrega costos a tus eventos o registra gastos compartidos para
                  ver el desglose aqui
                </p>
              </motion.div>
            )
          )}
        </motion.div>
      )}

      </div>
      <style jsx>{`
        .budget-stage :global(.text-gray-900) { color: rgba(255,255,255,0.95); }
        .budget-stage :global(.text-gray-700) { color: rgba(255,255,255,0.85); }
        .budget-stage :global(.text-gray-600) { color: rgba(255,255,255,0.72); }
        .budget-stage :global(.text-gray-500) { color: rgba(255,255,255,0.58); }
        .budget-stage :global(.text-gray-400) { color: rgba(255,255,255,0.45); }
        .budget-stage :global(.text-gray-300) { color: rgba(255,255,255,0.30); }
        .budget-stage :global(.text-gray-200) { color: rgba(255,255,255,0.18); }
        .budget-stage :global(.bg-white) { background-color: rgba(255,255,255,0.04); }
        .budget-stage :global(.bg-gray-50) { background-color: rgba(255,255,255,0.04); }
        .budget-stage :global(.bg-gray-100) { background-color: rgba(255,255,255,0.06); }
        .budget-stage :global(.border-gray-200) { border-color: rgba(255,255,255,0.10); }
        .budget-stage :global(.border-gray-100) { border-color: rgba(255,255,255,0.06); }
        .budget-stage :global(.divide-gray-200 > * + *) { border-color: rgba(255,255,255,0.08); }
        .budget-stage :global(.divide-gray-50 > * + *) { border-color: rgba(255,255,255,0.05); }
        .budget-stage :global(.glass) {
          background-color: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.08) !important;
          backdrop-filter: blur(8px);
        }
        .budget-stage :global(.shadow-md) { box-shadow: 0 0 20px rgba(0,0,0,0.18); }
        .budget-stage :global(.text-blue-600) { color: rgb(147 197 253); }
        .budget-stage :global(.text-purple-600) { color: rgb(216 180 254); }
        .budget-stage :global(.text-emerald-700) { color: rgb(110 231 183); }
        .budget-stage :global(.text-emerald-600) { color: rgb(52 211 153); }
        .budget-stage :global(.text-emerald-500) { color: rgb(52 211 153); }
        .budget-stage :global(.bg-emerald-50) { background-color: rgba(16,185,129,0.12); }
        .budget-stage :global(.bg-blue-50) { background-color: rgba(59,130,246,0.12); }
      `}</style>
    </motion.div>

      {/* Modals */}
      {showBudgetModal && (
        <BudgetEditModal
          open={showBudgetModal}
          onClose={() => setShowBudgetModal(false)}
          initialBudget={trip?.budget ?? 0}
          initialCurrency={trip?.budgetCurrency ?? 'MXN'}
          initialCategories={trip?.budgetCategories ?? []}
          onSave={handleSaveBudget}
        />
      )}

      {showExpenseModal && (
        <AddExpenseModal
          open={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          members={members}
          events={events}
          currency={budgetData.currency}
          currentUserId={user?.uid ?? ''}
          onSave={handleAddExpense}
        />
      )}
    </>
  );
}
