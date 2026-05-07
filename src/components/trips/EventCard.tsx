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
  Ship,
  MoreHorizontal,
  Trash2,
  DollarSign,
  ChevronDown,
  Pencil,
  Paperclip,
  FileText,
  X,
  Eye,
  Image,
  File as FileIcon,
  Copy,
  Camera,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { EVENT_TYPES, EVENT_TYPE_TO_DOC_CATEGORY, DOCUMENT_CATEGORIES } from '@/config/constants';
import { classNames, formatCurrency, getTimezoneAbbr } from '@/lib/utils/helpers';
import DocumentUpload from '@/components/trips/DocumentUpload';
import PhotoGallery from '@/components/trips/PhotoGallery';
import type { TripEvent, EventType, TripAttachment, DocumentCategory } from '@/types';

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

/* ---- Left border colors by type ---- */

const BORDER_COLORS: Record<EventType, string> = {
  flight: 'border-l-cyan-400',
  hotel: 'border-l-violet-400',
  car_rental: 'border-l-yellow-400',
  activity: 'border-l-green-400',
  restaurant: 'border-l-orange-400',
  transport: 'border-l-blue-400',
  cruise: 'border-l-sky-400',
  souvenirs: 'border-l-pink-400',
  snacks: 'border-l-amber-400',
  clothing: 'border-l-rose-400',
  fuel: 'border-l-lime-400',
  misc: 'border-l-gray-400',
};

const BG_ICON_COLORS: Record<EventType, string> = {
  flight: 'bg-cyan-50 text-cyan-600',
  hotel: 'bg-violet-50 text-violet-600',
  car_rental: 'bg-yellow-50 text-yellow-600',
  activity: 'bg-green-50 text-green-600',
  restaurant: 'bg-orange-50 text-orange-600',
  transport: 'bg-blue-50 text-blue-600',
  cruise: 'bg-sky-50 text-sky-600',
  souvenirs: 'bg-pink-50 text-pink-600',
  snacks: 'bg-amber-50 text-amber-600',
  clothing: 'bg-rose-50 text-rose-600',
  fuel: 'bg-lime-50 text-lime-600',
  misc: 'bg-gray-100 text-gray-500',
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

/* ---- Props ---- */

interface EventCardProps {
  event: TripEvent;
  onEdit: (event: TripEvent) => void;
  onDelete: (eventId: string) => void;
  onDuplicate?: (event: TripEvent) => void;
  eventDocuments?: TripAttachment[];
  onUploadDocument?: (file: File) => Promise<string>;
  onDeleteDocument?: (docId: string, url: string) => Promise<void>;
  onAddPhoto?: (eventId: string, file: File) => Promise<void>;
  onDeletePhoto?: (eventId: string, url: string) => Promise<void>;
}

export default function EventCard({
  event,
  onEdit,
  onDelete,
  onDuplicate,
  eventDocuments = [],
  onUploadDocument,
  onDeleteDocument,
  onAddPhoto,
  onDeletePhoto,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);

  const typeConfig = EVENT_TYPES[event.type];
  const Icon = ICON_MAP[typeConfig.icon] || MoreHorizontal;

  const details = event.details || {};
  const hasDetails = Object.values(details).some((v) => v?.trim());

  const departureTzAbbr = event.timezone ? getTimezoneAbbr(event.timezone, event.date) : '';
  const arrivalDateStr = details.arrivalDate || event.date;
  const arrivalTzAbbr = details.arrivalTimezone
    ? getTimezoneAbbr(details.arrivalTimezone, arrivalDateStr)
    : '';

  const docCategory: DocumentCategory = EVENT_TYPE_TO_DOC_CATEGORY[event.type] || 'other';
  const docCount = eventDocuments.length;

  /* Flight duration calculation */
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

  /* Time range display */
  const timeRange = (() => {
    if (!event.startTime && !event.endTime) return null;
    const parts: string[] = [];
    if (event.startTime) parts.push(event.startTime);
    if (event.endTime) parts.push(event.endTime);
    return parts.join(' - ');
  })();

  return (
    <motion.div
      layout
      className={classNames(
        'bg-white rounded-xl border border-gray-200 border-l-4 overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow',
        BORDER_COLORS[event.type]
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Main row: clean timeline card layout */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Type icon */}
        <div
          className={classNames(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
            BG_ICON_COLORS[event.type]
          )}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Title */}
          <h4 className="text-gray-900 font-semibold text-sm truncate">{event.title}</h4>

          {/* Line 2: Time range */}
          {timeRange && (
            <p className="text-gray-500 text-xs mt-0.5">
              {timeRange}
              {departureTzAbbr && <span className="text-amber-500 ml-1">({departureTzAbbr})</span>}
              {flightDuration && <span className="text-cyan-600 font-medium ml-1.5">{flightDuration}</span>}
            </p>
          )}

          {/* Line 3: Location */}
          {event.location && (
            <p className="flex items-center gap-1 text-gray-400 text-xs mt-0.5 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {event.location}
            </p>
          )}
        </div>

        {/* Right side: cost + doc count + expand arrow */}
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {/* Doc count badge */}
          {docCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400">
              <Paperclip className="w-2.5 h-2.5" />
              {docCount}
            </span>
          )}

          {/* Cost */}
          {event.cost > 0 && (
            <span className="text-emerald-600 text-xs font-medium whitespace-nowrap">
              {formatCurrency(event.cost, event.currency)}
            </span>
          )}

          {/* Expand arrow */}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-300"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-gray-100">
              {/* Type badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-400 text-xs">Tipo:</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${typeConfig.color}25`, color: typeConfig.color }}
                >
                  {typeConfig.label}
                </span>
              </div>

              {/* Type-specific details */}
              {hasDetails && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                  {Object.entries(details).map(([key, value]) =>
                    value?.trim() && key !== 'arrivalTimezone' && key !== 'arrivalDate' ? (
                      <div key={key} className="min-w-0">
                        <span className="text-gray-400 text-[11px] block">{DETAIL_LABELS[key] || key}</span>
                        <span className="text-gray-800 text-sm truncate block">{value}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Notes */}
              {event.notes && (
                <p className="text-gray-600 text-sm mb-3 leading-relaxed">{event.notes}</p>
              )}

              {/* Photo gallery */}
              {onAddPhoto && onDeletePhoto && (
                <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                  {(event.photos?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400 text-xs font-medium">
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
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400 text-xs font-medium">
                      Documentos adjuntos ({eventDocuments.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {eventDocuments.map((doc) => {
                      const isImage = doc.type.startsWith('image/');
                      const isPdf = doc.type === 'application/pdf';
                      const DocIcon = isPdf ? FileText : isImage ? Image : FileIcon;

                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group/doc"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DocIcon className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          <span className="text-gray-700 text-xs truncate flex-1">
                            {doc.name}
                          </span>
                          <span className="text-gray-300 text-[10px] flex-shrink-0">
                            {formatFileSize(doc.size)}
                          </span>
                          {(isImage || isPdf) && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover/doc:opacity-100"
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
                              className="p-1 text-red-400/40 hover:text-red-400 transition-colors opacity-0 group-hover/doc:opacity-100"
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
                    className="overflow-hidden mb-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600 text-xs font-medium">
                          Adjuntar documento
                        </span>
                        <button
                          onClick={() => setShowDocUpload(false)}
                          className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
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
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(event);
                  }}
                  aria-label={`Editar evento ${event.title}`}
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
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
                    className="flex items-center gap-1.5 text-violet-600 hover:text-violet-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicar
                  </button>
                )}

                {onUploadDocument && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDocUpload(!showDocUpload);
                    }}
                    className={classNames(
                      'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                      showDocUpload
                        ? 'text-amber-600 bg-amber-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    )}
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
                  className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
