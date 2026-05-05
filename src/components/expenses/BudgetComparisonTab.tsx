'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { Card, CardBody } from '@/components/ui/Card';
import { EVENT_TYPES } from '@/config/constants';
import { classNames, formatCurrency, formatDateES } from '@/lib/utils/helpers';
import type { EventType } from '@/types';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<EventType, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: CarFront,
  activity: MapPin,
  restaurant: UtensilsCrossed,
  transport: Car,
  cruise: Ship,
  other: MoreHorizontal,
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

export function BudgetComparisonTab({ tripId }: BudgetComparisonTabProps) {
  const { trip, loading: tripLoading } = useTrip(tripId);
  const { expenses, loading: expensesLoading } = useExpenses(tripId);
  const { events, loading: eventsLoading } = useEvents(tripId);
  const [viewMode, setViewMode] = useState<ViewMode>('category');

  const loading = tripLoading || expensesLoading || eventsLoading;
  const budgetCategories = trip?.budgetCategories ?? [];
  const currency = trip?.budgetCurrency ?? 'MXN';

  // --- Category comparison ---
  const categoryComparison = useMemo((): CategoryComparison[] => {
    if (budgetCategories.length === 0) return [];

    const actualByCategory = new Map<EventType, number>();

    for (const expense of expenses) {
      // Points payments: gasto real es $0, no se suma al gastado
      // El valor real se refleja en el presupuesto via el cost del evento
      if (expense.paymentMethod === 'points') continue;

      const cat = ((expense as { category?: string }).category ?? 'misc') as EventType;
      const prev = actualByCategory.get(cat) ?? 0;
      actualByCategory.set(cat, prev + expense.amount);
    }

    return budgetCategories.map((cat) => {
      const cfg = EVENT_TYPES[cat.type];
      const actual = actualByCategory.get(cat.type) ?? 0;
      const percentage = cat.allocated > 0 ? (actual / cat.allocated) * 100 : 0;
      return {
        type: cat.type,
        label: cfg.label,
        color: cfg.color,
        planned: cat.allocated,
        actual,
        percentage,
      };
    });
  }, [budgetCategories, expenses]);

  // --- Event comparison ---
  const eventComparison = useMemo((): EventComparison[] => {
    const expenseByEvent = new Map<string, number>();
    const pointsByEvent = new Map<string, { points: number; value: number }>();

    for (const expense of expenses) {
      if (expense.eventId) {
        if (expense.paymentMethod === 'points') {
          const prev = pointsByEvent.get(expense.eventId) ?? { points: 0, value: 0 };
          pointsByEvent.set(expense.eventId, {
            points: prev.points + ((expense as { pointsUsed?: number }).pointsUsed ?? 0),
            value: prev.value + ((expense as { equivalentValue?: number }).equivalentValue ?? 0),
          });
        } else {
          const prev = expenseByEvent.get(expense.eventId) ?? 0;
          expenseByEvent.set(expense.eventId, prev + expense.amount);
        }
      }
    }

    return events
      .filter((e) => e.cost > 0 || expenseByEvent.has(e.id) || pointsByEvent.has(e.id))
      .map((e) => {
        const cfg = EVENT_TYPES[e.type] ?? EVENT_TYPES.other;
        const planned = e.cost ?? 0;
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
  }, [events, expenses]);

  // --- Totals ---
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

  // Points savings
  const pointsSavings = useMemo(() => {
    let total = 0;
    let totalPoints = 0;
    for (const expense of expenses) {
      if (expense.paymentMethod === 'points') {
        total += (expense as { equivalentValue?: number }).equivalentValue ?? 0;
        totalPoints += (expense as { pointsUsed?: number }).pointsUsed ?? 0;
      }
    }
    return { total, totalPoints };
  }, [expenses]);

  const getTrafficLight = (percentage: number): string => {
    if (percentage < 80) return 'bg-emerald-500';
    if (percentage <= 100) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrafficIcon = (percentage: number) => {
    if (percentage < 80) return CheckCircle;
    if (percentage <= 100) return AlertTriangle;
    return XCircle;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
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
        className="text-center py-16"
      >
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-gray-700 font-semibold mb-1">Sin datos para comparar</h3>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          Configura tu presupuesto por categorias o agrega costos a tus eventos del itinerario
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* View toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setViewMode('category')}
          className={classNames(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all',
            viewMode === 'category'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Layers className="w-4 h-4" />
          Por categoria
        </button>
        <button
          onClick={() => setViewMode('event')}
          className={classNames(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all',
            viewMode === 'event'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <CalendarDays className="w-4 h-4" />
          Por evento
        </button>
      </div>

      {/* Summary card */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-gray-500 text-xs font-medium mb-1">Planeado</p>
              <p className="text-gray-900 font-bold text-lg">
                {formatCurrency(totals.totalPlanned, currency)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium mb-1">Gastado</p>
              <p className="text-gray-900 font-bold text-lg">
                {formatCurrency(totals.totalSpent, currency)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium mb-1">Diferencia</p>
              <p
                className={classNames(
                  'font-bold text-lg',
                  totals.difference >= 0 ? 'text-emerald-600' : 'text-red-600',
                )}
              >
                {totals.difference >= 0 ? '+' : ''}
                {formatCurrency(totals.difference, currency)}
              </p>
            </div>
          </div>
          {/* Points savings */}
          {pointsSavings.total > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <span className="text-amber-600 text-sm">★</span>
                </div>
                <div>
                  <p className="text-gray-700 text-sm font-medium">Ahorro con puntos</p>
                  <p className="text-gray-400 text-xs">{pointsSavings.totalPoints.toLocaleString()} puntos usados</p>
                </div>
              </div>
              <p className="text-emerald-600 font-bold text-lg">
                -{formatCurrency(pointsSavings.total, currency)}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Category view */}
      {viewMode === 'category' && (
        <>
          {hasNoBudget ? (
            <Card>
              <CardBody className="text-center py-8">
                <p className="text-gray-400 text-sm">
                  Configura tu presupuesto por categorias en la seccion de Presupuesto
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="space-y-4">
                {categoryComparison.map((item, idx) => {
                  const Icon = CATEGORY_ICONS[item.type];
                  const clampedPct = Math.min(item.percentage, 100);

                  return (
                    <motion.div
                      key={item.type}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${item.color}20` }}
                          >
                            <Icon className="w-4 h-4" style={{ color: item.color }} />
                          </div>
                          <span className="text-gray-700 text-sm font-medium">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-xs">
                            {formatCurrency(item.planned, currency)}
                          </span>
                          <span className="text-gray-900 text-sm font-semibold">
                            {formatCurrency(item.actual, currency)}
                          </span>
                          <div className={classNames('w-2.5 h-2.5 rounded-full', getTrafficLight(item.percentage))} />
                        </div>
                      </div>

                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.percentage > 100 ? '#ef4444' : item.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${clampedPct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 + idx * 0.05 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}

                {/* Total row */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 text-sm font-bold">Total</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">
                        {formatCurrency(categoryTotals.totalPlanned, currency)}
                      </span>
                      <span
                        className={classNames(
                          'text-sm font-bold',
                          categoryTotals.difference >= 0 ? 'text-gray-900' : 'text-red-600',
                        )}
                      >
                        {formatCurrency(categoryTotals.totalSpent, currency)}
                      </span>
                      <div
                        className={classNames(
                          'w-2.5 h-2.5 rounded-full',
                          getTrafficLight(
                            categoryTotals.totalPlanned > 0
                              ? (categoryTotals.totalSpent / categoryTotals.totalPlanned) * 100
                              : 0,
                          ),
                        )}
                      />
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {/* Event view */}
      {viewMode === 'event' && (
        <>
          {hasNoEvents ? (
            <Card>
              <CardBody className="text-center py-8">
                <p className="text-gray-400 text-sm">
                  Agrega costos estimados a tus eventos del itinerario para comparar
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="space-y-3">
                {eventComparison.map((item, idx) => {
                  const Icon = CATEGORY_ICONS[item.type] ?? MoreHorizontal;
                  const clampedPct = item.planned > 0 ? Math.min(item.percentage, 100) : 0;
                  const TrafficIcon = getTrafficIcon(item.percentage);
                  const hasPlanned = item.planned > 0;
                  const hasActual = item.actual > 0;

                  return (
                    <motion.div
                      key={item.eventId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.3 }}
                      className="py-3 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: `${item.color}20` }}
                          >
                            <Icon className="w-4 h-4" style={{ color: item.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">{item.title}</p>
                            <p className="text-gray-400 text-xs">{formatDateES(item.date)}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {hasPlanned && (
                            <p className="text-gray-400 text-xs">
                              Plan: {formatCurrency(item.planned, currency)}
                            </p>
                          )}
                          {item.paidWithPoints ? (
                            <p className="text-emerald-600 text-sm font-semibold">
                              ★ Cubierto con puntos
                            </p>
                          ) : (
                            <p className={classNames(
                              'text-sm font-semibold',
                              !hasActual ? 'text-gray-300' : item.percentage > 100 ? 'text-red-600' : 'text-gray-900',
                            )}>
                              {hasActual ? formatCurrency(item.actual, currency) : 'Sin gastos'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Points savings detail */}
                      {item.paidWithPoints && (
                        <div className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2 mt-1">
                          <span className="text-emerald-700 text-xs font-medium">
                            {item.pointsUsed.toLocaleString()} puntos usados
                          </span>
                          <span className="text-emerald-700 text-xs font-bold">
                            Ahorro: {formatCurrency(item.pointsValue, currency)}
                          </span>
                        </div>
                      )}

                      {/* Progress bar - only if there's a planned amount and NOT paid with points */}
                      {hasPlanned && !item.paidWithPoints && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.percentage > 100 ? '#ef4444' : item.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${clampedPct}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 + idx * 0.04 }}
                            />
                          </div>
                          <TrafficIcon
                            className={classNames(
                              'w-4 h-4 flex-shrink-0',
                              item.percentage < 80 ? 'text-emerald-500' : item.percentage <= 100 ? 'text-yellow-500' : 'text-red-500',
                            )}
                          />
                        </div>
                      )}

                      {/* Paid with points — show full green bar */}
                      {hasPlanned && item.paidWithPoints && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-emerald-400"
                              initial={{ width: 0 }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 + idx * 0.04 }}
                            />
                          </div>
                          <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                        </div>
                      )}

                      {/* No planned amount but has actual */}
                      {!hasPlanned && hasActual && !item.paidWithPoints && (
                        <p className="text-amber-600 text-xs mt-1">Gasto sin presupuesto asignado</p>
                      )}
                    </motion.div>
                  );
                })}

                {/* Total row */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 text-sm font-bold">Total eventos</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">
                        Plan: {formatCurrency(eventTotals.totalPlanned, currency)}
                      </span>
                      <span
                        className={classNames(
                          'text-sm font-bold',
                          eventTotals.difference >= 0 ? 'text-gray-900' : 'text-red-600',
                        )}
                      >
                        {formatCurrency(eventTotals.totalSpent, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
