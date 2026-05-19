'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSearch,
  Upload,
  X,
  Check,
  AlertCircle,
  Plane,
  Hotel,
  Car,
  UtensilsCrossed,
  MapPin,
  Bus,
  Ship,
  HelpCircle,
  Clock,
  CalendarDays,
  DollarSign,
  FileText,
  Pencil,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  type LucideIcon,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { scanBulkDocument, ScanNetworkError, type ScannedEvent } from '@/lib/utils/aiScanner';
import { EVENT_TYPES, CURRENCIES, MAX_FILE_SIZE } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import type { EventType } from '@/types';

/* ---- Type config ---- */

const TYPE_ICONS: Record<EventType, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: Car,
  restaurant: UtensilsCrossed,
  activity: MapPin,
  transport: Bus,
  cruise: Ship,
  souvenirs: Gift,
  snacks: Coffee,
  clothing: ShoppingBag,
  fuel: Fuel,
  misc: Package,
};

const TYPE_COLORS: Record<EventType, string> = {
  flight: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  hotel: 'bg-violet-50 text-violet-600 border-violet-200',
  car_rental: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  restaurant: 'bg-orange-50 text-orange-600 border-orange-200',
  activity: 'bg-green-50 text-green-600 border-green-200',
  transport: 'bg-blue-50 text-blue-600 border-blue-200',
  cruise: 'bg-sky-50 text-sky-600 border-sky-200',
  souvenirs: 'bg-pink-50 text-pink-600 border-pink-200',
  snacks: 'bg-amber-50 text-amber-600 border-amber-200',
  clothing: 'bg-rose-50 text-rose-600 border-rose-200',
  fuel: 'bg-lime-50 text-lime-600 border-lime-200',
  misc: 'bg-gray-50 text-gray-600 border-gray-200',
};

const TYPE_EMOJIS: Record<EventType, string> = {
  flight: '\u2708\uFE0F',
  hotel: '\uD83C\uDFE8',
  car_rental: '\uD83D\uDE97',
  restaurant: '\uD83C\uDF7D\uFE0F',
  activity: '\uD83D\uDCCD',
  transport: '\uD83D\uDE8C',
  cruise: '\u26F4\uFE0F',
  souvenirs: '\uD83C\uDF81',
  snacks: '\u2615',
  clothing: '\uD83D\uDECD\uFE0F',
  fuel: '\u26FD',
  misc: '\uD83D\uDCE6',
};

/* ---- Accepted file types ---- */

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp';

/* ---- States ---- */

type ScanState = 'idle' | 'scanning' | 'select-type' | 'preview' | 'bulk-preview' | 'pricing' | 'error';
type PricingMode = 'total' | 'per-person' | 'points';

/* ---- Detail labels ---- */

const DETAIL_LABELS: Record<string, string> = {
  airline: 'Aerolinea',
  flightNumber: 'No. de vuelo',
  origin: 'Origen',
  destination: 'Destino',
  confirmationCode: 'Codigo de confirmacion',
  seatNumber: 'Asiento',
  terminal: 'Terminal',
  baggage: 'Equipaje',
  hotelName: 'Hotel',
  address: 'Direccion',
  checkInDate: 'Check-in',
  checkOutDate: 'Check-out',
  checkInTime: 'Hora check-in',
  checkOutTime: 'Hora check-out',
  roomType: 'Tipo de habitacion',
  rentalCompany: 'Empresa',
  carType: 'Tipo de vehiculo',
  pickupLocation: 'Lugar de recogida',
  dropoffLocation: 'Lugar de devolucion',
  pickupDate: 'Fecha recogida',
  pickupTime: 'Hora recogida',
  dropoffDate: 'Fecha devolucion',
  dropoffTime: 'Hora devolucion',
  restaurantName: 'Restaurante',
  reservationName: 'Reservacion',
  guests: 'Personas',
  cuisine: 'Tipo de cocina',
  fromLocation: 'Desde',
  toLocation: 'Hasta',
};

/* ---- Scanning animation component ---- */

function ScanningAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      {/* Document with scanning line */}
      <div className="relative w-24 h-32 mb-6">
        {/* Document shape */}
        <div className="absolute inset-0 bg-white border-2 border-gray-200 rounded-xl shadow-lg">
          {/* Fake text lines */}
          <div className="p-3 space-y-2 mt-2">
            <div className="h-1.5 bg-gray-100 rounded-full w-3/4" />
            <div className="h-1.5 bg-gray-100 rounded-full w-full" />
            <div className="h-1.5 bg-gray-100 rounded-full w-2/3" />
            <div className="h-1.5 bg-gray-100 rounded-full w-5/6" />
            <div className="h-1.5 bg-gray-100 rounded-full w-1/2" />
          </div>
        </div>

        {/* Scanning line */}
        <motion.div
          className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-red-400 to-transparent rounded-full"
          initial={{ top: 8 }}
          animate={{ top: [8, 120, 8] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Glow effect */}
        <motion.div
          className="absolute left-0 right-0 h-8 bg-gradient-to-b from-red-400/10 to-transparent rounded-xl pointer-events-none"
          initial={{ top: 0 }}
          animate={{ top: [0, 112, 0] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Corner dots */}
        <motion.div
          className="absolute -top-1 -left-1 w-2.5 h-2.5 border-2 border-red-400 rounded-sm bg-white"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.div
          className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-red-400 rounded-sm bg-white"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
        />
        <motion.div
          className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-2 border-red-400 rounded-sm bg-white"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
        />
        <motion.div
          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-red-400 rounded-sm bg-white"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
        />
      </div>

      {/* Text */}
      <motion.p
        className="text-sm font-medium text-gray-600"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Analizando documento con IA...
      </motion.p>
      <p className="text-xs text-gray-300 mt-1">Esto puede tomar unos segundos</p>
    </div>
  );
}

/* ---- Editable field ---- */

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'time' | 'number';
}

function EditableField({ label, value, onChange, type = 'text' }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-gray-400 min-w-[80px]">{label}:</span>
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
          className="flex-1 text-sm text-gray-700 border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/50"
        />
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      className="flex items-center gap-1 group w-full text-left hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors"
    >
      <span className="text-[11px] text-gray-400 min-w-[80px]">{label}:</span>
      <span className="flex-1 text-sm text-gray-700 truncate">{value || '-'}</span>
      <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}

/* ---- Bulk event row ---- */

interface BulkEventRowProps {
  event: ScannedEvent;
  index: number;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onUpdateEvent: (updated: ScannedEvent) => void;
}

function BulkEventRow({ event, index, selected, expanded, onToggleSelect, onToggleExpand, onUpdateEvent }: BulkEventRowProps) {
  const TypeIcon = TYPE_ICONS[event.type] || HelpCircle;
  const typeConfig = EVENT_TYPES[event.type];
  const typeColorClass = TYPE_COLORS[event.type] || TYPE_COLORS.misc;
  const emoji = TYPE_EMOJIS[event.type] || '';

  const dateDisplay = event.date
    ? (() => {
        try {
          const [, m, d] = event.date.split('-');
          return `${d}/${m}`;
        } catch {
          return event.date;
        }
      })()
    : '';

  const timeDisplay = [event.startTime, event.endTime].filter(Boolean).join('-') || '';

  const updateField = (field: keyof ScannedEvent, value: string | number) => {
    onUpdateEvent({ ...event, [field]: value });
  };

  const updateDetail = (key: string, value: string) => {
    onUpdateEvent({
      ...event,
      details: { ...event.details, [key]: value },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={classNames(
        'border rounded-xl transition-all',
        selected ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/50 opacity-60'
      )}
    >
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={classNames(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            selected
              ? 'bg-blue-500 border-blue-500'
              : 'border-gray-300 bg-white hover:border-gray-400'
          )}
        >
          {selected && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* Date */}
        <span className="text-xs font-mono text-gray-500 w-12 flex-shrink-0">{dateDisplay}</span>

        {/* Type badge */}
        <span className={classNames(
          'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0',
          typeColorClass
        )}>
          <TypeIcon className="w-3 h-3" />
        </span>

        {/* Title + location */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-800 font-medium truncate block">{event.title}</span>
          {event.location && (
            <span className="text-xs text-gray-400 truncate block">{event.location}</span>
          )}
        </div>

        {/* Time */}
        {timeDisplay && (
          <span className="text-xs text-gray-400 font-mono flex-shrink-0">{timeDisplay}</span>
        )}

        {/* Price */}
        {event.cost && event.cost > 0 && (
          <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">
            ${event.cost.toFixed(2)}
          </span>
        )}

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />
        )}
      </div>

      {/* Expanded detail editor */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
              {/* Main fields */}
              <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
                <EditableField
                  label="Titulo"
                  value={event.title}
                  onChange={(v) => updateField('title', v)}
                />
                <EditableField
                  label="Fecha"
                  value={event.date}
                  onChange={(v) => updateField('date', v)}
                  type="date"
                />
                <div className="flex items-center gap-4">
                  <EditableField
                    label="Inicio"
                    value={event.startTime || ''}
                    onChange={(v) => updateField('startTime', v)}
                    type="time"
                  />
                  <EditableField
                    label="Fin"
                    value={event.endTime || ''}
                    onChange={(v) => updateField('endTime', v)}
                    type="time"
                  />
                </div>
                <EditableField
                  label="Ubicacion"
                  value={event.location || ''}
                  onChange={(v) => updateField('location', v)}
                />
              </div>

              {/* Details */}
              {Object.keys(event.details).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Detalles
                  </p>
                  {Object.entries(event.details).map(([key, value]) => (
                    <EditableField
                      key={key}
                      label={DETAIL_LABELS[key] || key}
                      value={value}
                      onChange={(v) => updateDetail(key, v)}
                    />
                  ))}
                </div>
              )}

              {/* Notes */}
              {event.notes && (
                <EditableField
                  label="Notas"
                  value={event.notes}
                  onChange={(v) => updateField('notes', v)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---- Props ---- */

interface ScanDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (scannedEvents: ScannedEvent[], file: File) => Promise<void>;
  defaultDate?: string;
  travelerCount?: number;
  tripYear?: number;
  tripStartDate?: string;
  tripEndDate?: string;
}

/* ---- Component ---- */

export default function ScanDocumentModal({ open, onClose, onConfirm, defaultDate, travelerCount = 1, tripYear, tripStartDate, tripEndDate }: ScanDocumentModalProps) {
  const [state, setState] = useState<ScanState>('idle');
  const [scannedData, setScannedData] = useState<ScannedEvent | null>(null);
  const [bulkEvents, setBulkEvents] = useState<ScannedEvent[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>('total');
  const [pricingCurrency, setPricingCurrency] = useState('USD');
  const [pricingTravelers, setPricingTravelers] = useState(1);
  const [selectedType, setSelectedType] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setState('idle');
    setScannedData(null);
    setBulkEvents([]);
    setSelectedIndices(new Set());
    setExpandedIndex(null);
    setSelectedFile(null);
    setErrorMessage('');
    setIsDragging(false);
    setConfirming(false);
    setPricingMode('total');
    setPricingCurrency('USD');
    setPricingTravelers(1);
    setSelectedType('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setState('error');
      setErrorMessage('Formato no soportado. Usa PDF, JPG o PNG.');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setState('error');
      setErrorMessage('El archivo es demasiado grande. Maximo 10MB.');
      return;
    }

    setSelectedFile(file);
    setState('scanning');
    setErrorMessage('');

    try {
      const results = await scanBulkDocument(file, tripYear);

      // Apply default date to events missing a date and clamp to trip range
      const clampDate = (dateVal: string): string => {
        if (!dateVal || !tripStartDate || !tripEndDate) return dateVal;
        if (dateVal < tripStartDate) return tripStartDate;
        if (dateVal > tripEndDate) return tripEndDate;
        return dateVal;
      };

      const withDefaults = results.map((e) => ({
        ...e,
        date: clampDate(e.date || defaultDate || ''),
      }));

      // Sort by date then startTime
      const sorted = [...withDefaults].sort((a, b) => {
        const dateCompare = (a.date || '').localeCompare(b.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });

      // Always ask user to confirm the event type first
      if (sorted.length === 1) {
        setScannedData(sorted[0]);
        setSelectedType(sorted[0].type || '');
      } else {
        setBulkEvents(sorted);
        setSelectedIndices(new Set(sorted.map((_, i) => i)));
        setPricingTravelers(travelerCount > 1 ? travelerCount : 1);
        setSelectedType(sorted[0]?.type || '');
      }
      setState('select-type');
    } catch (error) {
      console.error('Error scanning document:', error);
      setState('error');
      // Network drops (ERR_CONNECTION_CLOSED, Failed to fetch) should
      // tell the user to retry, not "intenta con otro archivo".
      if (
        error instanceof ScanNetworkError ||
        (error instanceof TypeError && /failed to fetch|networkerror/i.test(error.message))
      ) {
        setErrorMessage('Se perdió la conexión con el servidor de AI. Revisá tu internet y volvé a tocar Reintentar.');
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'No pudimos leer el documento, intenta con otro archivo'
        );
      }
    }
  }, [defaultDate]);

  /* ---- Drag & Drop ---- */

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ---- Edit scanned data (single mode) ---- */

  const updateField = (field: keyof ScannedEvent, value: string | number) => {
    if (!scannedData) return;
    setScannedData({ ...scannedData, [field]: value });
  };

  const updateDetail = (key: string, value: string) => {
    if (!scannedData) return;
    setScannedData({
      ...scannedData,
      details: { ...scannedData.details, [key]: value },
    });
  };

  /* ---- Bulk selection helpers ---- */

  const toggleSelectAll = () => {
    if (selectedIndices.size === bulkEvents.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(bulkEvents.map((_, i) => i)));
    }
  };

  const toggleSelect = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const updateBulkEvent = (index: number, updated: ScannedEvent) => {
    const next = [...bulkEvents];
    next[index] = updated;
    setBulkEvents(next);
  };

  const selectedCount = selectedIndices.size;

  /* ---- Confirm single ---- */

  const handleConfirmSingle = async () => {
    if (!scannedData || !selectedFile) return;
    setConfirming(true);
    try {
      await onConfirm([scannedData], selectedFile);
      resetState();
    } catch (error) {
      console.error('Error creating event:', error);
      setErrorMessage('Error al crear el evento. Intenta de nuevo.');
      setConfirming(false);
    }
  };

  /* ---- Confirm bulk ---- */

  const handleConfirmBulk = async () => {
    if (!selectedFile || selectedCount === 0) return;
    setConfirming(true);
    try {
      const selected = bulkEvents.filter((_, i) => selectedIndices.has(i));
      await onConfirm(selected, selectedFile);
      resetState();
    } catch (error) {
      console.error('Error creating events:', error);
      setErrorMessage('Error al crear los eventos. Intenta de nuevo.');
      setConfirming(false);
    }
  };

  /* ---- Confirm type selection and proceed ---- */

  const confirmTypeSelection = () => {
    const applyType = (e: ScannedEvent): ScannedEvent => ({
      ...e,
      type: (selectedType as ScannedEvent['type']) || e.type,
    });

    const evts = scannedData ? [scannedData] : bulkEvents;
    const hasCosts = evts.some((e) => e.cost && e.cost > 0);

    if (scannedData) {
      setScannedData(applyType(scannedData));
      setState(hasCosts ? 'pricing' : 'preview');
    } else {
      setBulkEvents(prev => prev.map(applyType));
      setState(hasCosts ? 'pricing' : 'bulk-preview');
    }
  };

  /* ---- Render type selection ---- */

  const renderSelectType = () => {
    const evts = scannedData ? [scannedData] : bulkEvents;
    const detectedType = evts[0]?.type || 'misc';

    const typeOptions = [
      { value: 'flight', label: 'Vuelo', icon: Plane, color: '#06b6d4' },
      { value: 'hotel', label: 'Hotel', icon: Hotel, color: '#8b5cf6' },
      { value: 'activity', label: 'Tour / Actividad', icon: MapPin, color: '#22c55e' },
      { value: 'restaurant', label: 'Restaurante', icon: UtensilsCrossed, color: '#f97316' },
      { value: 'car_rental', label: 'Renta de Auto', icon: Car, color: '#eab308' },
      { value: 'transport', label: 'Transporte', icon: Bus, color: '#3b82f6' },
      { value: 'cruise', label: 'Puerto / Crucero', icon: Ship, color: '#7dd3fc' },
      { value: 'souvenirs', label: 'Souvenirs', icon: Gift, color: '#e879f9' },
      { value: 'snacks', label: 'Snacks', icon: Coffee, color: '#fb923c' },
      { value: 'clothing', label: 'Ropa', icon: ShoppingBag, color: '#f43f5e' },
      { value: 'fuel', label: 'Combustible', icon: Fuel, color: '#84cc16' },
      { value: 'misc', label: 'Otros', icon: Package, color: '#94a3b8' },
    ];

    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-gray-900 font-semibold text-base">
            {evts.length === 1 ? 'Documento leido' : `${evts.length} eventos detectados`}
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Que tipo de reserva es?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {typeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedType === opt.value;
            const isDetected = detectedType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedType(opt.value)}
                className={classNames(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left',
                  isSelected
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                )}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${opt.color}15` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: opt.color }} />
                </div>
                <div>
                  <span className={classNames(
                    'text-sm font-medium',
                    isSelected ? 'text-blue-700' : 'text-gray-700'
                  )}>
                    {opt.label}
                  </span>
                  {isDetected && (
                    <span className="block text-[10px] text-gray-400">Detectado por IA</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setState('idle')} className="flex-1">
            Atras
          </Button>
          <Button onClick={confirmTypeSelection} disabled={!selectedType} className="flex-1">
            Continuar
          </Button>
        </div>
      </div>
    );
  };

  /* ---- Apply pricing to events ---- */

  const applyPricing = () => {
    const applyToEvent = (e: ScannedEvent): ScannedEvent => {
      if (pricingMode === 'points') {
        const pointsNote = e.cost ? `Pagado con ${e.cost} puntos de viajero` : 'Pagado con puntos de viajero';
        return { ...e, cost: 0, currency: pricingCurrency, notes: [e.notes, pointsNote].filter(Boolean).join('. ') };
      }
      let cost = e.cost || 0;
      if (pricingMode === 'per-person' && pricingTravelers > 1) {
        cost = cost * pricingTravelers;
      }
      return { ...e, cost, currency: pricingCurrency };
    };

    if (scannedData) {
      setScannedData(applyToEvent(scannedData));
      setState('preview');
    } else if (bulkEvents.length > 0) {
      setBulkEvents(prev => prev.map(applyToEvent));
      setState('bulk-preview');
    }
  };

  /* ---- Render pricing step ---- */

  const renderPricing = () => {
    const evts = scannedData ? [scannedData] : bulkEvents;
    const totalCost = evts.reduce((sum, e) => sum + (e.cost || 0), 0);
    const adjustedTotal = pricingMode === 'per-person' ? totalCost * pricingTravelers : totalCost;

    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-gray-900 font-semibold text-base">Configurar precios</h3>
          <p className="text-gray-400 text-sm mt-1">
            Detectamos {evts.length} evento{evts.length !== 1 ? 's' : ''} con costo
          </p>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-1.5">Moneda</label>
          <div className="flex gap-2">
            {['USD', 'MXN', 'EUR', 'GBP'].map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setPricingCurrency(cur)}
                className={classNames(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border',
                  pricingCurrency === cur
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                )}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>

        {/* Price mode */}
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-1.5">Los precios son:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPricingMode('total')}
              className={classNames(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all border',
                pricingMode === 'total'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              Precio total
            </button>
            <button
              type="button"
              onClick={() => setPricingMode('per-person')}
              className={classNames(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all border',
                pricingMode === 'per-person'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              Por persona
            </button>
            <button
              type="button"
              onClick={() => setPricingMode('points')}
              className={classNames(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all border',
                pricingMode === 'points'
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              Puntos
            </button>
          </div>
        </div>

        {/* Traveler count (only if per-person) */}
        {pricingMode === 'points' && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <p className="text-amber-700 text-sm font-medium">Se registrara como pagado con puntos de viajero</p>
            <p className="text-amber-600 text-xs mt-1">El costo sera $0 y se agregara una nota con los puntos usados</p>
          </div>
        )}

        {pricingMode === 'per-person' && (
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1.5">
              Numero de viajeros
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPricingTravelers(Math.max(1, pricingTravelers - 1))}
                className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-bold"
              >
                -
              </button>
              <span className="text-2xl font-bold text-gray-900 w-8 text-center">{pricingTravelers}</span>
              <button
                type="button"
                onClick={() => setPricingTravelers(pricingTravelers + 1)}
                className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Summary (not for points) */}
        {pricingMode !== 'points' && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Subtotal detectado</span>
            <span className="text-gray-700 font-medium">{totalCost.toFixed(2)} {pricingCurrency}</span>
          </div>
          {pricingMode === 'per-person' && pricingTravelers > 1 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-500">× {pricingTravelers} viajeros</span>
              <span className="text-gray-900 font-bold">{adjustedTotal.toFixed(2)} {pricingCurrency}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-200">
            <span className="text-gray-700 font-semibold">Total a registrar</span>
            <span className="text-gray-900 font-bold text-base">{adjustedTotal.toFixed(2)} {pricingCurrency}</span>
          </div>
        </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => { setState('idle'); }} className="flex-1">
            Atras
          </Button>
          <Button onClick={applyPricing} className="flex-1">
            Continuar
          </Button>
        </div>
      </div>
    );
  };

  /* ---- Render idle (upload zone) ---- */

  const renderIdle = () => (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={classNames(
        'border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer',
        isDragging
          ? 'border-red-400 bg-red-50/50 scale-[1.02]'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
      )}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3">
        <div className={classNames(
          'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
          isDragging ? 'bg-red-100' : 'bg-gray-100'
        )}>
          <Upload className={classNames(
            'w-7 h-7 transition-colors',
            isDragging ? 'text-red-500' : 'text-gray-400'
          )} />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">
            {isDragging ? 'Suelta el archivo aqui' : 'Arrastra un documento aqui'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            o haz clic para seleccionar
          </p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-gray-300 bg-gray-50 px-2 py-0.5 rounded">PDF</span>
          <span className="text-[10px] text-gray-300 bg-gray-50 px-2 py-0.5 rounded">JPG</span>
          <span className="text-[10px] text-gray-300 bg-gray-50 px-2 py-0.5 rounded">PNG</span>
          <span className="text-[10px] text-gray-300 ml-1">Max. 10MB</span>
        </div>

        <p className="text-[10px] text-gray-300 mt-2">
          Soporta documentos con multiples eventos (itinerarios de crucero, vuelos multi-ciudad, etc.)
        </p>
      </div>
    </div>
  );

  /* ---- Render single preview (backward compat) ---- */

  const renderPreview = () => {
    if (!scannedData) return null;

    const TypeIcon = TYPE_ICONS[scannedData.type] || HelpCircle;
    const typeConfig = EVENT_TYPES[scannedData.type];
    const typeColorClass = TYPE_COLORS[scannedData.type] || TYPE_COLORS.misc;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Type badge + title */}
        <div className="flex items-start gap-3">
          <div className={classNames(
            'w-11 h-11 rounded-xl flex items-center justify-center border flex-shrink-0',
            typeColorClass
          )}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className={classNames(
              'inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-1',
              typeColorClass
            )}>
              {typeConfig?.label || 'Otro'}
            </span>
            <EditableField
              label="Titulo"
              value={scannedData.title}
              onChange={(v) => updateField('title', v)}
            />
          </div>
        </div>

        {/* Date & Time row */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-500">
              <CalendarDays className="w-3.5 h-3.5" />
              <EditableField
                label="Fecha"
                value={scannedData.date}
                onChange={(v) => updateField('date', v)}
                type="date"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <EditableField
                label="Inicio"
                value={scannedData.startTime || ''}
                onChange={(v) => updateField('startTime', v)}
                type="time"
              />
            </div>
            {scannedData.endTime && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="text-gray-300">-</span>
                <EditableField
                  label="Fin"
                  value={scannedData.endTime}
                  onChange={(v) => updateField('endTime', v)}
                  type="time"
                />
              </div>
            )}
          </div>
          {scannedData.location && (
            <EditableField
              label="Ubicacion"
              value={scannedData.location}
              onChange={(v) => updateField('location', v)}
            />
          )}
        </div>

        {/* Details card */}
        {Object.keys(scannedData.details).length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Detalles extraidos
            </p>
            {Object.entries(scannedData.details).map(([key, value]) => (
              <EditableField
                key={key}
                label={DETAIL_LABELS[key] || key}
                value={value}
                onChange={(v) => updateDetail(key, v)}
              />
            ))}
          </div>
        )}

        {/* Cost */}
        {(scannedData.cost !== null && scannedData.cost !== undefined && scannedData.cost > 0) && (
          <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2 border border-green-100">
            <DollarSign className="w-4 h-4 text-green-500" />
            <EditableField
              label="Costo"
              value={String(scannedData.cost)}
              onChange={(v) => updateField('cost', parseFloat(v) || 0)}
              type="number"
            />
            <span className="text-xs text-green-600 font-medium">{scannedData.currency || 'MXN'}</span>
          </div>
        )}

        {/* Notes */}
        {scannedData.notes && (
          <div className="bg-gray-50 rounded-xl p-3">
            <EditableField
              label="Notas"
              value={scannedData.notes}
              onChange={(v) => updateField('notes', v)}
            />
          </div>
        )}

        {/* File name indicator */}
        {selectedFile && (
          <div className="flex items-center gap-2 text-xs text-gray-300 px-1">
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">{selectedFile.name}</span>
            <span>({(selectedFile.size / 1024).toFixed(0)} KB)</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={resetState}
            disabled={confirming}
          >
            Escanear otro
          </Button>
          <Button
            icon={Check}
            onClick={handleConfirmSingle}
            loading={confirming}
          >
            Confirmar y crear evento
          </Button>
        </div>
      </motion.div>
    );
  };

  /* ---- Render bulk preview ---- */

  const renderBulkPreview = () => {
    const allSelected = selectedIndices.size === bulkEvents.length;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">
              {bulkEvents.length} eventos encontrados
            </span>
          </div>
          {selectedFile && (
            <span className="text-[10px] text-gray-300 truncate max-w-[140px]">
              {selectedFile.name}
            </span>
          )}
        </div>

        {/* Select all toggle */}
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span className={classNames(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
            allSelected
              ? 'bg-blue-500 border-blue-500'
              : 'border-gray-300 bg-white hover:border-gray-400'
          )}>
            {allSelected && <Check className="w-3 h-3 text-white" />}
          </span>
          <span>{allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</span>
        </button>

        {/* Scrollable event list */}
        <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1 -mr-1">
          {bulkEvents.map((event, idx) => (
            <BulkEventRow
              key={`${event.date}-${idx}`}
              event={event}
              index={idx}
              selected={selectedIndices.has(idx)}
              expanded={expandedIndex === idx}
              onToggleSelect={() => toggleSelect(idx)}
              onToggleExpand={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
              onUpdateEvent={(updated) => updateBulkEvent(idx, updated)}
            />
          ))}
        </div>

        {/* Selected total */}
        {(() => {
          const selectedTotal = bulkEvents
            .filter((_, i) => selectedIndices.has(i))
            .reduce((sum, e) => sum + (e.cost || 0), 0);
          const currency = bulkEvents[0]?.currency || 'USD';
          return selectedTotal > 0 ? (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-500">Total seleccionado</span>
              <span className="text-sm font-bold text-gray-900">${selectedTotal.toFixed(2)} {currency}</span>
            </div>
          ) : null;
        })()}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={confirming}
            >
              Cancelar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              onClick={resetState}
              disabled={confirming}
            >
              Escanear otro
            </Button>
          </div>
          <Button
            icon={Check}
            onClick={handleConfirmBulk}
            loading={confirming}
            disabled={selectedCount === 0}
          >
            Crear {selectedCount} evento{selectedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </motion.div>
    );
  };

  /* ---- Render error ---- */

  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">Error al escanear</p>
      <p className="text-xs text-gray-400 max-w-xs mb-6">{errorMessage}</p>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={handleClose}>
          Cancelar
        </Button>
        <Button icon={RotateCcw} onClick={resetState}>
          Intentar de nuevo
        </Button>
      </div>
    </div>
  );

  const modalTitle = state === 'bulk-preview'
    ? `${bulkEvents.length} eventos encontrados`
    : state === 'select-type'
      ? 'Tipo de reserva'
      : state === 'pricing'
        ? 'Configurar precios'
        : state === 'preview'
          ? 'Documento escaneado'
          : 'Escanear documento';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={modalTitle}
    >
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderIdle()}
          </motion.div>
        )}
        {state === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ScanningAnimation />
          </motion.div>
        )}
        {state === 'select-type' && (
          <motion.div key="select-type" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderSelectType()}
          </motion.div>
        )}
        {state === 'pricing' && (
          <motion.div key="pricing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderPricing()}
          </motion.div>
        )}
        {state === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderPreview()}
          </motion.div>
        )}
        {state === 'bulk-preview' && (
          <motion.div key="bulk-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderBulkPreview()}
          </motion.div>
        )}
        {state === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderError()}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
