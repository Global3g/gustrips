'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plane, Plus, Search, SlidersHorizontal, MapPin, Calendar, Users, CalendarClock, ArrowRight, Globe, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseISO, differenceInDays, isWithinInterval } from 'date-fns';
import { useTrips } from '@/hooks/useTrips';
import { useAuth } from '@/hooks/useAuth';
import TripCard from '@/components/trips/TripCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardBody } from '@/components/ui/Card';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { ROUTES, TRIP_STATUS } from '@/config/constants';
import { classNames, formatDateES, formatDateShortES } from '@/lib/utils/helpers';
import type { Trip, TripStatus } from '@/types';

/* ─── Helpers ─────────────────────────────────────── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getUserName(user: { displayName: string; email: string } | null): string {
  if (!user) return '';
  if (user.displayName) return user.displayName.split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return '';
}

function formatDateShort(dateStr: string): string {
  return formatDateShortES(dateStr);
}

function formatDateFull(dateStr: string): string {
  return formatDateES(dateStr);
}

/** Generate a deterministic gradient from destination string (matches TripCard) */
function destinationGradient(destination: string): string {
  let hash = 0;
  for (let i = 0; i < destination.length; i++) {
    hash = destination.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 60%, 40%) 0%, hsl(${hue2}, 50%, 25%) 100%)`;
}

/* ─── Filter types ────────────────────────────────── */

type FilterStatus = 'all' | 'planning' | 'active' | 'completed';
type SortMode = 'recent' | 'upcoming' | 'az';

const FILTER_PILLS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'planning', label: 'Planificando' },
  { value: 'active', label: 'Activos' },
  { value: 'completed', label: 'Completados' },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'upcoming', label: 'Próximos' },
  { value: 'az', label: 'A-Z' },
];

/* ─── Skeletons ───────────────────────────────────── */

function TripCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-200">
      <div className="h-28 animate-shimmer" />
      <div className="p-5 space-y-3">
        <div className="h-5 animate-shimmer rounded-lg w-3/4" />
        <div className="h-4 animate-shimmer rounded-lg w-1/2" />
        <div className="h-3 animate-shimmer rounded-lg w-2/3" />
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-200">
      <div className="h-48 animate-shimmer" />
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Plane;
  label: string;
  value: string | number;
  color: string;
}) {
  const borderColorMap: Record<string, string> = {
    '#3b82f6': 'border-l-4 border-l-blue-400',
    '#8b5cf6': 'border-l-4 border-l-violet-400',
    '#22c55e': 'border-l-4 border-l-emerald-400',
  };
  const leftBorder = borderColorMap[color] || 'border-l-4 border-l-gray-300';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`shadow-md ${leftBorder}`}>
        <CardBody className="flex items-center gap-3 py-3 px-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wider">{label}</p>
            <p className="text-gray-900 text-lg font-bold leading-tight">{value}</p>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}

/* ─── Hero Card ───────────────────────────────────── */

function HeroTripCard({ trip, isActive }: { trip: Trip; isActive: boolean }) {
  const today = new Date();
  const startDate = parseISO(trip.startDate);
  const daysUntil = differenceInDays(startDate, today);
  const hasCover = !!trip.coverImage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Link href={ROUTES.app.trip(trip.id)} className="block group">
        <div
          className="relative rounded-2xl overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-xl bg-white border border-gray-200"
        >
          {/* Background */}
          <div
            className="h-52 sm:h-56 relative overflow-hidden"
            style={
              hasCover
                ? undefined
                : { background: destinationGradient(trip.destination) }
            }
          >
            {hasCover && (
              <img
                src={trip.coverImage!}
                alt={trip.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

            {/* Status badge */}
            <div className="absolute top-4 left-4">
              {isActive ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Viaje en curso
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm bg-blue-500/30 text-blue-100 border border-blue-400/30">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {daysUntil === 0
                    ? 'Empieza hoy'
                    : daysUntil === 1
                      ? 'Falta 1 día'
                      : `Faltan ${daysUntil} días`}
                </span>
              )}
            </div>

            {/* Content overlay — text stays white because it's on the image */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="text-white font-bold text-2xl sm:text-3xl drop-shadow-lg mb-1">
                {trip.title}
              </h2>
              <div className="flex items-center gap-4 text-white/80 text-sm">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  {trip.destination}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  {formatDateShort(trip.startDate)} - {formatDateShort(trip.endDate)}
                </span>
              </div>

              {/* Quick action */}
              <div className="mt-3">
                <span className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                  Ver viaje
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Main Page ───────────────────────────────────── */

export default function DashboardPage() {
  const { trips, loading, error } = useTrips();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  /* ─── Computed: hero trip ────────────────────────── */
  const { heroTrip, isHeroActive } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First check for active trip (today between start and end)
    const activeTrip = trips.find((trip) => {
      try {
        const start = parseISO(trip.startDate);
        const end = parseISO(trip.endDate);
        return isWithinInterval(today, { start, end });
      } catch {
        return false;
      }
    });

    if (activeTrip) {
      return { heroTrip: activeTrip, isHeroActive: true };
    }

    // Find next upcoming trip (nearest future startDate)
    const futureSorted = trips
      .filter((trip) => {
        try {
          const start = parseISO(trip.startDate);
          return start >= today;
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = parseISO(a.startDate).getTime();
        const dateB = parseISO(b.startDate).getTime();
        return dateA - dateB;
      });

    return {
      heroTrip: futureSorted[0] ?? null,
      isHeroActive: false,
    };
  }, [trips]);

  /* ─── Computed: stats ───────────────────────────── */
  const stats = useMemo(() => {
    const totalTrips = trips.length;

    const completedTrips = trips.filter((t) => t.status === 'completed');
    const uniqueDestinations = new Set(completedTrips.map((t) => t.destination.trim().toLowerCase()));
    const destinationsCount = uniqueDestinations.size;

    return {
      totalTrips,
      destinationsCount,
    };
  }, [trips]);

  /* ─── Computed: filtered + sorted trips ─────────── */
  const filteredTrips = useMemo(() => {
    let result = [...trips];

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (trip) =>
          trip.title.toLowerCase().includes(q) ||
          trip.destination.toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((trip) => trip.status === filterStatus);
    }

    // Sort
    switch (sortMode) {
      case 'recent':
        result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      case 'upcoming':
        result.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
        break;
      case 'az':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [trips, searchQuery, filterStatus, sortMode]);

  const userName = getUserName(user);
  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      {/* Onboarding for new users */}
      <OnboardingModal />

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-gray-900 text-xl sm:text-2xl font-bold">
            {greeting}, {userName}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {trips.length > 0
              ? `Tienes ${trips.length} viaje${trips.length !== 1 ? 's' : ''}`
              : '\u00bfA d\u00f3nde vamos?'}
          </p>
        </div>

        <Link
          href={ROUTES.app.newTrip}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo Viaje</span>
        </Link>
      </motion.div>

      {/* Stats bar */}
      {!loading && trips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <StatCard
            icon={Plane}
            label="Viajes"
            value={stats.totalTrips}
            color="#3b82f6"
          />
          <StatCard
            icon={Globe}
            label="Destinos visitados"
            value={stats.destinationsCount}
            color="#8b5cf6"
          />
          <div className="hidden sm:block">
            <StatCard
              icon={ListChecks}
              label="Viajes completados"
              value={trips.filter((t) => t.status === 'completed').length}
              color="#22c55e"
            />
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <HeroSkeleton />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && trips.length === 0 && !error && (
        <EmptyState
          icon={Plane}
          title="Tu pr\u00f3xima aventura te espera"
          description="Crea tu primer viaje y comienza a organizar cada momento."
          action={
            <Link
              href={ROUTES.app.newTrip}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Viaje
            </Link>
          }
        />
      )}

      {/* Hero card */}
      {!loading && heroTrip && (
        <HeroTripCard trip={heroTrip} isActive={isHeroActive} />
      )}

      {/* Trips section */}
      {!loading && trips.length > 0 && (
        <div className="space-y-4">
          {/* Section header with filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="space-y-3"
          >
            <h2 className="text-gray-900 font-bold text-lg">Todos tus viajes</h2>

            {/* Search + Sort row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por titulo o destino..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
              </div>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-700 text-sm cursor-pointer focus:outline-none focus:border-amber-500 transition-colors"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {FILTER_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => setFilterStatus(pill.value)}
                  className={classNames(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                    filterStatus === pill.value
                      ? 'bg-amber-600 text-white border border-amber-600'
                      : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-700'
                  )}
                >
                  {pill.label}
                  {pill.value !== 'all' && (
                    <span className="ml-1.5 text-[11px] opacity-60">
                      {trips.filter((t) =>
                        pill.value === 'all' ? true : t.status === pill.value
                      ).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Trip grid */}
          {filteredTrips.length > 0 ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.08 } },
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredTrips.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} index={index} />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-10 h-10 text-blue-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                No se encontraron viajes con esos filtros.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
