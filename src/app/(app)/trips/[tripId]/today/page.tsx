'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { format, parseISO, differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns';
import { formatDateHeaderES } from '@/lib/utils/helpers';
import {
  CalendarDays,
  Clock,
  MapPin,
  DollarSign,
  Plane,
  Hotel,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  MoreHorizontal,
  CalendarCheck,
  Sunset,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
// Trip + events come from the layout-level TripDataProvider.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { EVENT_TYPES, ROUTES } from '@/config/constants';
import { classNames, formatCurrency } from '@/lib/utils/helpers';
import type { EventType } from '@/types';

/* ─── Icon map ─────────────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  MoreHorizontal,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
};

const BG_ICON_COLORS: Record<EventType, string> = {
  flight: 'bg-cyan-50 text-cyan-600',
  hotel: 'bg-violet-50 text-violet-600',
  car_rental: 'bg-yellow-50 text-yellow-600',
  activity: 'bg-green-50 text-green-600',
  restaurant: 'bg-orange-50 text-orange-600',
  transport: 'bg-blue-50 text-blue-600',
  cruise: 'bg-sky-50 text-sky-600',
  souvenirs: 'bg-pink-50 text-pink-600',
  snacks: 'bg-amber-50 text-amber-600',
  clothing: 'bg-rose-50 text-rose-600',
  fuel: 'bg-lime-50 text-lime-600',
  misc: 'bg-gray-50 text-gray-600',
};

const BORDER_COLORS: Record<EventType, string> = {
  flight: 'border-l-cyan-400',
  hotel: 'border-l-violet-400',
  car_rental: 'border-l-yellow-400',
  activity: 'border-l-green-400',
  restaurant: 'border-l-orange-400',
  transport: 'border-l-blue-400',
  cruise: 'border-l-sky-400',
  souvenirs: 'border-l-pink-400',
  snacks: 'border-l-amber-400',
  clothing: 'border-l-rose-400',
  fuel: 'border-l-lime-400',
  misc: 'border-l-gray-400',
};

/* ─── Component ────────────────────────────────────── */

export default function TodayPage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const { trip, loading: tripLoading } = useTrip();
  const { events, loading: eventsLoading } = useEvents();

  const loading = tripLoading || eventsLoading;

  const todayStr = useMemo(() => {
    return format(new Date(), 'yyyy-MM-dd');
  }, []);

  const todayEvents = useMemo(() => {
    return events.filter((e) => e.date === todayStr);
  }, [events, todayStr]);

  const tripState = useMemo(() => {
    if (!trip) return 'loading';
    const today = startOfDay(new Date());
    const start = startOfDay(parseISO(trip.startDate));
    const end = startOfDay(parseISO(trip.endDate));

    if (isBefore(today, start)) {
      const days = differenceInDays(start, today);
      return { type: 'upcoming' as const, days };
    }
    if (isAfter(today, end)) {
      return { type: 'ended' as const };
    }
    const dayNumber = differenceInDays(today, start) + 1;
    const totalDays = differenceInDays(end, start) + 1;
    return { type: 'active' as const, dayNumber, totalDays };
  }, [trip]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600">Viaje no encontrado</p>
      </div>
    );
  }

  const todayFormatted = formatDateHeaderES(format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Hoy</h1>
        <p className="text-gray-400 text-sm capitalize">{todayFormatted}</p>
      </div>

      {/* Trip state banners */}
      {typeof tripState === 'object' && tripState.type === 'upcoming' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute w-24 h-24 bg-amber-50 rounded-full" />
            <div className="relative w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
              <CalendarCheck className="w-10 h-10 text-amber-400/60" />
            </div>
          </div>
          <h3 className="text-gray-700 text-lg font-bold mb-2">
            Faltan {tripState.days} {tripState.days === 1 ? 'dia' : 'dias'}
          </h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto mb-4">
            Tu viaje a <span className="text-gray-600 font-medium">{trip.destination}</span> comienza el{' '}
            {formatDateHeaderES(trip.startDate)}
          </p>
          <Link
            href={ROUTES.app.trip(tripId) + '/itinerary'}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            Ver itinerario
          </Link>
        </motion.div>
      )}

      {typeof tripState === 'object' && tripState.type === 'ended' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute w-24 h-24 bg-blue-50 rounded-full" />
            <div className="relative w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Sunset className="w-10 h-10 text-blue-400/60" />
            </div>
          </div>
          <h3 className="text-gray-700 text-lg font-bold mb-2">
            Este viaje ya termino
          </h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto mb-4">
            Tu viaje a <span className="text-gray-600 font-medium">{trip.destination}</span> finalizo el{' '}
            {formatDateHeaderES(trip.endDate)}
          </p>
          <Link
            href={ROUTES.app.trip(tripId) + '/itinerary'}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            Ver itinerario completo
          </Link>
        </motion.div>
      )}

      {/* Active trip with today's events */}
      {typeof tripState === 'object' && tripState.type === 'active' && (
        <>
          {/* Day indicator */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 text-sm font-semibold">
                Dia {tripState.dayNumber} de {tripState.totalDays}
              </span>
              <span className="text-gray-300 text-xs">
                en {trip.destination}
              </span>
            </div>
          </motion.div>

          {todayEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center py-12"
            >
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="absolute w-20 h-20 bg-gray-50 rounded-full" />
                <div className="relative w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <CalendarDays className="w-8 h-8 text-blue-300" />
                </div>
              </div>
              <h3 className="text-gray-600 text-base font-semibold mb-2">
                Sin eventos para hoy
              </h3>
              <p className="text-gray-300 text-sm max-w-xs mx-auto mb-4">
                Aprovecha el dia libre o revisa el itinerario para agregar algo
              </p>
              <Link
                href={ROUTES.app.trip(tripId) + '/itinerary'}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
              >
                <CalendarDays className="w-4 h-4" />
                Revisar itinerario
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {todayEvents.map((event, index) => {
                const typeConfig = EVENT_TYPES[event.type];
                const Icon = ICON_MAP[typeConfig.icon] || MoreHorizontal;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.06 }}
                    className={classNames(
                      'glass rounded-xl border-l-4 p-4',
                      BORDER_COLORS[event.type],
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={classNames(
                          'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                          BG_ICON_COLORS[event.type],
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-gray-900 font-semibold text-sm">
                              {event.title}
                            </h3>
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1"
                              style={{
                                backgroundColor: `${typeConfig.color}25`,
                                color: typeConfig.color,
                              }}
                            >
                              {typeConfig.label}
                            </span>
                          </div>
                          {event.cost > 0 && (
                            <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium flex-shrink-0">
                              <DollarSign className="w-3.5 h-3.5" />
                              {formatCurrency(event.cost, event.currency)}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 space-y-1.5">
                          {(event.startTime || event.endTime) && (
                            <p className="flex items-center gap-1.5 text-gray-600 text-xs">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />
                              {[event.startTime, event.endTime].filter(Boolean).join(' - ')}
                            </p>
                          )}
                          {event.location && (
                            <p className="flex items-center gap-1.5 text-gray-600 text-xs">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />
                              {event.location}
                            </p>
                          )}
                        </div>

                        {event.notes && (
                          <p className="text-gray-400 text-xs mt-3 leading-relaxed">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Summary */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="pt-4 text-center"
              >
                <p className="text-gray-200 text-xs">
                  {todayEvents.length} {todayEvents.length === 1 ? 'evento' : 'eventos'} hoy
                </p>
              </motion.div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
