'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sparkles, X, ChevronDown, ChevronRight } from 'lucide-react';
// Trip + events from layout-level TripDataProvider — banner is only mounted
// inside `/trips/[tripId]/page.tsx`.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { useExpenses } from '@/hooks/useExpenses';
import { classNames } from '@/lib/utils/helpers';

interface Props {
  tripId: string;
}

type SuggestionKind = 'empty-day' | 'time-gap' | 'return-flight' | 'hotel-nights' | 'budget-pace';

interface Suggestion {
  id: string;
  kind: SuggestionKind;
  text: string;
  prompt: string;
}

const DISMISS_KEY_PREFIX = 'gustrips:smart-suggestions-dismiss:';

function getDaysBetween(start: string, end: string): string[] {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    const total = differenceInCalendarDays(e, s);
    if (total < 0) return [];
    const days: string[] = [];
    for (let i = 0; i <= total; i++) {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      days.push(format(d, 'yyyy-MM-dd'));
    }
    return days;
  } catch {
    return [];
  }
}

function timeToMinutes(time: string): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

function formatDayLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "d 'de' MMM", { locale: es });
  } catch {
    return dateStr;
  }
}

function dispatchAssistantOpen(prompt: string) {
  if (typeof window === 'undefined') return;
  const ev = new CustomEvent('gustrips:open-assistant', { detail: { prompt } });
  window.dispatchEvent(ev);
}

export default function SmartSuggestionsBanner({ tripId }: Props) {
  const { trip } = useTrip();
  const { events } = useEvents();
  const { expenses } = useExpenses(tripId);

  const [expanded, setExpanded] = useState(false);
  const [dismissedToday, setDismissedToday] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `${DISMISS_KEY_PREFIX}${tripId}:${todayStr}`;
    if (localStorage.getItem(key) === '1') setDismissedToday(true);
  }, [tripId, todayStr]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!trip) return [];
    const out: Suggestion[] = [];
    const days = getDaysBetween(trip.startDate, trip.endDate);
    if (days.length === 0) return out;

    // Don't surface forward-looking suggestions if the trip is over.
    if (todayStr > trip.endDate) return out;

    const destination = trip.destination || 'tu destino';

    // Group events by date
    const eventsByDay = new Map<string, typeof events>();
    for (const ev of events) {
      if (!ev.date) continue;
      const list = eventsByDay.get(ev.date);
      if (list) {
        list.push(ev);
      } else {
        eventsByDay.set(ev.date, [ev]);
      }
    }

    // Past days are noise — you can't plan a gap that already happened.
    // Keep "today" so suggestions for the rest of the day still surface.
    const upcomingDays = days.filter((d) => d >= todayStr);

    // 1. Empty days (today + future only)
    for (let i = 0; i < upcomingDays.length; i++) {
      const day = upcomingDays[i];
      const dayIndex = days.indexOf(day); // preserve "Día N" numbering across the trip
      const dayEvents = eventsByDay.get(day);
      if (!dayEvents || dayEvents.length === 0) {
        out.push({
          id: `empty-${day}`,
          kind: 'empty-day',
          text: `Día ${dayIndex + 1} (${formatDayLabel(day)}) está vacío — ¿quieres planear algo?`,
          prompt: `Sugiéreme cosas para hacer el día ${day} en ${destination}.`,
        });
        if (out.length >= 3) return out;
      }
    }

    // 2. Time gaps > 4h on populated days (today + future only)
    for (const day of upcomingDays) {
      const dayEvents = eventsByDay.get(day);
      if (!dayEvents || dayEvents.length < 2) continue;
      // Sort by startTime
      const sorted = [...dayEvents]
        .filter((e) => e.startTime)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const aEnd = timeToMinutes(a.endTime) ?? timeToMinutes(a.startTime);
        const bStart = timeToMinutes(b.startTime);
        if (aEnd == null || bStart == null) continue;
        const gapMinutes = bStart - aEnd;
        if (gapMinutes > 4 * 60) {
          const hourA = a.endTime || a.startTime;
          const hourB = b.startTime;
          out.push({
            id: `gap-${day}-${i}`,
            kind: 'time-gap',
            text: `Tienes 4+ horas libres el día ${formatDayLabel(day)} entre ${a.title} y ${b.title}`,
            prompt: `Sugiéreme algo para hacer el día ${day} entre ${hourA} y ${hourB}.`,
          });
          if (out.length >= 3) return out;
          break; // one gap per day is enough
        }
      }
    }

    // 3. Missing return flight
    const flights = events.filter((e) => e.type === 'flight' && e.date);
    if (flights.length > 0) {
      const totalDays = days.length;
      const halfwayIdx = Math.floor(totalDays / 2);
      const lastThirtyIdx = Math.floor(totalDays * 0.7); // start of last 30%
      const halfwayDate = days[halfwayIdx];
      const lastThirtyDate = days[lastThirtyIdx];
      const hasFlightBeforeSecondHalf = flights.some((f) => f.date < halfwayDate);
      const hasReturnFlight = flights.some((f) => f.date >= lastThirtyDate);
      if (hasFlightBeforeSecondHalf && !hasReturnFlight) {
        out.push({
          id: 'return-flight',
          kind: 'return-flight',
          text: 'No detecto vuelo de regreso',
          prompt: `Ayúdame a planear el vuelo de regreso desde ${destination}.`,
        });
        if (out.length >= 3) return out;
      }
    }

    // 4. Hotel nights uncovered (excluding cruise nights & last day & past nights)
    const cruiseNights = new Set<string>();
    const hotelNights = new Set<string>();
    for (const ev of events) {
      if (ev.type === 'cruise' && ev.date) cruiseNights.add(ev.date);
      if (ev.type === 'hotel' && ev.date) hotelNights.add(ev.date);
    }
    const nightsNeedingHotel = days
      .slice(0, -1)
      .filter((d) => d >= todayStr && !cruiseNights.has(d));
    const uncoveredNights = nightsNeedingHotel.filter((d) => !hotelNights.has(d));
    if (uncoveredNights.length > 0) {
      const list = uncoveredNights.join(', ');
      out.push({
        id: 'hotel-nights',
        kind: 'hotel-nights',
        text: `Te faltan ${uncoveredNights.length} noche${uncoveredNights.length !== 1 ? 's' : ''} de hotel sin reservar`,
        prompt: `Faltan reservas de hotel en estas noches: ${list}. ¿Qué me sugieres?`,
      });
      if (out.length >= 3) return out;
    }

    // 5. SKIP — pending expense capture handled by PendingExpensesBanner.

    // 6. Budget over-pace
    if (trip.budget && trip.budget > 0) {
      try {
        const start = parseISO(trip.startDate);
        const end = parseISO(trip.endDate);
        const today = new Date();
        const totalDays = differenceInCalendarDays(end, start) + 1;
        const elapsedDays = differenceInCalendarDays(today, start) + 1;
        if (totalDays > 0 && elapsedDays > 0) {
          const elapsedPct = Math.min(1, elapsedDays / totalDays);
          if (elapsedPct > 0.4) {
            const spent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            const spentPct = spent / trip.budget;
            if (spentPct > 1.3 * elapsedPct) {
              const overPct = Math.round((spentPct / elapsedPct - 1) * 100);
              out.push({
                id: 'budget-pace',
                kind: 'budget-pace',
                text: `Vas ${overPct}% sobre el ritmo del presupuesto`,
                prompt: `Vas ${overPct}% sobre el ritmo del presupuesto. ¿Cómo recortar gastos?`,
              });
              if (out.length >= 3) return out;
            }
          }
        }
      } catch {
        // ignore date parse errors
      }
    }

    return out.slice(0, 3);
  }, [trip, events, expenses, todayStr]);

  if (!trip) return null;
  if (dismissedToday) return null;
  if (suggestions.length === 0) return null;

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${DISMISS_KEY_PREFIX}${tripId}:${todayStr}`, '1');
    }
    setDismissedToday(true);
  };

  const first = suggestions[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-amber-300/30 overflow-hidden p-4 relative"
      style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.02))' }}
    >
      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-amber-700/70 hover:text-amber-900 hover:bg-amber-200/40 transition-colors"
        title="No mostrar hoy"
        aria-label="Cerrar sugerencias"
      >
        <X className="w-4 h-4" />
      </button>

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
        className="flex items-center gap-3 pr-7 cursor-pointer select-none"
      >
        <motion.div
          animate={{ rotate: [0, 12, -8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(217,119,6,0.18)', boxShadow: '0 0 15px rgba(217,119,6,0.15)' }}
        >
          <Sparkles className="w-5 h-5 text-amber-700" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-950 font-bold text-sm">
            {suggestions.length} sugerencia{suggestions.length !== 1 ? 's' : ''} inteligente{suggestions.length !== 1 ? 's' : ''}
          </p>
          {!expanded && (
            <p className="text-amber-800 text-xs mt-0.5 truncate">
              {first.text}
            </p>
          )}
        </div>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-amber-700 flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.div>
      </div>

      {/* Suggestion list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className={classNames(
                    'flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/70 border border-amber-200/40',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm leading-snug">{s.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatchAssistantOpen(s.prompt)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1.5 bg-amber-500 text-white hover:bg-amber-600 hover:shadow-md transition-all flex-shrink-0"
                  >
                    <Sparkles className="w-3 h-3" />
                    Pregúntale al asistente
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900"
                >
                  <ChevronDown className="w-3 h-3 rotate-180" />
                  Ocultar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
