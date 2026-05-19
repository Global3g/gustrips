'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { eachDayOfInterval, parseISO, format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale/es';
import {
  ChevronDown,
  Plane,
  Hotel,
  CarFront,
  MapPin,
  UtensilsCrossed,
  Car,
  Ship,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  Pencil,
  Check,
  X,
  Sparkles,
  TrendingUp,
  CalendarDays,
} from 'lucide-react';
// Trip + events from layout-level TripDataProvider — this tab only renders
// inside `/trips/[tripId]/expenses`.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { useExpenses } from '@/hooks/useExpenses';
import { useToast } from '@/context/ToastContext';
import Particles from '@/components/ui/Particles';
import { EVENT_TYPES } from '@/config/constants';
import { classNames, formatCurrency } from '@/lib/utils/helpers';
import type { TripEvent, EventType } from '@/types';
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

interface DailyBudgetTabProps {
  tripId: string;
}

export function DailyBudgetTab({ tripId }: DailyBudgetTabProps) {
  const { trip } = useTrip();
  const { events, updateEvent } = useEvents();
  const { expenses } = useExpenses(tripId);
  const { toast } = useToast();

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [tempCost, setTempCost] = useState('');
  const [savingCost, setSavingCost] = useState(false);

  const currency = trip?.budgetCurrency || 'MXN';

  /* ─── Trip days ─── */
  const tripDays = useMemo(() => {
    if (!trip) return [];
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      return eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
  }, [trip]);

  /* ─── Points map ─── */
  const pointsEventMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const exp of expenses) {
      if (exp.paymentMethod === 'points' && exp.eventId) {
        const prev = map.get(exp.eventId) ?? 0;
        map.set(exp.eventId, prev + ((exp as { pointsUsed?: number }).pointsUsed ?? 0));
      }
    }
    return map;
  }, [expenses]);

  /* ─── Per-day data ─── */
  const dayData = useMemo(() => {
    return tripDays.map((day, idx) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEvents = events
        .filter((e) => e.date === dateStr)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      const dayTotal = dayEvents.reduce((sum, e) => sum + (e.cost || 0), 0);
      return { day, dateStr, dayEvents, dayTotal, dayNumber: idx + 1 };
    });
  }, [tripDays, events]);

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const grandTotal = dayData.reduce((sum, d) => sum + d.dayTotal, 0);
    const daysWithCost = dayData.filter((d) => d.dayTotal > 0).length;
    const avg = daysWithCost > 0 ? grandTotal / daysWithCost : 0;
    const max = Math.max(0, ...dayData.map((d) => d.dayTotal));
    const peakDay = dayData.find((d) => d.dayTotal === max && max > 0);
    return { grandTotal, daysWithCost, avg, max, peakDay };
  }, [dayData]);

  /* ─── Today flag ─── */
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tripStart = trip?.startDate ? parseISO(trip.startDate) : null;
  const tripEnd = trip?.endDate ? parseISO(trip.endDate) : null;
  const tripPct = useMemo(() => {
    if (!tripStart || !tripEnd) return null;
    const total = differenceInCalendarDays(tripEnd, tripStart) + 1;
    const elapsed = Math.max(0, Math.min(differenceInCalendarDays(new Date(), tripStart) + 1, total));
    return (elapsed / total) * 100;
  }, [tripStart, tripEnd]);

  /* ─── Handlers ─── */
  const toggleDay = (dateStr: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
    setEditingEventId(null);
  };

  const startEdit = (event: TripEvent) => {
    setEditingEventId(event.id);
    setTempCost(String(event.cost || 0));
  };

  const cancelEdit = () => {
    setEditingEventId(null);
  };

  const saveEdit = async (eventId: string) => {
    setSavingCost(true);
    try {
      const newCost = parseFloat(tempCost) || 0;
      await updateEvent(eventId, { cost: newCost });
      setEditingEventId(null);
      toast('Costo actualizado', 'success');
    } catch {
      toast('Error al actualizar costo', 'error');
    } finally {
      setSavingCost(false);
    }
  };

  if (!trip) return null;

  /* ─── Render ─── */
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
        <Particles count={28} />
        <div
          className="absolute -top-12 left-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.20), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }}
        />
        <div
          className="absolute bottom-12 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.14), transparent 70%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* ─── Hero stats ─── */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
            <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
              <CalendarDays className="w-3 h-3" />
              Total planeado
            </div>
            <div className="text-white text-2xl font-black tabular-nums" style={{ textShadow: '0 0 22px rgba(255,255,255,0.12)' }}>
              {formatCurrency(stats.grandTotal, currency)}
            </div>
            <div className="text-white/40 text-[11px] mt-0.5">{tripDays.length} días</div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
            <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
              <TrendingUp className="w-3 h-3" />
              Promedio diario
            </div>
            <div className="text-white text-2xl font-black tabular-nums">
              {formatCurrency(stats.avg, currency)}
            </div>
            <div className="text-white/40 text-[11px] mt-0.5">{stats.daysWithCost} días con costo</div>
          </div>

          {stats.peakDay ? (
            <div className="rounded-2xl border border-amber-300/30 backdrop-blur-sm p-4 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))' }}>
              <div className="flex items-center gap-1.5 text-amber-200/85 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
                <Sparkles className="w-3 h-3" />
                Día más caro
              </div>
              <div className="text-amber-100 text-2xl font-black tabular-nums">
                {formatCurrency(stats.peakDay.dayTotal, currency)}
              </div>
              <div className="text-amber-200/70 text-[11px] mt-0.5 capitalize">
                Día {stats.peakDay.dayNumber} · {format(stats.peakDay.day, "EEE d 'de' MMM", { locale: es })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
              <div className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">Día más caro</div>
              <div className="text-white/60 text-sm">Sin datos aún</div>
            </div>
          )}
        </div>

        {/* ─── Mini bar chart of all days ─── */}
        {stats.max > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
            <div className="flex items-baseline justify-between mb-2.5">
              <div className="text-white/85 text-sm font-bold">Distribución por día</div>
              <div className="text-white/40 text-[11px]">tap para detalle</div>
            </div>
            <div className="flex items-end gap-1 h-20">
              {dayData.map((d) => {
                const heightPct = stats.max > 0 ? (d.dayTotal / stats.max) * 100 : 0;
                const isToday = d.dateStr === todayStr;
                const isExpanded = expandedDays.has(d.dateStr);
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => toggleDay(d.dateStr)}
                    className="flex-1 flex flex-col items-center gap-1 group min-w-0"
                    title={`Día ${d.dayNumber} · ${formatCurrency(d.dayTotal, currency)}`}
                  >
                    <div className="flex-1 w-full flex items-end">
                      <motion.div
                        className={classNames(
                          'w-full rounded-t-md transition-all',
                          isExpanded ? 'shadow-[0_0_12px_rgba(245,158,11,0.5)]' : '',
                        )}
                        style={{
                          background: isExpanded
                            ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
                            : isToday
                            ? 'linear-gradient(180deg, #60a5fa, #3b82f6)'
                            : 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))',
                          minHeight: d.dayTotal > 0 ? '4px' : '2px',
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: d.dayNumber * 0.02 }}
                      />
                    </div>
                    <div
                      className={classNames(
                        'text-[9px] font-bold tabular-nums leading-none',
                        isExpanded ? 'text-amber-200' : isToday ? 'text-sky-300' : 'text-white/35 group-hover:text-white/65',
                      )}
                    >
                      {d.dayNumber}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Day cards ─── */}
        <div className="space-y-2">
          {dayData.map((d, idx) => {
            const isExpanded = expandedDays.has(d.dateStr);
            const isToday = d.dateStr === todayStr;
            const heightPct = stats.max > 0 ? (d.dayTotal / stats.max) * 100 : 0;
            const dayLabel = format(d.day, "EEE d 'de' MMM", { locale: es });
            const capitalizedLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

            return (
              <motion.div
                key={d.dateStr}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={classNames(
                  'rounded-2xl border backdrop-blur-sm overflow-hidden',
                  isToday
                    ? 'border-sky-300/40 bg-sky-400/[0.05]'
                    : 'border-white/[0.08] bg-white/[0.04]',
                )}
              >
                {/* Day header */}
                <button
                  type="button"
                  onClick={() => toggleDay(d.dateStr)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <div
                    className={classNames(
                      'w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-[10px] font-black leading-none',
                      isToday
                        ? 'bg-sky-400/20 text-sky-200 border border-sky-300/40'
                        : 'bg-white/[0.06] text-white/70 border border-white/10',
                    )}
                  >
                    <span className="text-[8px] uppercase tracking-wider opacity-70">Día</span>
                    <span className="text-base">{d.dayNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-white text-sm font-semibold capitalize truncate">
                        {capitalizedLabel}
                        {isToday && <span className="text-sky-300 text-[11px] ml-1.5 font-bold">· Hoy</span>}
                      </span>
                      <span className="text-white text-sm font-bold tabular-nums whitespace-nowrap">
                        {formatCurrency(d.dayTotal, currency)}
                      </span>
                    </div>
                    {/* Inline bar */}
                    <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: isToday
                            ? 'linear-gradient(90deg, #60a5fa, #3b82f6)'
                            : 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2))',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${heightPct}%` }}
                        transition={{ duration: 0.6, delay: 0.15 + idx * 0.02 }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1">
                      <span className="text-white/40">
                        {d.dayEvents.length} evento{d.dayEvents.length !== 1 ? 's' : ''}
                      </span>
                      <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-white/40"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.span>
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-white/[0.06]"
                    >
                      <div className="p-3 space-y-1.5">
                        {d.dayEvents.length === 0 ? (
                          <p className="text-white/35 text-xs text-center py-3">Sin eventos en este día</p>
                        ) : (
                          d.dayEvents.map((event) => {
                            const cfg = EVENT_TYPES[event.type] ?? EVENT_TYPES.misc;
                            const Icon = CATEGORY_ICONS[event.type] ?? Package;
                            const paidWithPoints = pointsEventMap.has(event.id);
                            const pointsUsed = pointsEventMap.get(event.id) || 0;
                            const isEditing = editingEventId === event.id;

                            return (
                              <div
                                key={event.id}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
                              >
                                <div
                                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: `${cfg.color}22` }}
                                >
                                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                                </div>
                                <span className="text-white/45 text-[10px] tabular-nums w-10 flex-shrink-0">
                                  {event.startTime || '--:--'}
                                </span>
                                <span className="text-white/85 text-sm flex-1 truncate">
                                  {event.title}
                                  {event.autoGenerated && (
                                    <span className="ml-1.5 text-[9px] font-bold text-amber-200/90 bg-amber-300/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      auto
                                    </span>
                                  )}
                                </span>

                                {paidWithPoints ? (
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-emerald-300 text-[11px] font-bold flex items-center gap-1 justify-end">
                                      <Sparkles className="w-3 h-3" />
                                      Puntos
                                    </div>
                                    <div className="text-emerald-300/60 text-[9px] tabular-nums">
                                      {pointsUsed.toLocaleString()} pts
                                    </div>
                                  </div>
                                ) : isEditing ? (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={tempCost}
                                      onChange={(e) => setTempCost(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit(event.id);
                                        if (e.key === 'Escape') cancelEdit();
                                      }}
                                      autoFocus
                                      className="w-20 bg-white/[0.06] border border-amber-300/50 rounded-md px-2 py-1 text-white text-sm tabular-nums text-right outline-none focus:border-amber-300"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => saveEdit(event.id)}
                                      disabled={savingCost}
                                      className="w-6 h-6 rounded-md bg-emerald-400/20 border border-emerald-300/50 text-emerald-200 hover:bg-emerald-400/30 transition-colors flex items-center justify-center disabled:opacity-50"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEdit}
                                      className="w-6 h-6 rounded-md bg-white/[0.06] border border-white/[0.1] text-white/60 hover:bg-white/10 transition-colors flex items-center justify-center"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(event)}
                                    className={classNames(
                                      'group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold tabular-nums transition-all flex-shrink-0',
                                      event.cost > 0
                                        ? 'text-white hover:bg-amber-300/10'
                                        : 'text-white/30 hover:text-amber-200 hover:bg-amber-300/10',
                                    )}
                                  >
                                    {formatCurrency(event.cost || 0, currency)}
                                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-white/50 transition-opacity" />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* ─── Trip progress vs budget consumed bar ─── */}
        {tripPct !== null && stats.grandTotal > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
            <div className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
              Avance del viaje
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                initial={{ width: 0 }}
                animate={{ width: `${tripPct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[11px] mt-1">
              <span className="text-white/55">{Math.round(tripPct)}% transcurrido</span>
              <span className="text-white/55">{Math.round(100 - tripPct)}% por venir</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
