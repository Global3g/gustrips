'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  Pencil,
  Paperclip,
  FileText,
  X,
  Eye,
  Image as ImageIcon,
  File as FileIcon,
  Copy,
  Camera,
  Wine,
  Coffee,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';
import { EVENT_TYPES, EVENT_TYPE_TO_DOC_CATEGORY } from '@/config/constants';
import { classNames, formatCurrency, getTimezoneAbbr } from '@/lib/utils/helpers';
import DocumentUpload from '@/components/trips/DocumentUpload';
import PhotoGallery from '@/components/trips/PhotoGallery';
import EventPattern from '@/components/trips/EventPattern';
import QuickExpenseModal from '@/components/expenses/QuickExpenseModal';
import type { TripEvent, EventType, TripAttachment, DocumentCategory, TripExpense } from '@/types';

/* ---- Icon map ---- */

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  MoreHorizontal,
};

/* ---- Detail labels ---- */

const DETAIL_LABELS: Record<string, string> = {
  airline: 'Aerolinea',
  flightNumber: 'No. de vuelo',
  origin: 'Origen',
  destination: 'Destino',
  departureTerminal: 'Terminal',
  confirmationCode: 'Confirmacion',
  seatNumber: 'Asiento',
  baggage: 'Equipaje',
  clubPremier: 'Club Premier',
  hotelName: 'Hotel',
  address: 'Direccion',
  checkInDate: 'Check-in',
  checkOutDate: 'Check-out',
  checkInTime: 'Hora check-in',
  checkOutTime: 'Hora check-out',
  roomType: 'Habitacion',
  guests: 'Huespedes',
  rentalCompany: 'Empresa',
  pickupLocation: 'Recogida',
  dropoffLocation: 'Devolucion',
  pickupDate: 'Fecha recogida',
  pickupTime: 'Hora recogida',
  dropoffDate: 'Fecha devolucion',
  dropoffTime: 'Hora devolucion',
  carType: 'Vehiculo',
  restaurantName: 'Restaurante',
  reservationName: 'Reservacion',
  cuisine: 'Cocina',
  activityName: 'Actividad',
  duration: 'Duracion',
  bookingRef: 'Referencia',
  provider: 'Proveedor',
  fromLocation: 'Desde',
  toLocation: 'Hasta',
  transportMode: 'Modo',
};

/* ---- Helpers ---- */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRestaurantIcon(event: TripEvent): LucideIcon {
  // Normalize title: lowercase + strip diacritics so "desayuno", "Almuérzo", etc. match.
  const title = (event.title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  if (/\b(desayuno|breakfast|brunch)\b/.test(title)) return Coffee;
  if (/\b(cena|dinner|supper)\b/.test(title)) return Wine;
  if (/\b(comida|almuerzo|lunch)\b/.test(title)) return UtensilsCrossed;

  // Fall back to startTime windows
  const t = event.startTime;
  if (t && /^\d{2}:\d{2}/.test(t)) {
    const [hStr, mStr] = t.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const minutes = h * 60 + m;
      const inRange = (lo: number, hi: number) => minutes >= lo && minutes <= hi;
      if (inRange(5 * 60, 10 * 60 + 30)) return Coffee;       // 05:00 - 10:30
      if (inRange(11 * 60, 15 * 60 + 30)) return UtensilsCrossed; // 11:00 - 15:30
      if (inRange(18 * 60, 23 * 60)) return Wine;             // 18:00 - 23:00
    }
  }

  return UtensilsCrossed;
}

type StatusTone = 'live' | 'soon' | 'past' | null;

function getEventStatus(event: TripEvent): { label: string; tone: StatusTone } | null {
  if (!event.startTime || !event.date) return null;
  try {
    const now = new Date();
    const start = new Date(`${event.date}T${event.startTime}`);
    const end = event.endTime ? new Date(`${event.date}T${event.endTime}`) : start;
    if (Number.isNaN(start.getTime())) return null;

    if (now >= start && now <= end) return { label: 'EN CURSO', tone: 'live' };

    const minsUntil = differenceInMinutes(start, now);
    if (minsUntil < 0) {
      const minsAgo = Math.abs(minsUntil);
      if (minsAgo < 60 * 6) return { label: 'PASADO', tone: 'past' };
      return null;
    }
    if (minsUntil < 60) return { label: `EN ${minsUntil}m`, tone: 'soon' };
    if (minsUntil < 60 * 12) return { label: `EN ${Math.floor(minsUntil / 60)}h`, tone: 'soon' };
    return null;
  } catch {
    return null;
  }
}

/* ---- Props ---- */

interface EventCardProps {
  event: TripEvent;
  onEdit: (event: TripEvent) => void;
  onDelete: (eventId: string) => void;
  onDuplicate?: (event: TripEvent) => void;
  eventDocuments?: TripAttachment[];
  /** Expenses linked to this event — used to compute "Real cost" vs "Estimated cost" */
  eventExpenses?: TripExpense[];
  onUploadDocument?: (file: File) => Promise<string>;
  onDeleteDocument?: (docId: string, url: string) => Promise<void>;
  onAddPhoto?: (eventId: string, file: File) => Promise<void>;
  onDeletePhoto?: (eventId: string, url: string) => Promise<void>;
  /** Trip is completed or past its end date — disable the past-event mute so the itinerary stays vibrant for review/sharing. */
  tripCompleted?: boolean;
  /** Trip ID — required for the "Agregar gasto" button to work */
  tripId?: string;
}

export default function EventCard({
  event,
  onEdit,
  onDelete,
  onDuplicate,
  eventDocuments = [],
  eventExpenses = [],
  onUploadDocument,
  onDeleteDocument,
  onAddPhoto,
  onDeletePhoto,
  tripCompleted = false,
  tripId,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [tick, setTick] = useState(0);
  const [LeafletComponents, setLeafletComponents] = useState<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    if (event.latitude == null || event.longitude == null) return;
    if (LeafletComponents) return;
    Promise.all([import('react-leaflet'), import('leaflet')])
      .then(([RL, LMod]) => {
        const L = (LMod as any).default ?? LMod;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        setLeafletComponents({
          MapContainer: RL.MapContainer,
          TileLayer: RL.TileLayer,
          Marker: RL.Marker,
          Popup: RL.Popup,
        });
      })
      .catch(() => {});
  }, [expanded, event.latitude, event.longitude, LeafletComponents]);

  useEffect(() => {
    if (event.latitude == null || event.longitude == null) return;
    if (typeof document === 'undefined') return;
    const id = 'leaflet-css-link';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }, [event.latitude, event.longitude]);

  /* Mouse-tracked 3D tilt */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [3, -3]), { stiffness: 280, damping: 22 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-3, 3]), { stiffness: 280, damping: 22 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const typeConfig = EVENT_TYPES[event.type];
  const Icon = ICON_MAP[typeConfig.icon] || MoreHorizontal;
  const RenderedIcon = event.type === 'restaurant' ? getRestaurantIcon(event) : Icon;
  const typeColor = typeConfig.color;

  const status = useMemo(() => getEventStatus(event), [event, tick]);

  /* Past detection — independent of the badge's 6h cutoff. Mutes ALL past events. */
  const isPast = useMemo(() => {
    if (!event.date) return false;
    try {
      const now = new Date();
      if (event.endTime) {
        const end = new Date(`${event.date}T${event.endTime}`);
        if (!Number.isNaN(end.getTime())) return now > end;
      }
      if (event.startTime) {
        const start = new Date(`${event.date}T${event.startTime}`);
        if (!Number.isNaN(start.getTime())) return now > start;
      }
      // No time info — compare date against today (start of day)
      const eventDay = new Date(`${event.date}T00:00:00`);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return eventDay < todayStart;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, tick]);

  /* Scroll live event into view on first mount */
  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (status?.tone === 'live' && cardRef.current) {
      hasScrolledRef.current = true;
      const t = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [status?.tone]);

  const details = event.details || {};
  const hasDetails = Object.values(details).some((v) => v?.trim());

  const departureTzAbbr = event.timezone ? getTimezoneAbbr(event.timezone, event.date) : '';
  const arrivalDateStr = details.arrivalDate || event.date;
  const arrivalTzAbbr = details.arrivalTimezone
    ? getTimezoneAbbr(details.arrivalTimezone, arrivalDateStr)
    : '';

  const docCategory: DocumentCategory = EVENT_TYPE_TO_DOC_CATEGORY[event.type] || 'other';
  const docCount = eventDocuments.length;

  /* Real cost vs estimated cost — only sum expenses with same currency as event */
  const eventCurrency = event.currency || 'MXN';
  const realCost = useMemo(() => {
    return eventExpenses
      .filter((exp) => (exp.currency || 'MXN') === eventCurrency)
      .reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [eventExpenses, eventCurrency]);
  const hasRealCost = eventExpenses.length > 0;
  const costDelta = realCost - event.cost;
  const costDeltaPct = event.cost > 0 ? (costDelta / event.cost) * 100 : 0;

  /* Flight duration calculation (preserved) */
  const flightDuration = (() => {
    if (event.type !== 'flight' || !event.startTime || !event.endTime) return '';
    const depDate = event.date;
    const arrDate = details.arrivalDate || event.date;
    if (!depDate) return '';
    try {
      const depMs = new Date(`${depDate}T${event.startTime}`).getTime();
      const arrMs = new Date(`${arrDate}T${event.endTime}`).getTime();
      let diffMs = arrMs - depMs;
      if (event.timezone && details.arrivalTimezone) {
        const refDate = new Date(`${depDate}T${event.startTime}`);
        const getOffset = (tz: string) => {
          const str = refDate.toLocaleString('en-US', { timeZone: tz });
          return new Date(str).getTime() - refDate.getTime();
        };
        const depOffset = getOffset(event.timezone);
        const arrOffset = getOffset(details.arrivalTimezone);
        diffMs = diffMs - (arrOffset - depOffset);
      }
      if (diffMs <= 0) return '';
      const totalMin = Math.round(diffMs / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    } catch {
      return '';
    }
  })();

  const hasTime = !!event.startTime;

  const isLive = status?.tone === 'live';

  return (
    <div className="relative">
      {/* Outer pulsing halo (live only) — sits behind the card */}
      {isLive && (
        <div
          aria-hidden
          className="absolute -inset-1 rounded-3xl pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(circle, ${typeColor}66, transparent 60%)`,
            filter: 'blur(14px)',
            zIndex: 0,
          }}
        />
      )}
    <motion.div
      ref={cardRef}
      layout
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => setExpanded(!expanded)}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      animate={{
        opacity: isPast && !tripCompleted ? 0.62 : 1,
        filter: isPast && !tripCompleted ? 'saturate(0.55)' : 'saturate(1)',
        scale: isLive ? 1.015 : 1,
      }}
      whileHover={{
        scale: isLive ? 1.02 : 1.005,
        opacity: isPast && !tripCompleted ? 0.88 : 1,
        filter: isPast && !tripCompleted ? 'saturate(0.85)' : 'saturate(1)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative rounded-2xl cursor-pointer group overflow-hidden"
    >
      {/* L1 — Gradient mesh backdrop colored by event type */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${typeColor}1f 0%, rgba(255,255,255,0.7) 38%, rgba(255,255,255,0.6) 62%, ${typeColor}17 100%)`,
        }}
      />

      {/* L2 — Glass blur (lets the city background bleed through softly) */}
      <div className="absolute inset-0 bg-white/35 backdrop-blur-xl" />

      {/* L3 — Type-color aura blob (top right) */}
      <div
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 opacity-70 group-hover:opacity-100"
        style={{ background: `${typeColor}55` }}
      />

      {/* L3.5 — Extra emerald aura when live (bottom-left), pulses */}
      {isLive && (
        <div
          aria-hidden
          className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl pointer-events-none animate-pulse"
          style={{ background: 'rgba(16,185,129,0.40)' }}
        />
      )}

      {/* AHORA — animated gradient stripe at the top (live only) */}
      {isLive && (
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden pointer-events-none z-20"
        >
          <motion.div
            className="h-full w-1/2"
            style={{
              background: `linear-gradient(90deg, transparent, ${typeColor}, transparent)`,
            }}
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {/* L4 — Inner top highlight (glass edge) */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />

      {/* L4.5 — Decorative pattern unique to event type */}
      <div className="absolute inset-0 opacity-[0.11] pointer-events-none transition-opacity duration-500 group-hover:opacity-[0.18]">
        <EventPattern type={event.type} color={typeColor} />
      </div>

      {/* L5 — Vertical accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${typeColor}, ${typeColor}66)`,
          boxShadow: `0 0 14px ${typeColor}90`,
        }}
      />

      {/* L6 — Outer subtle border */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-colors duration-300"
        style={{
          border: '1px solid rgba(255,255,255,0.45)',
          boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -12px ${typeColor}33`,
        }}
      />

      {/* CONTENT */}
      <div className="relative z-10 p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-5">
          {/* TIME HERO (or icon if no time) */}
          {hasTime ? (
            <div className="flex-shrink-0 pt-0.5">
              <p
                className="text-xl sm:text-[26px] font-extrabold tabular-nums tracking-tight leading-none"
                style={{ color: typeColor, textShadow: `0 1px 0 rgba(255,255,255,0.6)` }}
              >
                {event.startTime}
              </p>
              {event.endTime && event.endTime !== event.startTime && (
                <>
                  <div className="w-7 h-px bg-gray-300/70 my-1.5" />
                  <p className="text-sm sm:text-[15px] text-gray-500 tabular-nums leading-none font-semibold">
                    {event.endTime}
                  </p>
                </>
              )}
              {flightDuration && (
                <p
                  className="text-[9px] mt-2.5 font-mono tracking-[0.18em] uppercase font-bold"
                  style={{ color: typeColor, opacity: 0.7 }}
                >
                  {flightDuration}
                </p>
              )}
              {departureTzAbbr && !flightDuration && (
                <p className="text-[9px] text-gray-400 mt-2 font-mono tracking-[0.15em] uppercase">
                  {departureTzAbbr}
                </p>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 pt-1">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{
                  backgroundColor: `${typeColor}1c`,
                  color: typeColor,
                  boxShadow: `0 0 0 1px ${typeColor}30, 0 6px 14px ${typeColor}30`,
                }}
              >
                <RenderedIcon className="w-6 h-6" />
              </div>
            </div>
          )}

          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2.5">
              <div className="flex-1 min-w-0">
                {/* Type label as small caps */}
                <p
                  className="text-[9px] font-extrabold tracking-[0.18em] uppercase leading-none mb-1.5"
                  style={{ color: typeColor }}
                >
                  {typeConfig.label}
                </p>
                {/* Title */}
                <h4 className="text-gray-900 font-bold text-[15px] leading-tight tracking-tight">
                  {event.title}
                </h4>
                {/* Location */}
                {event.location && (
                  <p className="flex items-center gap-1 text-gray-500 text-xs mt-1.5 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: typeColor }} />
                    {event.location}
                  </p>
                )}
              </div>

              {/* Right side: status + icon halo */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {status && (
                  <span
                    className={classNames(
                      'inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-full transition-all',
                      status.tone === 'live' && 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40',
                      status.tone === 'soon' && 'bg-amber-50 text-amber-700 border border-amber-200',
                      status.tone === 'past' && 'bg-gray-100 text-gray-400 border border-gray-200',
                    )}
                  >
                    {status.tone === 'live' && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                    {status.label}
                  </span>
                )}

                {hasTime && (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
                    style={{
                      backgroundColor: `${typeColor}1c`,
                      color: typeColor,
                      boxShadow: `0 0 0 1px ${typeColor}30, 0 4px 12px ${typeColor}30`,
                    }}
                  >
                    <RenderedIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom meta row */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {event.cost > 0 && (
                <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-gray-200/70 bg-white/40 backdrop-blur-sm">
                  {/* Estimated cost (always shown if cost > 0) */}
                  <div
                    className="flex flex-col items-start justify-center px-2.5 py-1"
                    title="Costo presupuestado"
                  >
                    <span className="text-[8px] font-bold tracking-[0.12em] uppercase text-blue-600 leading-none">Est.</span>
                    <span
                      className="text-[11px] font-bold tabular-nums leading-none mt-0.5"
                      style={{ color: '#1d4ed8' }}
                    >
                      {formatCurrency(event.cost, event.currency)}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="w-px bg-gray-200/70" />

                  {/* Real cost OR "falta capturar" warning */}
                  {hasRealCost ? (
                    <div
                      className="flex flex-col items-start justify-center px-2.5 py-1"
                      style={{
                        backgroundColor:
                          costDelta > 0.01
                            ? 'rgba(244,63,94,0.10)'
                            : costDelta < -0.01
                            ? 'rgba(16,185,129,0.10)'
                            : 'rgba(16,185,129,0.10)',
                      }}
                      title={
                        costDelta > 0.01
                          ? `${costDeltaPct > 0 ? '+' : ''}${costDeltaPct.toFixed(0)}% sobre el presupuesto`
                          : costDelta < -0.01
                          ? `${Math.abs(costDeltaPct).toFixed(0)}% bajo el presupuesto`
                          : 'En presupuesto'
                      }
                    >
                      <span
                        className="text-[8px] font-bold tracking-[0.12em] uppercase leading-none"
                        style={{
                          color:
                            costDelta > 0.01 ? '#be123c' : '#047857',
                        }}
                      >
                        Real
                      </span>
                      <span
                        className="text-[11px] font-bold tabular-nums leading-none mt-0.5"
                        style={{
                          color:
                            costDelta > 0.01 ? '#be123c' : '#047857',
                        }}
                      >
                        {formatCurrency(realCost, eventCurrency)}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tripId) setShowExpenseModal(true);
                      }}
                      className="flex flex-col items-start justify-center px-2.5 py-1 hover:bg-amber-100 transition-colors"
                      style={{ backgroundColor: 'rgba(245,158,11,0.13)' }}
                      title="Falta capturar el gasto real"
                    >
                      <span className="text-[8px] font-bold tracking-[0.12em] uppercase leading-none text-amber-700">
                        Real
                      </span>
                      <span className="text-[11px] font-bold leading-none mt-0.5 text-amber-700 inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Falta
                      </span>
                    </button>
                  )}
                </div>
              )}
              {docCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-white/60 border border-gray-200/60 rounded-full px-2 py-0.5 backdrop-blur-sm">
                  <Paperclip className="w-2.5 h-2.5" />
                  {docCount}
                </span>
              )}
              {arrivalTzAbbr && departureTzAbbr && arrivalTzAbbr !== departureTzAbbr && (
                <span className="text-[9px] text-amber-600 font-mono tracking-[0.15em] uppercase font-bold">
                  {departureTzAbbr} → {arrivalTzAbbr}
                </span>
              )}
              <div className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {expanded ? 'Cerrar' : 'Detalles'}
                </span>
                <motion.div
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="relative z-10 overflow-hidden"
          >
            <div className="px-5 pb-5">
              <div
                className="pt-4"
                style={{ borderTop: '1px solid rgba(255,255,255,0.6)' }}
              >
                {/* Type-specific details */}
                {hasDetails && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                    {Object.entries(details).map(([key, value]) =>
                      value?.trim() && key !== 'arrivalTimezone' && key !== 'arrivalDate' ? (
                        <div key={key} className="min-w-0">
                          <span
                            className="text-[9px] block font-bold tracking-[0.12em] uppercase mb-0.5"
                            style={{ color: typeColor, opacity: 0.75 }}
                          >
                            {DETAIL_LABELS[key] || key}
                          </span>
                          <span className="text-gray-800 text-sm font-medium truncate block">
                            {value}
                          </span>
                        </div>
                      ) : null
                    )}
                  </div>
                )}

                {event.latitude != null && event.longitude != null && LeafletComponents && (
                  <div
                    className="mb-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/60 backdrop-blur-sm border-b border-gray-200/60">
                      <MapPin className="w-3 h-3" style={{ color: typeColor }} />
                      <span
                        className="text-[10px] font-bold tracking-[0.12em] uppercase"
                        style={{ color: typeColor }}
                      >
                        Ubicacion
                      </span>
                      <a
                        href={`https://www.google.com/maps/?q=${event.latitude},${event.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        Abrir en Maps
                      </a>
                    </div>
                    <div style={{ height: 160 }}>
                      <LeafletComponents.MapContainer
                        center={[event.latitude, event.longitude]}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={false}
                        attributionControl={false}
                      >
                        <LeafletComponents.TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution="&copy; OpenStreetMap"
                        />
                        <LeafletComponents.Marker position={[event.latitude, event.longitude]}>
                          <LeafletComponents.Popup>
                            {event.location || event.title}
                          </LeafletComponents.Popup>
                        </LeafletComponents.Marker>
                      </LeafletComponents.MapContainer>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {event.notes && (
                  <div
                    className="text-gray-700 text-sm mb-4 leading-relaxed rounded-xl p-3"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(255,255,255,0.7)',
                    }}
                  >
                    {event.notes}
                  </div>
                )}

                {/* Photo gallery */}
                {onAddPhoto && onDeletePhoto && (
                  <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                    {(event.photos?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <Camera className="w-3 h-3" style={{ color: typeColor }} />
                        <span
                          className="text-[10px] font-bold tracking-[0.12em] uppercase"
                          style={{ color: typeColor }}
                        >
                          Fotos ({event.photos!.length})
                        </span>
                      </div>
                    )}
                    <PhotoGallery
                      photos={event.photos ?? []}
                      onAddPhoto={(file) => onAddPhoto(event.id, file)}
                      onDeletePhoto={(url) => onDeletePhoto(event.id, url)}
                    />
                  </div>
                )}

                {/* Attached documents list */}
                {eventDocuments.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Paperclip className="w-3 h-3" style={{ color: typeColor }} />
                      <span
                        className="text-[10px] font-bold tracking-[0.12em] uppercase"
                        style={{ color: typeColor }}
                      >
                        Documentos ({eventDocuments.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {eventDocuments.map((doc) => {
                        const isImage = doc.type.startsWith('image/');
                        const isPdf = doc.type === 'application/pdf';
                        const DocIcon = isPdf ? FileText : isImage ? ImageIcon : FileIcon;

                        return (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 group/doc backdrop-blur-sm"
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.6)',
                              border: '1px solid rgba(255,255,255,0.7)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DocIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 text-xs truncate flex-1 font-medium">
                              {doc.name}
                            </span>
                            <span className="text-gray-400 text-[10px] flex-shrink-0">
                              {formatFileSize(doc.size)}
                            </span>
                            {(isImage || isPdf) && (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-gray-400 hover:text-gray-700 transition-colors opacity-0 group-hover/doc:opacity-100"
                                aria-label="Ver"
                              >
                                <Eye className="w-3 h-3" />
                              </a>
                            )}
                            {onDeleteDocument && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Eliminar "${doc.name}"?`)) {
                                    onDeleteDocument(doc.id, doc.url);
                                  }
                                }}
                                className="p-1 text-red-400/50 hover:text-red-500 transition-colors opacity-0 group-hover/doc:opacity-100"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Document upload overlay */}
                <AnimatePresence>
                  {showDocUpload && onUploadDocument && onDeleteDocument && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="rounded-xl p-3 backdrop-blur-sm"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.6)',
                          border: '1px solid rgba(255,255,255,0.75)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="text-[10px] font-bold tracking-[0.12em] uppercase"
                            style={{ color: typeColor }}
                          >
                            Adjuntar documento
                          </span>
                          <button
                            onClick={() => setShowDocUpload(false)}
                            className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                            aria-label="Cerrar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <DocumentUpload
                          documents={[]}
                          onUpload={onUploadDocument}
                          onDelete={onDeleteDocument}
                          category={docCategory}
                          eventId={event.id}
                          hideCategorySelector
                          compact
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(event);
                    }}
                    aria-label={`Editar evento ${event.title}`}
                    className="inline-flex items-center gap-1.5 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all backdrop-blur-sm"
                    style={{
                      backgroundColor: 'rgba(59,130,246,0.1)',
                      border: '1px solid rgba(59,130,246,0.2)',
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>

                  {onDuplicate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(event);
                      }}
                      aria-label={`Duplicar evento ${event.title}`}
                      className="inline-flex items-center gap-1.5 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all backdrop-blur-sm"
                      style={{
                        backgroundColor: 'rgba(139,92,246,0.1)',
                        border: '1px solid rgba(139,92,246,0.2)',
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicar
                    </button>
                  )}

                  {tripId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExpenseModal(true);
                      }}
                      aria-label={`Agregar gasto para ${event.title}`}
                      className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all backdrop-blur-sm"
                      style={{
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.25)',
                      }}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      Agregar gasto
                    </button>
                  )}

                  {onUploadDocument && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDocUpload(!showDocUpload);
                      }}
                      className={classNames(
                        'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all backdrop-blur-sm',
                        showDocUpload
                          ? 'text-amber-700'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                      style={
                        showDocUpload
                          ? {
                              backgroundColor: 'rgba(245,158,11,0.13)',
                              border: '1px solid rgba(245,158,11,0.25)',
                            }
                          : {
                              backgroundColor: 'rgba(255,255,255,0.55)',
                              border: '1px solid rgba(255,255,255,0.7)',
                            }
                      }
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Adjuntar
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Eliminar "${event.title}"? Esta accion no se puede deshacer.`)) {
                        onDelete(event.id);
                      }
                    }}
                    aria-label={`Eliminar evento ${event.title}`}
                    className="inline-flex items-center gap-1.5 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg ml-auto transition-all backdrop-blur-sm"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    {tripId && (
      <QuickExpenseModal
        open={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        tripId={tripId}
        event={event}
      />
    )}
    </div>
  );
}
