'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  MoreHorizontal,
  Trash2,
  Clock,
  DollarSign,
  ChevronDown,
  Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { EVENT_TYPES } from '@/config/constants';
import { classNames, formatCurrency, getTimezoneAbbr } from '@/lib/utils/helpers';
import type { TripEvent, EventType } from '@/types';

/* ─── Mapa de iconos Lucide ─────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  MoreHorizontal,
};

/* ─── Colores de borde por tipo ─────────────────── */

const BORDER_COLORS: Record<EventType, string> = {
  flight: 'border-l-cyan-400',
  hotel: 'border-l-violet-400',
  car_rental: 'border-l-yellow-400',
  activity: 'border-l-green-400',
  restaurant: 'border-l-orange-400',
  transport: 'border-l-blue-400',
  other: 'border-l-gray-400',
};

const BG_ICON_COLORS: Record<EventType, string> = {
  flight: 'bg-cyan-500/20 text-cyan-400',
  hotel: 'bg-violet-500/20 text-violet-400',
  car_rental: 'bg-yellow-500/20 text-yellow-400',
  activity: 'bg-green-500/20 text-green-400',
  restaurant: 'bg-orange-500/20 text-orange-400',
  transport: 'bg-blue-500/20 text-blue-400',
  other: 'bg-gray-500/20 text-gray-400',
};

/* ─── Labels para detalles por tipo ────────────── */

const DETAIL_LABELS: Record<string, string> = {
  // Flight
  airline: 'Aerolínea',
  flightNumber: 'No. de vuelo',
  origin: 'Origen',
  destination: 'Destino',
  departureTerminal: 'Terminal',
  confirmationCode: 'Confirmación',
  seatNumber: 'Asiento',
  baggage: 'Equipaje',
  clubPremier: 'Club Premier',
  // Hotel
  hotelName: 'Hotel',
  address: 'Dirección',
  checkInDate: 'Check-in',
  checkOutDate: 'Check-out',
  checkInTime: 'Hora check-in',
  checkOutTime: 'Hora check-out',
  roomType: 'Habitación',
  guests: 'Huéspedes',
  // Car rental
  rentalCompany: 'Empresa',
  pickupLocation: 'Recogida',
  dropoffLocation: 'Devolución',
  pickupDate: 'Fecha recogida',
  pickupTime: 'Hora recogida',
  dropoffDate: 'Fecha devolución',
  dropoffTime: 'Hora devolución',
  carType: 'Vehículo',
  // Restaurant
  restaurantName: 'Restaurante',
  reservationName: 'Reservación',
  cuisine: 'Cocina',
  // Activity
  activityName: 'Actividad',
  duration: 'Duración',
  bookingRef: 'Referencia',
  provider: 'Proveedor',
  // Transport
  fromLocation: 'Desde',
  toLocation: 'Hasta',
  transportMode: 'Modo',
};

interface EventCardProps {
  event: TripEvent;
  onEdit: (event: TripEvent) => void;
  onDelete: (eventId: string) => void;
}

export default function EventCard({ event, onEdit, onDelete }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);

  const typeConfig = EVENT_TYPES[event.type];
  const Icon = ICON_MAP[typeConfig.icon] || MoreHorizontal;

  const details = event.details || {};
  const hasDetails = Object.values(details).some((v) => v?.trim());

  // Timezone abbreviations (para todos los tipos)
  const departureTzAbbr = event.timezone ? getTimezoneAbbr(event.timezone, event.date) : '';
  const arrivalDateStr = details.arrivalDate || event.date;
  const arrivalTzAbbr = details.arrivalTimezone
    ? getTimezoneAbbr(details.arrivalTimezone, arrivalDateStr)
    : '';
  // ¿La fecha de llegada es distinta a la de salida?
  const arrivalDateDiffers = details.arrivalDate && details.arrivalDate !== event.date;

  // Duración (para vuelos)
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

  return (
    <motion.div
      layout
      className={classNames(
        'glass rounded-xl border-l-4 overflow-hidden cursor-pointer',
        BORDER_COLORS[event.type]
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Fila principal */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icono del tipo */}
        <div
          className={classNames(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            BG_ICON_COLORS[event.type]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>

        {/* Informacion */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-sm truncate">{event.title}</h4>

          {/* ── Salida y llegada para todos los tipos ── */}
          <div className="mt-1 space-y-0.5">
            {event.startTime && (
              <p className="text-white/50 text-xs">
                <span className="text-white/30 font-medium">Sale:</span>{' '}
                {format(parseISO(event.date), "d MMM", { locale: es })},{' '}
                {event.startTime}
                {departureTzAbbr && <span className="text-amber-400/70"> ({departureTzAbbr})</span>}
              </p>
            )}
            {event.endTime && (
              <p className="text-white/50 text-xs">
                <span className="text-white/30 font-medium">Llega:</span>{' '}
                {format(parseISO(details.arrivalDate || event.date), "d MMM", { locale: es })},{' '}
                {event.endTime}
                {(arrivalTzAbbr || departureTzAbbr) && (
                  <span className="text-amber-400/70"> ({arrivalTzAbbr || departureTzAbbr})</span>
                )}
                {flightDuration && (
                  <span className="text-cyan-400/70 font-medium"> · {flightDuration}</span>
                )}
              </p>
            )}
            {event.location && event.type !== 'flight' && (
              <p className="flex items-center gap-1 text-white/50 text-xs truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {event.location}
              </p>
            )}
          </div>
        </div>

        {/* Costo */}
        {event.cost > 0 && (
          <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium flex-shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
            {formatCurrency(event.cost, event.currency)}
          </span>
        )}

        {/* Flecha expandir */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/30 flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </div>

      {/* Contenido expandido */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/10">
              {/* Tipo */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/40 text-xs">Tipo:</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${typeConfig.color}25`, color: typeConfig.color }}
                >
                  {typeConfig.label}
                </span>
              </div>

              {/* Detalles especificos del tipo */}
              {hasDetails && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                  {Object.entries(details).map(([key, value]) =>
                    value?.trim() && key !== 'arrivalTimezone' && key !== 'arrivalDate' ? (
                      <div key={key} className="min-w-0">
                        <span className="text-white/40 text-[11px] block">{DETAIL_LABELS[key] || key}</span>
                        <span className="text-white/80 text-sm truncate block">{value}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Notas */}
              {event.notes && (
                <p className="text-white/60 text-sm mb-3 leading-relaxed">{event.notes}</p>
              )}

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(event);
                  }}
                  className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(event.id);
                  }}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
