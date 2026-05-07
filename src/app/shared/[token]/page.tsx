'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { motion } from 'framer-motion';
import {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  MoreHorizontal,
  CalendarDays,
  Clock,
  DollarSign,
  Globe,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EVENT_TYPES } from '@/config/constants';
import { classNames, formatCurrency, glassStyle, formatDateES, formatDateHeaderES } from '@/lib/utils/helpers';
import type { Trip, TripEvent, EventType } from '@/types';

// ─── Icon map ───────────────────────────────────────

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
  misc: 'bg-gray-100 text-gray-500',
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

// ─── Helpers ────────────────────────────────────────

function formatDate(dateStr: string): string {
  return formatDateES(dateStr);
}

function formatDateHeader(dateStr: string): string {
  return formatDateHeaderES(dateStr);
}

// ─── Component ──────────────────────────────────────

export default function SharedTripPage() {
  const params = useParams();
  const token = params.token as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchSharedTrip = async () => {
      try {
        const db = getClientDb();

        // Query trip by shareToken
        const tripsRef = collection(db, 'trips');
        const q = query(tripsRef, where('shareToken', '==', token));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const tripDoc = snapshot.docs[0];
        const tripData = { id: tripDoc.id, ...tripDoc.data() } as Trip;
        setTrip(tripData);

        // Fetch events
        const eventsRef = collection(db, `trips/${tripDoc.id}/events`);
        const eventsQuery = query(eventsRef, orderBy('date', 'asc'), orderBy('startTime', 'asc'));
        const eventsSnap = await getDocs(eventsQuery);
        const eventsData = eventsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as TripEvent[];
        setEvents(eventsData);
      } catch (error) {
        console.error('Error al cargar viaje compartido:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedTrip();
  }, [token]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Globe className="w-10 h-10 text-gray-200" />
          </div>
          <h1 className="text-gray-900 text-2xl font-bold mb-2">Viaje no encontrado</h1>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Este enlace no es valido o el viaje ya no esta compartido.
          </p>
        </div>
      </div>
    );
  }

  // ── Group events by date ──
  const groupedByDate = events.reduce(
    (groups, event) => {
      const key = event.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
      return groups;
    },
    {} as Record<string, TripEvent[]>,
  );
  const sortedDates = Object.keys(groupedByDate).sort();

  // ── Total cost ──
  const totalCost = events.reduce((sum, ev) => sum + (ev.cost || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 text-blue-600 text-xs font-medium mb-3">
              <Globe className="w-3.5 h-3.5" />
              <span>Viaje compartido via GusTrips</span>
            </div>
            <h1 className="text-gray-900 text-3xl font-bold mb-2">{trip.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-gray-600 text-sm">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {trip.destination}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
              </span>
            </div>
            {trip.description && (
              <p className="text-gray-400 text-sm mt-4 leading-relaxed max-w-xl">
                {trip.description}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8"
        >
          <div className="rounded-xl p-4" style={glassStyle}>
            <p className="text-gray-400 text-xs mb-1">Eventos</p>
            <p className="text-gray-900 text-xl font-bold">{events.length}</p>
          </div>
          <div className="rounded-xl p-4" style={glassStyle}>
            <p className="text-gray-400 text-xs mb-1">Dias</p>
            <p className="text-gray-900 text-xl font-bold">{sortedDates.length}</p>
          </div>
          {totalCost > 0 && (
            <div className="rounded-xl p-4 col-span-2 sm:col-span-1" style={glassStyle}>
              <p className="text-gray-400 text-xs mb-1">Costo Total</p>
              <p className="text-emerald-600 text-xl font-bold">{formatCurrency(totalCost)}</p>
            </div>
          )}
        </motion.div>

        {/* Events by date */}
        {sortedDates.length === 0 ? (
          <div className="text-center py-16">
            <Plane className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Este viaje aun no tiene eventos</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedDates.map((dateKey, index) => {
              const dayEvents = groupedByDate[dateKey];

              return (
                <motion.div
                  key={dateKey}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.05, duration: 0.4 }}
                >
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                    </div>
                    <h2 className="text-gray-900 font-semibold text-sm">
                      {formatDateHeader(dateKey)}
                    </h2>
                    <div className="flex-1 h-px bg-gray-50" />
                    <span className="text-gray-300 text-xs">
                      {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  </div>

                  {/* Event cards */}
                  <div className="space-y-3 pl-4 border-l-2 border-gray-200 ml-4">
                    {dayEvents.map((event) => {
                      const typeConfig = EVENT_TYPES[event.type];
                      const Icon = ICON_MAP[typeConfig.icon] || MoreHorizontal;

                      return (
                        <div
                          key={event.id}
                          className={classNames(
                            'rounded-xl border-l-4 p-4',
                            BORDER_COLORS[event.type],
                          )}
                          style={glassStyle}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={classNames(
                                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                BG_ICON_COLORS[event.type],
                              )}
                            >
                              <Icon className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="text-gray-900 font-semibold text-sm">{event.title}</h3>
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

                              <div className="mt-2 space-y-1">
                                {(event.startTime || event.endTime) && (
                                  <p className="flex items-center gap-1.5 text-gray-500 text-xs">
                                    <Clock className="w-3 h-3 flex-shrink-0" />
                                    {[event.startTime, event.endTime].filter(Boolean).join(' - ')}
                                  </p>
                                )}
                                {event.location && (
                                  <p className="flex items-center gap-1.5 text-gray-500 text-xs">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    {event.location}
                                  </p>
                                )}
                              </div>

                              {event.notes && (
                                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                                  {event.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pt-6 border-t border-gray-200">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors text-xs"
          >
            <Globe className="w-3 h-3" />
            Powered by <span className="font-semibold text-gray-500">GusTrips</span>
          </a>
          <p className="text-gray-300 text-[10px] mt-1">
            Organiza tus viajes en grupo de forma colaborativa
          </p>
        </div>
      </div>
    </div>
  );
}
