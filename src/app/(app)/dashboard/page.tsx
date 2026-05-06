'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plane, Plus, Search, MapPin, Calendar, Users, CalendarClock, ArrowRight, Globe, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseISO, differenceInDays, isWithinInterval } from 'date-fns';
import { useTrips } from '@/hooks/useTrips';
import { useAuth } from '@/hooks/useAuth';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { ROUTES } from '@/config/constants';
import { classNames, formatDateShortES } from '@/lib/utils/helpers';
import type { Trip } from '@/types';

/* ─── Helpers ─────────────────────────────────────── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getUserName(user: { displayName: string; email: string } | null): string {
  if (!user) return '';
  if (user.displayName) return user.displayName.split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return '';
}

function formatDateCompact(dateStr: string): string {
  return formatDateShortES(dateStr);
}

/* ─── Glass card style ───────────────────────────── */

const glass = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
};

const glassHover = 'hover:bg-white/[0.08] transition-all duration-200';

/* ─── Trip Card (glass style) ────────────────────── */

function GlassTripCard({ trip, featured = false }: { trip: Trip; featured?: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let badge = '';
  let badgeColor = '';

  try {
    const start = parseISO(trip.startDate);
    const end = parseISO(trip.endDate);

    if (isWithinInterval(today, { start, end })) {
      const dayNum = differenceInDays(today, start) + 1;
      const totalDays = differenceInDays(end, start) + 1;
      badge = `Dia ${dayNum} de ${totalDays}`;
      badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    } else if (start > today) {
      const daysUntil = differenceInDays(start, today);
      badge = daysUntil === 1 ? 'Manana' : `${daysUntil} dias`;
      badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    } else {
      badge = 'Completado';
      badgeColor = 'bg-white/10 text-white/40 border-white/10';
    }
  } catch {
    // ignore
  }

  return (
    <Link href={ROUTES.app.trip(trip.id)} className="block group">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={classNames(
          'rounded-2xl overflow-hidden cursor-pointer',
          featured ? 'col-span-2' : '',
        )}
        style={glass}
      >
        {/* Cover */}
        <div className={classNames('relative overflow-hidden', featured ? 'h-44' : 'h-32')}>
          {trip.coverImage ? (
            <img
              src={trip.coverImage}
              alt={trip.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          {/* Badge */}
          {badge && (
            <div className="absolute top-3 left-3">
              <span className={classNames('text-[10px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm', badgeColor)}>
                {badge}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className={classNames('text-white font-bold drop-shadow-lg', featured ? 'text-xl' : 'text-base')}>
              {trip.title}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-white/60 text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {trip.destination}
              </span>
              <span className="text-white/40 text-xs">
                {formatDateCompact(trip.startDate)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/* ─── Stat pill ──────────────────────────────────── */

function StatPill({ icon: Icon, value, label, color }: {
  icon: typeof Plane; value: string | number; label: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl" style={glass}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-white font-bold text-sm leading-none">{value}</p>
        <p className="text-white/40 text-[10px] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────── */

export default function DashboardPage() {
  const { trips, loading, error } = useTrips();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const userName = getUserName(user);
  const greeting = getGreeting();

  /* ─── Hero trip ─────────────────────────────────── */
  const { heroTrip } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeTrip = trips.find((trip) => {
      try {
        return isWithinInterval(today, { start: parseISO(trip.startDate), end: parseISO(trip.endDate) });
      } catch { return false; }
    });
    if (activeTrip) return { heroTrip: activeTrip };

    const future = trips
      .filter((t) => { try { return parseISO(t.startDate) >= today; } catch { return false; } })
      .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());

    return { heroTrip: future[0] ?? null };
  }, [trips]);

  /* ─── Stats ─────────────────────────────────────── */
  const stats = useMemo(() => ({
    total: trips.length,
    destinations: new Set(trips.filter((t) => t.status === 'completed').map((t) => t.destination.trim().toLowerCase())).size,
    completed: trips.filter((t) => t.status === 'completed').length,
  }), [trips]);

  /* ─── Filtered trips (exclude hero) ────────────── */
  const otherTrips = useMemo(() => {
    let result = trips.filter((t) => t.id !== heroTrip?.id);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q));
    }
    return result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [trips, heroTrip, searchQuery]);

  const todayFormatted = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <OnboardingModal />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-white/40 text-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {greeting},
        </p>
        <h1 className="text-white text-2xl sm:text-3xl font-bold mt-0.5">{userName}</h1>
        <p className="text-white/30 text-xs mt-1 flex items-center gap-1.5 capitalize">
          <Calendar className="w-3 h-3" /> {todayFormatted}
        </p>
      </motion.div>

      {/* ── Stats ── */}
      {!loading && trips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex gap-3 overflow-x-auto scrollbar-none -mx-1 px-1"
        >
          <StatPill icon={Plane} value={stats.total} label="Viajes" color="#3b82f6" />
          <StatPill icon={Globe} value={stats.destinations} label="Destinos" color="#8b5cf6" />
          <StatPill icon={ListChecks} value={stats.completed} label="Completados" color="#22c55e" />
        </motion.div>
      )}

      {/* ── Search ── */}
      {!loading && trips.length > 2 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Buscar viajes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-all"
              style={{ ...glass, border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </motion.div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-4">
          <div className="h-44 rounded-2xl animate-pulse" style={glass} />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-32 rounded-2xl animate-pulse" style={glass} />
            <div className="h-32 rounded-2xl animate-pulse" style={glass} />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && trips.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-2xl"
          style={glass}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <Plane className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-1">Tu proxima aventura te espera</h2>
          <p className="text-white/40 text-sm mb-5">Crea tu primer viaje y comienza a organizar</p>
          <Link
            href={ROUTES.app.newTrip}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Crear Viaje
          </Link>
        </motion.div>
      )}

      {/* ── Hero trip ── */}
      {!loading && heroTrip && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <GlassTripCard trip={heroTrip} featured />
        </motion.div>
      )}

      {/* ── Other trips grid ── */}
      {!loading && otherTrips.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-white/50 text-xs font-semibold uppercase tracking-wider">Todos los viajes</h2>
          <div className="grid grid-cols-2 gap-3">
            {otherTrips.map((trip, i) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
              >
                <GlassTripCard trip={trip} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
