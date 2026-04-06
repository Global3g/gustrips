'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { format, parseISO, eachDayOfInterval, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { GripVertical } from 'lucide-react';
import { EVENT_TYPES } from '@/config/constants';
import { formatCurrency, getTimezoneAbbr } from '@/lib/utils/helpers';
import type { TripEvent } from '@/types';

/* ─── Constantes ──────────────────────────────────── */

const HOUR_HEIGHT = 40;
const MIN_BLOCK_HEIGHT = 20;
const DAY_COL_MIN_W = 170;
const SNAP_MIN = 15;

/* ─── Colores más intensos por tipo (fondo y texto) ─ */

const AGENDA_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  flight:     { bg: 'rgba(6,182,212,0.25)',   border: '#06b6d4', text: '#22d3ee' },   // cyan
  hotel:      { bg: 'rgba(139,92,246,0.25)',  border: '#8b5cf6', text: '#a78bfa' },   // violet
  car_rental: { bg: 'rgba(234,179,8,0.25)',   border: '#eab308', text: '#facc15' },   // yellow
  activity:   { bg: 'rgba(34,197,94,0.25)',   border: '#22c55e', text: '#4ade80' },   // green
  restaurant: { bg: 'rgba(249,115,22,0.25)',  border: '#f97316', text: '#fb923c' },   // orange
  transport:  { bg: 'rgba(59,130,246,0.25)',  border: '#3b82f6', text: '#60a5fa' },   // blue
  other:      { bg: 'rgba(107,114,128,0.25)', border: '#6b7280', text: '#9ca3af' },   // gray
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
  onUpdate: (eventId: string, data: Partial<TripEvent>) => Promise<void>;
}

/* ─── Componente ──────────────────────────────────── */

export default function AgendaView({ events, onEdit, onUpdate }: AgendaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragInfoRef = useRef<{ event: TripEvent; durationMin: number; offsetY: number } | null>(null);
  const ghostRef = useRef<DragGhost | null>(null);

  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const resizeInfoRef = useRef<{ event: TripEvent; startMin: number } | null>(null);
  const resizeGhostRef = useRef<ResizeGhost | null>(null);
  const [resizeGhost, setResizeGhost] = useState<ResizeGhost | null>(null);

  // Sync refs with state
  useEffect(() => { ghostRef.current = ghost; }, [ghost]);
  useEffect(() => { resizeGhostRef.current = resizeGhost; }, [resizeGhost]);

  /* ─── Derivar fechas ────────────────────────────── */

  const dates = useMemo(() => {
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
  }, [events]);

  /* ─── Rango de horas ────────────────────────────── */

  const { startHour, endHour } = useMemo(() => {
    return { startHour: 6, endHour: 24 }; // Siempre 6 AM a medianoche
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
    const first = events.find((e) => e.startTime);
    if (first) {
      const min = timeToMinutes(first.startTime);
      scrollRef.current.scrollTop = Math.max(0, ((min / 60) - startHour - 0.5) * HOUR_HEIGHT);
    }
  }, [events, startHour]);

  /* ─── Drag & Drop ──────────────────────────────── */

  const handleDragStart = useCallback((e: React.PointerEvent, event: TripEvent) => {
    if (!event.startTime) return;
    e.preventDefault();
    e.stopPropagation();

    const block = e.currentTarget as HTMLElement;
    const rect = block.getBoundingClientRect();

    const sm = timeToMinutes(event.startTime);
    const em = event.endTime ? timeToMinutes(event.endTime) : sm + 60;
    let dur = em - sm;
    // Vuelo que cruza medianoche
    if (dur <= 0) dur = 60;

    dragInfoRef.current = {
      event,
      durationMin: dur,
      offsetY: e.clientY - rect.top,
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

          onUpdate(drag.event.id, updates);
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
          onUpdate(info.event.id, { endTime: newEndTime });
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

  if (dates.length === 0) return null;

  /* ─── Render ────────────────────────────────────── */

  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/60 overflow-hidden">
      <div ref={scrollRef} className="overflow-auto max-h-[85vh]">
        <div className="flex min-w-max">

          {/* ─── Columna de horas (sticky) ──────── */}
          <div className="w-14 flex-shrink-0 sticky left-0 z-20 bg-gray-900">
            <div className="h-12 border-b border-white/10" />
            <div className="relative" style={{ height: totalHours * HOUR_HEIGHT }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-2"
                  style={{ top: (h - startHour) * HOUR_HEIGHT }}
                >
                  <span className="text-white/25 text-[10px] font-mono leading-none relative -top-[5px]">
                    {formatHour(h)}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-10 border-t border-white/10" />
          </div>

          {/* ─── Columnas de días ───────────────── */}
          {dates.map((date) => {
            const { timed, untimed } = eventsByDate[date];
            const isWeekend = [0, 6].includes(parseISO(date).getDay());
            const total = dayTotals[date];

            return (
              <div
                key={date}
                ref={(el) => { if (el) colRefs.current.set(date, el); }}
                className="border-l border-white/10"
                style={{ minWidth: DAY_COL_MIN_W }}
              >
                {/* Header del día */}
                <div
                  className={`h-12 flex flex-col items-center justify-center border-b border-white/10 sticky top-0 z-10 ${
                    isWeekend ? 'bg-gray-800' : 'bg-gray-900'
                  }`}
                >
                  <span className="text-white/40 text-[10px] uppercase tracking-wide">
                    {format(parseISO(date), 'EEE', { locale: es })}
                  </span>
                  <span className="text-white text-xs font-bold">
                    {format(parseISO(date), 'd MMM', { locale: es })}
                  </span>
                </div>

                {/* Grid de tiempo */}
                <div
                  data-grid
                  className={`relative ${isWeekend ? 'bg-white/[0.015]' : ''}`}
                  style={{ height: totalHours * HOUR_HEIGHT }}
                >
                  {/* Líneas de hora */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-white/[0.06]"
                      style={{ top: (h - startHour) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Eventos sin hora */}
                  {untimed.map((event, i) => {
                    const colors = AGENDA_COLORS[event.type] || AGENDA_COLORS.other;
                    return (
                      <div
                        key={event.id}
                        className="absolute left-1 right-1 rounded-md overflow-hidden cursor-pointer hover:brightness-125 transition-all"
                        style={{
                          top: 2 + i * 26,
                          height: 24,
                          backgroundColor: colors.bg,
                          borderLeft: `3px solid ${colors.border}`,
                        }}
                        onClick={() => onEdit(event)}
                      >
                        <p className="px-1.5 text-[10px] font-semibold truncate leading-[24px]" style={{ color: colors.text }}>
                          {event.title}
                        </p>
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
                    const isFlightMulti = event.type === 'flight' && event.details?.arrivalDate && event.details.arrivalDate !== event.date;
                    const isHotelMulti = event.type === 'hotel' && event.details?.checkOutDate && event.details.checkOutDate !== event.date;
                    const isMultiDay = isFlightMulti || isHotelMulti;
                    const isContinuation = isMultiDay && date !== event.date;

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

                    return (
                      <div
                        key={`${event.id}-${date}`}
                        className={`absolute left-1 right-1 rounded-lg overflow-hidden z-[1] transition-opacity ${
                          isDragging ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing hover:brightness-110'
                        } ${isContinuation ? 'opacity-60 border-dashed' : ''}`}
                        style={{
                          top: Math.max(pos.top, 0),
                          height: resizedHeight,
                          backgroundColor: colors.bg,
                          borderLeft: `3px solid ${colors.border}`,
                          touchAction: 'none',
                        }}
                        onPointerDown={!isContinuation ? (e) => handleDragStart(e, event) : undefined}
                        onClick={isContinuation ? undefined : (e) => {
                          if (!dragInfoRef.current) onEdit(event);
                        }}
                      >
                        <div className="px-1.5 py-0.5 h-full flex flex-col overflow-hidden relative">
                          {/* Grip + título */}
                          <div className="flex items-start gap-0.5">
                            {!isContinuation && (
                              <GripVertical className="w-3 h-3 flex-shrink-0 mt-px opacity-30" style={{ color: colors.text }} />
                            )}
                            <p className="text-[10px] font-bold leading-tight truncate flex-1" style={{ color: colors.text }}>
                              {isContinuation ? `↳ ${event.title}` : event.title}
                            </p>
                          </div>

                          {/* Detalles extra para vuelos */}
                          {event.type === 'flight' && !isContinuation && (
                            <p className="text-white/40 text-[9px] leading-tight truncate">
                              {[event.details?.airline, event.details?.flightNumber].filter(Boolean).join(' · ')}
                              {flightDur && <span className="text-cyan-400/70 font-semibold"> · {flightDur}</span>}
                            </p>
                          )}

                          {/* Hora + timezone */}
                          <p className="text-white/50 text-[9px] leading-tight truncate">
                            {isContinuation
                              ? `→ llega ${event.endTime || ''}`
                              : (
                                <>
                                  {event.startTime}
                                  {tzAbbr && <span className="text-amber-400/60"> ({tzAbbr})</span>}
                                  {event.endTime && ` – ${event.endTime}`}
                                  {event.details?.arrivalTimezone && (
                                    <span className="text-amber-400/60">
                                      {' '}({getTimezoneAbbr(event.details.arrivalTimezone, event.details?.arrivalDate || date)})
                                    </span>
                                  )}
                                </>
                              )
                            }
                          </p>

                          {/* Confirmación (vuelos) */}
                          {event.type === 'flight' && event.details?.confirmationCode && pos.height > 30 && (
                            <p className="text-white/30 text-[9px] truncate">
                              Ref: {event.details.confirmationCode}
                            </p>
                          )}

                          {/* Asiento + equipaje (vuelos) */}
                          {event.type === 'flight' && pos.height > 40 && (
                            <p className="text-white/25 text-[9px] truncate">
                              {[event.details?.seatNumber && `Asiento ${event.details.seatNumber}`, event.details?.baggage].filter(Boolean).join(' · ')}
                            </p>
                          )}

                          {/* Ubicación (no vuelos) */}
                          {event.type !== 'flight' && pos.height > 30 && event.location && (
                            <p className="text-white/25 text-[9px] truncate mt-auto">{event.location}</p>
                          )}

                          {/* Costo */}
                          {event.cost > 0 && pos.height > 25 && (
                            <p className="text-emerald-400/60 text-[9px] font-semibold mt-auto">
                              {formatCurrency(event.cost, event.currency)}
                            </p>
                          )}

                          {/* Handle de resize (barra al fondo) */}
                          {!isContinuation && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize group/resize flex items-center justify-center"
                              onPointerDown={(e) => handleResizeStart(e, event, date)}
                            >
                              <div className="w-8 h-[3px] rounded-full bg-white/15 group-hover/resize:bg-white/40 transition-colors" />
                            </div>
                          )}

                          {/* Hora nueva durante resize */}
                          {isResizing && (
                            <p className="absolute bottom-2 right-1.5 text-blue-400 text-[9px] font-bold">
                              → {minutesToTime(resizeGhost.endMin)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

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
                      <p className="px-2 py-1 text-blue-400 text-[11px] font-semibold">
                        {minutesToTime(ghost.startMin)} – {minutesToTime(ghost.startMin + ghost.durationMin)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Total del día */}
                <div className="h-10 border-t border-white/10 flex items-center justify-center">
                  {total > 0 ? (
                    <span className="text-emerald-400/80 text-xs font-semibold">
                      {formatCurrency(total)}
                    </span>
                  ) : (
                    <span className="text-white/15 text-[10px]">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
