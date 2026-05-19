'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  Map,
  MapPin,
  CalendarDays,
  Filter,
  Navigation,
  Clock,
  Loader2,
  Plane,
  Hotel,
  CarFront,
  UtensilsCrossed,
  Car,
  Ship,
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
import { useGeocode } from '@/hooks/useGeocode';
import Particles from '@/components/ui/Particles';
import { EVENT_TYPES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import type { TripEvent, EventType } from '@/types';

/* ── Icon map for event types ─────────────────────── */
const EVENT_ICON_MAP: Record<EventType, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: CarFront,
  activity: MapPin,
  restaurant: UtensilsCrossed,
  transport: Car,
  cruise: Ship,
  souvenirs: Gift,
  snacks: Coffee,
  clothing: ShoppingBag,
  fuel: Fuel,
  misc: Package,
};

/* ── Haversine distance (km) ──────────────────────── */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ── Dynamic import for MapView ───────────────────── */
const MapView = dynamic(() => import('@/components/trips/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-[50vh] sm:h-[60vh] w-full flex items-center justify-center bg-[#0d1b2e]">
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-sky-300/30"
          style={{
            background: 'linear-gradient(135deg, rgba(125,211,252,0.18), rgba(125,211,252,0.06))',
            boxShadow: '0 0 20px rgba(125,211,252,0.25)',
          }}
        >
          <Map className="w-6 h-6 text-sky-200 animate-pulse" />
        </div>
        <p className="text-sm text-white/60">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trip } = useTrip();
  const { events, loading: eventsLoading } = useEvents();
  const { geocodedEvents, loading: geocoding } = useGeocode(events);

  /* ── Filter state ─── */
  const [activeDay, setActiveDay] = useState<string | null>(null); // null = all
  const [activeType, setActiveType] = useState<EventType | null>(null); // null = all
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; key: number } | null>(null);

  /* ── Build events with coordinates (either original or geocoded) ─── */
  const eventsWithCoords = useMemo(
    () =>
      geocodedEvents
        .filter(
          (e) =>
            (e.latitude != null && e.longitude != null) ||
            (e._geoLat != null && e._geoLng != null),
        )
        .map((e) => ({
          ...e,
          latitude: e.latitude ?? e._geoLat,
          longitude: e.longitude ?? e._geoLng,
        })),
    [geocodedEvents],
  );

  /* ── Trip days for day numbering ─── */
  const tripDayList = useMemo(() => {
    if (!trip) return [] as { date: string; dayNumber: number }[];
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const days = eachDayOfInterval({ start, end });
      return days.map((d, i) => ({
        date: format(d, 'yyyy-MM-dd'),
        dayNumber: i + 1,
      }));
    } catch {
      return [];
    }
  }, [trip]);

  /* ── Stats ─── */
  const stats = useMemo(() => {
    const eventsCount = eventsWithCoords.length;

    const cities = new Set<string>();
    for (const e of eventsWithCoords) {
      const c = (e.city ?? '').trim();
      if (c) cities.add(c.toLowerCase());
    }

    /* Distance: sum haversine between consecutive events with coords, sorted by date+time */
    const sorted = [...eventsWithCoords].sort((a, b) => {
      const ad = `${a.date ?? ''} ${a.startTime ?? ''}`;
      const bd = `${b.date ?? ''} ${b.startTime ?? ''}`;
      return ad.localeCompare(bd);
    });
    let kmTotal = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (
        prev.latitude != null &&
        prev.longitude != null &&
        cur.latitude != null &&
        cur.longitude != null
      ) {
        kmTotal += haversineKm(
          [prev.latitude, prev.longitude],
          [cur.latitude, cur.longitude],
        );
      }
    }

    return {
      eventsCount,
      citiesCount: cities.size,
      kmTotal: Math.round(kmTotal),
      daysCount: tripDayList.length,
    };
  }, [eventsWithCoords, tripDayList]);

  /* ── Available types from events on the map ─── */
  const availableTypes = useMemo(() => {
    const set = new Set<EventType>();
    for (const e of eventsWithCoords) set.add(e.type);
    return Array.from(set);
  }, [eventsWithCoords]);

  /* ── Apply filters ─── */
  const filteredEvents = useMemo(() => {
    return eventsWithCoords.filter((e) => {
      if (activeDay && e.date !== activeDay) return false;
      if (activeType && e.type !== activeType) return false;
      return true;
    });
  }, [eventsWithCoords, activeDay, activeType]);

  /* ── Sorted list (date+time) for the bottom event list ─── */
  const sortedFiltered = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const ad = `${a.date ?? ''} ${a.startTime ?? ''}`;
      const bd = `${b.date ?? ''} ${b.startTime ?? ''}`;
      return ad.localeCompare(bd);
    });
  }, [filteredEvents]);

  /* ── Click on a list item: highlight + (try) fly to ─── */
  const handleSelectEvent = (e: typeof eventsWithCoords[number]) => {
    setHighlightedId(e.id);
    if (e.latitude != null && e.longitude != null) {
      setFlyTo({ lat: e.latitude, lng: e.longitude, key: Date.now() });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="map-stage relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
    >
      {/* Visual layer */}
      <div className="absolute inset-0 pointer-events-none">
        <Particles count={28} />
        <div
          className="absolute -top-12 left-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.18), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }}
        />
        <div
          className="absolute bottom-12 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.16), transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* Hero header */}
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-sky-300/30"
            style={{
              background: 'linear-gradient(135deg, rgba(125,211,252,0.18), rgba(125,211,252,0.06))',
              boxShadow: '0 0 20px rgba(125,211,252,0.25)',
            }}
          >
            <Map className="w-6 h-6 text-sky-200" />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ffffff 0%, #e0f2fe 60%, #7dd3fc 100%)',
              }}
            >
              Mapa del viaje
            </h1>
            <p className="text-white/55 text-[12px] mt-0.5">
              {stats.eventsCount} eventos ubicados &middot; {stats.kmTotal.toLocaleString('es-MX')} km recorridos &middot; {stats.daysCount} {stats.daysCount === 1 ? 'dia' : 'dias'}
            </p>
          </div>
          {geocoding && (
            <div className="flex items-center gap-2 text-[11px] text-sky-100 bg-sky-400/10 border border-sky-300/30 px-3 py-1.5 rounded-full backdrop-blur-sm flex-shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Ubicando...
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<MapPin className="w-5 h-5 text-sky-200" />}
            label="Eventos en mapa"
            value={stats.eventsCount.toString()}
            tint="rgba(125,211,252,0.18)"
            border="rgba(125,211,252,0.30)"
          />
          <StatCard
            icon={<Navigation className="w-5 h-5 text-indigo-200" />}
            label="Ciudades"
            value={stats.citiesCount.toString()}
            tint="rgba(129,140,248,0.20)"
            border="rgba(129,140,248,0.30)"
          />
          <StatCard
            icon={<CalendarDays className="w-5 h-5 text-pink-200" />}
            label="Km recorridos"
            value={stats.kmTotal.toLocaleString('es-MX')}
            tint="rgba(244,114,182,0.18)"
            border="rgba(244,114,182,0.30)"
          />
        </div>

        {/* Day filter pills */}
        {tripDayList.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-white/60 text-[11px] uppercase tracking-wider font-semibold">
              <Filter className="w-3 h-3" />
              Filtrar por dia
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              <DayPill
                active={activeDay === null}
                onClick={() => setActiveDay(null)}
                label="Todos"
              />
              {tripDayList.map((d) => (
                <DayPill
                  key={d.date}
                  active={activeDay === d.date}
                  onClick={() => setActiveDay(d.date)}
                  label={`Dia ${d.dayNumber}`}
                  sub={format(parseISO(d.date), "d MMM", { locale: es })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Type filter pills */}
        {availableTypes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-white/60 text-[11px] uppercase tracking-wider font-semibold">
              <Filter className="w-3 h-3" />
              Filtrar por tipo
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              <TypePill
                active={activeType === null}
                onClick={() => setActiveType(null)}
                label="Todos los tipos"
                color="#7dd3fc"
              />
              {availableTypes.map((t) => {
                const cfg = EVENT_TYPES[t];
                const Icon = EVENT_ICON_MAP[t];
                return (
                  <TypePill
                    key={t}
                    active={activeType === t}
                    onClick={() => setActiveType(t)}
                    label={cfg.label}
                    color={cfg.color}
                    icon={<Icon className="w-3.5 h-3.5" />}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1b2e]/40 backdrop-blur-sm">
          <MapView
            events={filteredEvents as TripEvent[]}
            centerLat={flyTo?.lat ?? null}
            centerLng={flyTo?.lng ?? null}
            className="h-[50vh] sm:h-[60vh]"
          />
        </div>

        {/* Event list */}
        {eventsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : sortedFiltered.length > 0 ? (
          <div
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-white/60">
                Eventos en el mapa
              </span>
              <span className="text-[11px] text-white/40">
                {sortedFiltered.length}
              </span>
            </div>
            <div className="max-h-[240px] overflow-y-auto scrollbar-thin">
              {sortedFiltered.map((event) => {
                const cfg = EVENT_TYPES[event.type] || EVENT_TYPES.misc;
                const isHi = highlightedId === event.id;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleSelectEvent(event)}
                    className={classNames(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-white/[0.04] last:border-b-0',
                      isHi
                        ? 'bg-sky-400/15'
                        : 'hover:bg-white/[0.05]',
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{
                        background: cfg.color,
                        boxShadow: `0 0 10px ${cfg.color}66`,
                      }}
                    />
                    {event.startTime ? (
                      <span className="text-[11px] font-mono text-white/70 flex items-center gap-1 flex-shrink-0 w-14">
                        <Clock className="w-3 h-3 text-white/40" />
                        {event.startTime}
                      </span>
                    ) : (
                      <span className="w-14 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-white truncate flex-1 min-w-0">
                      {event.title}
                    </span>
                    {event.location && (
                      <span className="text-[11px] text-white/50 flex items-center gap-1 flex-shrink-0 truncate max-w-[40%]">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm py-10 px-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white/40" />
            </div>
            <p className="text-sm text-white/60">
              {activeDay || activeType
                ? 'Ningun evento coincide con los filtros'
                : 'Agrega ubicaciones a tus eventos para verlos aqui'}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Stat card ─────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  tint,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  border: string;
}) {
  return (
    <div
      className="rounded-2xl border backdrop-blur-sm p-3 sm:p-4 flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.02))`,
        borderColor: border,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold truncate">
          {label}
        </div>
        <div className="text-base sm:text-lg font-black text-white truncate leading-tight">
          {value}
        </div>
      </div>
    </div>
  );
}

/* ── Day pill ──────────────────────────────────────── */
function DayPill({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border backdrop-blur-sm transition-colors whitespace-nowrap',
        active
          ? 'bg-sky-400/15 border-sky-300/50 text-sky-100 shadow-[0_0_12px_rgba(125,211,252,0.25)]'
          : 'bg-white/[0.04] border-white/10 text-white/65 hover:bg-white/[0.08] hover:text-white',
      )}
    >
      <span>{label}</span>
      {sub && <span className="text-[10px] font-medium opacity-70">{sub}</span>}
    </button>
  );
}

/* ── Type pill ─────────────────────────────────────── */
function TypePill({
  active,
  onClick,
  label,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border backdrop-blur-sm transition-colors whitespace-nowrap',
        active
          ? 'text-white'
          : 'bg-white/[0.04] border-white/10 text-white/65 hover:bg-white/[0.08] hover:text-white',
      )}
      style={
        active
          ? {
              background: `${color}26`, // ~15% alpha
              borderColor: `${color}80`,
              boxShadow: `0 0 12px ${color}40`,
            }
          : undefined
      }
    >
      {icon && (
        <span style={active ? { color } : { color: 'rgba(255,255,255,0.6)' }}>
          {icon}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}
