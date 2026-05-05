'use client';

import { useState, useMemo } from 'react';
import { eachDayOfInterval, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
import { EVENT_TYPES } from '@/config/constants';
import { classNames, formatDateShortES } from '@/lib/utils/helpers';
import type { TripEvent } from '@/types';

interface DailyBudgetTabProps {
  tripId: string;
}

export function DailyBudgetTab({ tripId }: DailyBudgetTabProps) {
  const { trip } = useTrip(tripId);
  const { events, updateEvent } = useEvents(tripId);
  const { expenses } = useExpenses(tripId);

  // Build map of events paid with points
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
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const currency = trip?.budgetCurrency || 'MXN';

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

  const toggleDay = (dateStr: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const handleCostChange = async (eventId: string, newCost: number) => {
    await updateEvent(eventId, { cost: newCost });
  };

  const grandTotal = useMemo(() => {
    return events.reduce((sum, e) => sum + (e.cost || 0), 0);
  }, [events]);

  if (!trip) return null;

  let runningTotal = 0;

  return (
    <div className="space-y-3">
      {tripDays.map((day, dayIdx) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayLabel = format(day, 'EEE', { locale: es }) + ' ' + formatDateShortES(dateStr);
        const capitalizedLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
        const isExpanded = expandedDays.has(dateStr);

        const dayEvents = events
          .filter((e) => e.date === dateStr)
          .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        const dayTotal = dayEvents.reduce((sum, e) => sum + (e.cost || 0), 0);
        runningTotal += dayTotal;

        return (
          <div key={dateStr} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Day header */}
            <button
              type="button"
              onClick={() => toggleDay(dateStr)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              <span className="text-xs font-bold text-gray-400 w-10">Dia {dayIdx + 1}</span>
              <span className="text-sm font-medium text-gray-800 flex-1 text-left">
                {capitalizedLabel}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                ${dayTotal.toLocaleString()} <span className="text-xs text-gray-400">{currency}</span>
              </span>
            </button>

            {/* Expanded content */}
            {isExpanded && dayEvents.length > 0 && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {dayEvents.map((event) => (
                  <EventCostRow
                    key={event.id}
                    event={event}
                    currency={currency}
                    onCostChange={handleCostChange}
                    paidWithPoints={pointsEventMap.has(event.id)}
                    pointsUsed={pointsEventMap.get(event.id)}
                  />
                ))}
              </div>
            )}

            {isExpanded && dayEvents.length === 0 && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-300">Sin eventos</p>
              </div>
            )}

            {/* Running total */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-2 bg-gray-50/50 flex justify-end">
                <span className="text-xs text-gray-500">
                  Acumulado: <span className="font-semibold text-gray-700">${runningTotal.toLocaleString()}</span>
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Grand total */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-amber-800">Total del viaje</span>
        <span className="text-lg font-bold text-amber-900">
          ${grandTotal.toLocaleString()} <span className="text-sm font-normal text-amber-600">{currency}</span>
        </span>
      </div>
    </div>
  );
}

/* ---- Inline event cost row ---- */

interface EventCostRowProps {
  event: TripEvent;
  currency: string;
  onCostChange: (eventId: string, cost: number) => void;
  paidWithPoints?: boolean;
  pointsUsed?: number;
}

function EventCostRow({ event, currency, onCostChange, paidWithPoints, pointsUsed }: EventCostRowProps) {
  const [editing, setEditing] = useState(false);
  const [localCost, setLocalCost] = useState(String(event.cost || 0));

  const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.other;

  const handleBlur = () => {
    setEditing(false);
    const parsed = parseFloat(localCost) || 0;
    if (parsed !== event.cost) {
      onCostChange(event.id, parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
      {/* Icon dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: eventConfig.color }}
      />

      {/* Time */}
      <span className="text-xs text-gray-400 w-12 flex-shrink-0">
        {event.startTime || '--:--'}
      </span>

      {/* Title + badge */}
      <span className="text-sm text-gray-700 flex-1 truncate flex items-center gap-2">
        {event.title}
        {event.autoGenerated && (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            Auto
          </span>
        )}
      </span>

      {/* Cost display */}
      {paidWithPoints ? (
        <div className="text-right min-w-[80px]">
          <p className="text-emerald-600 text-xs font-semibold">★ Puntos</p>
          <p className="text-gray-300 text-[10px]">{(pointsUsed || 0).toLocaleString()} pts</p>
        </div>
      ) : editing ? (
        <input
          type="number"
          value={localCost}
          onChange={(e) => setLocalCost(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-24 text-right text-sm px-2 py-1 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setLocalCost(String(event.cost || 0));
            setEditing(true);
          }}
          className={classNames(
            'text-sm font-medium text-right min-w-[80px] px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors',
            event.cost > 0 ? 'text-gray-900' : 'text-gray-300',
          )}
        >
          ${(event.cost || 0).toLocaleString()}
        </button>
      )}
    </div>
  );
}
