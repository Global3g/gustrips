'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Zap, ChevronRight, Sparkles, MapPin, Navigation } from 'lucide-react';
import {
  parseISO,
  startOfDay,
  differenceInDays,
  isAfter,
  isBefore,
  isEqual,
  format,
} from 'date-fns';
// Trip + events from the layout-level TripDataProvider — banner is only
// mounted inside `/trips/[tripId]/page.tsx`.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { useUserLocation } from '@/hooks/useUserLocation';
import { haversineMeters } from '@/lib/utils/geo';
import { ROUTES } from '@/config/constants';
import type { TripEvent } from '@/types';

const NEARBY_RADIUS_M = 500;

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `a ${Math.max(1, Math.round(meters))} m`;
  }
  const km = meters / 1000;
  return `a ${km.toFixed(1)} km`;
}

interface Props {
  tripId: string;
}

function formatLocalTime(now: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || undefined,
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  }
}

function timeStrToMinutes(time: string): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

function eventDateTime(event: TripEvent): Date | null {
  try {
    const base = parseISO(event.date);
    const minutes = timeStrToMinutes(event.startTime);
    if (minutes != null) {
      base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    } else {
      base.setHours(0, 0, 0, 0);
    }
    return base;
  } catch {
    return null;
  }
}

function findNextEvent(events: TripEvent[], now: Date): TripEvent | null {
  const todayStr = format(now, 'yyyy-MM-dd');

  // First: events today after current time
  const todays = events
    .filter((e) => e.date === todayStr)
    .map((e) => ({ e, dt: eventDateTime(e) }))
    .filter((x): x is { e: TripEvent; dt: Date } => x.dt != null && x.dt.getTime() > now.getTime())
    .sort((a, b) => a.dt.getTime() - b.dt.getTime());

  if (todays.length > 0) return todays[0].e;

  // Else: first event in any future day
  const futures = events
    .filter((e) => e.date > todayStr)
    .map((e) => ({ e, dt: eventDateTime(e) }))
    .filter((x): x is { e: TripEvent; dt: Date } => x.dt != null)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime());

  return futures[0]?.e ?? null;
}

function buildCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'ahora';

  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return diffDays === 1 ? 'en 1 dia' : `en ${diffDays} dias`;
  }
  if (diffHours >= 1) {
    const remMin = diffMin - diffHours * 60;
    return remMin > 0 ? `en ${diffHours}h ${remMin}min` : `en ${diffHours}h`;
  }
  return `en ${Math.max(diffMin, 1)}min`;
}

export default function CompanionBanner({ tripId }: Props) {
  const { trip } = useTrip();
  const { events } = useEvents();
  const [now, setNow] = useState<Date>(() => new Date());
  const { location, permission, request } = useUserLocation({ enabled: true });

  // Re-render every minute so countdown / clock stay fresh
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const timezone = useMemo(() => {
    return events[0]?.timezone || undefined;
  }, [events]);

  const inRange = useMemo(() => {
    if (!trip) return false;
    try {
      const today = startOfDay(now);
      const start = startOfDay(parseISO(trip.startDate));
      const end = startOfDay(parseISO(trip.endDate));
      return (
        (isAfter(today, start) || isEqual(today, start)) &&
        (isBefore(today, end) || isEqual(today, end))
      );
    } catch {
      return false;
    }
  }, [trip, now]);

  const computed = useMemo(() => {
    if (!trip) return null;
    try {
      const today = startOfDay(now);
      const start = startOfDay(parseISO(trip.startDate));
      const end = startOfDay(parseISO(trip.endDate));
      const dayNumber = differenceInDays(today, start) + 1;
      const totalDays = differenceInDays(end, start) + 1;
      const nextEvent = findNextEvent(events, now);
      const nextDt = nextEvent ? eventDateTime(nextEvent) : null;
      const countdown = nextDt ? buildCountdown(nextDt, now) : null;
      const localTime = formatLocalTime(now, timezone);
      return { dayNumber, totalDays, nextEvent, countdown, localTime };
    } catch {
      return null;
    }
  }, [trip, events, now, timezone]);

  const nearby = useMemo(() => {
    if (!location || permission !== 'granted') return null;
    let best: { event: TripEvent; distance: number } | null = null;
    for (const ev of events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const d = haversineMeters(
        { lat: location.lat, lng: location.lng },
        { lat: ev.latitude, lng: ev.longitude }
      );
      if (d <= NEARBY_RADIUS_M && (!best || d < best.distance)) {
        best = { event: ev, distance: d };
      }
    }
    return best;
  }, [events, location, permission]);

  if (!trip || !inRange || !computed) return null;

  const { dayNumber, totalDays, nextEvent, countdown, localTime } = computed;
  const showLocationCta = permission === 'prompt' || permission === 'unknown';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-emerald-500/15 via-emerald-400/8 to-sky-400/10 backdrop-blur-md p-5 sm:p-6 relative overflow-hidden"
    >
      {/* Animated orbs */}
      <motion.div
        aria-hidden
        className="absolute -top-24 -left-16 w-64 h-64 rounded-full bg-emerald-400/25 blur-3xl pointer-events-none"
        animate={{ x: [0, 20, 0], y: [0, 12, 0], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-sky-400/25 blur-3xl pointer-events-none"
        animate={{ x: [0, -16, 0], y: [0, -10, 0], opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-emerald-200 text-[11px] font-semibold tracking-[0.18em]">EN VIVO</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 text-xs font-medium backdrop-blur-sm">
            Dia {dayNumber} de {totalDays}
          </span>
        </div>

        {/* Big section: clock + local time */}
        <div className="mt-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-sm">
            <Clock className="w-6 h-6 text-emerald-100" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-4xl font-bold text-white tabular-nums tracking-tight">
              {localTime}
            </span>
            {timezone && (
              <span className="text-[11px] text-white/55 mt-0.5">{timezone}</span>
            )}
          </div>
        </div>

        {/* Geo: nearby event hint */}
        <AnimatePresence>
          {nearby && (
            <motion.div
              key={`nearby-${nearby.event.id}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="mt-4"
            >
              <Link
                href={`${ROUTES.app.itinerary(tripId)}?day=${nearby.event.date}`}
                className="group flex items-center gap-3 rounded-2xl bg-emerald-400/12 hover:bg-emerald-400/18 border border-emerald-300/30 hover:border-emerald-300/50 px-4 py-3 transition-colors"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <Sparkles className="w-4 h-4 text-emerald-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">
                    Estás cerca de{' '}
                    <span className="text-white font-semibold">{nearby.event.title}</span>
                    <span className="text-emerald-200/90"> · {formatDistance(nearby.distance)}</span>
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-100/70 group-hover:text-white transition-colors shrink-0" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Geo: permission CTA */}
        {!nearby && showLocationCta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mt-4 flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5"
          >
            <MapPin className="w-4 h-4 text-emerald-200 shrink-0" />
            <p className="text-white/75 text-xs flex-1">
              Activa tu ubicación para ver eventos cercanos
            </p>
            <button
              type="button"
              onClick={request}
              className="text-xs px-2.5 py-1 rounded-full bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-300/30 text-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <Navigation className="w-3 h-3" />
              Activar ubicación
            </button>
          </motion.div>
        )}

        {/* Bottom: next event */}
        <div className="mt-5">
          {nextEvent ? (
            <Link
              href={`${ROUTES.app.itinerary(tripId)}?day=${nextEvent.date}`}
              className="group flex items-center gap-3 rounded-2xl bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20 px-4 py-3 transition-colors"
            >
              <Zap className="w-4 h-4 text-amber-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white/90 text-sm font-medium truncate">
                  Siguiente: <span className="text-white">{nextEvent.title}</span>
                  {countdown && (
                    <span className="text-emerald-200/90"> · {countdown}</span>
                  )}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors shrink-0" />
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-white/8 border border-white/10 px-4 py-3">
              <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
              <p className="text-white/90 text-sm font-medium flex-1">
                Dia libre — ¿que planeas?
              </p>
              <Link
                href={ROUTES.app.itinerary(tripId)}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/30 text-amber-100 transition-colors"
              >
                Agregar
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
