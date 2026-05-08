'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, X, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
import { EVENT_TYPES } from '@/config/constants';
import { classNames, formatCurrency } from '@/lib/utils/helpers';
import QuickExpenseModal from './QuickExpenseModal';
import type { TripEvent } from '@/types';
import {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  MoreHorizontal,
};

interface PendingExpensesBannerProps {
  tripId: string;
}

const DISMISS_KEY_PREFIX = 'gustrips:pending-expenses-dismiss:';

export default function PendingExpensesBanner({ tripId }: PendingExpensesBannerProps) {
  const { events } = useEvents(tripId);
  const { expenses } = useExpenses(tripId);

  const [expanded, setExpanded] = useState(true);
  const [dismissedToday, setDismissedToday] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Check session storage for dismiss state — resets each new day
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `${DISMISS_KEY_PREFIX}${tripId}:${todayStr}`;
    if (sessionStorage.getItem(key) === '1') setDismissedToday(true);
  }, [tripId, todayStr]);

  // Build a Set of event IDs that already have an expense linked
  const eventIdsWithExpense = useMemo(() => {
    const set = new Set<string>();
    for (const exp of expenses) {
      if (exp.eventId) set.add(exp.eventId);
    }
    return set;
  }, [expenses]);

  // Pending events: cost > 0, date in the past, no expense linked, not multi-day continuation (use original date)
  const pendingEvents = useMemo(() => {
    const today = todayStr;
    return events
      .filter((e) => {
        if (!e.date || !e.cost || e.cost <= 0) return false;
        if (e.date >= today) return false; // future or today
        if (eventIdsWithExpense.has(e.id)) return false;
        return true;
      })
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? -d : (a.startTime || '').localeCompare(b.startTime || '');
      });
  }, [events, eventIdsWithExpense, todayStr]);

  if (pendingEvents.length === 0) return null;
  if (dismissedToday) return null;

  const handleDismissToday = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${tripId}:${todayStr}`, '1');
    }
    setDismissedToday(true);
  };

  const totalPendingByCurrency = pendingEvents.reduce<Record<string, number>>((acc, ev) => {
    const cur = ev.currency || 'MXN';
    acc[cur] = (acc[cur] || 0) + (ev.cost || 0);
    return acc;
  }, {});

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-amber-300/60 overflow-hidden shadow-lg shadow-amber-500/10"
        style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}
      >
        {/* Header */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((s) => !s)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded((s) => !s);
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-200/30 transition-colors cursor-pointer"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(217,119,6,0.18)', boxShadow: '0 0 15px rgba(217,119,6,0.15)' }}
          >
            <AlertCircle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-950 font-bold text-sm">
              Tienes {pendingEvents.length} gasto{pendingEvents.length !== 1 ? 's' : ''} sin registrar
            </p>
            <p className="text-amber-800 text-xs mt-0.5">
              {Object.entries(totalPendingByCurrency).map(([cur, amt], i) => (
                <span key={cur}>
                  {i > 0 && ' · '}
                  Estimado: {formatCurrency(amt, cur)}
                </span>
              ))}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDismissToday(); }}
            className="p-1.5 rounded-lg text-amber-700/70 hover:text-amber-900 hover:bg-amber-200/50 transition-colors flex-shrink-0"
            title="No mostrar hoy"
          >
            <X className="w-4 h-4" />
          </button>
          <motion.div
            animate={{ rotate: expanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            className="text-amber-700 flex-shrink-0"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>

        {/* Expanded list */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-1.5">
                {pendingEvents.map((event) => {
                  const cfg = EVENT_TYPES[event.type];
                  const Icon = ICON_MAP[cfg.icon] || MoreHorizontal;
                  const dateLabel = (() => {
                    try {
                      return format(parseISO(event.date), "EEE d 'de' MMM", { locale: es });
                    } catch {
                      return event.date;
                    }
                  })();

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEvent(event)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/70 hover:bg-white border border-amber-200/40 hover:border-amber-300 hover:shadow-md transition-all group text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cfg.color}1c`, color: cfg.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-sm truncate">{event.title}</p>
                        <p className="text-gray-500 text-[11px] mt-0.5 capitalize truncate">
                          {dateLabel}
                          {event.startTime && ` · ${event.startTime}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-sm tabular-nums">
                          {formatCurrency(event.cost, event.currency || 'MXN')}
                        </span>
                        <span
                          className={classNames(
                            'inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1 transition-all',
                            'bg-emerald-500 text-white group-hover:bg-emerald-600 group-hover:shadow-md',
                          )}
                        >
                          <Receipt className="w-3 h-3" />
                          Registrar
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Quick expense modal */}
      {selectedEvent && (
        <QuickExpenseModal
          open={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          tripId={tripId}
          event={selectedEvent}
          onCreated={() => {
            setSelectedEvent(null);
          }}
        />
      )}
    </>
  );
}
