'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
import { ROUTES } from '@/config/constants';
import type { TripEvent } from '@/types';

export interface SmartNotification {
  id: string; // stable id used for dismiss
  level: 'info' | 'warning' | 'success';
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string; // navigates if provided
  dismissible: boolean; // most are; cleared in localStorage for the day
}

const DISMISS_KEY_PREFIX = 'gustrips:notif-dismiss';

function dismissKey(tripId: string, id: string, dayStr: string): string {
  return `${DISMISS_KEY_PREFIX}:${tripId}:${id}:${dayStr}`;
}

function safeParseDateTime(date: string, time?: string): Date | null {
  if (!date) return null;
  try {
    const dt = time ? `${date}T${time}` : `${date}T00:00:00`;
    const parsed = new Date(dt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeParseISO(date: string): Date | null {
  if (!date) return null;
  try {
    const d = parseISO(date);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function formatRelativeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (remMin === 0) return `${hours}h`;
  return `${hours}h ${remMin}min`;
}

export function useSmartNotifications(tripId: string): {
  notifications: SmartNotification[];
  dismiss: (id: string) => void;
} {
  const { trip } = useTrip(tripId);
  const { events } = useEvents(tripId);
  const { expenses } = useExpenses(tripId);

  // Track dismissed ids for today; stored in localStorage by composite key
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // On mount / tripId change / day change, hydrate dismissed from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const found = new Set<string>();
    try {
      const prefix = `${DISMISS_KEY_PREFIX}:${tripId}:`;
      const suffix = `:${todayStr}`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith(prefix) && k.endsWith(suffix)) {
          if (localStorage.getItem(k) === '1') {
            const middle = k.slice(prefix.length, k.length - suffix.length);
            if (middle) found.add(middle);
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    setDismissedIds(found);
  }, [tripId, todayStr]);

  const dismiss = useCallback(
    (id: string) => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(dismissKey(tripId, id, todayStr), '1');
        } catch {
          // ignore quota errors
        }
      }
      setDismissedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [tripId, todayStr],
  );

  const notifications = useMemo<SmartNotification[]>(() => {
    if (!trip) return [];

    const out: SmartNotification[] = [];
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = format(tomorrowDate, 'yyyy-MM-dd');

    const destination = trip.destination || 'tu destino';
    const itineraryHref = ROUTES.app.itinerary(tripId);
    const expensesHref = ROUTES.app.expenses(tripId);
    const budgetHref = ROUTES.app.budget(tripId);

    // ── 1. Vuelo en menos de 6h (warning) ─────────────
    const flightsToday: Array<{ ev: TripEvent; minutes: number }> = [];
    for (const ev of events) {
      if (ev.type !== 'flight') continue;
      if (ev.date !== today) continue;
      const dt = safeParseDateTime(ev.date, ev.startTime);
      if (!dt) continue;
      const mins = differenceInMinutes(dt, now);
      if (mins >= 0 && mins <= 6 * 60) {
        flightsToday.push({ ev, minutes: mins });
      }
    }
    if (flightsToday.length > 0) {
      flightsToday.sort((a, b) => a.minutes - b.minutes);
      const next = flightsToday[0];
      const dest = next.ev.location || next.ev.title || destination;
      out.push({
        id: 'flight-soon',
        level: 'warning',
        title: 'Vuelo en menos de 6h',
        body: `Tu vuelo a ${dest} sale en ${formatRelativeMinutes(next.minutes)}`,
        actionLabel: 'Ver itinerario',
        actionHref: itineraryHref,
        dismissible: true,
      });
    }

    // ── 2. Hoy comienza el viaje ──────────────────────
    if (trip.startDate === today) {
      out.push({
        id: 'trip-start',
        level: 'success',
        title: '¡Día 1!',
        body: `Empieza tu viaje a ${destination}`,
        actionLabel: 'Ver itinerario',
        actionHref: itineraryHref,
        dismissible: true,
      });
    }

    // ── 3. Mañana sale tu vuelo ───────────────────────
    const flightsTomorrow = events.filter((e) => e.type === 'flight' && e.date === tomorrow);
    if (flightsTomorrow.length > 0) {
      out.push({
        id: 'flight-tomorrow',
        level: 'info',
        title: 'Mañana sale tu vuelo',
        body: 'Recuerda hacer check-in',
        actionLabel: 'Ver itinerario',
        actionHref: itineraryHref,
        dismissible: true,
      });
    }

    // ── 4 & 5. Budget thresholds ──────────────────────
    if (trip.budget && trip.budget > 0) {
      const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const ratio = totalSpent / trip.budget;

      if (ratio > 1.0) {
        const overBy = totalSpent - trip.budget;
        const currency = trip.budgetCurrency || expenses[0]?.currency || 'MXN';
        out.push({
          id: 'budget-exceeded',
          level: 'warning',
          title: 'Presupuesto excedido',
          body: `Te has pasado por ${overBy.toLocaleString('es-MX', { maximumFractionDigits: 0 })} ${currency}`,
          actionLabel: 'Ver presupuesto',
          actionHref: budgetHref,
          dismissible: true,
        });
      } else if (ratio >= 0.8) {
        const pct = Math.round(ratio * 100);
        out.push({
          id: 'budget-80',
          level: 'info',
          title: 'Presupuesto al 80%+',
          body: `Has usado el ${pct}% del presupuesto`,
          actionLabel: 'Ver presupuesto',
          actionHref: budgetHref,
          dismissible: true,
        });
      }
    }

    // ── 6. Eventos pasados sin gasto registrado ───────
    // Past events with cost > 0 that have no linked expense (by eventId)
    const expenseEventIds = new Set(expenses.map((e) => e.eventId).filter(Boolean) as string[]);
    let pendingExpenses = 0;
    for (const ev of events) {
      if (!ev.cost || ev.cost <= 0) continue;
      if (!ev.date) continue;
      if (ev.date >= today) continue; // strictly past
      if (expenseEventIds.has(ev.id)) continue;
      pendingExpenses += 1;
    }
    if (pendingExpenses >= 3) {
      out.push({
        id: 'pending-expenses',
        level: 'info',
        title: 'Gastos sin capturar',
        body: `Tienes ${pendingExpenses} gastos sin capturar`,
        actionLabel: 'Capturar',
        actionHref: expensesHref,
        dismissible: true,
      });
    }

    // ── 7. Hoy es el último día ───────────────────────
    if (trip.endDate === today && trip.startDate !== today) {
      out.push({
        id: 'trip-last-day',
        level: 'success',
        title: '¡Último día!',
        body: '¿Disfrutaste el viaje?',
        actionLabel: 'Ver recap',
        actionHref: `/trips/${tripId}/recap`,
        dismissible: true,
      });
    }

    // Filter out dismissed-today
    return out.filter((n) => !dismissedIds.has(n.id));
  }, [trip, events, expenses, tripId, dismissedIds]);

  // Re-evaluate parseISO usage to silence unused import lint
  void safeParseISO;

  return { notifications, dismiss };
}
