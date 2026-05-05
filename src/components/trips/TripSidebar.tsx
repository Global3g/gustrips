'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format, parseISO, eachDayOfInterval, isToday, isBefore, getISOWeek } from 'date-fns';
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
  Plane,
  Hotel,
  Car,
  UtensilsCrossed,
  Ship,
  ArrowLeft,
  FileSearch,
  HardDriveDownload,
  Loader2,
  Sparkles,
  Globe,
  Clock,
  TrendingUp,
  Check,
  X as XIcon,
} from 'lucide-react';
import { classNames, formatCurrency } from '@/lib/utils/helpers';
import { exportTripBackup, downloadBackup, getTripBackupFilename } from '@/lib/utils/backup';
import { ROUTES } from '@/config/constants';
import type { Trip, TripEvent } from '@/types';

/* ------------------------------------------------------------------ */
/*  Nav color map — each nav item gets its own unique accent color     */
/* ------------------------------------------------------------------ */

const NAV_COLORS = {
  general:      { icon: 'text-blue-400',    activeBg: 'bg-blue-500/15',    activeText: 'text-blue-300',    glow: 'shadow-blue-500/20',    bar: 'from-blue-400 to-blue-500' },
  documents:    { icon: 'text-violet-400',   activeBg: 'bg-violet-500/15',  activeText: 'text-violet-300',  glow: 'shadow-violet-500/20',  bar: 'from-violet-400 to-violet-500' },
  budget:       { icon: 'text-emerald-400',  activeBg: 'bg-emerald-500/15', activeText: 'text-emerald-300', glow: 'shadow-emerald-500/20', bar: 'from-emerald-400 to-emerald-500' },
  expenses:     { icon: 'text-orange-400',  activeBg: 'bg-orange-500/15',  activeText: 'text-orange-300',  glow: 'shadow-orange-500/20',  bar: 'from-orange-400 to-orange-500' },
  travelers:    { icon: 'text-amber-400',    activeBg: 'bg-amber-500/15',   activeText: 'text-amber-300',   glow: 'shadow-amber-500/20',   bar: 'from-amber-400 to-amber-500' },
  checklist:    { icon: 'text-cyan-400',     activeBg: 'bg-cyan-500/15',    activeText: 'text-cyan-300',    glow: 'shadow-cyan-500/20',    bar: 'from-cyan-400 to-cyan-500' },
  links:        { icon: 'text-rose-400',     activeBg: 'bg-rose-500/15',    activeText: 'text-rose-300',    glow: 'shadow-rose-500/20',    bar: 'from-rose-400 to-rose-500' },
  photos:       { icon: 'text-amber-400',    activeBg: 'bg-amber-500/15',   activeText: 'text-amber-300',   glow: 'shadow-amber-500/20',   bar: 'from-amber-400 to-amber-500' },
  map:          { icon: 'text-sky-400',      activeBg: 'bg-sky-500/15',     activeText: 'text-sky-300',     glow: 'shadow-sky-500/20',     bar: 'from-sky-400 to-sky-500' },
} as const;

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; icon: typeof Clock }> = {
  planning:  { label: 'Planificando', bg: 'bg-amber-500/15', text: 'text-amber-300', dot: 'bg-amber-400', icon: Clock },
  active:    { label: 'Activo',       bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400', icon: Plane },
  completed: { label: 'Completado',   bg: 'bg-blue-500/15', text: 'text-blue-300', dot: 'bg-blue-400', icon: Check },
  cancelled: { label: 'Cancelado',    bg: 'bg-red-500/15', text: 'text-red-300', dot: 'bg-red-400', icon: XIcon },
};

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
        className="flex items-center gap-1.5 w-full px-5 py-2.5 text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] hover:text-white/45 transition-colors duration-200"
      >
        <ChevronDown
          className={classNames(
            'w-3 h-3 transition-transform duration-300 ease-out',
            open ? '' : '-rotate-90',
          )}
        />
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[9px] font-semibold text-white/35 bg-white/[0.06] rounded-full px-2 py-0.5 normal-case tracking-normal border border-white/[0.06]">
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
/*  NavItem — colored per section                                      */
/* ------------------------------------------------------------------ */

function NavItem({ href, label, icon, isActive, badge, sublabel, muted, color }: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  badge?: React.ReactNode;
  sublabel?: string;
  muted?: boolean;
  color: keyof typeof NAV_COLORS;
}) {
  const c = NAV_COLORS[color];

  return (
    <Link
      href={href}
      className={classNames(
        'flex items-center gap-3 mx-3 px-3 py-2.5 text-[13px] rounded-xl transition-all duration-200 group relative',
        isActive
          ? `${c.activeBg} ${c.activeText} font-semibold shadow-lg ${c.glow} backdrop-blur-sm border border-white/[0.06]`
          : muted
            ? 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
            : 'text-white/55 hover:text-white/90 hover:bg-white/[0.05]',
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <div className={classNames(
          'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b',
          c.bar,
        )} />
      )}
      <span className={classNames(
        'flex-shrink-0 transition-all duration-200',
        isActive ? c.icon : muted ? 'text-white/20' : `${c.icon} opacity-40 group-hover:opacity-70`
      )}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="truncate block leading-tight">{label}</span>
        {sublabel && (
          <span className="text-[10px] text-white/30 block leading-tight mt-0.5">{sublabel}</span>
        )}
      </div>
      {badge && (
        <span className="flex-shrink-0">{badge}</span>
      )}
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
              ? 'bg-white/[0.04] text-white/20'
              : eventCount > 0
                ? 'bg-white/[0.08] text-white/50'
                : 'bg-white/[0.04] text-white/20 group-hover:bg-white/[0.06]',
      )}>
        <span className="text-[11px] font-bold">{dayNumber}</span>
      </div>
      {/* Day info */}
      <div className="flex-1 min-w-0">
        <span className={classNames(
          'text-[12px] block leading-tight transition-colors duration-200',
          isActive ? 'text-white font-semibold' : isPast ? 'text-white/20' : 'text-white/50'
        )}>
          {weekday} {dayLabel}
        </span>
        {isTodayDay && (
          <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 font-bold uppercase tracking-wider mt-0.5">
            <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
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
              isActive ? 'bg-orange-400/20 text-orange-300' : 'bg-white/[0.06] text-white/30',
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
      <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.12em]">
        Semana {index + 1}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reservation Pills                                                  */
/* ------------------------------------------------------------------ */

function ReservationPills({ events }: { events: TripEvent[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { flight: 0, hotel: 0, car_rental: 0, restaurant: 0, cruise: 0 };
    for (const e of events) {
      if (c[e.type] !== undefined) c[e.type]++;
    }
    return c;
  }, [events]);

  const items = [
    { type: 'flight', icon: Plane, label: 'Vuelos', count: counts.flight, bg: 'bg-pink-500/15', text: 'text-pink-400', shadow: 'shadow-pink-500/10' },
    { type: 'hotel', icon: Hotel, label: 'Hoteles', count: counts.hotel, bg: 'bg-violet-500/15', text: 'text-violet-400', shadow: 'shadow-violet-500/10' },
    { type: 'cruise', icon: Ship, label: 'Crucero', count: counts.cruise, bg: 'bg-sky-500/15', text: 'text-sky-400', shadow: 'shadow-sky-500/10' },
    { type: 'car_rental', icon: Car, label: 'Autos', count: counts.car_rental, bg: 'bg-amber-500/15', text: 'text-amber-400', shadow: 'shadow-amber-500/10' },
    { type: 'restaurant', icon: UtensilsCrossed, label: 'Comida', count: counts.restaurant, bg: 'bg-orange-500/15', text: 'text-orange-400', shadow: 'shadow-orange-500/10' },
  ].filter(i => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.type}
            className={classNames(
              'inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2.5 py-1 backdrop-blur-sm border border-white/[0.06] shadow-lg',
              item.bg,
              item.text,
              item.shadow,
            )}
            title={`${item.count} ${item.label}`}
          >
            <Icon className="w-3 h-3" />
            <span>{item.count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick stat mini card                                               */
/* ------------------------------------------------------------------ */

function StatMiniCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm px-2.5 py-2 text-center transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.08]">
      <div className={classNames('flex items-center justify-center mb-1', color)}>
        {icon}
      </div>
      <div className="text-[13px] font-bold text-white/90 leading-none">{value}</div>
      <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5 leading-none truncate">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Destination gradient generator                                     */
/* ------------------------------------------------------------------ */

function getDestinationGradient(destination: string): string {
  const hash = destination.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-indigo-600 via-purple-600 to-pink-500',
    'from-emerald-600 via-teal-600 to-cyan-500',
    'from-orange-600 via-red-600 to-pink-500',
    'from-blue-600 via-indigo-600 to-violet-500',
    'from-rose-600 via-pink-600 to-fuchsia-500',
    'from-amber-600 via-orange-600 to-red-500',
    'from-cyan-600 via-blue-600 to-indigo-500',
    'from-teal-600 via-emerald-600 to-green-500',
  ];
  return gradients[hash % gradients.length];
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
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TripSidebar({ tripId, trip, events, currentPath, onScanDocument, travelerCount }: TripSidebarProps) {
  const basePath = ROUTES.app.trip(tripId);
  const searchParams = useSearchParams();
  const [backingUp, setBackingUp] = useState(false);
  const activeDayRef = useRef<HTMLAnchorElement>(null);
  const itineraryScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);

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
    return currentPath === basePath + subpath;
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

  /* ---- Budget ---- */

  const totalSpent = useMemo(() => events.reduce((sum, e) => sum + (e.cost || 0), 0), [events]);
  const budgetCurrency = trip?.budgetCurrency || 'MXN';

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

  const status = STATUS_CONFIG[trip?.status || 'planning'] || STATUS_CONFIG.planning;

  /* ---- Quick stats ---- */

  const eventCount = events.length;
  const travelers = travelerCount || trip?.travelerIds?.length || 0;

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
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0f1729] via-[#131e33] to-[#0c1320] relative overflow-hidden">

      {/* ====== BACKGROUND DECORATIVE ORBS ====== */}
      <div className="absolute top-12 -left-12 w-40 h-40 bg-blue-600/[0.07] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-16 w-48 h-48 bg-violet-600/[0.05] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -left-8 w-36 h-36 bg-emerald-600/[0.04] rounded-full blur-3xl pointer-events-none" />

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }} />

      {/* ====== TOP — Logo + Back ====== */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between relative z-10">
        <Link
          href={ROUTES.app.dashboard}
          className="inline-flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/70 transition-all duration-200 rounded-lg px-2 py-1.5 -ml-1 hover:bg-white/[0.05] group"
        >
          <ArrowLeft className="w-3 h-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>Mis Viajes</span>
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GusTrips" className="h-7 opacity-50 hover:opacity-70 transition-opacity duration-200" />
      </div>

      {/* ====== Trip Identity ====== */}
      <div className="relative z-10">
        <div className="px-5 pt-2 pb-3">
          <h2 className="text-white font-extrabold text-lg leading-tight tracking-tight">
            {trip?.title || 'Cargando...'}
          </h2>
          {trip?.destination && (
            <p className="text-white/50 text-[11px] mt-1 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0 text-rose-400/60" />
              {trip.destination}
            </p>
          )}
        </div>

        {/* Meta row — dates, duration pill, status badge */}
        <div className="px-4 pt-3 pb-2 space-y-3">
          {/* Date + Duration + Status */}
          <div className="flex items-center flex-wrap gap-2 text-[11px]">
            {dateRange && (
              <div className="flex items-center gap-1 text-white/35">
                <CalendarDays className="w-3 h-3" />
                <span>{dateRange}</span>
              </div>
            )}
            {tripDays > 0 && (
              <span className="inline-flex items-center text-[10px] font-bold text-white/50 bg-white/[0.06] backdrop-blur-sm rounded-full px-2.5 py-0.5 border border-white/[0.08]">
                <Clock className="w-2.5 h-2.5 mr-1 text-white/30" />
                {tripDays} dias
              </span>
            )}
            <span className={classNames(
              'inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-0.5 border border-white/[0.06]',
              status.bg,
              status.text,
            )}>
              <status.icon className="w-3 h-3" />
              {status.label}
            </span>
          </div>

          {/* Reservation pills */}
          <ReservationPills events={events} />
        </div>
      </div>

      {/* ====== QUICK STATS ROW ====== */}
      <div className="px-3 pb-3 relative z-10">
        <div className="flex gap-2">
          <StatMiniCard
            icon={<CalendarDays className="w-3.5 h-3.5" />}
            value={eventCount}
            label="Eventos"
            color="text-blue-400"
          />
          <StatMiniCard
            icon={<Users className="w-3.5 h-3.5" />}
            value={travelers}
            label="Viajeros"
            color="text-amber-400"
          />
        </div>
      </div>

      {/* Gradient divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent relative z-10" />

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
          <div className="flex items-center">
            <div className="flex-1">
              <NavItem
                href={basePath + '/documents'}
                label="Reservas y Docs"
                icon={<FileText className="w-4 h-4" />}
                isActive={isActive('/documents')}
                color="documents"
              />
            </div>
            {onScanDocument && (
              <button
                onClick={onScanDocument}
                className="p-1.5 mr-3 rounded-lg text-white/20 hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/5"
                title="Escanear documento con IA"
              >
                <FileSearch className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <NavItem
            href={basePath + '/budget'}
            label="Presupuesto"
            icon={<Wallet className="w-4 h-4" />}
            isActive={isActive('/budget')}
            color="budget"
            badge={
              totalSpent > 0 ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm border bg-emerald-500/15 text-emerald-400 border-emerald-500/10 shadow-lg shadow-emerald-500/5">
                  {formatCurrency(totalSpent, budgetCurrency)}
                </span>
              ) : undefined
            }
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
            <div ref={itineraryScrollRef} className="max-h-[300px] overflow-y-auto sidebar-nav-scroll space-y-0.5">
              {renderDayList()}
            </div>
            {showScrollFade && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#131e33] to-transparent pointer-events-none" />
            )}
          </div>
        </CollapsibleSection>

        {/* Mas */}
        <CollapsibleSection title="Mas">
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
            href={basePath + '/photos'}
            label="Fotos"
            icon={<Camera className="w-4 h-4" />}
            isActive={isActive('/photos')}
            color="photos"
          />
          <NavItem
            href={basePath + '/map'}
            label="Mapa"
            icon={<Map className="w-4 h-4" />}
            isActive={isActive('/map')}
            color="map"
          />
          <NavItem
            href={basePath + '/checklist'}
            label="Checklist"
            icon={<CheckSquare className="w-4 h-4" />}
            isActive={isActive('/checklist')}
            color="checklist"
          />
          <NavItem
            href={basePath + '/links'}
            label="Links utiles"
            icon={<ExternalLink className="w-4 h-4" />}
            isActive={isActive('/links')}
            color="links"
          />
        </CollapsibleSection>

        {/* ====== SCAN BUTTON — prominent ====== */}
        {onScanDocument && (
          <div className="px-3 pt-2 pb-1">
            <button
              onClick={onScanDocument}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-fuchsia-600/20 hover:from-violet-600/30 hover:via-purple-600/30 hover:to-fuchsia-600/30 text-violet-300 hover:text-violet-200 border border-violet-500/15 hover:border-violet-500/25 shadow-lg shadow-violet-500/5 hover:shadow-violet-500/10 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Escanear con IA</span>
            </button>
          </div>
        )}
      </nav>

      {/* ====== BOTTOM — Backup + Brand ====== */}
      <div className="relative z-10">
        {/* Gradient divider */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        <div className="px-4 py-3 space-y-2">
          {/* Backup button */}
          <button
            onClick={handleSidebarBackup}
            disabled={backingUp || !trip}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium text-white/30 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-200 disabled:opacity-40"
          >
            {backingUp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <HardDriveDownload className="w-3.5 h-3.5" />
            )}
            <span>{backingUp ? 'Exportando...' : 'Descargar backup'}</span>
          </button>

          {/* Bottom brand */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            <div className="w-3 h-px bg-gradient-to-r from-transparent to-white/10" />
            <p className="text-[9px] text-white/15 font-bold tracking-[0.2em] uppercase">GusTrips</p>
            <div className="w-3 h-px bg-gradient-to-l from-transparent to-white/10" />
          </div>
        </div>
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
