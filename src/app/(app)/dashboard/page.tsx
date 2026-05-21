'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Plane,
  Plus,
  Search,
  MapPin,
  Calendar,
  Globe,
  ListChecks,
  CalendarDays,
  Receipt,
  FileText,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseISO, differenceInDays, isWithinInterval } from 'date-fns';
import { useTrips } from '@/hooks/useTrips';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/context/ToastContext';
// OnboardingModal is shown only to first-time users; ship it lazily so the
// dashboard JS stays lean for the 99% of visits where it never renders.
const OnboardingModal = dynamic(
  () => import('@/components/onboarding/OnboardingModal'),
  { ssr: false },
);
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

/* ─── Trip Card (glass style) ────────────────────── */

function GlassTripCard({ trip, featured = false }: { trip: Trip; featured?: boolean }) {
  const router = useRouter();
  const { deleteTrip } = useTrips();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Auto-cancel the primed delete state after 6s so the button doesn't sit
  // armed indefinitely.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 6000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

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

  const handleEdit = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`${ROUTES.app.trip(trip.id)}/edit`);
  };

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setDeleting(true);
      await deleteTrip(trip.id);
      toast('Viaje borrado', 'success');
    } catch (err) {
      console.error('Error deleting trip:', err);
      toast('No pudimos borrar el viaje', 'error');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={classNames(
        'relative rounded-2xl overflow-hidden',
        featured ? 'col-span-2' : '',
      )}
      style={glass}
    >
      <Link href={ROUTES.app.trip(trip.id)} className="block group">
        {/* Cover */}
        <div className={classNames('relative overflow-hidden', featured ? 'h-44' : 'h-32')}>
          {trip.coverImage ? (
            <Image
              src={trip.coverImage}
              alt={trip.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
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
          <div className="absolute bottom-0 left-0 right-0 p-4 pr-20">
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
      </Link>

      {/* Action buttons (overlay on top of the cover, top-right corner). */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <button
          type="button"
          onClick={handleEdit}
          aria-label="Editar viaje"
          title="Editar viaje"
          className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-md text-white/90 hover:bg-black/75 hover:text-white flex items-center justify-center transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label="Borrar viaje"
          title="Borrar viaje"
          className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-md text-rose-300 hover:bg-rose-500/75 hover:text-white flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Delete confirmation overlay. Sits on top of the whole card. */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center"
            onClick={(e) => e.preventDefault()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-300" />
            </div>
            <p className="text-white text-sm font-bold mb-1">¿Borrar este viaje?</p>
            <p className="text-white/70 text-xs leading-snug max-w-xs mb-3">
              Se eliminará el viaje completo: itinerario, eventos, gastos, documentos y fotos.
              No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Borrar
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/85 text-xs font-semibold transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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

/* ─── Empty state (first trip landing card) ──────── */

function DashboardEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto rounded-3xl p-8 sm:p-12 relative overflow-hidden border border-white/[0.08] my-12"
      style={{ background: 'linear-gradient(135deg, rgba(12,25,41,0.95) 0%, rgba(22,42,68,0.95) 100%)' }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/15 rounded-full -translate-y-48 translate-x-48 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/15 rounded-full translate-y-40 -translate-x-40 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-500/30 to-violet-500/30 ring-1 ring-white/[0.08] flex items-center justify-center mb-6"
          style={{ boxShadow: '0 0 40px rgba(59,130,246,0.25)' }}
        >
          <Plane className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-white font-bold text-2xl sm:text-3xl tracking-tight">
          ¡Comienza tu primer viaje!
        </h2>
        <p className="text-white/60 text-sm sm:text-base mt-3 max-w-md mx-auto">
          Organiza vuelos, hoteles, actividades y todo lo que necesitas en un solo lugar. Comparte con amigos y familia.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={ROUTES.app.newTrip}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Crear mi primer viaje
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: CalendarDays, label: 'Itinerario visual', desc: 'Día por día' },
            { icon: Receipt, label: 'Gastos compartidos', desc: 'Sin discusiones' },
            { icon: FileText, label: 'Documentos', desc: 'Todo a la mano' },
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
              >
                <div className="w-10 h-10 mx-auto rounded-xl bg-white/[0.05] flex items-center justify-center mb-2.5">
                  <Icon className="w-5 h-5 text-white/70" />
                </div>
                <p className="text-white text-sm font-semibold">{f.label}</p>
                <p className="text-white/40 text-xs mt-0.5">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
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
        <>
          {user?.email && (
            <div className="max-w-2xl mx-auto mb-6 rounded-2xl border border-amber-300/30 bg-amber-50/95 p-4 sm:p-5">
              <p className="text-amber-900 text-sm font-semibold mb-2">
                ¿No ves tus viajes?
              </p>
              <p className="text-amber-900/85 text-xs sm:text-sm mb-3">
                Estás logueado como <strong>{user.email}</strong>. Si tus viajes están en
                otra cuenta o tu sesión está atascada, limpia todo y vuelve a iniciar
                sesión con la cuenta correcta.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const { resetSessionAndReload } = await import('@/lib/utils/resetSession');
                  await resetSessionAndReload();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
              >
                Limpiar sesión y volver a iniciar
              </button>
            </div>
          )}
          <DashboardEmptyState />
        </>
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
