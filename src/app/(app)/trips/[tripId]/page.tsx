'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Calendar,
  Pencil,
  X,
  Users,
  CheckSquare,
  Wallet,
  Copy,
  Loader2,
  Download,
  HardDriveDownload,
  Share2,
  Check,
  Link as LinkIcon,
  ChevronRight,
  Camera,
  Receipt,
  FileText,
  MoreHorizontal,
  CalendarPlus,
  Navigation,
  Plane,
  Hotel,
  Car,
  UtensilsCrossed,
  Ship,
  StickyNote,
  Plus,
  Trash2,
  Map,
  PiggyBank,
  Link2,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { format, parseISO, differenceInDays, isAfter, isBefore, isEqual, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useTrip } from '@/hooks/useTrip';
import { useTrips } from '@/hooks/useTrips';
import { useEvents } from '@/hooks/useEvents';
import { useMembers } from '@/hooks/useMembers';
import { useChecklist } from '@/hooks/useChecklist';
import { useMilestones } from '@/hooks/useMilestones';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { exportTripBackup, downloadBackup, getTripBackupFilename } from '@/lib/utils/backup';
import { buildIcsString, downloadIcsFile, getTripIcsFilename } from '@/lib/utils/exportIcs';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { TRIP_STATUS, ROUTES, EVENT_TYPES } from '@/config/constants';
import { glassStyle, classNames, formatCurrency, formatDateES, generateId } from '@/lib/utils/helpers';
import { nowISO } from '@/lib/utils/helpers';
import SpotlightCard from '@/components/ui/SpotlightCard';
import PendingExpensesBanner from '@/components/expenses/PendingExpensesBanner';
import QuickActionsRow from '@/components/trips/QuickActionsRow';
import type { Trip, TripEvent, ChecklistItem, QuickNote } from '@/types';

/* ── Dynamic / below-the-fold imports ─────────────────────────────────
 * Each of these is heavy or conditional and shouldn't ship in the first
 * trip-detail chunk:
 *   - TripForm + DocumentUpload + photo cropping bring tons of UI weight; the
 *     edit modal is only shown when the user taps "Editar".
 *   - jspdf + autotable (~150KB) only runs on tap of "Exportar PDF".
 *   - QRCode is only rendered inside the share modal.
 *   - Particles is decorative WebGL/canvas eye-candy below the fold.
 *   - The three smart banners (Companion / Notifications / Suggestions) all
 *     run their own Firestore queries and aren't required for first paint.
 */
const TripForm = dynamic(
  () => import('@/components/trips/TripForm'),
  { ssr: false, loading: () => null },
);
const QRCode = dynamic(
  () => import('@/components/ui/QRCode'),
  { ssr: false, loading: () => null },
);
const Particles = dynamic(
  () => import('@/components/ui/Particles'),
  { ssr: false, loading: () => null },
);
const CompanionBanner = dynamic(
  () => import('@/components/trips/CompanionBanner'),
  { ssr: false, loading: () => null },
);
const NotificationsBanner = dynamic(
  () => import('@/components/trips/NotificationsBanner'),
  { ssr: false, loading: () => null },
);
const SmartSuggestionsBanner = dynamic(
  () => import('@/components/trips/SmartSuggestionsBanner'),
  { ssr: false, loading: () => null },
);

/* ─── Countdown Badge ─────────────────────────────── */

function CountdownHero({ startDate, endDate }: { startDate: string; endDate: string }) {
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));

  if (isAfter(today, end)) {
    return <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm font-bold">Viaje completado</span>;
  }

  if ((isAfter(today, start) || isEqual(today, start)) && (isBefore(today, end) || isEqual(today, end))) {
    const dayNumber = differenceInDays(today, start) + 1;
    const totalDays = differenceInDays(end, start) + 1;
    return (
      <span
        className="bg-emerald-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm font-bold animate-pulse"
        style={{ boxShadow: '0 0 20px rgba(16,185,129,0.55), 0 0 40px rgba(16,185,129,0.25)' }}
      >
        Dia {dayNumber} de {totalDays}
      </span>
    );
  }

  const daysUntil = differenceInDays(start, today);
  return <span className="bg-amber-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm font-bold">{daysUntil === 1 ? 'Manana!' : `Faltan ${daysUntil} dias`}</span>;
}

/* ─── Trip Hero (animated cover) ──────────────────── */

interface TripHeroProps {
  trip: Trip;
  totalDays: number;
  travelerNamesCount: number;
  status: { label: string; color: string };
  isInTripRange: boolean;
  onMoreMenuToggle: () => void;
}

function TripHero({ trip, totalDays, travelerNamesCount, status, isInTripRange, onMoreMenuToggle }: TripHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const imageBlur = useTransform(scrollYProgress, [0, 1], ['blur(0px)', 'blur(4px)']);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.35, 0.85]);

  return (
    <motion.div
      ref={heroRef}
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="relative rounded-2xl overflow-hidden shadow-lg"
    >
      {trip.coverImage ? (
        <motion.div
          className="w-full h-52 sm:h-60 overflow-hidden"
          style={{ y: imageY, filter: imageBlur }}
        >
          <motion.img
            src={trip.coverImage}
            alt={trip.title}
            className="w-full h-full object-cover"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-[#1e3a5f] via-[#2a5a8f] to-[#1e3a5f]" />
      )}
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"
        style={{ opacity: overlayOpacity }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-end justify-between">
          <div>
            <CountdownHero startDate={trip.startDate} endDate={trip.endDate} />
            <h1
              className="text-transparent bg-clip-text bg-gradient-to-b from-white to-amber-50 font-bold text-2xl sm:text-3xl mt-2 tracking-tight"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.55))' }}
            >
              {trip.title}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-white/70 text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {trip.destination}
              </p>
              <span className="text-white/40">·</span>
              <p className="text-white/70 text-sm flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {totalDays} dias
              </p>
              {travelerNamesCount > 0 && (
                <>
                  <span className="text-white/40">·</span>
                  <p className="text-white/70 text-sm flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {travelerNamesCount}
                  </p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onMoreMenuToggle}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="absolute top-4 left-4">
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm inline-flex items-center gap-1.5"
          style={{ backgroundColor: `${status.color}30`, color: '#fff', border: `1px solid ${status.color}60` }}>
          {isInTripRange && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
          )}
          {status.label}
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Next Event Card ─────────────────────────────── */

function NextEventCard({ events, tripId }: { events: TripEvent[]; tripId: string }) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const currentTime = format(now, 'HH:mm');

  const upcoming = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.startTime || '').localeCompare(b.startTime || '');
    });
    const todayNext = sorted.find((e) => e.date === todayStr && e.startTime && e.startTime > currentTime);
    if (todayNext) return todayNext;
    return sorted.find((e) => e.date > todayStr) ?? null;
  }, [events, todayStr, currentTime]);

  if (!upcoming) return null;

  const isToday = upcoming.date === todayStr;
  const dayLabel = isToday ? 'Hoy' : format(parseISO(upcoming.date), "EEEE d 'de' MMMM", { locale: es });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes beam-walk-${tripId.replace(/[^a-z0-9]/gi, '')} { to { offset-distance: 100%; } }
        .beam-track-${tripId.replace(/[^a-z0-9]/gi, '')} {
          position: absolute;
          top: 0; left: 0;
          width: 140px;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg,
            transparent 0%,
            #06b6d4 15%,
            #38bdf8 40%,
            #a78bfa 65%,
            #ec4899 85%,
            transparent 100%
          );
          offset-path: inset(-2px round 18px);
          offset-distance: 0%;
          offset-rotate: auto;
          animation: beam-walk-${tripId.replace(/[^a-z0-9]/gi, '')} 8s linear infinite;
          pointer-events: none;
          z-index: 10;
        }
      ` }} />
      <Link href={`/trips/${tripId}/itinerary`} className="block">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative rounded-2xl p-5 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)] transition-all group"
          style={{ background: 'linear-gradient(135deg, #0c1929 0%, #162a44 100%)' }}
        >
          <div className={`beam-track-${tripId.replace(/[^a-z0-9]/gi, '')}`} aria-hidden />
          <div className="flex items-center gap-1.5 mb-3 relative z-0">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              {isToday ? 'Siguiente' : 'Proximo evento'}
            </span>
            <span className="text-xs text-white/30 capitalize ml-auto">{dayLabel}</span>
          </div>
          <div className="flex items-center gap-4 relative z-0">
            {upcoming.startTime && (
              <div className="text-3xl font-black text-blue-400 tabular-nums leading-none">
                {upcoming.startTime}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base truncate">{upcoming.title}</p>
              {upcoming.location && (
                <p className="text-white/40 text-sm flex items-center gap-1 mt-1 truncate">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-blue-400/60" />
                  {upcoming.location}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-blue-400 transition-colors flex-shrink-0" />
          </div>
        </motion.div>
      </Link>
    </>
  );
}

/* ─── Empty Event Card ────────────────────────────── */

function EmptyEventCard({ tripId }: { tripId: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="relative overflow-hidden rounded-2xl p-8 border border-white/[0.08]"
      style={{ background: 'linear-gradient(135deg, rgba(12,25,41,0.95) 0%, rgba(22,42,68,0.95) 100%)' }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full translate-y-24 -translate-x-24 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div
          className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center mb-4 ring-1 ring-blue-400/20"
          style={{ boxShadow: '0 0 30px rgba(59,130,246,0.25)' }}
        >
          <CalendarPlus className="w-8 h-8 text-blue-400" />
        </div>

        <h3 className="text-white font-bold text-lg leading-tight">Tu viaje está vacío</h3>
        <p className="text-white/50 text-sm mt-1.5 max-w-sm">
          Comienza agregando tu primer evento — un vuelo, hotel, actividad o lo que necesites planear.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2 mt-6 w-full sm:w-auto">
          <Link
            href={`/trips/${tripId}/itinerary`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Agregar evento
          </Link>
          <Link
            href={`/trips/${tripId}/itinerary`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-sm font-semibold border border-white/[0.08] transition-all w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4" />
            Auto-generar
          </Link>
        </div>
      </div>
    </motion.div>
  );
}


/* ─── Quick Notes ─────────────────────────────────── */

function QuickNotesSection({ notes, onAdd, onToggle, onDelete }: {
  notes: QuickNote[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newNote, setNewNote] = useState('');
  // Done notes are removed on toggle, so we only render pending ones.
  const pending = notes.filter((n) => !n.done);

  const handleAdd = () => {
    const text = newNote.trim();
    if (!text) return;
    onAdd(text);
    setNewNote('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-2xl p-6 mt-2 relative overflow-hidden border border-amber-300/40 shadow-lg shadow-amber-500/10"
      style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%)' }}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full -translate-y-16 translate-x-16" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center"
            style={{ boxShadow: '0 0 15px rgba(245,158,11,0.15)' }}>
            <StickyNote className="w-4.5 h-4.5 text-amber-700" />
          </div>
          <span className="text-sm font-bold text-amber-900">Pendientes urgentes</span>
          {pending.length > 0 && (
            <span className="ml-auto bg-amber-500/30 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/40">
              {pending.length}
            </span>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Agregar pendiente..."
            className="flex-1 bg-white/60 border border-amber-300/60 rounded-xl px-3.5 py-2.5 text-sm text-amber-900 placeholder:text-amber-700/50 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 focus:bg-white/80 transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!newNote.trim()}
            className="w-10 h-10 rounded-xl bg-amber-500/30 hover:bg-amber-500/40 text-amber-800 flex items-center justify-center transition-colors disabled:opacity-30 border border-amber-500/40"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div className="space-y-1.5">
            {pending.map((note) => (
              <div key={note.id} className="flex items-center gap-2.5 bg-white/50 rounded-xl px-3 py-2.5 border border-amber-300/40 group">
                <button
                  onClick={() => onToggle(note.id)}
                  className="w-5 h-5 rounded-md border-2 border-amber-600/50 hover:border-amber-700 flex-shrink-0 transition-colors flex items-center justify-center"
                />
                <span className="flex-1 text-sm text-amber-900">{note.text}</span>
                <button
                  onClick={() => onDelete(note.id)}
                  className="w-6 h-6 rounded-lg text-amber-700/40 hover:text-red-600 hover:bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}


        {notes.length === 0 && (
          <p className="text-amber-700/50 text-xs text-center py-2">Sin pendientes — escribe algo arriba</p>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Status Suggestion Banner ────────────────────── */

function StatusSuggestionBanner({ trip, onUpdate }: {
  trip: { startDate: string; endDate: string; status: string };
  onUpdate: (status: 'active' | 'completed') => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(trip.startDate));
  const end = startOfDay(parseISO(trip.endDate));
  if (dismissed) return null;

  const isActive = (isAfter(today, start) || isEqual(today, start)) && (isBefore(today, end) || isEqual(today, end));
  const isOver = isAfter(today, end);

  if (trip.status === 'planning' && isActive) {
    return (
      <div className="rounded-xl p-3 flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200">
        <p className="text-emerald-700 text-xs">Tu viaje comenzo — <span className="font-semibold">¿actualizar a Activo?</span></p>
        <div className="flex gap-2">
          <button onClick={() => setDismissed(true)} className="text-gray-400 text-xs">No</button>
          <button onClick={() => onUpdate('active')} className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-medium">Si</button>
        </div>
      </div>
    );
  }

  if (trip.status === 'active' && isOver) {
    return (
      <div className="rounded-xl p-3 flex items-center justify-between gap-2 bg-blue-50 border border-blue-200">
        <p className="text-blue-700 text-xs">Tu viaje termino — <span className="font-semibold">¿marcar Completado?</span></p>
        <div className="flex gap-2">
          <button onClick={() => setDismissed(true)} className="text-gray-400 text-xs">No</button>
          <button onClick={() => onUpdate('completed')} className="px-2.5 py-1 rounded-lg bg-blue-500 text-white text-xs font-medium">Si</button>
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Skeleton ────────────────────────────────────── */

function TripDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-52 animate-shimmer rounded-2xl" />
      <div className="h-24 animate-shimmer rounded-2xl" />
      <div className="grid grid-cols-4 gap-3"><div className="h-20 animate-shimmer rounded-2xl" /><div className="h-20 animate-shimmer rounded-2xl" /><div className="h-20 animate-shimmer rounded-2xl" /><div className="h-20 animate-shimmer rounded-2xl" /></div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────── */

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip, loading, updateTrip, generateShareToken } = useTrip(tripId);
  useMilestones(tripId);

  // One-time cleanup: legacy done notes (from before the toggle-deletes
  // change) are filtered silently when the trip loads.
  const cleanedLegacyNotes = useRef(false);
  useEffect(() => {
    if (!trip || cleanedLegacyNotes.current) return;
    const notes = trip.quickNotes ?? [];
    const hasDone = notes.some((n) => n.done);
    if (!hasDone) return;
    cleanedLegacyNotes.current = true;
    updateTrip({ quickNotes: notes.filter((n) => !n.done) }).catch(() => {
      cleanedLegacyNotes.current = false;
    });
  }, [trip, updateTrip]);
  const { createTrip } = useTrips();
  const { events } = useEvents(tripId);
  const { members } = useMembers(tripId);
  const { items: checklistItems } = useChecklist(tripId);
  const { travelers: globalTravelers } = useGlobalTravelers();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  if (loading) return <TripDetailSkeleton />;

  if (!trip) {
    // Always go straight to the dashboard. router.back() silently no-ops
    // when the user landed here directly (refresh, share link, PWA install).
    const handleNotFoundBack = () => {
      router.push(ROUTES.app.dashboard);
    };
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 text-lg">Viaje no encontrado</p>
        <button
          type="button"
          onClick={handleNotFoundBack}
          className="text-blue-600 text-sm mt-4 inline-block hover:underline"
        >
          Volver al dashboard
        </button>
      </div>
    );
  }

  const status = TRIP_STATUS[trip.status];
  const totalDays = differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1;
  const _todayStart = startOfDay(new Date());
  const _tripStart = startOfDay(parseISO(trip.startDate));
  const _tripEnd = startOfDay(parseISO(trip.endDate));
  const isInTripRange =
    (isAfter(_todayStart, _tripStart) || isEqual(_todayStart, _tripStart)) &&
    (isBefore(_todayStart, _tripEnd) || isEqual(_todayStart, _tripEnd));
  const spent = events.reduce((sum, e) => sum + (e.cost || 0), 0);
  const budget = trip.budget || 0;
  const budgetPct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  const budgetColor = budgetPct > 85 ? '#ef4444' : budgetPct > 60 ? '#f59e0b' : '#22c55e';
  const checkDone = checklistItems.filter((i) => i.checked).length;
  const checkTotal = checklistItems.length;
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  // Event type counts
  const typeCounts: Record<string, number> = {};
  for (const e of events) { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; }

  // Travelers
  const travelerNames = (trip.travelerIds || []).map((tid) => globalTravelers.find((t) => t.id === tid)).filter(Boolean);

  // Quick notes
  const quickNotes: QuickNote[] = trip.quickNotes ?? [];

  const handleAddNote = async (text: string) => {
    const note: QuickNote = { id: generateId(), text, done: false, createdAt: nowISO() };
    await updateTrip({ quickNotes: [...quickNotes, note] });
  };

  const handleToggleNote = async (id: string) => {
    // Marking a note as "hecho" now removes it entirely so the section
    // doesn't pile up with completed items below.
    await updateTrip({ quickNotes: quickNotes.filter((n) => n.id !== id) });
  };

  const handleDeleteNote = async (id: string) => {
    await updateTrip({ quickNotes: quickNotes.filter((n) => n.id !== id) });
  };

  /* ── Handlers ── */

  const handleUpdate = async (data: {
    title: string; destination: string; startDate: string; endDate: string;
    description?: string; status: 'planning' | 'active' | 'completed' | 'cancelled';
    coverImage?: string | null; travelerIds?: string[];
  }) => {
    try {
      setSaving(true);
      await updateTrip({
        title: data.title, destination: data.destination, startDate: data.startDate, endDate: data.endDate,
        description: data.description || '', status: data.status,
        coverImage: data.coverImage ?? trip.coverImage, travelerIds: data.travelerIds || trip.travelerIds || [],
      });
      toast('Viaje actualizado', 'success');
      setEditing(false);
    } catch { toast('Error al actualizar', 'error'); }
    finally { setSaving(false); }
  };

  const handleDuplicate = async () => {
    try {
      setDuplicating(true);
      const db = getClientDb();
      const newTripId = await createTrip({
        title: `${trip.title} (copia)`, destination: trip.destination,
        startDate: trip.startDate, endDate: trip.endDate,
        description: trip.description, status: 'planning', coverImage: trip.coverImage,
      });
      const eventsSnap = await getDocs(query(collection(db, `trips/${tripId}/events`), orderBy('date', 'asc')));
      const { addDoc } = await import('firebase/firestore');
      for (const eventDoc of eventsSnap.docs) {
        await addDoc(collection(db, `trips/${newTripId}/events`), eventDoc.data());
      }
      const checklistSnap = await getDocs(query(collection(db, `trips/${tripId}/checklist`), orderBy('phase', 'asc')));
      for (const checkDoc of checklistSnap.docs) {
        await addDoc(collection(db, `trips/${newTripId}/checklist`), { ...checkDoc.data(), checked: false });
      }
      toast('Viaje duplicado', 'success');
      setShowDuplicateModal(false);
      router.push(ROUTES.app.trip(newTripId));
    } catch { toast('Error al duplicar', 'error'); }
    finally { setDuplicating(false); }
  };

  const handleExportPdf = async () => {
    try {
      // jspdf + autotable add ~150KB gzipped. Load on demand only.
      const { exportTripPdf } = await import('@/lib/utils/exportPdf');
      exportTripPdf(trip, events, members, checklistItems);
      toast('PDF descargado', 'success');
    } catch {
      toast('Error al generar PDF', 'error');
    }
  };

  const handleBackup = async () => {
    try { setBackingUp(true); const data = await exportTripBackup(tripId); downloadBackup(data, getTripBackupFilename(trip.title)); toast('Backup descargado', 'success'); }
    catch { toast('Error al generar backup', 'error'); }
    finally { setBackingUp(false); }
  };

  const handleExportIcs = () => {
    if (!trip) return;
    try {
      const ics = buildIcsString({
        trip: {
          title: trip.title,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
        },
        events,
      });
      downloadIcsFile(getTripIcsFilename(trip.title), ics);
      toast('Calendario .ics descargado', 'success');
    } catch (err) {
      console.error('Error generando .ics:', err);
      toast('Error al generar calendario', 'error');
    }
  };

  const handleShare = async () => {
    if (trip.shareToken) { setShowShareModal(true); return; }
    try { setGeneratingShare(true); await generateShareToken(); setShowShareModal(true); toast('Enlace generado', 'success'); }
    catch { toast('Error al generar enlace', 'error'); }
    finally { setGeneratingShare(false); }
  };

  const shareUrl = trip?.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${trip.shareToken}` : '';

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); toast('Enlace copiado', 'success'); setTimeout(() => setCopied(false), 2000); }
    catch { toast('No se pudo copiar', 'error'); }
  };

  const handleStatusUpdate = async (newStatus: 'active' | 'completed') => {
    try { await updateTrip({ status: newStatus }); toast(newStatus === 'completed' ? 'Viaje completado!' : 'Estado actualizado', 'success'); }
    catch { toast('Error al actualizar', 'error'); }
  };

  return (
    <div className="space-y-5">
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="edit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="flex justify-end mb-3">
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1"><X className="w-4 h-4" /> Cancelar</button>
            </div>
            <TripForm initialData={trip} onSubmit={handleUpdate} loading={saving} />
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

            {/* ── Hero ── */}
            <TripHero
              trip={trip}
              totalDays={totalDays}
              travelerNamesCount={travelerNames.length}
              status={status}
              isInTripRange={isInTripRange}
              onMoreMenuToggle={() => setShowMoreMenu(!showMoreMenu)}
            />

            {/* ── Companion Banner (live during trip) ── */}
            <CompanionBanner tripId={tripId} />

            {/* ── More Menu ── */}
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="relative z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 -mt-2">
                    {[
                      { icon: Pencil, label: 'Editar viaje', onClick: () => { setEditing(true); setShowMoreMenu(false); } },
                      { icon: Share2, label: 'Compartir', onClick: () => { handleShare(); setShowMoreMenu(false); } },
                      { icon: Download, label: 'Exportar PDF', onClick: () => { handleExportPdf(); setShowMoreMenu(false); } },
                      { icon: CalendarPlus, label: 'Calendario (.ics)', onClick: () => { handleExportIcs(); setShowMoreMenu(false); } },
                      { icon: HardDriveDownload, label: 'Backup JSON', onClick: () => { handleBackup(); setShowMoreMenu(false); } },
                      { icon: Copy, label: 'Duplicar viaje', onClick: () => { setShowDuplicateModal(true); setShowMoreMenu(false); } },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button key={item.label} onClick={item.onClick}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                          <Icon className="w-4 h-4 text-gray-400" /> {item.label}
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* ── Smart Notifications Banner ── */}
            <NotificationsBanner tripId={tripId} />

            {/* ── Status Suggestion ── */}
            <StatusSuggestionBanner trip={trip} onUpdate={handleStatusUpdate} />

            {/* ── Pending Expenses Banner ── */}
            <PendingExpensesBanner tripId={tripId} />

            {/* ── Smart Suggestions Banner ── */}
            <SmartSuggestionsBanner tripId={tripId} />

            {/* ── Quick actions: scan, add event, upload photo ── */}
            <QuickActionsRow tripId={tripId} trip={trip} />

            {/* ── Next Event ── */}
            {events.length === 0 ? (
              <EmptyEventCard tripId={tripId} />
            ) : (
              <NextEventCard events={events} tripId={tripId} />
            )}

            {/* ── Sections Grid — Aurora + Spotlight + Border Beam + Blur Fade ── */}
            <div className="rounded-3xl p-4 mt-3 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #28406a 0%, #2e4775 100%)' }}>

              {/* Particles constellation */}
              <Particles count={35} />

              {/* Aurora background — animated blobs */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="aurora-blob-1 absolute w-[600px] h-[600px] rounded-full blur-[80px] opacity-60 -top-48 -left-48"
                  style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 60%)' }} />
                <div className="aurora-blob-2 absolute w-[500px] h-[500px] rounded-full blur-[80px] opacity-50 -bottom-40 -right-40"
                  style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 60%)' }} />
                <div className="aurora-blob-3 absolute w-[400px] h-[400px] rounded-full blur-[70px] opacity-40 top-1/3 left-1/2"
                  style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 60%)' }} />
              </div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
                className="relative z-10 grid grid-cols-2 gap-3.5">

                {/* Itinerario — Hero card with Border Beam */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}
                  className="col-span-2">
                  <Link href={`/trips/${tripId}/itinerary`}>
                    <SpotlightCard glowColor="rgba(59,130,246,0.2)" className="border-beam rounded-2xl">
                      <div className="bg-[#0d1b2e]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/[0.06] group">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center"
                            style={{ boxShadow: '0 0 30px rgba(59,130,246,0.2)' }}>
                            <CalendarPlus className="w-8 h-8 text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-bold text-xl shiny-text">Itinerario</p>
                            <p className="text-white/40 text-sm mt-0.5">{events.length} evento{events.length !== 1 ? 's' : ''} planificados</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-blue-400 transition-colors" />
                        </div>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Gastos */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}>
                  <Link href={`/trips/${tripId}/expenses`}>
                    <SpotlightCard glowColor="rgba(245,158,11,0.2)" className="rounded-2xl h-full">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06] h-full">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4"
                          style={{ boxShadow: '0 0 20px rgba(245,158,11,0.12)' }}>
                          <Receipt className="w-6 h-6 text-amber-400" />
                        </div>
                        <p className="text-white font-bold text-sm">Gastos</p>
                        <p className="text-2xl font-black text-amber-400 mt-1">{formatCurrency(spent)}</p>
                        {budget > 0 && (
                          <>
                            <p className="text-white/25 text-[10px] mt-1">de {formatCurrency(budget)}</p>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${budgetPct}%` }}
                                transition={{ duration: 0.8, delay: 0.5 }} className="h-full rounded-full bg-gradient-to-r from-amber-400/40 to-amber-400/80" />
                            </div>
                          </>
                        )}
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Fotos */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}>
                  <Link href={`/trips/${tripId}/photos`}>
                    <SpotlightCard glowColor="rgba(139,92,246,0.2)" className="rounded-2xl h-full">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06] h-full">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4"
                          style={{ boxShadow: '0 0 20px rgba(139,92,246,0.12)' }}>
                          <Camera className="w-6 h-6 text-violet-400" />
                        </div>
                        <p className="text-white font-bold text-sm">Fotos</p>
                        <p className="text-2xl font-black text-violet-400 mt-1">{trip.albumPhotos?.length || 0}</p>
                        <p className="text-white/25 text-[10px] mt-0.5">foto{(trip.albumPhotos?.length || 0) !== 1 ? 's' : ''} del viaje</p>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Checklist */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}>
                  <Link href={`/trips/${tripId}/checklist`}>
                    <SpotlightCard glowColor="rgba(16,185,129,0.2)" className="rounded-2xl h-full">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06] h-full">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4"
                          style={{ boxShadow: '0 0 20px rgba(16,185,129,0.12)' }}>
                          <CheckSquare className="w-6 h-6 text-emerald-400" />
                        </div>
                        <p className="text-white font-bold text-sm">Checklist</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">{checkPct}%</p>
                        <p className="text-white/25 text-[10px] mt-0.5">{checkDone} de {checkTotal}</p>
                        {checkTotal > 0 && (
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${checkPct}%` }}
                              transition={{ duration: 0.8, delay: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-emerald-400/40 to-emerald-400/80" />
                          </div>
                        )}
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Documentos */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}>
                  <Link href={`/trips/${tripId}/documents`}>
                    <SpotlightCard glowColor="rgba(244,63,94,0.2)" className="rounded-2xl h-full">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06] h-full">
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4"
                          style={{ boxShadow: '0 0 20px rgba(244,63,94,0.12)' }}>
                          <FileText className="w-6 h-6 text-rose-400" />
                        </div>
                        <p className="text-white font-bold text-sm">Documentos</p>
                        <p className="text-white/25 text-xs mt-1">Escanear y subir</p>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Viajeros — wide card */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}
                  className="col-span-2">
                  <Link href={`/trips/${tripId}/members`}>
                    <SpotlightCard glowColor="rgba(99,102,241,0.2)" className="rounded-2xl">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06]">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center"
                            style={{ boxShadow: '0 0 20px rgba(99,102,241,0.12)' }}>
                            <Users className="w-6 h-6 text-indigo-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-bold text-sm">Viajeros</p>
                            <p className="text-white/40 text-xs">{travelerNames.length} persona{travelerNames.length !== 1 ? 's' : ''}</p>
                          </div>
                          {travelerNames.length > 0 && (
                            <div className="flex -space-x-2">
                              {travelerNames.slice(0, 5).map((t) => (
                                <div key={t!.id} className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-[#0d1b2e]"
                                  style={{ backgroundColor: t!.avatarColor || '#6366f1', boxShadow: '0 0 10px rgba(0,0,0,0.3)' }}>
                                  {t!.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {travelerNames.length > 5 && (
                                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 text-white/60 text-[10px] font-bold border-2 border-[#0d1b2e]">
                                  +{travelerNames.length - 5}
                                </div>
                              )}
                            </div>
                          )}
                          <ChevronRight className="w-4 h-4 text-white/20" />
                        </div>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Presupuesto */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}>
                  <Link href={`/trips/${tripId}/budget`}>
                    <SpotlightCard glowColor="rgba(6,182,212,0.2)" className="rounded-2xl h-full">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06] h-full">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4"
                          style={{ boxShadow: '0 0 20px rgba(6,182,212,0.12)' }}>
                          <PiggyBank className="w-6 h-6 text-cyan-400" />
                        </div>
                        <p className="text-white font-bold text-sm">Presupuesto</p>
                        <p className="text-white/25 text-xs mt-1">{budget > 0 ? `${budgetPct}% usado` : 'Sin definir'}</p>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Mapa */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}>
                  <Link href={`/trips/${tripId}/map`}>
                    <SpotlightCard glowColor="rgba(20,184,166,0.2)" className="rounded-2xl h-full">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06] h-full">
                        <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mb-4"
                          style={{ boxShadow: '0 0 20px rgba(20,184,166,0.12)' }}>
                          <Map className="w-6 h-6 text-teal-400" />
                        </div>
                        <p className="text-white font-bold text-sm">Mapa</p>
                        <p className="text-white/25 text-xs mt-1">Ver ubicaciones</p>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

                {/* Links utiles */}
                <motion.div variants={{ hidden: { opacity: 0, y: 30, filter: 'blur(12px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } }}
                  className="col-span-2">
                  <Link href={`/trips/${tripId}/links`}>
                    <SpotlightCard glowColor="rgba(236,72,153,0.2)" className="rounded-2xl">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06]">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0"
                            style={{ boxShadow: '0 0 20px rgba(236,72,153,0.12)' }}>
                            <Link2 className="w-6 h-6 text-pink-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">Links utiles</p>
                            <p className="text-white/40 text-xs mt-0.5">Enlaces guardados del viaje</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                        </div>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>

              </motion.div>

              {/* ── Trip Progress ── */}
              <motion.div
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="relative z-10 mt-3.5">
                {(() => {
                  const today = startOfDay(new Date());
                  const start = startOfDay(parseISO(trip.startDate));
                  const end = startOfDay(parseISO(trip.endDate));
                  const tripTotalDays = differenceInDays(end, start) + 1;

                  let progressPct = 0;
                  let label = '';
                  let sublabel = '';
                  let barColor = '#3b82f6';

                  if (isBefore(today, start)) {
                    const daysLeft = differenceInDays(start, today);
                    progressPct = 0;
                    label = `${daysLeft}`;
                    sublabel = daysLeft === 1 ? 'dia para salir' : 'dias para salir';
                    barColor = '#f59e0b';
                  } else if (isAfter(today, end)) {
                    progressPct = 100;
                    label = 'Fin';
                    sublabel = 'Viaje completado';
                    barColor = '#3b82f6';
                  } else {
                    const elapsed = differenceInDays(today, start) + 1;
                    const remaining = differenceInDays(end, today);
                    progressPct = Math.round((elapsed / tripTotalDays) * 100);
                    label = `${remaining}`;
                    sublabel = remaining === 1 ? 'dia restante' : 'dias restantes';
                    barColor = '#10b981';
                  }

                  return (
                    <SpotlightCard glowColor={`${barColor}20`} className="rounded-2xl">
                      <div className="bg-[#0d1b2e]/60 backdrop-blur-xl rounded-2xl p-4 border border-white/[0.06]">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">Progreso</span>
                          <p className="text-white font-bold text-sm">{label} <span className="text-white/40 text-xs font-normal">{sublabel}</span></p>
                        </div>
                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 1.2, delay: 0.9 }} className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${barColor}60, ${barColor})` }} />
                        </div>
                        <p className="text-white/20 text-[10px] mt-1.5">
                          {formatDateES(trip.startDate)} — {formatDateES(trip.endDate)}
                        </p>
                      </div>
                    </SpotlightCard>
                  );
                })()}
              </motion.div>
            </div>

            {/* ── Quick Notes ── */}
            <QuickNotesSection
              notes={quickNotes}
              onAdd={handleAddNote}
              onToggle={handleToggleNote}
              onDelete={handleDeleteNote}
            />

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Share Modal ── */}
      <AnimatePresence>
        {showShareModal && trip?.shareToken && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="rounded-2xl p-6 max-w-md w-full space-y-4" style={glassStyle} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Share2 className="w-5 h-5 text-blue-600" /></div>
                <div><h3 className="text-gray-900 text-lg font-bold">Compartir Viaje</h3><p className="text-gray-400 text-xs">Cualquier persona con el enlace puede ver el itinerario</p></div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <LinkIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <input type="text" value={shareUrl} readOnly className="flex-1 bg-transparent text-gray-700 text-sm outline-none truncate" />
                <button onClick={handleCopyLink}
                  className={classNames('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                    copied ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200')}>
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              </div>
              <div className="flex justify-center py-2"><QRCode url={shareUrl} size={180} caption="Escanea para ver el itinerario" /></div>
              <div className="flex justify-end pt-2"><Button variant="secondary" size="sm" onClick={() => setShowShareModal(false)}>Cerrar</Button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Duplicate Modal ── */}
      <AnimatePresence>
        {showDuplicateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !duplicating && setShowDuplicateModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="rounded-2xl p-6 max-w-md w-full space-y-4" style={glassStyle} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Copy className="w-5 h-5 text-blue-600" /></div>
                <h3 className="text-gray-900 text-lg font-bold">Duplicar Viaje</h3>
              </div>
              <p className="text-gray-600 text-sm">Se creara una copia de <span className="font-medium">{trip.title}</span> con todos los eventos y checklist.</p>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowDuplicateModal(false)} disabled={duplicating}>Cancelar</Button>
                <Button variant="primary" className="flex-1" onClick={handleDuplicate} loading={duplicating} icon={Copy}>Duplicar</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
