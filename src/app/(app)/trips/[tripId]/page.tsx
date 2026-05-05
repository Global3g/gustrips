'use client';

import { useState, useEffect } from 'react';
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
  ChevronDown,
  Clock,
  Plane,
  Hotel,
  Car,
  UtensilsCrossed,
  Paperclip,
  Globe,
  ChevronRight,
  Plus,
  FileSearch,
  CalendarPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useToast } from '@/context/ToastContext';
import TripForm from '@/components/trips/TripForm';
import { Button } from '@/components/ui/Button';
import { exportTripPdf } from '@/lib/utils/exportPdf';
import { exportTripBackup, downloadBackup, getTripBackupFilename } from '@/lib/utils/backup';
import QRCode from '@/components/ui/QRCode';
import WeatherWidget from '@/components/trips/WeatherWidget';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { TRIP_STATUS, ROUTES } from '@/config/constants';
import { glassStyle, classNames, formatCurrency, formatDateES } from '@/lib/utils/helpers';
import type { TripEvent, ChecklistItem, ActivityLogEntry } from '@/types';

// ─── Activity Log Helpers ──────────────────────────────
const ACTION_LABELS: Record<ActivityLogEntry['action'], string> = {
  created: 'creo',
  updated: 'actualizo',
  deleted: 'elimino',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'ayer';
  if (diffD < 7) return `hace ${diffD} dias`;
  return `hace ${Math.floor(diffD / 7)} sem`;
}

// ─── Trip Countdown Badge ───────────────────────────────
function TripCountdownBadge({ startDate, endDate }: { startDate: string; endDate: string }) {
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));

  if (isAfter(today, end)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
        Completado
      </span>
    );
  }

  if ((isAfter(today, start) || isEqual(today, start)) && (isBefore(today, end) || isEqual(today, end))) {
    const dayNumber = differenceInDays(today, start) + 1;
    const totalDays = differenceInDays(end, start) + 1;
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse">
        Dia {dayNumber} de {totalDays}
      </span>
    );
  }

  const daysUntil = differenceInDays(start, today);
  if (daysUntil > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
        Faltan {daysUntil} {daysUntil === 1 ? 'dia' : 'dias'}
      </span>
    );
  }

  return null;
}

// ─── Auto Status Suggestion Banner ──────────────────────
function StatusSuggestionBanner({
  trip,
  onUpdate,
}: {
  trip: { startDate: string; endDate: string; status: string };
  onUpdate: (status: 'active' | 'completed') => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(trip.startDate));
  const end = startOfDay(parseISO(trip.endDate));

  if (dismissed) return null;

  if (
    trip.status === 'planning' &&
    (isAfter(today, start) || isEqual(today, start)) &&
    (isBefore(today, end) || isEqual(today, end))
  ) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 100%)',
          border: '1px solid rgba(34,197,94,0.25)',
        }}
      >
        <p className="text-emerald-700 text-sm">
          Tu viaje comenzo -- ¿actualizar estado a <span className="font-semibold">Activo</span>?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          >
            Descartar
          </button>
          <button
            onClick={() => onUpdate('active')}
            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium transition-all"
          >
            Actualizar
          </button>
        </div>
      </motion.div>
    );
  }

  if (trip.status === 'active' && isAfter(today, end)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
          border: '1px solid rgba(59,130,246,0.25)',
        }}
      >
        <p className="text-blue-700 text-sm">
          Tu viaje termino -- ¿marcar como <span className="font-semibold">Completado</span>?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          >
            Descartar
          </button>
          <button
            onClick={() => onUpdate('completed')}
            className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 text-xs font-medium transition-all"
          >
            Completar
          </button>
        </div>
      </motion.div>
    );
  }

  return null;
}

// ─── Summary Stats Pills ────────────────────────────────
function TripStatsPills({
  events,
  members,
  checklistItems,
  travelerCount,
}: {
  events: TripEvent[];
  members: { uid: string }[];
  checklistItems: ChecklistItem[];
  travelerCount?: number;
}) {
  const totalCost = events.reduce((sum, e) => sum + (e.cost || 0), 0);
  const checkedCount = checklistItems.filter((i) => i.checked).length;
  const checklistPercent =
    checklistItems.length > 0
      ? Math.round((checkedCount / checklistItems.length) * 100)
      : 0;

  const stats = [
    {
      icon: Calendar,
      value: events.length,
      label: events.length === 1 ? 'evento' : 'eventos',
      color: '#a855f7',
    },
    {
      icon: Wallet,
      value: formatCurrency(totalCost),
      label: 'gastado',
      color: '#f59e0b',
    },
    {
      icon: Users,
      value: travelerCount || members.length,
      label: (travelerCount || members.length) === 1 ? 'viajero' : 'viajeros',
      color: '#3b82f6',
    },
    {
      icon: CheckSquare,
      value: `${checklistPercent}%`,
      label: 'checklist',
      color: '#22c55e',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 }}
      className="flex flex-wrap gap-2"
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
            }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
            <span className="text-gray-900">{stat.value}</span>
            <span className="text-gray-400">{stat.label}</span>
          </div>
        );
      })}
    </motion.div>
  );
}

// ─── Reservas y archivos Icons ──────────────────────────
function ReservationTypeIcons({ events, tripId }: { events: TripEvent[]; tripId: string }) {
  const categories = [
    { type: 'flight', label: 'Vuelos', icon: Plane, color: '#06b6d4', bgColor: 'bg-cyan-50' },
    { type: 'hotel', label: 'Alojamiento', icon: Hotel, color: '#8b5cf6', bgColor: 'bg-violet-50' },
    { type: 'car_rental', label: 'Autos', icon: Car, color: '#eab308', bgColor: 'bg-yellow-50' },
    { type: 'restaurant', label: 'Restaurantes', icon: UtensilsCrossed, color: '#f97316', bgColor: 'bg-orange-50' },
    { type: 'documents', label: 'Archivos', icon: Paperclip, color: '#6b7280', bgColor: 'bg-gray-100' },
  ];

  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-rose-400 hover:shadow-lg transition-shadow">
      <h3 className="text-gray-900 font-semibold text-sm mb-3">Reservas y archivos</h3>
      <div className="flex flex-wrap gap-3">
        {categories.map((cat) => {
          const count = cat.type === 'documents' ? 0 : (counts[cat.type] || 0);
          const CatIcon = cat.icon;
          const href = cat.type === 'documents'
            ? ROUTES.app.trip(tripId) + '/documents'
            : ROUTES.app.trip(tripId) + '/itinerary';

          return (
            <Link
              key={cat.type}
              href={href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors min-w-[72px]"
            >
              <div
                className={classNames(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  cat.bgColor,
                )}
              >
                <CatIcon className="w-5 h-5" style={{ color: cat.color }} />
              </div>
              <span className="text-gray-500 text-[11px] font-medium">{cat.label}</span>
              {count > 0 && (
                <span className="text-gray-400 text-[10px] font-medium bg-gray-50 px-2 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trip Completion Confetti ───────────────────────
function TripConfetti({ tripId }: { tripId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `gustrips-celebrated-${tripId}`;
    if (!localStorage.getItem(key)) {
      setShow(true);
      localStorage.setItem(key, '1');
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [tripId]);

  if (!show) return null;

  return (
    <div className="trip-confetti-overlay">
      {Array.from({ length: 20 }).map((_, i) => (
        <span key={i} className="trip-confetti-piece" />
      ))}
    </div>
  );
}

function TripDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 animate-shimmer rounded-lg w-48" />
      <div className="h-4 animate-shimmer rounded-lg w-32" />
      <div className="rounded-2xl p-6 space-y-4" style={glassStyle}>
        <div className="h-5 animate-shimmer rounded-lg w-3/4" />
        <div className="h-4 animate-shimmer rounded-lg w-1/2" />
        <div className="h-4 animate-shimmer rounded-lg w-2/3" />
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip, loading, updateTrip, generateShareToken } = useTrip(tripId);
  const { createTrip } = useTrips();
  const { events } = useEvents(tripId);
  const { members } = useMembers(tripId);
  const { items: checklistItems } = useChecklist(tripId);
  const { entries: activityEntries } = useActivityLog(tripId);
  const { travelers: globalTravelers } = useGlobalTravelers();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  if (loading) {
    return <TripDetailSkeleton />;
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 text-lg">Viaje no encontrado</p>
        <Link
          href={ROUTES.app.dashboard}
          className="text-blue-600 hover:text-blue-500 text-sm mt-4 inline-block"
        >
          Volver al dashboard
        </Link>
      </div>
    );
  }

  const status = TRIP_STATUS[trip.status];

  const formatDate = (dateStr: string) => {
    return formatDateES(dateStr);
  };

  const handleUpdate = async (data: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    description?: string;
    status: 'planning' | 'active' | 'completed' | 'cancelled';
    coverImage?: string | null;
    travelerIds?: string[];
  }) => {
    try {
      setSaving(true);
      await updateTrip({
        title: data.title,
        destination: data.destination,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description || '',
        status: data.status,
        coverImage: data.coverImage ?? trip.coverImage,
        travelerIds: data.travelerIds || trip.travelerIds || [],
      });
      if (data.status === 'completed' && trip.status !== 'completed') {
        const tripDays = differenceInDays(parseISO(data.endDate), parseISO(data.startDate)) + 1;
        const eventCount = events.length;
        toast(
          `Viaje completado! ${tripDays} dias, ${eventCount} evento${eventCount !== 1 ? 's' : ''} -- recuerdos increibles`,
          'success',
        );
      } else {
        toast('Viaje actualizado', 'success');
      }
      setEditing(false);
    } catch (err) {
      console.error('Error al actualizar viaje:', err);
      toast('Error al actualizar el viaje', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setDuplicating(true);
      const db = getClientDb();

      const newTripId = await createTrip({
        title: `${trip.title} (copia)`,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        description: trip.description,
        status: 'planning',
        coverImage: trip.coverImage,
      });

      const eventsSnap = await getDocs(
        query(collection(db, `trips/${tripId}/events`), orderBy('date', 'asc'))
      );
      const { addDoc } = await import('firebase/firestore');
      const eventsCol = collection(db, `trips/${newTripId}/events`);
      for (const eventDoc of eventsSnap.docs) {
        const eventData = eventDoc.data();
        const { id: _removed, ...rest } = eventData as TripEvent;
        await addDoc(eventsCol, rest);
      }

      const checklistSnap = await getDocs(
        query(collection(db, `trips/${tripId}/checklist`), orderBy('phase', 'asc'))
      );
      const checklistCol = collection(db, `trips/${newTripId}/checklist`);
      for (const checkDoc of checklistSnap.docs) {
        const checkData = checkDoc.data();
        const { id: _removed, ...rest } = checkData as ChecklistItem;
        await addDoc(checklistCol, { ...rest, checked: false });
      }

      toast('Viaje duplicado exitosamente', 'success');
      setShowDuplicateModal(false);
      router.push(ROUTES.app.trip(newTripId));
    } catch (err) {
      console.error('Error al duplicar viaje:', err);
      toast('Error al duplicar el viaje', 'error');
    } finally {
      setDuplicating(false);
    }
  };

  const handleExportPdf = () => {
    if (!trip) return;
    try {
      exportTripPdf(trip, events, members, checklistItems);
      toast('PDF descargado', 'success');
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      toast('Error al generar el PDF', 'error');
    }
  };

  const handleBackup = async () => {
    if (!trip) return;
    try {
      setBackingUp(true);
      const data = await exportTripBackup(tripId);
      const filename = getTripBackupFilename(trip.title);
      downloadBackup(data, filename);
      toast('Backup descargado', 'success');
    } catch (err) {
      console.error('Error al generar backup:', err);
      toast('Error al generar el backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handleShare = async () => {
    if (!trip) return;

    if (trip.shareToken) {
      setShowShareModal(true);
      return;
    }

    try {
      setGeneratingShare(true);
      await generateShareToken();
      toast('Enlace de compartir generado', 'success');
      setShowShareModal(true);
    } catch (err) {
      console.error('Error al generar enlace:', err);
      toast('Error al generar enlace de compartir', 'error');
    } finally {
      setGeneratingShare(false);
    }
  };

  const shareUrl = trip?.shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${trip.shareToken}`
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast('Enlace copiado', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('No se pudo copiar el enlace', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Trip completion confetti celebration */}
      {trip.status === 'completed' && <TripConfetti tripId={tripId} />}

      {/* Cover image hero */}
      {trip.coverImage && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full h-48 sm:h-56 rounded-2xl overflow-hidden relative shadow-lg"
        >
          <img
            src={trip.coverImage}
            alt={trip.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <h2 className="text-white font-bold text-2xl drop-shadow-lg">{trip.title}</h2>
            <p className="text-white/70 text-sm mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {trip.destination}
            </p>
          </div>
        </motion.div>
      )}

      {/* Status badges row */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full inline-block"
          style={{
            backgroundColor: `${status.color}25`,
            color: status.color,
            border: `1px solid ${status.color}44`,
          }}
        >
          {status.label}
        </span>
        <TripCountdownBadge startDate={trip.startDate} endDate={trip.endDate} />
        {!trip.coverImage && (
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 ml-1">{trip.title}</h1>
        )}
      </motion.div>

      {/* Action bar — glass style horizontal row */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-2xl px-3 py-2.5 flex items-center justify-around sm:justify-start sm:gap-1 overflow-x-auto"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(229,231,235,0.8)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {[
          { icon: HardDriveDownload, label: 'Backup', onClick: handleBackup, disabled: backingUp, loading: backingUp },
          { icon: Download, label: 'PDF', onClick: handleExportPdf, disabled: false, loading: false },
          { icon: Share2, label: 'Compartir', onClick: handleShare, disabled: generatingShare, loading: generatingShare },
          { icon: Copy, label: 'Duplicar', onClick: () => setShowDuplicateModal(true), disabled: false, loading: false },
          { icon: editing ? X : Pencil, label: editing ? 'Cancelar' : 'Editar', onClick: () => setEditing(!editing), disabled: false, loading: false, accent: editing },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={classNames(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[56px] disabled:opacity-50',
                action.accent
                  ? 'bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 shadow-sm'
                  : 'bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-gray-700 hover:shadow-md',
              )}
            >
              {action.loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
              <span className="text-[10px] font-medium leading-none">{action.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Content: View or Edit */}
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <TripForm
              initialData={trip}
              onSubmit={handleUpdate}
              loading={saving}
            />
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Status Suggestion Banner */}
            <StatusSuggestionBanner
              trip={trip}
              onUpdate={async (newStatus) => {
                try {
                  await updateTrip({ status: newStatus });
                  if (newStatus === 'completed') {
                    const tripDays = differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1;
                    const eventCount = events.length;
                    toast(
                      `Viaje completado! ${tripDays} dias, ${eventCount} evento${eventCount !== 1 ? 's' : ''} -- recuerdos increibles`,
                      'success',
                    );
                  } else {
                    toast('Estado actualizado a Activo', 'success');
                  }
                } catch {
                  toast('Error al actualizar estado', 'error');
                }
              }}
            />

            {/* Row 1 — Key Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Destino */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-blue-400 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Destino</p>
                </div>
                <p className="text-gray-900 text-lg font-semibold leading-tight">{trip.destination}</p>
              </motion.div>

              {/* Fechas */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-violet-400 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-500" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fechas</p>
                </div>
                <p className="text-gray-900 text-sm font-semibold leading-tight">
                  {formatDate(trip.startDate)} &mdash; {formatDate(trip.endDate)}
                </p>
                <p className="text-purple-500 text-xs font-medium mt-1.5">
                  {differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1} dias
                </p>
              </motion.div>

              {/* Viajeros */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-emerald-400 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Viajeros</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-gray-900 text-2xl font-bold leading-none">
                    {trip.travelerIds?.length || members.length}
                  </p>
                  {/* Traveler initials avatars */}
                  {(() => {
                    const travelerNames = (trip.travelerIds || [])
                      .map((tid) => globalTravelers.find((t) => t.id === tid))
                      .filter(Boolean)
                      .slice(0, 3);
                    if (travelerNames.length === 0) return null;
                    return (
                      <div className="flex -space-x-2">
                        {travelerNames.map((t) => (
                          <div
                            key={t!.id}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white"
                            style={{ backgroundColor: t!.avatarColor || '#6366f1' }}
                            title={t!.fullName}
                          >
                            {t!.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        ))}
                        {(trip.travelerIds?.length || 0) > 3 && (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 text-xs font-bold border-2 border-white">
                            +{(trip.travelerIds?.length || 0) - 3}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            </div>

            {/* Row 2 — Progress Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Presupuesto */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-amber-400 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Presupuesto</p>
                </div>
                {(() => {
                  const spent = events.reduce((sum, e) => sum + (e.cost || 0), 0);
                  const budget = trip.budget || 0;
                  const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
                  const barColor = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e';
                  return (
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-gray-900 text-lg font-bold">{formatCurrency(spent)}</span>
                        {budget > 0 && (
                          <span className="text-gray-400 text-xs">de {formatCurrency(budget)}</span>
                        )}
                      </div>
                      {budget > 0 ? (
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: barColor }}
                          />
                        </div>
                      ) : (
                        <p className="text-gray-300 text-xs">Sin presupuesto definido</p>
                      )}
                      {budget > 0 && (
                        <p className="text-xs mt-1.5 font-medium" style={{ color: barColor }}>
                          {pct}% utilizado
                        </p>
                      )}
                    </div>
                  );
                })()}
              </motion.div>

              {/* Checklist */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-4 border-l-cyan-400 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <CheckSquare className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Checklist</p>
                </div>
                {(() => {
                  const done = checklistItems.filter((i) => i.checked).length;
                  const total = checklistItems.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-gray-900 text-lg font-bold">{pct}%</span>
                        <span className="text-gray-400 text-xs">{done} de {total}</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
                          className="h-full rounded-full bg-green-500"
                        />
                      </div>
                      {total === 0 && (
                        <p className="text-gray-300 text-xs mt-1.5">Sin items todavia</p>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            </div>

            {/* Row 3 — Description */}
            {trip.description && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                  style={{
                    background: 'linear-gradient(to bottom, #8b5cf6, #3b82f6)',
                  }}
                />
                <p className="text-gray-600 text-base leading-relaxed italic pl-4">
                  {trip.description}
                </p>
              </motion.div>
            )}

            {/* Row 4 — Reservas y archivos */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <ReservationTypeIcons events={events} tripId={tripId} />
            </motion.div>

            {/* Row 5 — Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <Link
                href={ROUTES.app.itinerary(tripId)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 group hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <CalendarPlus className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm font-semibold">Agregar evento</p>
                  <p className="text-gray-400 text-xs">Itinerario</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
              </Link>

              <Link
                href={ROUTES.app.documents(tripId)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 group hover:border-violet-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                  <FileSearch className="w-5 h-5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm font-semibold">Documentos</p>
                  <p className="text-gray-400 text-xs">Escanear y subir</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors" />
              </Link>

              <Link
                href={ROUTES.app.checklist(tripId)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 group hover:border-emerald-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <CheckSquare className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm font-semibold">Ver checklist</p>
                  <p className="text-gray-400 text-xs">Tareas pendientes</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-400 transition-colors" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && trip?.shareToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl p-6 max-w-md w-full space-y-4"
              style={glassStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-gray-900 text-lg font-bold">Compartir Viaje</h3>
                  <p className="text-gray-400 text-xs">Cualquier persona con el enlace puede ver el itinerario</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <LinkIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-gray-700 text-sm outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={classNames(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                    copied
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200',
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </>
                  )}
                </button>
              </div>

              <div className="flex justify-center py-2">
                <QRCode
                  url={shareUrl}
                  size={180}
                  caption="Escanea para ver el itinerario"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowShareModal(false)}
                >
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate Confirmation Modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !duplicating && setShowDuplicateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl p-6 max-w-md w-full space-y-4"
              style={glassStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Copy className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-gray-900 text-lg font-bold">Duplicar Viaje</h3>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed">
                Se creara una copia de <span className="text-gray-900 font-medium">{trip.title}</span> con
                todos los eventos y checklist. El nuevo viaje se creara en estado &quot;Planificando&quot;.
              </p>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowDuplicateModal(false)}
                  disabled={duplicating}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleDuplicate}
                  loading={duplicating}
                  icon={Copy}
                >
                  Duplicar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actividad reciente (collapsible) */}
      {activityEntries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => setActivityOpen(!activityOpen)}
            className="flex items-center gap-2 text-gray-300 hover:text-gray-500 transition-colors text-xs font-medium w-full"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Actividad reciente</span>
            <div className="flex-1 h-px bg-gray-100" />
            <ChevronDown
              className={classNames(
                'w-3.5 h-3.5 transition-transform duration-200',
                activityOpen ? 'rotate-180' : '',
              )}
            />
          </button>

          <AnimatePresence>
            {activityOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-1.5">
                  {activityEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-baseline gap-2 text-xs"
                    >
                      <span className="text-gray-500 font-medium flex-shrink-0">
                        {entry.userName}
                      </span>
                      <span className="text-gray-300">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                      <span className="text-gray-400 truncate">
                        {entry.entityName}
                      </span>
                      <span className="text-gray-200 flex-shrink-0 ml-auto">
                        {relativeTime(entry.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
