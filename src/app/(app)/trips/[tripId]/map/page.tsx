'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { motion } from 'framer-motion';
import { Map, MapPin, CalendarDays, Clock, Loader2 } from 'lucide-react';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useGeocode } from '@/hooks/useGeocode';
import { EVENT_TYPES } from '@/config/constants';
import { formatCurrency, formatDateHeaderES } from '@/lib/utils/helpers';
import type { TripEvent, EventType } from '@/types';

/* Dynamic import for MapView (Leaflet requires client-only) */
const MapView = dynamic(() => import('@/components/trips/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] lg:h-[500px] rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-2 animate-pulse">
          <Map className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-sm text-gray-400">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trip } = useTrip(tripId);
  const { events, loading: eventsLoading } = useEvents(tripId);
  const { geocodedEvents, loading: geocoding } = useGeocode(events);

  // Build events with coordinates (either original or geocoded)
  const eventsWithCoords = useMemo(
    () => geocodedEvents
      .filter((e) => (e.latitude != null && e.longitude != null) || (e._geoLat != null && e._geoLng != null))
      .map((e) => ({
        ...e,
        latitude: e.latitude ?? e._geoLat,
        longitude: e.longitude ?? e._geoLng,
      })),
    [geocodedEvents],
  );

  const eventsWithLocation = useMemo(
    () => events.filter((e) => e.location && e.location.trim().length > 0),
    [events],
  );

  /* ── Trip days for day numbering ── */
  const tripDays = useMemo(() => {
    if (!trip) return {};
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const days = eachDayOfInterval({ start, end });
      const map: Record<string, number> = {};
      days.forEach((d, i) => {
        map[format(d, 'yyyy-MM-dd')] = i + 1;
      });
      return map;
    } catch {
      return {};
    }
  }, [trip]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof eventsWithCoords> = {};
    for (const event of eventsWithCoords) {
      const key = event.date || 'sin-fecha';
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    }
    return groups;
  }, [eventsWithCoords]);

  const sortedDates = Object.keys(groupedByDate).sort();

  const formatDateHeader = (dateStr: string): string => {
    if (dateStr === 'sin-fecha') return 'Sin fecha';
    const dayNum = tripDays[dateStr];
    const headerLabel = formatDateHeaderES(dateStr);
    return dayNum ? `Dia ${dayNum} — ${headerLabel}` : headerLabel;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Map className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Mapa del Viaje</h1>
          <p className="text-sm text-gray-500">
            {eventsWithCoords.length === 0 && !geocoding
              ? 'Agrega ubicaciones a tus eventos para verlos aqui'
              : `${eventsWithCoords.length} de ${eventsWithLocation.length} ubicaciones en el mapa`}
          </p>
        </div>
        {geocoding && (
          <div className="flex items-center gap-2 text-xs text-blue-500 bg-blue-50 px-3 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Ubicando...
          </div>
        )}
      </div>

      {/* Map */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <MapView
          events={eventsWithCoords as TripEvent[]}
          className="h-[400px] lg:h-[500px] rounded-2xl"
        />
      </div>

      {eventsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : eventsWithCoords.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-bold text-gray-800">
            Ubicaciones por dia
          </h2>

          {sortedDates.map((dateKey) => {
            const dayEvents = groupedByDate[dateKey];

            return (
              <div key={dateKey} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-sm font-bold text-gray-700">
                    {formatDateHeader(dateKey)}
                  </span>
                </div>

                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const typeConfig = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.other;

                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: typeConfig.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {event.title}
                          </p>
                          {event.location && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </p>
                          )}
                        </div>
                        {event.startTime && (
                          <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />
                            {event.startTime}
                          </span>
                        )}
                        {event.cost > 0 && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatCurrency(event.cost, event.currency)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>
      ) : null}
    </div>
  );
}
