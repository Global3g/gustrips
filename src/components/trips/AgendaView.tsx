'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { format, parseISO, eachDayOfInterval, differenceInCalendarDays, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, addMonths, addDays } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { AlertTriangle, Pencil, Copy, Trash2 } from 'lucide-react';
import { EVENT_TYPES } from '@/config/constants';
import { formatCurrency, getTimezoneAbbr, formatDateShortES } from '@/lib/utils/helpers';
import EventPattern from '@/components/trips/EventPattern';
import type { TripEvent } from '@/types';

/* ─── Constantes ──────────────────────────────────── */

const HOUR_HEIGHT = 80;
const MIN_BLOCK_HEIGHT = 40;
const DAY_COL_MIN_W = 170;
const SNAP_MIN = 15;

/* ─── Colores más intensos por tipo (fondo y texto) ─ */

const AGENDA_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  flight:     { bg: 'rgba(236,72,153,0.12)',   border: '#ec4899', text: '#db2777' },
  hotel:      { bg: 'rgba(139,92,246,0.12)',  border: '#7c3aed', text: '#6d28d9' },
  car_rental: { bg: 'rgba(234,179,8,0.12)',   border: '#ca8a04', text: '#a16207' },
  activity:   { bg: 'rgba(34,197,94,0.12)',   border: '#16a34a', text: '#15803d' },
  restaurant: { bg: 'rgba(249,115,22,0.12)',  border: '#ea580c', text: '#c2410c' },
  transport:  { bg: 'rgba(59,130,246,0.12)',  border: '#2563eb', text: '#1d4ed8' },
  cruise:     { bg: 'rgba(125,211,252,0.20)', border: '#7dd3fc', text: '#0284c7' },
  other:      { bg: 'rgba(107,114,128,0.12)', border: '#6b7280', text: '#4b5563' },
};

/* ─── Helpers ─────────────────────────────────────── */

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatHour(h: number): string {
  if (h >= 24) return '00:00';
  return `${h.toString().padStart(2, '0')}:00`;
}

function isEventInPast(event: TripEvent, displayDate: string, now: Date): boolean {
  if (event.date && displayDate < event.date) return false;
  try {
    if (event.endTime && event.date) {
      const end = new Date(`${event.date}T${event.endTime}`);
      if (event.type === 'flight' && event.details?.arrivalDate) {
        const arrEnd = new Date(`${event.details.arrivalDate}T${event.endTime}`);
        if (!Number.isNaN(arrEnd.getTime())) return now > arrEnd;
      }
      if (event.type === 'hotel' && event.details?.checkOutDate) {
        const checkOut = new Date(`${event.details.checkOutDate}T${event.details.checkOutTime || event.endTime}`);
        if (!Number.isNaN(checkOut.getTime())) return now > checkOut;
      }
      if (!Number.isNaN(end.getTime())) return now > end;
    }
    if (event.startTime && event.date) {
      const start = new Date(`${event.date}T${event.startTime}`);
      if (!Number.isNaN(start.getTime())) return now > start;
    }
  } catch {}
  return false;
}

/* ─── Conflictos visuales ─────────────────────────── */

function findConflicts(events: TripEvent[], date: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  // Solo eventos timed que ORIGINAN en este día (excluye continuaciones multi-día)
  const dayEvents = events
    .filter((e) => e.startTime && e.date === date)
    .map((e) => {
      const startMin = timeToMinutes(e.startTime);
      let endMin = e.endTime ? timeToMinutes(e.endTime) : startMin + 60;
      if (endMin <= startMin) endMin = startMin + 60;
      return { event: e, startMin, endMin };
    });

  for (let i = 0; i < dayEvents.length; i++) {
    for (let j = i + 1; j < dayEvents.length; j++) {
      const a = dayEvents[i];
      const b = dayEvents[j];
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        const aList = result.get(a.event.id) || [];
        aList.push(b.event.title);
        result.set(a.event.id, aList);
        const bList = result.get(b.event.id) || [];
        bList.push(a.event.title);
        result.set(b.event.id, bList);
      }
    }
  }
  return result;
}

/* ─── Asignación de lanes (side-by-side) ──────────── */

function assignLanes(
  events: { id: string; startMin: number; endMin: number }[],
): Map<string, { laneIndex: number; laneCount: number; isOverlay: boolean }> {
  const result = new Map<string, { laneIndex: number; laneCount: number; isOverlay: boolean }>();
  if (events.length === 0) return result;

  // Detectar eventos completamente contenidos dentro de otros (overlay).
  // Un evento B es "overlay" si existe otro A más grande que contiene a B en tiempo.
  const overlayIds = new Set<string>();
  for (const b of events) {
    for (const a of events) {
      if (a.id === b.id) continue;
      const aDuration = a.endMin - a.startMin;
      const bDuration = b.endMin - b.startMin;
      // a debe ser estrictamente mayor que b para evitar empates
      if (aDuration <= bDuration) continue;
      if (a.startMin <= b.startMin && a.endMin >= b.endMin) {
        overlayIds.add(b.id);
        break;
      }
    }
  }

  // Asignar overlays — todos van solos, layer encima del contenedor
  for (const id of overlayIds) {
    result.set(id, { laneIndex: 0, laneCount: 1, isOverlay: true });
  }

  // Para los demás (contenedores y eventos sin overlap parcial), aplicar lanes normales
  const containers = events.filter((e) => !overlayIds.has(e.id));
  const sorted = [...containers].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  const clusterId = new Map<string, number>();
  let nextCluster = 0;
  let activeCluster = -1;
  let activeMaxEnd = -Infinity;

  for (const ev of sorted) {
    if (ev.startMin >= activeMaxEnd) {
      activeCluster = nextCluster++;
      activeMaxEnd = ev.endMin;
      laneEnds.length = 0;
    } else {
      activeMaxEnd = Math.max(activeMaxEnd, ev.endMin);
    }
    clusterId.set(ev.id, activeCluster);

    let lane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= ev.startMin) {
        lane = i;
        break;
      }
    }
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.endMin);
    } else {
      laneEnds[lane] = ev.endMin;
    }
    lanes.set(ev.id, lane);
  }

  const clusterMaxLane = new Map<number, number>();
  lanes.forEach((laneIdx, id) => {
    const c = clusterId.get(id) ?? 0;
    clusterMaxLane.set(c, Math.max(clusterMaxLane.get(c) ?? 0, laneIdx + 1));
  });

  lanes.forEach((laneIdx, id) => {
    const c = clusterId.get(id) ?? 0;
    result.set(id, { laneIndex: laneIdx, laneCount: clusterMaxLane.get(c) ?? 1, isOverlay: false });
  });

  return result;
}

/* ─── Drag & Resize state ─────────────────────────── */

interface DragGhost {
  eventId: string;
  date: string;
  startMin: number;
  durationMin: number;
}

interface ResizeGhost {
  eventId: string;
  date: string;
  startMin: number;
  endMin: number;
}

/* ─── Props ───────────────────────────────────────── */

interface AgendaViewProps {
  events: TripEvent[];
  onEdit: (event: TripEvent) => void;
  onUpdate?: (eventId: string, data: Partial<TripEvent>) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  onDuplicate?: (event: TripEvent) => void;
  onReorder?: (events: TripEvent[]) => Promise<void>;
  onCreateAt?: (date: string, time: string) => void;
  selectedDate?: string;
  onSelectedDateChange?: (date: string) => void;
  tripStartDate?: string;
  tripEndDate?: string;
  calendarView?: 'day' | 'week' | 'full';
  onCalendarViewChange?: (view: 'day' | 'week' | 'full') => void;
}

/* ─── MonthGrid (mini month picker) ───────────────── */

function MonthGrid({ dates, selectedDate, onSelect }: {
  dates: string[];
  selectedDate: string;
  onSelect: (d: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => parseISO(selectedDate));
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const dateSet = new Set(dates);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          aria-label="Mes anterior"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-bold text-gray-900 capitalize">
          {format(viewMonth, "MMMM yyyy", { locale: es })}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          aria-label="Mes siguiente"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dStr = format(day, 'yyyy-MM-dd');
          const inTrip = dateSet.has(dStr);
          const isSelected = dStr === selectedDate;
          const inMonth = isSameMonth(day, viewMonth);
          const todayCheck = isToday(day);
          const baseCls = 'h-8 w-8 rounded-lg text-xs flex items-center justify-center transition-all';
          const stateCls = isSelected
            ? 'bg-blue-500 text-white font-bold shadow-md shadow-blue-500/30'
            : inTrip
              ? 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium'
              : 'text-gray-300 cursor-not-allowed';
          const dimCls = !inMonth && !isSelected ? 'opacity-40' : '';
          const todayCls = todayCheck && !isSelected ? 'ring-1 ring-blue-300' : '';
          return (
            <button
              key={dStr}
              type="button"
              onClick={() => inTrip && onSelect(dStr)}
              disabled={!inTrip}
              className={`${baseCls} ${stateCls} ${dimCls} ${todayCls}`.trim()}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Componente ──────────────────────────────────── */

export default function AgendaView({ events, onEdit, onUpdate, onDelete, onDuplicate, onReorder, onCreateAt, selectedDate, onSelectedDateChange, tripStartDate, tripEndDate, calendarView = 'full', onCalendarViewChange }: AgendaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragInfoRef = useRef<{ event: TripEvent; durationMin: number; offsetY: number } | null>(null);
  const ghostRef = useRef<DragGhost | null>(null);
  const clickedEventRef = useRef(false);
  const gridClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const resizeInfoRef = useRef<{ event: TripEvent; startMin: number } | null>(null);
  const resizeGhostRef = useRef<ResizeGhost | null>(null);
  const [resizeGhost, setResizeGhost] = useState<ResizeGhost | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [nowTick, setNowTick] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; event: TripEvent } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const isMultiSelectMode = selectedEventIds.size > 0;

  // Mobile media query
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Escape clears multi-select
  useEffect(() => {
    if (selectedEventIds.size === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedEventIds(new Set());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedEventIds.size]);

  // Toggle event id in selected set
  const toggleSelectedEvent = useCallback((id: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [contextMenu]);

  // Sync refs with state
  useEffect(() => { ghostRef.current = ghost; }, [ghost]);
  useEffect(() => { resizeGhostRef.current = resizeGhost; }, [resizeGhost]);

  // Reset week offset when view or selectedDate changes
  useEffect(() => { setWeekOffset(0); }, [calendarView, selectedDate]);

  /* ─── Derivar fechas ────────────────────────────── */

  const dates = useMemo(() => {
    // If trip start/end dates provided, show ALL days of the trip
    if (tripStartDate && tripEndDate) {
      try {
        return eachDayOfInterval({
          start: parseISO(tripStartDate),
          end: parseISO(tripEndDate),
        }).map((d) => format(d, 'yyyy-MM-dd'));
      } catch { /* fall through */ }
    }
    // Fallback: derive from events
    const allDates: string[] = [];
    for (const ev of events) {
      if (ev.date) allDates.push(ev.date);
      if (ev.details?.arrivalDate) allDates.push(ev.details.arrivalDate);
      if (ev.details?.checkOutDate) allDates.push(ev.details.checkOutDate);
    }
    if (allDates.length === 0) return [];
    const sorted = [...new Set(allDates)].sort();
    return eachDayOfInterval({
      start: parseISO(sorted[0]),
      end: parseISO(sorted[sorted.length - 1]),
    }).map((d) => format(d, 'yyyy-MM-dd'));
  }, [events, tripStartDate, tripEndDate]);

  /* ─── Filtrar fechas según calendarView ──────────── */

  const filteredDates = useMemo(() => {
    if (calendarView === 'full') return dates;
    if (calendarView === 'day') {
      if (selectedDate && dates.includes(selectedDate)) return [selectedDate];
      return dates.length > 0 ? [dates[0]] : [];
    }
    // 'week': 7 days starting from selectedDate + weekOffset
    const start = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
    if (!start) return [];
    const startIdx = dates.indexOf(start) + weekOffset * 7;
    const clampedStart = Math.max(0, Math.min(startIdx, dates.length - 1));
    return dates.slice(clampedStart, clampedStart + 7);
  }, [dates, calendarView, selectedDate, weekOffset]);

  /* ─── Rango de horas ────────────────────────────── */

  const { startHour, endHour } = useMemo(() => {
    return { startHour: 6, endHour: 22 };
  }, []);

  const totalHours = endHour - startHour;
  const hours = Array.from({ length: totalHours }, (_, i) => startHour + i);

  /* ─── Agrupar eventos por fecha ─────────────────── */

  const eventsByDate = useMemo(() => {
    const groups: Record<string, { timed: TripEvent[]; untimed: TripEvent[] }> = {};
    for (const date of dates) groups[date] = { timed: [], untimed: [] };

    for (const event of events) {
      const g = groups[event.date];
      if (!g) continue;

      if (event.startTime) {
        g.timed.push(event);

        // Vuelos multi-día: agregar "continuación" en días intermedios hasta arrival
        if (event.type === 'flight' && event.details?.arrivalDate && event.details.arrivalDate !== event.date) {
          const depIdx = dates.indexOf(event.date);
          const arrIdx = dates.indexOf(event.details.arrivalDate);
          for (let i = depIdx + 1; i <= arrIdx && i < dates.length; i++) {
            groups[dates[i]]?.timed.push(event);
          }
        }

        // Hoteles multi-día: agregar en todos los días de estancia
        if (event.type === 'hotel' && event.details?.checkOutDate && event.details.checkOutDate !== event.date) {
          const inIdx = dates.indexOf(event.date);
          const outIdx = dates.indexOf(event.details.checkOutDate);
          for (let i = inIdx + 1; i <= outIdx && i < dates.length; i++) {
            groups[dates[i]]?.timed.push(event);
          }
        }
      } else {
        g.untimed.push(event);
      }
    }
    return groups;
  }, [events, dates]);

  /* ─── Totales por día ──────────────────────────── */

  const dayTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const date of dates) {
      totals[date] = events
        .filter((e) => e.date === date && e.cost > 0)
        .reduce((sum, e) => sum + e.cost, 0);
    }
    return totals;
  }, [events, dates]);

  /* ─── Scroll inicial ───────────────────────────── */

  useEffect(() => {
    if (!scrollRef.current) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (filteredDates.includes(todayStr) && nowMin >= startHour * 60 && nowMin < endHour * 60) {
      scrollRef.current.scrollTop = Math.max(0, ((nowMin / 60) - startHour - 1) * HOUR_HEIGHT);
      return;
    }
    const first = events.find((e) => e.startTime);
    if (first) {
      const min = timeToMinutes(first.startTime);
      scrollRef.current.scrollTop = Math.max(0, ((min / 60) - startHour - 0.5) * HOUR_HEIGHT);
    }
  }, [events, startHour, endHour, filteredDates]);

  /* ─── Drag & Drop ──────────────────────────────── */

  const handleDragStart = useCallback((event: TripEvent, blockRect: DOMRect, clientY: number) => {
    if (!event.startTime) return;

    const sm = timeToMinutes(event.startTime);
    const em = event.endTime ? timeToMinutes(event.endTime) : sm + 60;
    let dur = em - sm;
    // Vuelo que cruza medianoche
    if (dur <= 0) dur = 60;

    dragInfoRef.current = {
      event,
      durationMin: dur,
      offsetY: clientY - blockRect.top,
    };

    setGhost({ eventId: event.id, date: event.date, startMin: sm, durationMin: dur });

    const onMove = (ev: PointerEvent) => {
      const drag = dragInfoRef.current;
      if (!drag) return;

      // Encontrar columna bajo el cursor
      let targetDate = '';
      colRefs.current.forEach((el, date) => {
        const r = el.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX < r.right) targetDate = date;
      });
      if (!targetDate) return;

      // Encontrar el grid de esa columna
      const colEl = colRefs.current.get(targetDate);
      const gridEl = colEl?.querySelector('[data-grid]') as HTMLElement | null;
      if (!gridEl) return;

      const gridRect = gridEl.getBoundingClientRect();
      const relY = ev.clientY - gridRect.top - drag.offsetY;
      const rawMin = startHour * 60 + (relY / HOUR_HEIGHT) * 60;
      const snapped = Math.round(rawMin / SNAP_MIN) * SNAP_MIN;
      const clamped = Math.max(startHour * 60, Math.min(snapped, endHour * 60 - drag.durationMin));

      setGhost((prev) => {
        if (prev && prev.date === targetDate && prev.startMin === clamped) return prev;
        return { eventId: drag.event.id, date: targetDate, startMin: clamped, durationMin: drag.durationMin };
      });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const drag = dragInfoRef.current;
      const g = ghostRef.current;

      if (drag && g) {
        const newStartTime = minutesToTime(g.startMin);
        const newEndTime = minutesToTime(g.startMin + g.durationMin);
        const dateChanged = g.date !== drag.event.date;
        const timeChanged = newStartTime !== drag.event.startTime;

        if (dateChanged || timeChanged) {
          const updates: Partial<TripEvent> = {
            date: g.date,
            startTime: newStartTime,
            endTime: newEndTime,
          };

          // Para vuelos con arrivalDate: desplazar arrivalDate por la misma diferencia de días
          if (dateChanged && drag.event.type === 'flight' && drag.event.details?.arrivalDate) {
            const daysDelta = differenceInCalendarDays(parseISO(g.date), parseISO(drag.event.date));
            const newArrival = new Date(parseISO(drag.event.details.arrivalDate));
            newArrival.setDate(newArrival.getDate() + daysDelta);
            updates.details = {
              ...drag.event.details,
              arrivalDate: format(newArrival, 'yyyy-MM-dd'),
            };
          }

          onUpdate?.(drag.event.id, updates);
        }
      }

      dragInfoRef.current = null;
      setGhost(null);
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [startHour, endHour, onUpdate]);

  /* ─── Resize ────────────────────────────────────── */

  const handleResizeStart = useCallback((e: React.PointerEvent, event: TripEvent, date: string) => {
    if (!event.startTime) return;
    e.preventDefault();
    e.stopPropagation();

    const sm = timeToMinutes(event.startTime);
    const em = event.endTime ? timeToMinutes(event.endTime) : sm + 60;

    resizeInfoRef.current = { event, startMin: sm };
    setResizeGhost({ eventId: event.id, date, startMin: sm, endMin: em > sm ? em : sm + 60 });

    const onMove = (ev: PointerEvent) => {
      const info = resizeInfoRef.current;
      if (!info) return;

      // Encontrar el grid de la columna
      const colEl = colRefs.current.get(date);
      const gridEl = colEl?.querySelector('[data-grid]') as HTMLElement | null;
      if (!gridEl) return;

      const gridRect = gridEl.getBoundingClientRect();
      const relY = ev.clientY - gridRect.top;
      const rawMin = startHour * 60 + (relY / HOUR_HEIGHT) * 60;
      const snapped = Math.round(rawMin / SNAP_MIN) * SNAP_MIN;
      // Mínimo 15 min de duración
      const clamped = Math.max(info.startMin + SNAP_MIN, Math.min(snapped, endHour * 60));

      setResizeGhost((prev) => {
        if (prev && prev.endMin === clamped) return prev;
        return { eventId: info.event.id, date, startMin: info.startMin, endMin: clamped };
      });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const info = resizeInfoRef.current;
      const rg = resizeGhostRef.current;

      if (info && rg) {
        const newEndTime = minutesToTime(rg.endMin);
        if (newEndTime !== info.event.endTime) {
          onUpdate?.(info.event.id, { endTime: newEndTime });
        }
      }

      resizeInfoRef.current = null;
      setResizeGhost(null);
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [startHour, endHour, onUpdate]);

  /* ─── Bulk actions sobre eventos seleccionados ──── */

  const bulkShiftDays = useCallback((deltaDays: number) => {
    if (!onUpdate) return;
    const ids = Array.from(selectedEventIds);
    ids.forEach((id) => {
      const ev = events.find((e) => e.id === id);
      if (!ev || !ev.date) return;
      try {
        const newDate = format(addDays(parseISO(ev.date), deltaDays), 'yyyy-MM-dd');
        onUpdate?.(id, { date: newDate });
      } catch {}
    });
    setSelectedEventIds(new Set());
  }, [onUpdate, selectedEventIds, events]);

  const bulkDelete = useCallback(() => {
    if (!onDelete) return;
    const ids = Array.from(selectedEventIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Eliminar ${ids.length} eventos? Esta accion no se puede deshacer.`)) return;
    ids.forEach((id) => onDelete?.(id));
    setSelectedEventIds(new Set());
  }, [onDelete, selectedEventIds]);

  /* ─── Calcular posición de un evento en el grid ── */

  const getBlockPosition = (event: TripEvent, date: string) => {
    const startMin = timeToMinutes(event.startTime);
    let endMin = event.endTime ? timeToMinutes(event.endTime) : startMin + 60;

    // Vuelos multi-día
    const isFlightMultiDay = event.type === 'flight' && event.details?.arrivalDate && event.details.arrivalDate !== event.date;
    // Hoteles multi-día
    const isHotelMultiDay = event.type === 'hotel' && event.details?.checkOutDate && event.details.checkOutDate !== event.date;

    if (isFlightMultiDay) {
      if (date === event.date) {
        endMin = endHour * 60;
      } else if (date === event.details?.arrivalDate) {
        return {
          top: 0,
          height: Math.max(((timeToMinutes(event.endTime) - startHour * 60) / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT),
        };
      } else {
        return { top: 0, height: totalHours * HOUR_HEIGHT };
      }
    } else if (isHotelMultiDay) {
      const checkInTime = event.details?.checkInTime ? timeToMinutes(event.details.checkInTime) : startMin;
      const checkOutTime = event.details?.checkOutTime ? timeToMinutes(event.details.checkOutTime) : endHour * 60;

      if (date === event.date) {
        // Día de check-in: desde hora check-in hasta fin del grid
        const topMin = Math.max(checkInTime, startHour * 60);
        const top = ((topMin - startHour * 60) / 60) * HOUR_HEIGHT;
        return { top, height: totalHours * HOUR_HEIGHT - top };
      } else if (date === event.details?.checkOutDate) {
        // Día de check-out: desde inicio hasta hora check-out
        const botMin = Math.min(checkOutTime, endHour * 60);
        return { top: 0, height: Math.max(((botMin - startHour * 60) / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT) };
      } else {
        // Días intermedios: todo el grid
        return { top: 0, height: totalHours * HOUR_HEIGHT };
      }
    } else if (endMin <= startMin) {
      endMin = endHour * 60;
    }

    const topMin = Math.max(startMin, startHour * 60);
    const botMin = Math.min(endMin, endHour * 60);
    const top = ((topMin - startHour * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(((botMin - topMin) / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT);
    return { top, height };
  };

  if (filteredDates.length === 0) return null;

  /* ─── Render ────────────────────────────────────── */

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* ─── View toggle bar ─────────────────── */}
      <div
        className="relative flex items-center gap-1 px-3 py-2 border-b border-blue-100"
        style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #ede9fe 50%, #fdf2f8 100%)' }}
      >
        {(['day', 'week', 'full'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onCalendarViewChange?.(v)}
            className={`px-3 py-1 rounded-md text-xs transition-colors ${
              calendarView === v
                ? 'bg-amber-100 text-amber-800 font-bold'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Completo'}
          </button>
        ))}

        {/* Day navigation arrows */}
        {calendarView === 'day' && onSelectedDateChange && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => {
                const currentDate = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
                const idx = dates.indexOf(currentDate);
                if (idx > 0) onSelectedDateChange(dates[idx - 1]);
              }}
              disabled={(() => {
                const currentDate = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
                return dates.indexOf(currentDate) <= 0;
              })()}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
              title="Día anterior"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => setShowMonthPicker((s) => !s)}
              className="text-[11px] text-gray-700 font-semibold hover:bg-gray-100 rounded px-2 py-1 min-w-[90px] text-center transition-colors"
            >
              {filteredDates.length > 0 && formatDateShortES(filteredDates[0])}
            </button>
            <button
              onClick={() => {
                const currentDate = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
                const idx = dates.indexOf(currentDate);
                if (idx < dates.length - 1) onSelectedDateChange(dates[idx + 1]);
              }}
              disabled={(() => {
                const currentDate = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
                return dates.indexOf(currentDate) >= dates.length - 1;
              })()}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
              title="Día siguiente"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}

        {/* Week navigation arrows */}
        {calendarView === 'week' && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              disabled={(() => {
                const start = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
                if (!start) return true;
                return dates.indexOf(start) + (weekOffset - 1) * 7 < 0;
              })()}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
              title="Semana anterior"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => setShowMonthPicker((s) => !s)}
              className="text-[11px] text-gray-700 font-semibold hover:bg-gray-100 rounded px-2 py-1 min-w-[90px] text-center transition-colors"
            >
              {filteredDates.length > 0 && `${formatDateShortES(filteredDates[0])} – ${formatDateShortES(filteredDates[filteredDates.length - 1])}`}
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              disabled={(() => {
                const start = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
                if (!start) return true;
                return dates.indexOf(start) + (weekOffset + 1) * 7 >= dates.length;
              })()}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
              title="Semana siguiente"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}

        {showMonthPicker && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowMonthPicker(false)}
            />
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-40 w-[300px] bg-white rounded-xl shadow-2xl border border-gray-200 p-4">
              <MonthGrid
                dates={dates}
                selectedDate={selectedDate ?? dates[0]}
                onSelect={(d) => {
                  onSelectedDateChange?.(d);
                  setShowMonthPicker(false);
                }}
              />
            </div>
          </>
        )}
      </div>
      <div ref={scrollRef} className="overflow-auto max-h-[85vh]">
        <div className={`flex ${calendarView === 'full' ? 'min-w-max' : 'min-w-0 w-full'}`}>

          {/* ─── Columna de horas (sticky) ──────── */}
          <div
            className={`${isMobile ? 'w-10' : (calendarView === 'day' ? 'w-16' : 'w-14')} flex-shrink-0 sticky left-0 z-20`}
            style={{ background: 'linear-gradient(180deg, #eff6ff 0%, #ede9fe 100%)' }}
          >
            <div className={`${calendarView === 'day' ? 'h-16' : 'h-12'} border-b border-blue-200/60`} />
            <div className="relative" style={{ height: totalHours * HOUR_HEIGHT }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className={`absolute w-full text-right ${isMobile ? 'pr-1' : 'pr-2'}`}
                  style={{ top: (h - startHour) * HOUR_HEIGHT }}
                >
                  <span className={`font-mono leading-none relative -top-[5px] tabular-nums font-bold ${
                    isMobile
                      ? 'text-indigo-700 text-[9px]'
                      : (calendarView === 'day' ? 'text-indigo-700 text-sm' : 'text-indigo-600 text-[11px]')
                  }`}>
                    {formatHour(h)}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-10 border-t border-blue-200/60" />
          </div>

          {/* ─── Columnas de días ───────────────── */}
          {filteredDates.map((date) => {
            const { timed, untimed } = eventsByDate[date];
            const isWeekend = [0, 6].includes(parseISO(date).getDay());
            const total = dayTotals[date];
            const isDateToday = isToday(parseISO(date));

            // Conflictos por día (excluye continuaciones multi-día)
            const conflicts = findConflicts(events, date);

            // Lanes side-by-side: solo eventos que originan en este día (no continuaciones)
            const laneInputs = timed
              .filter((e) => {
                const isFlightCont = e.type === 'flight' && e.details?.arrivalDate && e.details.arrivalDate !== e.date && date !== e.date;
                const isHotelCont = e.type === 'hotel' && e.details?.checkOutDate && e.details.checkOutDate !== e.date && date !== e.date;
                return !isFlightCont && !isHotelCont;
              })
              .map((e) => {
                const sm = timeToMinutes(e.startTime);
                let em = e.endTime ? timeToMinutes(e.endTime) : sm + 60;
                if (em <= sm) em = sm + 60;
                return { id: e.id, startMin: sm, endMin: em };
              });
            const lanes = assignLanes(laneInputs);

            return (
              <div
                key={date}
                ref={(el) => { if (el) colRefs.current.set(date, el); }}
                className={`border-l border-gray-200 ${calendarView !== 'full' ? 'flex-1' : ''}`}
                style={
                  calendarView === 'day'
                    ? { minWidth: '100%', width: '100%' }
                    : calendarView === 'week'
                    ? { minWidth: isMobile ? 90 : 120, flex: 1 }
                    : { minWidth: isMobile ? 120 : DAY_COL_MIN_W }
                }
              >
                {/* Header del día */}
                <div
                  className={`${calendarView === 'day' ? 'h-16' : 'h-14'} flex flex-col items-center justify-center border-b sticky top-0 z-10 relative overflow-hidden`}
                  style={{
                    background: isDateToday
                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                      : isWeekend
                        ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                        : 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%)',
                    borderBottomColor: isDateToday ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.6)',
                  }}
                >
                  {/* Top glass highlight */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
                  {isDateToday && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-12 bg-white/40 rounded-full blur-2xl pointer-events-none" />
                  )}
                  <span className={`uppercase tracking-[0.15em] font-bold leading-none ${
                    calendarView === 'day' ? 'text-[10px]' : 'text-[9px]'
                  } ${
                    isDateToday ? 'text-white/90' : isWeekend ? 'text-amber-700' : 'text-indigo-600'
                  }`}>
                    {format(parseISO(date), calendarView === 'day' ? 'EEEE' : 'EEE', { locale: es })}
                  </span>
                  <span className={`font-black tracking-tight tabular-nums leading-none mt-1 ${
                    calendarView === 'day' ? 'text-2xl' : 'text-lg'
                  } ${
                    isDateToday ? 'text-white drop-shadow-md' : isWeekend ? 'text-amber-900' : 'text-indigo-900'
                  }`}>
                    {format(parseISO(date), 'd')}
                  </span>
                  <span className={`uppercase tracking-wider font-semibold leading-none mt-0.5 ${
                    calendarView === 'day' ? 'text-[9px]' : 'text-[8px]'
                  } ${
                    isDateToday ? 'text-white/80' : isWeekend ? 'text-amber-700' : 'text-indigo-600'
                  }`}>
                    {format(parseISO(date), 'MMM', { locale: es })}
                  </span>
                  {isDateToday && (
                    <span className="absolute top-1 right-1 text-[8px] font-black tracking-[0.18em] uppercase text-indigo-700 bg-white rounded-full px-1.5 py-0.5 shadow-md">HOY</span>
                  )}
                </div>

                {/* Grid de tiempo */}
                <div
                  data-grid
                  className={`relative ${isWeekend ? 'bg-gray-50/50' : ''}`}
                  style={{ height: totalHours * HOUR_HEIGHT }}
                  onPointerUp={(e) => {
                    if (!onCreateAt) return;
                    if ((e.target as HTMLElement).closest('[data-event-block]')) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    // Cancel any pending timer
                    if (gridClickTimerRef.current) clearTimeout(gridClickTimerRef.current);
                    gridClickTimerRef.current = setTimeout(() => {
                      if (clickedEventRef.current) { clickedEventRef.current = false; return; }
                      const totalMin = startHour * 60 + (clickY / HOUR_HEIGHT) * 60;
                      const snappedMin = Math.round(totalMin / SNAP_MIN) * SNAP_MIN;
                      const time = minutesToTime(snappedMin);
                      onCreateAt(date, time);
                    }, 300);
                  }}
                >
                  {/* Líneas de hora */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-gray-100 pointer-events-none"
                      style={{ top: (h - startHour) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Líneas de media hora */}
                  {hours.map((h) => (
                    <div
                      key={`half-${h}`}
                      className="absolute w-full border-t border-dashed border-gray-100 pointer-events-none"
                      style={{ top: (h - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    />
                  ))}

                  {/* Línea de "ahora" */}
                  {isDateToday && (() => {
                    void nowTick;
                    const now = new Date();
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    if (nowMinutes < startHour * 60 || nowMinutes > endHour * 60) return null;
                    const topPx = ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
                    return (
                      <div
                        className="absolute left-0 right-0 z-[3] pointer-events-none"
                        style={{ top: topPx }}
                      >
                        <span className="absolute -top-2 -left-1 bg-red-500 text-white text-[10px] font-bold rounded px-1 leading-tight">
                          {`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`}
                        </span>
                        <div className="absolute left-0 top-0 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-red-500" />
                        <div className="bg-red-500 h-[2px] rounded shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                      </div>
                    );
                  })()}

                  {/* Eventos sin hora */}
                  {untimed.map((event, i) => {
                    const colors = AGENDA_COLORS[event.type] || AGENDA_COLORS.other;
                    const typeColor = EVENT_TYPES[event.type]?.color || colors.border;
                    void nowTick;
                    const isPastBlock = isEventInPast(event, date, new Date());
                    const conflictTitles = conflicts.get(event.id) || [];
                    const hasConflict = conflictTitles.length > 0;
                    const isSelected = selectedEventIds.has(event.id);
                    return (
                      <div
                        key={event.id}
                        data-event-block
                        className={`absolute left-1 right-1 rounded-md overflow-hidden cursor-pointer hover:brightness-125 transition-all backdrop-blur-sm ${
                          isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                        }`}
                        style={{
                          top: 2 + i * 26,
                          height: 24,
                          background: `linear-gradient(135deg, ${typeColor}24 0%, rgba(255,255,255,0.78) 38%, rgba(255,255,255,0.65) 62%, ${typeColor}1c 100%)`,
                          borderLeft: `3px solid ${typeColor}`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 14px -8px ${typeColor}33`,
                          opacity: isPastBlock ? 0.55 : 1,
                          filter: isPastBlock ? 'saturate(0.5)' : 'none',
                        }}
                        title={hasConflict ? `Solapa con: ${conflictTitles.join(', ')}` : undefined}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || isMultiSelectMode) {
                            e.stopPropagation();
                            toggleSelectedEvent(event.id);
                            return;
                          }
                          onEdit(event);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({ x: e.clientX, y: e.clientY, event });
                        }}
                      >
                        <p className="px-1.5 text-[10px] font-semibold truncate leading-[24px] relative z-[1]" style={{ color: colors.text }}>
                          {event.title}
                        </p>
                        {hasConflict && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center z-[2] pointer-events-none">
                            <AlertTriangle className="text-red-500 w-3 h-3 animate-pulse" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Eventos con hora */}
                  {timed.map((event) => {
                    const isDragging = ghost?.eventId === event.id;
                    // No renderizar duplicado en día original si se arrastra a otro día
                    if (isDragging && ghost.date !== date && date === event.date) return null;

                    const pos = getBlockPosition(event, date);
                    const colors = AGENDA_COLORS[event.type] || AGENDA_COLORS.other;
                    const typeColor = EVENT_TYPES[event.type]?.color || colors.border;
                    const isFlightMulti = event.type === 'flight' && event.details?.arrivalDate && event.details.arrivalDate !== event.date;
                    const isHotelMulti = event.type === 'hotel' && event.details?.checkOutDate && event.details.checkOutDate !== event.date;
                    const isMultiDay = isFlightMulti || isHotelMulti;
                    const isContinuation = isMultiDay && date !== event.date;
                    const laneInfo = !isContinuation ? lanes.get(event.id) : undefined;
                    const conflictTitles = !isContinuation ? (conflicts.get(event.id) || []) : [];
                    const hasConflict = conflictTitles.length > 0;

                    const tzAbbr = event.timezone ? getTimezoneAbbr(event.timezone, date) : '';

                    // Duración para vuelos
                    let flightDur = '';
                    if (event.type === 'flight' && event.startTime && event.endTime && !isContinuation) {
                      const depDate = event.date;
                      const arrDate = event.details?.arrivalDate || event.date;
                      try {
                        const depMs = new Date(`${depDate}T${event.startTime}`).getTime();
                        const arrMs = new Date(`${arrDate}T${event.endTime}`).getTime();
                        let diffMs = arrMs - depMs;
                        if (event.timezone && event.details?.arrivalTimezone) {
                          const ref = new Date(`${depDate}T${event.startTime}`);
                          const getOff = (tz: string) => {
                            const s = ref.toLocaleString('en-US', { timeZone: tz });
                            return new Date(s).getTime() - ref.getTime();
                          };
                          diffMs -= getOff(event.details.arrivalTimezone) - getOff(event.timezone);
                        }
                        if (diffMs > 0) {
                          const totalMin = Math.round(diffMs / 60000);
                          const h = Math.floor(totalMin / 60);
                          const m = totalMin % 60;
                          flightDur = m > 0 ? `${h}h ${m}m` : `${h}h`;
                        }
                      } catch { /* ignore */ }
                    }

                    const isResizing = resizeGhost?.eventId === event.id && resizeGhost.date === date;
                    const resizedHeight = isResizing
                      ? Math.max(((resizeGhost.endMin - resizeGhost.startMin) / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT)
                      : pos.height;

                    void nowTick;
                    const isPastBlock = isEventInPast(event, date, new Date());

                    const isOverlay = laneInfo?.isOverlay === true;
                    const laneStyle: React.CSSProperties = isOverlay
                      ? { left: 8, right: 8 }
                      : laneInfo && laneInfo.laneCount > 1
                      ? {
                          left: `calc(${(laneInfo.laneIndex / laneInfo.laneCount) * 100}% + 4px)`,
                          width: `calc(${100 / laneInfo.laneCount}% - 8px)`,
                        }
                      : {};

                    const isSelected = selectedEventIds.has(event.id);

                    return (
                      <div
                        key={`${event.id}-${date}`}
                        data-event-block
                        className={`absolute rounded-lg overflow-hidden transition-opacity backdrop-blur-sm ${
                          isOverlay ? 'z-[5]' : 'z-[1]'
                        } ${
                          isOverlay || (laneInfo && laneInfo.laneCount > 1) ? '' : 'left-1 right-1'
                        } ${
                          isDragging ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing hover:brightness-110'
                        } ${isContinuation ? 'border-dashed' : ''} ${
                          isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                        }`}
                        style={{
                          top: Math.max(pos.top, 0),
                          height: resizedHeight,
                          background: `linear-gradient(135deg, ${typeColor}24 0%, rgba(255,255,255,0.78) 38%, rgba(255,255,255,0.65) 62%, ${typeColor}1c 100%)`,
                          borderLeft: `3px solid ${typeColor}`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 14px -8px ${typeColor}33`,
                          touchAction: 'none',
                          opacity: isPastBlock ? 0.55 : (isContinuation ? 0.6 : 1),
                          filter: isPastBlock ? 'saturate(0.5)' : 'none',
                          ...laneStyle,
                        }}
                        title={hasConflict ? `Solapa con: ${conflictTitles.join(', ')}` : undefined}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({ x: e.clientX, y: e.clientY, event });
                        }}
                        onPointerDown={!isContinuation ? (e) => {
                          // Multi-select: Cmd/Ctrl click or already in multi-select mode → toggle, no drag
                          if (e.metaKey || e.ctrlKey || isMultiSelectMode) {
                            e.stopPropagation();
                            clickedEventRef.current = true;
                            if (gridClickTimerRef.current) clearTimeout(gridClickTimerRef.current);
                            toggleSelectedEvent(event.id);
                            return;
                          }

                          const startX = e.clientX;
                          const startY = e.clientY;
                          let dragged = false;
                          // Capture rect synchronously — currentTarget gets nulled later
                          const blockEl = e.currentTarget as HTMLElement;
                          const blockRect = blockEl.getBoundingClientRect();

                          const onMove = (ev: PointerEvent) => {
                            if (dragged) return;
                            const dx = Math.abs(ev.clientX - startX);
                            const dy = Math.abs(ev.clientY - startY);
                            if (dx > 5 || dy > 5) {
                              dragged = true;
                              document.removeEventListener('pointermove', onMove);
                              document.removeEventListener('pointerup', onUp);
                              handleDragStart(event, blockRect, startY);
                            }
                          };

                          const onUp = () => {
                            document.removeEventListener('pointermove', onMove);
                            document.removeEventListener('pointerup', onUp);
                            if (!dragged) {
                              // Was a click — open edit
                              clickedEventRef.current = true;
                              if (gridClickTimerRef.current) clearTimeout(gridClickTimerRef.current);
                              onEdit(event);
                            }
                          };

                          document.addEventListener('pointermove', onMove);
                          document.addEventListener('pointerup', onUp);
                        } : undefined}
                      >
                        {resizedHeight > 60 && (
                          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
                            <EventPattern type={event.type} color={typeColor} />
                          </div>
                        )}
                        {hasConflict && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center z-[2] pointer-events-none">
                            <AlertTriangle className="text-red-500 w-3 h-3 animate-pulse" />
                          </div>
                        )}
                        <div className={`${isMobile ? 'py-0.5 px-1' : 'py-1.5 px-2'} h-full flex flex-col overflow-hidden relative z-[1] justify-start gap-0.5`}>
                          {/* Título */}
                          <p
                            className={`font-bold leading-tight truncate ${resizedHeight > 60 ? 'text-xs' : 'text-[11px]'}`}
                            style={{ color: colors.text }}
                          >
                            {isContinuation ? `↳ ${event.title}` : event.title}
                          </p>

                          {/* Contenido adicional solo si el bloque es > 40px */}
                          {resizedHeight > 40 && (
                            <>
                              {/* Hora */}
                              <p className="text-[10px] leading-tight truncate" style={{ color: "#111827" }}>
                                {isContinuation
                                  ? `→ llega ${event.endTime || ''}`
                                  : (
                                    <>
                                      {event.startTime}
                                      {tzAbbr && <span style={{ color: "#111827", fontWeight: 600 }}> ({tzAbbr})</span>}
                                      {event.endTime && ` – ${event.endTime}`}
                                      {event.details?.arrivalTimezone && (
                                        <span style={{ color: "#111827", fontWeight: 600 }}>
                                          {' '}({getTimezoneAbbr(event.details.arrivalTimezone, event.details?.arrivalDate || date)})
                                        </span>
                                      )}
                                    </>
                                  )
                                }
                              </p>

                              {/* Detalles extra para vuelos */}
                              {event.type === 'flight' && !isContinuation && resizedHeight > 60 && (
                                <p className="text-[10px] leading-tight truncate" style={{ color: "#111827" }}>
                                  {[event.details?.airline, event.details?.flightNumber].filter(Boolean).join(' · ')}
                                  {flightDur && <span style={{ color: "#111827", fontWeight: 600 }}> · {flightDur}</span>}
                                </p>
                              )}

                              {/* Confirmación (vuelos) */}
                              {event.type === 'flight' && event.details?.confirmationCode && resizedHeight > 80 && (
                                <p className="text-[10px] truncate" style={{ color: "#111827" }}>
                                  Ref: {event.details.confirmationCode}
                                </p>
                              )}

                              {/* Asiento + equipaje (vuelos) */}
                              {event.type === 'flight' && resizedHeight > 100 && (
                                <p className="text-[10px] truncate" style={{ color: "#111827" }}>
                                  {[event.details?.seatNumber && `Asiento ${event.details.seatNumber}`, event.details?.baggage].filter(Boolean).join(' · ')}
                                </p>
                              )}

                              {/* Ubicación (no vuelos) */}
                              {event.type !== 'flight' && event.location && resizedHeight > 60 && (
                                <p className="text-[10px] truncate" style={{ color: "#111827" }}>{event.location}</p>
                              )}
                            </>
                          )}


                          {/* Handle de resize (barra al fondo) */}
                          {!isContinuation && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize group/resize flex items-center justify-center pointer-events-auto"
                              onPointerDown={(e) => handleResizeStart(e, event, date)}
                            >
                              <div className="w-8 h-[3px] rounded-full bg-gray-200 group-hover/resize:bg-gray-400 transition-colors" />
                            </div>
                          )}

                          {/* Hora nueva durante resize */}
                          {isResizing && (
                            <p className="absolute bottom-2 right-1.5 text-blue-600 text-[10px] font-bold">
                              → {minutesToTime(resizeGhost.endMin)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* ─── Empty state (sin eventos) ── */}
                  {untimed.length === 0 && timed.length === 0 && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] pointer-events-auto">
                      <button
                        onClick={() => onCreateAt?.(date, '12:00')}
                        className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-gray-400 text-xs hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-colors"
                      >
                        + Agregar evento
                      </button>
                    </div>
                  )}

                  {/* ─── Ghost del drag ─────────────── */}
                  {ghost && ghost.date === date && (
                    <div
                      className="absolute left-1 right-1 rounded-lg z-[5] pointer-events-none border-2 border-dashed border-blue-400/60"
                      style={{
                        top: ((ghost.startMin - startHour * 60) / 60) * HOUR_HEIGHT,
                        height: Math.max((ghost.durationMin / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT),
                        backgroundColor: 'rgba(59,130,246,0.12)',
                      }}
                    >
                      <p className="px-2 py-1 text-blue-600 text-[11px] font-semibold">
                        {minutesToTime(ghost.startMin)} – {minutesToTime(ghost.startMin + ghost.durationMin)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Total del día */}
                <div className="h-10 border-t border-gray-200 flex items-center justify-center">
                  {total > 0 ? (
                    <span className="text-emerald-600 text-xs font-semibold">
                      {formatCurrency(total)}
                    </span>
                  ) : (
                    <span className="text-gray-200 text-[10px]">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {isMultiSelectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55] bg-white rounded-2xl shadow-2xl border border-gray-200 px-4 py-2.5 flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">
            {selectedEventIds.size} seleccionado{selectedEventIds.size !== 1 ? 's' : ''}
          </span>
          <div className="h-5 w-px bg-gray-200" />
          <button
            type="button"
            onClick={() => bulkShiftDays(-1)}
            className="text-xs font-semibold text-gray-700 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!onUpdate}
          >
            ← Día anterior
          </button>
          <button
            type="button"
            onClick={() => bulkShiftDays(1)}
            className="text-xs font-semibold text-gray-700 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!onUpdate}
          >
            Día siguiente →
          </button>
          {onDelete && (
            <>
              <div className="h-5 w-px bg-gray-200" />
              <button
                type="button"
                onClick={bulkDelete}
                className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
              >
                Eliminar
              </button>
            </>
          )}
          <div className="h-5 w-px bg-gray-200" />
          <button
            type="button"
            onClick={() => setSelectedEventIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
        </div>
      )}
      {contextMenu && (
        <>
          {/* invisible backdrop to catch outside clicks */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-[61] bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 min-w-[160px] overflow-hidden"
            style={{
              left: Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 180),
              top: Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 150),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              onClick={() => {
                onEdit(contextMenu.event);
                setContextMenu(null);
              }}
            >
              <Pencil className="w-3.5 h-3.5 text-gray-400" />
              Editar
            </button>
            {onDuplicate && (
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 transition-colors text-left"
                onClick={() => {
                  onDuplicate?.(contextMenu.event);
                  setContextMenu(null);
                }}
              >
                <Copy className="w-3.5 h-3.5 text-violet-500" />
                Duplicar
              </button>
            )}
            {onDelete && (
              <>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                  onClick={() => {
                    if (window.confirm(`Eliminar "${contextMenu.event.title}"? Esta accion no se puede deshacer.`)) {
                      onDelete?.(contextMenu.event.id);
                    }
                    setContextMenu(null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Eliminar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
