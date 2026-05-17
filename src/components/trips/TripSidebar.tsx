'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, eachDayOfInterval, isToday, isBefore, isAfter, getISOWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronDown,
  MapPin,
  FileText,
  Wallet,
  Receipt,
  CalendarDays,
  Users,
  CheckSquare,
  ExternalLink,
  Camera,
  Map,
  HardDriveDownload,
  Loader2,
  Sparkles,
  Clock,
  Home,
  Pencil,
  Trash2,
  AlertTriangle,
  MoreHorizontal,
} from 'lucide-react';
import { useTrips } from '@/hooks/useTrips';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useToast } from '@/context/ToastContext';
import { classNames } from '@/lib/utils/helpers';
import { exportTripBackup, downloadBackup, getTripBackupFilename } from '@/lib/utils/backup';
import { ROUTES } from '@/config/constants';
import StatusChangeMenu from '@/components/trips/sidebar/StatusChangeMenu';
import JumpToTodayButton from '@/components/trips/sidebar/JumpToTodayButton';
import TripSwitcher from '@/components/trips/sidebar/TripSwitcher';
import type { Trip, TripEvent, TripStatus } from '@/types';

/* ------------------------------------------------------------------ */
/*  Unified palette — single amber accent for active state.
 *  9-color palette was visually chaotic; one accent reads as one app.   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                */
/* ------------------------------------------------------------------ */

function CollapsibleSection({ title, defaultOpen = true, children, count }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-5 py-2.5 text-[10px] font-bold text-white/75 uppercase tracking-[0.15em] hover:text-white/85 transition-colors duration-200"
      >
        <ChevronDown
          className={classNames(
            'w-3 h-3 transition-transform duration-300 ease-out',
            open ? '' : '-rotate-90',
          )}
        />
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[9px] font-semibold text-white/80 bg-white/[0.06] rounded-full px-2 py-0.5 normal-case tracking-normal border border-white/[0.06]">
            {count}
          </span>
        )}
      </button>
      {/* Gradient section divider */}
      <div className="mx-5 mb-1.5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div
        className={classNames(
          'space-y-0.5 overflow-hidden transition-all duration-300 ease-out',
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NavItem — single accent, no motion, no glow.                       */
/* ------------------------------------------------------------------ */

function NavItem({ href, label, icon, isActive, badge, sublabel, muted }: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  badge?: React.ReactNode;
  sublabel?: string;
  muted?: boolean;
  /** Unused — kept for backwards compatibility with old call sites. */
  color?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={classNames(
        'relative flex items-center gap-3 mx-2 px-3 py-2 text-[13px] rounded-lg transition-colors duration-150 group',
        isActive
          ? 'bg-amber-400/10 text-amber-200 font-semibold'
          : muted
            ? 'text-white/65 hover:text-white hover:bg-white/[0.04]'
            : 'text-white/90 hover:text-white hover:bg-white/[0.04]',
      )}
    >
      {/* Static left bar for the active item. No layoutId, no spring. */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-amber-400" />
      )}
      <span
        className={classNames(
          'flex-shrink-0',
          isActive ? 'text-amber-300' : 'text-white/55 group-hover:text-white/80',
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="truncate block leading-tight">{label}</span>
        {sublabel && (
          <span className="text-[10px] text-white/55 block leading-tight mt-0.5">{sublabel}</span>
        )}
      </div>
      {badge && <span className="flex-shrink-0">{badge}</span>}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Day Item — mini calendar card style                                */
/* ------------------------------------------------------------------ */

function DayItem({ href, dayNumber, dayLabel, weekday, eventCount, isActive, isToday: isTodayDay, isPast, activeRef }: {
  href: string;
  dayNumber: number;
  dayLabel: string;
  weekday: string;
  eventCount: number;
  isActive: boolean;
  isToday: boolean;
  isPast: boolean;
  activeRef?: React.Ref<HTMLAnchorElement>;
}) {
  return (
    <Link
      ref={isActive ? activeRef : undefined}
      href={href}
      className={classNames(
        'flex items-center gap-2.5 mx-3 px-2 py-1.5 rounded-xl transition-all duration-200 group relative',
        isActive
          ? 'bg-gradient-to-r from-orange-500/15 to-rose-500/10 backdrop-blur-sm shadow-lg shadow-orange-500/10 border border-orange-500/10'
          : isTodayDay
            ? 'bg-blue-500/[0.08] border border-blue-500/10'
            : 'hover:bg-white/[0.04]',
      )}
    >
      {/* Day number — mini card */}
      <div className={classNames(
        'w-8 h-8 rounded-lg flex flex-col items-center justify-center flex-shrink-0 transition-all duration-200 leading-none',
        isActive
          ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/30'
          : isTodayDay
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
            : isPast
              ? 'bg-white/[0.04] text-white/70'
              : eventCount > 0
                ? 'bg-white/[0.08] text-white'
                : 'bg-white/[0.04] text-white/70 group-hover:bg-white/[0.06]',
      )}>
        <span className="text-[11px] font-bold">{dayNumber}</span>
      </div>
      {/* Day info */}
      <div className="flex-1 min-w-0">
        <span className={classNames(
          'text-[12px] block leading-tight transition-colors duration-200 inline-flex items-center gap-1',
          isActive ? 'text-white font-semibold' : isPast ? 'text-white/70' : 'text-white'
        )}>
          {weekday} {dayLabel}
        </span>
        {isTodayDay && (
          <span className="inline-flex items-center gap-1 text-[9px] text-amber-300 font-bold uppercase tracking-wider mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Hoy
          </span>
        )}
      </div>
      {/* Event count dots / number */}
      {eventCount > 0 && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {eventCount <= 4 ? (
            Array.from({ length: eventCount }).map((_, i) => (
              <div key={i} className={classNames(
                'w-1.5 h-1.5 rounded-full transition-colors duration-200',
                isActive ? 'bg-orange-400' : isTodayDay ? 'bg-blue-400/60' : 'bg-white/15',
              )} />
            ))
          ) : (
            <span className={classNames(
              'text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center',
              isActive ? 'bg-orange-400/20 text-orange-300' : 'bg-white/[0.06] text-white/80',
            )}>
              {eventCount}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Week group label for itinerary                                     */
/* ------------------------------------------------------------------ */

function WeekLabel({ weekNumber, index }: { weekNumber: number; index: number }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-2 pb-1">
      <span className="text-[9px] font-bold text-white/70 uppercase tracking-[0.12em]">
        Semana {index + 1}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TripSidebarProps {
  tripId: string;
  trip: Trip | null;
  events: TripEvent[];
  currentPath: string;
  onScanDocument?: () => void;
  travelerCount?: number;
  updateTrip?: (data: Partial<Omit<Trip, 'id' | 'createdBy' | 'createdAt'>>) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TripSidebar({ tripId, trip, events, currentPath, onScanDocument, travelerCount, updateTrip }: TripSidebarProps) {
  const basePath = ROUTES.app.trip(tripId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { deleteTrip } = useTrips();
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const activeDayRef = useRef<HTMLAnchorElement>(null);
  const itineraryScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);

  // Auto-cancel the delete confirmation after 6s so the button doesn't sit
  // primed indefinitely.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 6000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const handleDelete = async () => {
    if (!trip) return;
    try {
      setDeleting(true);
      await deleteTrip(tripId);
      toast('Viaje borrado', 'success');
      router.push(ROUTES.app.dashboard);
    } catch (err) {
      console.error('Error deleting trip:', err);
      toast('No pudimos borrar el viaje', 'error');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Close the "..." menu on outside click / Escape.
  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent): void => {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const handleSidebarBackup = async () => {
    if (!trip) return;
    try {
      setBackingUp(true);
      const data = await exportTripBackup(tripId);
      const filename = getTripBackupFilename(trip.title);
      downloadBackup(data, filename);
    } catch (err) {
      console.error('Error al generar backup:', err);
    } finally {
      setBackingUp(false);
    }
  };

  const activeDayParam = searchParams.get('day');

  const isActive = (subpath: string) => {
    if (subpath === '') return currentPath === basePath;
    const fullPath = basePath + subpath;
    return currentPath === fullPath || currentPath.startsWith(fullPath + '/');
  };

  /* ---- Itinerary days ---- */

  const itineraryDays = useMemo(() => {
    if (!trip) return [];
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const days = eachDayOfInterval({ start, end });
      const today = new Date();

      return days.map((day, idx) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayEvents = events.filter((e) => e.date === dateStr);
        const weekday = format(day, 'EEE', { locale: es });
        const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        const dayLabel = format(day, 'd MMM', { locale: es });
        return {
          date: day,
          dateStr,
          weekday: capitalizedWeekday,
          dayLabel,
          dayNumber: idx + 1,
          eventCount: dayEvents.length,
          isToday: isToday(day),
          isPast: isBefore(day, today) && !isToday(day),
          isoWeek: getISOWeek(day),
        };
      });
    } catch {
      return [];
    }
  }, [trip, events]);

  /* ---- Group days by week ---- */

  const weekGroups = useMemo(() => {
    if (itineraryDays.length <= 7) return null; // No grouping for short trips
    const groups: { weekNumber: number; days: typeof itineraryDays }[] = [];
    let currentWeek = -1;
    for (const day of itineraryDays) {
      if (day.isoWeek !== currentWeek) {
        currentWeek = day.isoWeek;
        groups.push({ weekNumber: currentWeek, days: [] });
      }
      groups[groups.length - 1].days.push(day);
    }
    return groups;
  }, [itineraryDays]);

  /* ---- Date range formatted ---- */

  const dateRange = useMemo(() => {
    if (!trip) return '';
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const startStr = format(start, 'd MMM', { locale: es });
      const endStr = format(end, 'd MMM yyyy', { locale: es });
      return `${startStr} — ${endStr}`;
    } catch {
      return '';
    }
  }, [trip]);

  const tripDays = itineraryDays.length;

  /* ---- Is day active ---- */

  const isDayActive = (dateStr: string): boolean => {
    if (!isActive('/itinerary')) return false;
    if (activeDayParam) return activeDayParam === dateStr;
    if (itineraryDays.length > 0) return itineraryDays[0].dateStr === dateStr;
    return false;
  };

  /* ---- Scroll active day into view ---- */

  useEffect(() => {
    if (activeDayRef.current) {
      activeDayRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeDayParam, itineraryDays]);

  /* ---- Detect scrollable itinerary for fade indicator ---- */

  useEffect(() => {
    const el = itineraryScrollRef.current;
    if (!el) return;
    const check = () => {
      const isScrollable = el.scrollHeight > el.clientHeight;
      const isNotAtBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
      setShowScrollFade(isScrollable && isNotAtBottom);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      observer.disconnect();
    };
  }, [itineraryDays]);

  /* ---- Status ---- */

  const tripStatus: TripStatus = (trip?.status as TripStatus) || 'planning';

  const handleStatusChange = async (newStatus: TripStatus) => {
    if (!updateTrip) return;
    await updateTrip({ status: newStatus });
  };

  /* ---- Travelers count (still used in nav badge) ---- */

  const travelers = travelerCount || trip?.travelerIds?.length || 0;
  // Photo badge — count only. The full photo data lives in the photos
  // subcollection (~300+ docs for a big trip) and subscribing to it from
  // the sidebar made every page load N×500ms slower just to render a tiny
  // number. getCountFromServer returns a single aggregate row instead.
  // Event-only photo URLs come from the `events` prop we already have, so
  // no extra subscription needed.
  const [subPhotoCount, setSubPhotoCount] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getClientDb();
        const ref = collection(db, 'trips', tripId, 'photos');
        const snap = await getCountFromServer(ref);
        if (!cancelled) setSubPhotoCount(snap.data().count);
      } catch (err) {
        if (!cancelled) console.warn('[TripSidebar] photo count failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);
  const photoCount = useMemo(() => {
    const eventUrls = new Set<string>();
    for (const ev of events) {
      if (Array.isArray(ev.photos)) for (const url of ev.photos) if (url) eventUrls.add(url);
    }
    // Upper bound — we treat subcollection + event-only as additive. Worst
    // case there's some overlap and the badge shows N+ extras; for a nav
    // badge that's fine.
    return subPhotoCount + eventUrls.size;
  }, [subPhotoCount, events]);

  /* ---- Today / jump-to-today ---- */

  const todayInTripIdx = useMemo(() => {
    if (!trip) return -1;
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const today = new Date();
      if (isBefore(today, start) || isAfter(today, end)) return -1;
      return itineraryDays.findIndex((d) => d.isToday);
    } catch {
      return -1;
    }
  }, [trip, itineraryDays]);

  const todayDateStr = todayInTripIdx >= 0 ? itineraryDays[todayInTripIdx].dateStr : null;
  const showJumpToToday = todayDateStr !== null && (!isActive('/itinerary') || (activeDayParam !== todayDateStr && activeDayParam !== null));

  const handleJumpToToday = () => {
    if (!todayDateStr) return;
    router.push(basePath + '/itinerary?day=' + todayDateStr);
  };

  /* ---- Render day list (with or without week groups) ---- */

  const renderDayList = () => {
    if (weekGroups) {
      return weekGroups.map((group, gi) => (
        <div key={group.weekNumber}>
          <WeekLabel weekNumber={group.weekNumber} index={gi} />
          {group.days.map((day) => (
            <DayItem
              key={day.dateStr}
              href={basePath + '/itinerary?day=' + day.dateStr}
              dayNumber={day.dayNumber}
              dayLabel={day.dayLabel}
              weekday={day.weekday}
              eventCount={day.eventCount}
              isActive={isDayActive(day.dateStr)}
              isToday={day.isToday}
              isPast={day.isPast}
              activeRef={activeDayRef}
            />
          ))}
        </div>
      ));
    }
    return itineraryDays.map((day) => (
      <DayItem
        key={day.dateStr}
        href={basePath + '/itinerary?day=' + day.dateStr}
        dayNumber={day.dayNumber}
        dayLabel={day.dayLabel}
        weekday={day.weekday}
        eventCount={day.eventCount}
        isActive={isDayActive(day.dateStr)}
        isToday={day.isToday}
        isPast={day.isPast}
        activeRef={activeDayRef}
      />
    ));
  };

  return (
    <div
      className="flex flex-col h-full relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a1628 0%, #14243f 50%, #162d48 100%)' }}
    >
      {/* ====== TOP — Trip Switcher ====== */}
      <div className="px-4 pt-4 pb-2">
        <TripSwitcher currentTripId={tripId} currentTitle={trip?.title} />
      </div>

      {/* ====== Trip Identity ====== */}
      <div className="px-5 pt-2 pb-3">
        <h2 className="font-bold text-lg leading-tight tracking-tight text-white">
          {trip?.title || 'Cargando...'}
        </h2>
        {trip?.destination && (
          <p className="text-white/70 text-[11px] mt-1 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0 text-white/55" />
            {trip.destination}
          </p>
        )}
      </div>

      {/* Meta row — dates, duration pill, status menu */}
      <div className="px-4 pb-3">
        <div className="flex items-center flex-wrap gap-2 text-[11px]">
          {dateRange && (
            <div className="flex items-center gap-1 text-white/70">
              <CalendarDays className="w-3 h-3" />
              <span>{dateRange}</span>
            </div>
          )}
          {tripDays > 0 && (
            <span className="inline-flex items-center text-[10px] font-semibold text-white/80 bg-white/[0.05] rounded-full px-2.5 py-0.5 border border-white/[0.08]">
              <Clock className="w-2.5 h-2.5 mr-1" />
              {tripDays} días
            </span>
          )}
          {updateTrip && (
            <StatusChangeMenu currentStatus={tripStatus} onChange={handleStatusChange} />
          )}
        </div>
      </div>

      {/* Static divider */}
      <div className="mx-4 h-px bg-white/[0.08]" />

      {/* ====== NAVIGATION — scrollable ====== */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 relative z-10 sidebar-nav-scroll">
        {/* Principal */}
        <CollapsibleSection title="Principal">
          <NavItem
            href={basePath}
            label="General"
            icon={<MapPin className="w-4 h-4" />}
            isActive={isActive('')}
            color="general"
          />
          <NavItem
            href={basePath + '/documents'}
            label="Reservas y Docs"
            icon={<FileText className="w-4 h-4" />}
            isActive={isActive('/documents')}
            color="documents"
          />
          <NavItem
            href={basePath + '/budget'}
            label="Presupuesto"
            icon={<Wallet className="w-4 h-4" />}
            isActive={isActive('/budget')}
            color="budget"
          />
          <NavItem
            href={basePath + '/expenses'}
            label="Gastos"
            icon={<Receipt className="w-4 h-4" />}
            isActive={isActive('/expenses')}
            color="expenses"
          />
        </CollapsibleSection>

        {/* Itinerario */}
        <CollapsibleSection title="Itinerario" count={itineraryDays.length}>
          <div className="relative">
            <div className="px-3 pt-1 pb-1.5">
              <JumpToTodayButton visible={showJumpToToday} onJump={handleJumpToToday} />
            </div>
            <div ref={itineraryScrollRef} className="max-h-[300px] overflow-y-auto sidebar-nav-scroll space-y-0.5">
              {renderDayList()}
            </div>
            {showScrollFade && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#1a3352] to-transparent pointer-events-none" />
            )}
          </div>
        </CollapsibleSection>

        {/* Personas */}
        <CollapsibleSection title="Personas">
          <NavItem
            href={basePath + '/members'}
            label="Viajeros"
            icon={<Users className="w-4 h-4" />}
            isActive={isActive('/members')}
            color="travelers"
            badge={travelers > 0 ? (
              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 w-5 h-5 rounded-full flex items-center justify-center border border-amber-500/10 shadow-lg shadow-amber-500/5">
                {travelers}
              </span>
            ) : undefined}
          />
          <NavItem
            href={basePath + '/checklist'}
            label="Checklist"
            icon={<CheckSquare className="w-4 h-4" />}
            isActive={isActive('/checklist')}
            color="checklist"
          />
        </CollapsibleSection>

        {/* Recuerdos */}
        <CollapsibleSection title="Recuerdos">
          <NavItem
            href={basePath + '/photos'}
            label="Fotos"
            icon={<Camera className="w-4 h-4" />}
            isActive={isActive('/photos')}
            color="photos"
            badge={photoCount > 0 ? (
              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/10">
                {photoCount}
              </span>
            ) : undefined}
          />
        </CollapsibleSection>

        {/* Lugar */}
        <CollapsibleSection title="Lugar">
          <NavItem
            href={basePath + '/map'}
            label="Mapa"
            icon={<Map className="w-4 h-4" />}
            isActive={isActive('/map')}
            color="map"
          />
          <NavItem
            href={basePath + '/links'}
            label="Links útiles"
            icon={<ExternalLink className="w-4 h-4" />}
            isActive={isActive('/links')}
            color="links"
          />
        </CollapsibleSection>

        {/* Scan with AI — sobrio, no gradiente */}
        {onScanDocument && (
          <div className="px-3 pt-2">
            <button
              onClick={onScanDocument}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white/85 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Escanear con IA</span>
            </button>
          </div>
        )}
      </nav>

      {/* ====== FOOTER — Mis Viajes (primary) + "..." menu ====== */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Primary: back to dashboard */}
          <Link
            href={ROUTES.app.dashboard}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-white bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.15] transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Mis Viajes</span>
          </Link>

          {/* Secondary actions live behind a "..." menu */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label="Más acciones"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-white/75 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute z-30 right-0 bottom-full mb-2 w-56 rounded-xl border border-white/15 bg-[#0d1b2e] shadow-2xl shadow-black/60 overflow-hidden"
              >
                <Link
                  href={`${basePath}/edit`}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-white/90 hover:text-white hover:bg-white/[0.06] transition-colors"
                  role="menuitem"
                >
                  <Pencil className="w-3.5 h-3.5 text-white/55" />
                  Editar viaje
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    handleSidebarBackup();
                  }}
                  disabled={backingUp || !trip}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-white/90 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                  role="menuitem"
                >
                  {backingUp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white/55" />
                  ) : (
                    <HardDriveDownload className="w-3.5 h-3.5 text-white/55" />
                  )}
                  {backingUp ? 'Exportando...' : 'Descargar backup'}
                </button>
                <div className="h-px bg-white/[0.08]" />
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setConfirmDelete(true);
                  }}
                  disabled={!trip || deleting}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                  role="menuitem"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Borrar viaje
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Delete confirmation appears below the row when primed */}
        {confirmDelete && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 space-y-2">
            <div className="flex items-start gap-1.5 text-[11px] text-rose-100">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-300" />
              <span>Borrar este viaje no se puede deshacer.</span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-400 transition-colors disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white/85 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====== SCROLLBAR STYLES ====== */}
      <style jsx>{`
        .sidebar-nav-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 10px;
        }
        .sidebar-nav-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
        }
        .sidebar-nav-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
        }
      `}</style>
    </div>
  );
}
