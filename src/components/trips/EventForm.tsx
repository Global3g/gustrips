'use client';

import { useState, useRef, useEffect, useMemo, type FormEvent } from 'react';
import { z } from 'zod';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  MoreHorizontal,
  Copy,
  Trash2,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { EVENT_TYPES, CURRENCIES, DEFAULT_CURRENCY, PAYMENT_METHODS } from '@/config/constants';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TimezoneSelect from '@/components/ui/TimezoneSelect';
import Textarea from '@/components/ui/Textarea';
import PlacesAutocomplete from '@/components/ui/PlacesAutocomplete';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { classNames, getInitials } from '@/lib/utils/helpers';
import { inferDateLocation } from '@/lib/utils/photoLocation';
import CardPicker from '@/components/expenses/CardPicker';
import type { TripEvent, EventType, ExpenseCategory, PaymentMethod } from '@/types';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useTrip } from '@/hooks/useTrip';
import { useTripRole } from '@/hooks/useTripRole';
import { getClientStorage } from '@/lib/firebase/client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { extractReceiptData } from '@/lib/utils/receiptOCR';

/* ─── Mapa de iconos para tipos de evento ──────── */

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Hotel,
  MapPin,
  UtensilsCrossed,
  Car,
  CarFront,
  Ship,
  Gift,
  Coffee,
  ShoppingBag,
  Fuel,
  Package,
  MoreHorizontal,
};

/* ─── Definicion de campos dinamicos por tipo ──── */

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'date' | 'time' | 'number' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2;
}

const EVENT_FIELDS: Record<EventType, FieldDef[]> = {
  flight: [
    { key: 'airline', label: 'Aerolínea', type: 'text', placeholder: 'Ej. Volaris, Aeroméxico' },
    { key: 'flightNumber', label: 'No. de vuelo', type: 'text', placeholder: 'Ej. VB2045' },
    { key: 'origin', label: 'Origen', type: 'text', placeholder: 'Ej. GDL' },
    { key: 'destination', label: 'Destino', type: 'text', placeholder: 'Ej. CUN' },
    { key: 'departureTerminal', label: 'Terminal', type: 'text', placeholder: 'Terminal de salida' },
    { key: 'confirmationCode', label: 'Código de confirmación', type: 'text', placeholder: 'Código de reserva' },
    { key: 'seatNumber', label: 'Asiento', type: 'text', placeholder: 'Ej. 12A' },
    { key: 'baggage', label: 'Equipaje', type: 'text', placeholder: 'Ej. 1 maleta 23kg' },
    { key: 'clubPremier', label: 'No. Club Premier', type: 'text', placeholder: 'Ej. 123456789' },
  ],
  hotel: [
    { key: 'hotelName', label: 'Hotel', type: 'text', placeholder: 'Nombre del hotel', colSpan: 2 },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Dirección del hotel', colSpan: 2 },
    { key: 'checkInDate', label: 'Check-in', type: 'date' },
    { key: 'checkOutDate', label: 'Check-out', type: 'date' },
    { key: 'checkInTime', label: 'Hora check-in', type: 'time' },
    { key: 'checkOutTime', label: 'Hora check-out', type: 'time' },
    { key: 'confirmationCode', label: 'Código de reservación', type: 'text', placeholder: 'Código de reserva', colSpan: 2 },
    { key: 'roomType', label: 'Tipo de habitación', type: 'text', placeholder: 'Ej. Doble, Suite' },
    { key: 'guests', label: 'Huéspedes', type: 'number', placeholder: '2' },
  ],
  car_rental: [
    { key: 'rentalCompany', label: 'Empresa', type: 'text', placeholder: 'Ej. Hertz, Sixt' },
    { key: 'carType', label: 'Tipo de vehículo', type: 'text', placeholder: 'Ej. SUV, Sedán' },
    { key: 'pickupLocation', label: 'Lugar de recogida', type: 'text', placeholder: 'Dirección o sucursal', colSpan: 2 },
    { key: 'dropoffLocation', label: 'Lugar de devolución', type: 'text', placeholder: 'Dirección o sucursal', colSpan: 2 },
    { key: 'pickupDate', label: 'Fecha recogida', type: 'date' },
    { key: 'pickupTime', label: 'Hora recogida', type: 'time' },
    { key: 'dropoffDate', label: 'Fecha devolución', type: 'date' },
    { key: 'dropoffTime', label: 'Hora devolución', type: 'time' },
    { key: 'confirmationCode', label: 'Código de reservación', type: 'text', placeholder: 'Código de reserva', colSpan: 2 },
  ],
  restaurant: [
    { key: 'restaurantName', label: 'Restaurante', type: 'text', placeholder: 'Nombre del restaurante', colSpan: 2 },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Dirección', colSpan: 2 },
    { key: 'reservationName', label: 'Reservación a nombre de', type: 'text', placeholder: 'Nombre' },
    { key: 'guests', label: 'Personas', type: 'number', placeholder: '2' },
    { key: 'cuisine', label: 'Tipo de cocina', type: 'text', placeholder: 'Ej. Italiana, Mexicana' },
  ],
  activity: [
    { key: 'activityName', label: 'Actividad', type: 'text', placeholder: 'Nombre de la actividad', colSpan: 2 },
    { key: 'address', label: 'Dirección / Punto de encuentro', type: 'text', placeholder: 'Ubicación', colSpan: 2 },
    { key: 'duration', label: 'Duración', type: 'text', placeholder: 'Ej. 2 horas' },
    { key: 'bookingRef', label: 'Referencia de reserva', type: 'text', placeholder: 'Código o referencia' },
    { key: 'provider', label: 'Operador / Proveedor', type: 'text', placeholder: 'Empresa o persona', colSpan: 2 },
  ],
  transport: [
    { key: 'transportMode', label: 'Modo de transporte', type: 'select', colSpan: 2, options: [
      { value: '', label: 'Seleccionar modo...' },
      { value: 'Uber', label: 'Uber' },
      { value: 'Taxi', label: 'Taxi' },
      { value: 'Bus', label: 'Bus / Camión' },
      { value: 'Tren', label: 'Tren' },
      { value: 'Metro', label: 'Metro' },
      { value: 'Colectivo', label: 'Colectivo' },
      { value: 'Transfer', label: 'Transfer privado' },
    ]},
    { key: 'fromLocation', label: 'Punto de partida', type: 'text', placeholder: 'Desde...' },
    { key: 'toLocation', label: 'Punto de llegada', type: 'text', placeholder: 'Hasta...' },
    { key: 'bookingRef', label: 'Referencia', type: 'text', placeholder: 'Código o referencia' },
  ],
  cruise: [
    { key: 'portName', label: 'Puerto', type: 'text', placeholder: 'Ej. Southampton, Cork', colSpan: 2 },
    { key: 'shipName', label: 'Nombre del barco', type: 'text', placeholder: 'Ej. Royal Caribbean' },
    { key: 'cabinNumber', label: 'Cabina', type: 'text', placeholder: 'Ej. 8234' },
    { key: 'confirmationCode', label: 'Código de reserva', type: 'text', placeholder: 'Código de reserva' },
  ],
  souvenirs: [
    { key: 'storeName', label: 'Tienda', type: 'text', placeholder: 'Nombre de la tienda', colSpan: 2 },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Ubicación', colSpan: 2 },
    { key: 'items', label: 'Artículos', type: 'text', placeholder: 'Qué compraste', colSpan: 2 },
  ],
  snacks: [
    { key: 'storeName', label: 'Lugar', type: 'text', placeholder: 'Tienda o restaurante', colSpan: 2 },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Ubicación', colSpan: 2 },
    { key: 'items', label: 'Qué compraste', type: 'text', placeholder: 'Ej. Café, sandwich', colSpan: 2 },
  ],
  clothing: [
    { key: 'storeName', label: 'Tienda', type: 'text', placeholder: 'Nombre de la tienda', colSpan: 2 },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Ubicación', colSpan: 2 },
    { key: 'items', label: 'Artículos', type: 'text', placeholder: 'Qué compraste' },
    { key: 'brand', label: 'Marca', type: 'text', placeholder: 'Ej. Nike, Zara' },
  ],
  fuel: [
    { key: 'gasStation', label: 'Gasolinera', type: 'text', placeholder: 'Nombre de la gasolinera', colSpan: 2 },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Ubicación', colSpan: 2 },
    { key: 'liters', label: 'Litros', type: 'number', placeholder: 'Ej. 40' },
    { key: 'pricePerLiter', label: 'Precio por litro', type: 'number', placeholder: 'Ej. 21.50' },
  ],
  misc: [
    { key: 'placeName', label: 'Lugar', type: 'text', placeholder: 'Tienda o lugar', colSpan: 2 },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Ubicación', colSpan: 2 },
    { key: 'description', label: 'Descripción', type: 'text', placeholder: 'Qué compraste o hiciste', colSpan: 2 },
  ],
};

/* ─── Auto-generador de titulo ─────────────────── */

function generateTitle(type: EventType, details: Record<string, string>): string {
  switch (type) {
    case 'flight':
      if (details.origin && details.destination) return `Vuelo ${details.origin} → ${details.destination}`;
      if (details.airline) return `Vuelo ${details.airline}`;
      return 'Vuelo';
    case 'hotel':
      return details.hotelName || 'Hotel';
    case 'car_rental':
      return details.rentalCompany ? `Renta ${details.rentalCompany}` : 'Renta de Carro';
    case 'restaurant':
      return details.restaurantName || 'Restaurante';
    case 'activity':
      return details.activityName || 'Actividad';
    case 'transport':
      if (details.fromLocation && details.toLocation) return `${details.fromLocation} → ${details.toLocation}`;
      return 'Transporte';
    case 'cruise':
      return details.portName ? `Puerto: ${details.portName}` : 'Puerto / Crucero';
    case 'souvenirs':
      return details.storeName ? `Souvenirs en ${details.storeName}` : 'Souvenirs';
    case 'snacks':
      return details.storeName ? `Snacks en ${details.storeName}` : 'Snacks';
    case 'clothing':
      return details.storeName ? `Ropa en ${details.storeName}` : 'Ropa y Accesorios';
    case 'fuel':
      return details.gasStation ? `Gasolina en ${details.gasStation}` : 'Combustible';
    case 'misc':
      return details.placeName || 'Otros';
    default:
      return '';
  }
}

/* ─── Derivar ubicacion desde detalles ─────────── */

function deriveLocation(type: EventType, details: Record<string, string>): string {
  switch (type) {
    case 'flight':
      if (details.origin && details.destination) return `${details.origin} → ${details.destination}`;
      return '';
    case 'hotel':
      return details.address || details.hotelName || '';
    case 'car_rental':
      return details.pickupLocation || '';
    case 'restaurant':
      return details.address || details.restaurantName || '';
    case 'activity':
      return details.address || '';
    case 'transport':
      if (details.fromLocation && details.toLocation) return `${details.fromLocation} → ${details.toLocation}`;
      return '';
    case 'cruise':
      return details.portName || '';
    case 'souvenirs':
    case 'snacks':
    case 'clothing':
      return details.address || details.storeName || '';
    case 'fuel':
      return details.address || details.gasStation || '';
    case 'misc':
      return details.address || details.placeName || '';
    default:
      return '';
  }
}

/* ─── Smart defaults por tipo ──────────────────── */

function getSmartDefaults(type: EventType): Record<string, string> {
  switch (type) {
    case 'hotel':
      return { checkInTime: '15:00', checkOutTime: '12:00' };
    case 'restaurant':
      return {};
    default:
      return {};
  }
}

/* ─── Esquema de validacion Zod ─────────────────── */

const eventSchema = z.object({
  title: z.string().min(1, 'El titulo es obligatorio'),
  type: z.enum(['flight', 'hotel', 'activity', 'restaurant', 'transport', 'car_rental', 'cruise', 'souvenirs', 'snacks', 'clothing', 'fuel', 'misc'] as const),
  date: z.string().min(1, 'La fecha es obligatoria'),
  startTime: z.string().optional().default(''),
  endTime: z.string().optional().default(''),
  location: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  cost: z.number().min(0, 'El costo no puede ser negativo').default(0),
  currency: z.string().default(DEFAULT_CURRENCY),
  details: z.record(z.string(), z.string()).default({}),
});

/* ─── Props ─────────────────────────────────────── */

interface EventFormProps {
  initialData?: TripEvent;
  /** Pre-fill the date field for new events (ignored if initialData is provided) */
  defaultDate?: string;
  /** Pre-fill the start time for new events (ignored if initialData is provided) */
  defaultTime?: string;
  /** Trip start date to restrict date inputs */
  tripStartDate?: string;
  /** Trip end date to restrict date inputs */
  tripEndDate?: string;
  /** Trip ID for creating linked expenses */
  tripId?: string;
  /** Other events in the trip — used to auto-suggest the location by date. */
  tripEvents?: TripEvent[];
  /** Manual per-day locations ("YYYY-MM-DD" -> "City, Country") for fallback. */
  dayLocations?: Record<string, string>;
  onSubmit: (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => Promise<string | void>;
  onCancel: () => void;
  loading?: boolean;
  /** Optional: only called when editing an existing event */
  onDelete?: (eventId: string) => void;
  /** Optional: only called when editing an existing event */
  onDuplicate?: (event: TripEvent) => void;
}

/* ─── Opciones para selects ─────────────────────── */

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

/* ─── Step indicator ───────────────────────────── */

const STEPS = [
  { label: 'Esencial', description: 'Tipo, titulo y fecha' },
  { label: 'Detalles', description: 'Info del evento' },
  { label: 'Opcional', description: 'Costo y notas' },
];

function StepIndicator({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-4">
      {STEPS.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onStepClick(idx)}
            className="flex items-center gap-1 group"
          >
            <div
              className={classNames(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                isActive
                  ? 'bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/15'
                  : isCompleted
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-600'
              )}
            >
              {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
            </div>
            <span
              className={classNames(
                'text-xs font-medium transition-colors hidden sm:inline',
                isActive ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={classNames(
                  'w-6 h-px mx-1',
                  isCompleted ? 'bg-blue-300' : 'bg-gray-200'
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Componente ────────────────────────────────── */

export default function EventForm({ initialData, defaultDate, defaultTime, tripStartDate, tripEndDate, tripId, tripEvents, dayLocations, onSubmit, onCancel, loading = false, onDelete, onDuplicate }: EventFormProps) {
  const isEdit = !!initialData;
  const [step, setStep] = useState(isEdit ? -1 : 0); // -1 = show all steps at once (edit mode)
  const [type, setType] = useState<EventType | ''>(initialData?.type || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(initialData?.date || defaultDate || '');
  const [startTime, setStartTime] = useState(initialData?.startTime || defaultTime || '');
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [cost, setCost] = useState(initialData?.cost?.toString() || '0');
  const [currency, setCurrency] = useState(initialData?.currency || DEFAULT_CURRENCY);
  const [details, setDetails] = useState<Record<string, string>>(initialData?.details || {});
  const [timezone, setTimezone] = useState(initialData?.timezone || '');
  const [arrivalTimezone, setArrivalTimezone] = useState(initialData?.details?.arrivalTimezone || '');
  const [arrivalDate, setArrivalDate] = useState(initialData?.details?.arrivalDate || '');
  const [latitude, setLatitude] = useState(initialData?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(initialData?.longitude?.toString() || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [country, setCountry] = useState(initialData?.country || '');

  // Auto-suggest city/country from the itinerary for the chosen date (new
  // events only — editing keeps the saved location). Re-runs when the date
  // changes; only writes when the guess has a value so it never wipes a
  // location the user typed with a blank. Doesn't depend on city/country, so
  // typing in those fields won't re-trigger it.
  useEffect(() => {
    if (isEdit || !date) return;
    const guess = inferDateLocation(date, tripEvents, { dayLocations });
    if (guess.city) setCity(guess.city);
    if (guess.country) setCountry(guess.country);
  }, [date, tripEvents, dayLocations, isEdit]);

  const [createExpense, setCreateExpense] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState<boolean | null>(null); // null = not answered yet
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Expense fields (only used when isAlreadyPaid = true)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cardId, setCardId] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [pointsUsed, setPointsUsed] = useState('');
  const [equivalentValue, setEquivalentValue] = useState('');
  const [realValueCurrency, setRealValueCurrency] = useState(DEFAULT_CURRENCY);

  const titleManuallyEdited = useRef(!!initialData);
  const destinationRef = useRef<HTMLInputElement>(null);
  const receiptScanInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /* Dirty-check: become dirty as soon as any field changes */
  const [dirty, setDirty] = useState(false);

  /* Submit intent (declared early so handleClose / shortcut can reference) */
  const [intentionalSubmit, setIntentionalSubmit] = useState(false);

  // Hooks for expense creation
  const { user } = useAuth();
  const { addTripExpense } = useExpenses(tripId || '');
  const { travelers: allTravelers } = useGlobalTravelers();
  const { trip } = useTrip(tripId || '');
  // Role gating — viewer/kid get a read-only chrome with no save button.
  // We still let them open the form so they can inspect the event details
  // (the form fields themselves stay enabled because most are non-input
  // visuals like timezone displays — the gate is at the submit boundary).
  const { can: tripRoleCan } = useTripRole();
  const isReadOnly = tripRoleCan.readOnly;

  // Get trip travelers (filtered by trip.travelerIds — only people actually on this trip)
  const tripTravelers = useMemo(() => {
    const ids = trip?.travelerIds;
    if (!ids || ids.length === 0) return allTravelers;
    return allTravelers.filter((t) => ids.includes(t.id));
  }, [allTravelers, trip?.travelerIds]);

  // Initialize paidBy and splitBetween when travelers load and when "Already paid" is selected
  useEffect(() => {
    if (isAlreadyPaid && tripTravelers.length > 0 && !paidBy) {
      setPaidBy(tripTravelers[0].id);
      setSplitBetween(tripTravelers.map((t) => t.id));
    }
  }, [isAlreadyPaid, tripTravelers, paidBy]);

  /* Auto-generar titulo cuando cambian tipo o detalles */
  useEffect(() => {
    if (!titleManuallyEdited.current && type) {
      setTitle(generateTitle(type, details));
    }
  }, [type, details]);

  /* Dirty tracking: any change to a tracked field marks the form dirty.
     We skip the initial mount so loading initialData doesn't count. */
  const dirtyInitMounted = useRef(false);
  useEffect(() => {
    if (!dirtyInitMounted.current) {
      dirtyInitMounted.current = true;
      return;
    }
    if (!dirty) setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    type,
    title,
    date,
    startTime,
    endTime,
    notes,
    cost,
    currency,
    details,
    timezone,
    arrivalTimezone,
    arrivalDate,
    latitude,
    longitude,
    city,
    country,
    paymentMethod,
    paidBy,
    splitBetween,
    pointsUsed,
    equivalentValue,
    realValueCurrency,
    receiptFile,
    isAlreadyPaid,
  ]);

  /* Wrapper for closing: prompts confirmation if there are unsaved changes */
  const handleClose = () => {
    if (dirty && !loading) {
      const confirmed = window.confirm('Hay cambios sin guardar. ¿Cerrar de todas formas?');
      if (!confirmed) return;
    }
    onCancel();
  };

  /* Cmd/Ctrl + Enter to save */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        setIntentionalSubmit(true);
        // Defer one microtask so state update is flushed before submit
        Promise.resolve().then(() => {
          formRef.current?.requestSubmit();
        });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
     
  }, []);

  /* Smart default: restaurant time */
  useEffect(() => {
    if (type === 'restaurant' && !startTime && !initialData) {
      setStartTime('20:00');
    }
  }, [type, startTime, initialData]);

  /* Handle receipt scanning */
  const handleScanReceipt = async (file: File) => {
    setScanningReceipt(true);
    try {
      let scanned;
      try {
        scanned = await extractReceiptData(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No pude leer el ticket.';
        console.error('[OCR]', err);
        alert(msg);
        return;
      }

      if (!scanned) {
        alert('No se pudo leer el ticket. Intenta con otra foto más clara.');
        return;
      }

      // Auto-fill cost and currency
      setCost(scanned.amount.toString());
      setCurrency(scanned.currency);

      // Auto-fill payment method if detected
      if (scanned.paymentMethod) {
        setPaymentMethod(scanned.paymentMethod);
      }

      // If establishment name detected and title not manually edited, update it
      if (scanned.description && !titleManuallyEdited.current) {
        setTitle(scanned.description);
      }

      // Store the file for later upload
      setReceiptFile(file);
      setCreateExpense(true); // Auto-enable expense creation
    } catch (error) {
      console.error('Error scanning receipt:', error);
      alert('Error al escanear el ticket. Intenta de nuevo.');
    } finally {
      setScanningReceipt(false);
    }
  };

  /* Smart default: hotel check-out date = check-in + 1 day */
  useEffect(() => {
    if (type === 'hotel' && details.checkInDate && !details.checkOutDate && !initialData) {
      try {
        const checkIn = new Date(details.checkInDate);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 1);
        const checkOutStr = checkOut.toISOString().split('T')[0];
        setDetails((prev) => ({ ...prev, checkOutDate: checkOutStr }));
      } catch {
        // ignore invalid date
      }
    }
  }, [type, details.checkInDate, details.checkOutDate, initialData]);

  /* Smart default: flight origin filled -> focus destination */
  useEffect(() => {
    if (type === 'flight' && details.origin && !details.destination) {
      // Small delay to let DOM render
      const timer = setTimeout(() => {
        destinationRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [type, details.origin, details.destination]);

  const handleTypeChange = (newType: EventType | '') => {
    setType(newType);
    // Apply smart defaults for the new type
    const defaults = newType ? getSmartDefaults(newType) : {};
    setDetails(initialData ? {} : defaults);
    setArrivalTimezone('');
    setArrivalDate('');
    titleManuallyEdited.current = false;

    // Smart defaults for startTime
    if (newType === 'restaurant' && !initialData) {
      setStartTime('20:00');
    } else if (!initialData) {
      setStartTime('');
    }
  };

  const handleDetailChange = (key: string, value: string) => {
    setDetails((prev) => ({ ...prev, [key]: value }));

    // Hotel: sincronizar campos base con detalles
    if (type === 'hotel') {
      if (key === 'checkInDate') setDate(value);
      if (key === 'checkInTime') setStartTime(value);
      if (key === 'checkOutTime') setEndTime(value);
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    titleManuallyEdited.current = true;
  };

  const toggleSplitMember = (uid: string) => {
    setSplitBetween((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Only allow submit when explicitly triggered by submit button click
    if (!intentionalSubmit) {
      // Enter key pressed — advance step instead of submitting (not in edit mode)
      if (step >= 0 && step < 2) goNext();
      return;
    }
    setIntentionalSubmit(false);
    setErrors({});

    // Filtrar detalles vacios
    const cleanDetails: Record<string, string> = {};
    for (const [k, v] of Object.entries(details)) {
      if (v.trim()) cleanDetails[k] = v.trim();
    }

    // Guardar datos de llegada en details (todos los tipos excepto hotel)
    if (type !== 'hotel') {
      if (arrivalTimezone) cleanDetails.arrivalTimezone = arrivalTimezone;
      if (arrivalDate) cleanDetails.arrivalDate = arrivalDate;
    }

    if (!type) {
      setErrors({ type: 'Selecciona un tipo de evento' });
      setStep(0);
      return;
    }

    const parsed = eventSchema.safeParse({
      title,
      type,
      date,
      startTime,
      endTime,
      location: deriveLocation(type, cleanDetails),
      notes,
      cost: parseFloat(cost) || 0,
      currency,
      details: cleanDetails,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      // Go back to step with error
      if (fieldErrors.type || fieldErrors.title || fieldErrors.date) {
        setStep(0);
      }
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    const eventData = {
      ...parsed.data,
      ...(timezone ? { timezone } : {}),
      ...(!isNaN(latNum) ? { latitude: latNum } : {}),
      ...(!isNaN(lngNum) ? { longitude: lngNum } : {}),
      ...(city ? { city } : {}),
      ...(country ? { country } : {}),
      attachments: initialData?.attachments || [],
    };

    const eventId = await onSubmit(eventData);

    // Create linked expense if checkbox is checked and event was created successfully
    if (createExpense && eventId && !isEdit && user && tripId) {
      try {
        // Upload receipt photo if provided
        let receiptUrl: string | undefined;
        if (receiptFile) {
          try {
            const storage = getClientStorage();
            const timestamp = Date.now();
            const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `trips/${tripId}/receipts/${eventId}_${timestamp}_${safeName}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, receiptFile);
            receiptUrl = await getDownloadURL(storageRef);
          } catch (uploadError) {
            console.error('Error uploading receipt:', uploadError);
            // Continue creating expense even if receipt upload fails
          }
        }

        // Map event type to expense category
        const expenseCategory: ExpenseCategory = type;

        // Handle points payment method
        const isPoints = paymentMethod === 'points';
        const realValue = isPoints ? (parseFloat(equivalentValue) || 0) : 0;

        await addTripExpense({
          tripId,
          eventId,
          description: title,
          amount: isPoints ? 0 : parseFloat(cost) || 0,
          currency: isPoints ? realValueCurrency : currency,
          category: expenseCategory,
          paidBy: paidBy || user.uid,
          splitBetween: splitBetween.length > 0 ? splitBetween : [user.uid],
          date,
          notes: notes || undefined,
          paymentMethod,
          cardId:
            paymentMethod === 'credit' || paymentMethod === 'debit'
              ? cardId || undefined
              : undefined,
          pointsUsed: isPoints ? (parseFloat(pointsUsed) || 0) : undefined,
          equivalentValue: isPoints ? realValue : undefined,
          realValueCurrency: isPoints ? realValueCurrency : undefined,
          receiptUrl,
          createdBy: user.uid,
        });
      } catch (error) {
        console.error('Error creating linked expense:', error);
        // Don't fail the event creation if expense creation fails
      }
    }
  };

  const fields = type ? EVENT_FIELDS[type] : [];

  /* Can move forward from step 0 */
  const canAdvanceFromStep0 = !!type && !!title && !!date;

  const goNext = () => {
    if (step === 0 && !canAdvanceFromStep0) {
      const stepErrors: Record<string, string> = {};
      if (!type) stepErrors.type = 'Selecciona un tipo de evento';
      if (!title) stepErrors.title = 'El titulo es obligatorio';
      if (!date) stepErrors.date = 'La fecha es obligatoria';
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((prev) => Math.min(prev + 1, 2));
  };

  const goBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  };

  // Address-type fields → autocomplete fills the address text + coords.
  const LOCATION_FIELDS = new Set(['address', 'pickupLocation', 'dropoffLocation', 'portName']);
  // Primary "name" fields → picking a place fills the name AND stamps coords
  // (and the address subfield when present). This is the natural action that
  // makes a pin appear instantly, instead of relying on later geocoding.
  const PLACE_NAME_FIELDS = new Set([
    'restaurantName', 'activityName', 'hotelName', 'storeName', 'gasStation', 'placeName',
  ]);

  const renderField = (field: FieldDef) => {
    const value = details[field.key] || '';
    const wrapperClass = field.colSpan === 2 ? 'col-span-2' : '';

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key} className={wrapperClass}>
          <Select
            label={field.label}
            options={field.options}
            value={value}
            onChange={(e) => handleDetailChange(field.key, e.target.value)}
            compact
          />
        </div>
      );
    }

    // Use Places Autocomplete for both address-type and primary name fields.
    if (LOCATION_FIELDS.has(field.key) || PLACE_NAME_FIELDS.has(field.key)) {
      const isNameField = PLACE_NAME_FIELDS.has(field.key);
      return (
        <div key={field.key} className={wrapperClass}>
          <PlacesAutocomplete
            label={field.label}
            value={value}
            onChange={(v) => handleDetailChange(field.key, v)}
            onSelect={(place) => {
              setLatitude(String(place.lat));
              setLongitude(String(place.lng));
              if (isNameField) {
                // Keep the place name in the name field; drop the full address
                // into the address subfield (used by deriveLocation) when set.
                handleDetailChange(field.key, place.name || place.address);
                if (place.address) handleDetailChange('address', place.address);
              } else {
                handleDetailChange(field.key, place.address || place.name);
              }
            }}
            placeholder={field.placeholder}
            compact
          />
        </div>
      );
    }

    // Special ref for flight destination
    const extraProps: Record<string, unknown> = {};
    if (type === 'flight' && field.key === 'destination') {
      extraProps.ref = destinationRef;
    }

    return (
      <div key={field.key} className={wrapperClass}>
        <Input
          label={field.label}
          type={field.type}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => handleDetailChange(field.key, e.target.value)}
          compact
          {...extraProps}
        />
      </div>
    );
  };

  /* ─── Step 0: Essentials ────────────────────────── */
  const renderStep0 = () => (
    <div className="space-y-3">
      {/* Question: Is this already paid? (only for new events) */}
      {!isEdit && isAlreadyPaid === null && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-1 text-center">
            ¿Ya pagaste este evento?
          </p>
          <p className="text-xs text-gray-500 mb-4 text-center">
            Esto nos ayuda a saber si registrar un gasto o solo planearlo.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAlreadyPaid(true);
                setCreateExpense(true);
              }}
              className="group flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/10 active:scale-[0.98] transition-all text-center"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
              <p className="text-sm font-semibold text-emerald-900">Sí, ya pagué</p>
              <p className="text-[11px] text-emerald-700/80 leading-tight">Registrar gasto</p>
            </button>
            <button
              type="button"
              onClick={() => setIsAlreadyPaid(false)}
              className="group flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-2xl bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-400 hover:shadow-md hover:shadow-gray-500/10 active:scale-[0.98] transition-all text-center"
            >
              <div className="w-10 h-10 rounded-full bg-gray-500 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-semibold text-gray-900">No, aún no</p>
              <p className="text-[11px] text-gray-600 leading-tight">Solo planear</p>
            </button>
          </div>
        </div>
      )}

      {/* Show selected option banner if answered */}
      {!isEdit && isAlreadyPaid !== null && (
        <div className={classNames(
          "rounded-lg p-2 flex items-center justify-between",
          isAlreadyPaid ? "bg-green-100 border border-green-300" : "bg-blue-100 border border-blue-300"
        )}>
          <span className="text-sm font-medium text-gray-700">
            {isAlreadyPaid ? "✅ Gasto ya pagado - Se creará registro" : "📅 Solo planeando"}
          </span>
          <button
            type="button"
            onClick={() => setIsAlreadyPaid(null)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Only show form fields after answering the question (or when editing) */}
      {(isEdit || isAlreadyPaid !== null) && (
        <>
          {/* Tipo de evento — chip grid */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Tipo de evento <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {(Object.entries(EVENT_TYPES) as [EventType, typeof EVENT_TYPES[EventType]][]).map(
                ([t, cfg]) => {
                  const ChipIcon = ICON_MAP[cfg.icon] || MoreHorizontal;
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={classNames(
                        'relative flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition-all border',
                        active
                          ? 'border-transparent shadow-md scale-[1.02]'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-600'
                      )}
                      style={
                        active
                          ? {
                              backgroundColor: `${cfg.color}1c`,
                              color: cfg.color,
                              boxShadow: `0 0 0 1.5px ${cfg.color}, 0 6px 14px -8px ${cfg.color}66`,
                            }
                          : undefined
                      }
                    >
                      <ChipIcon className="w-4 h-4" />
                      <span className="text-[10px] font-semibold leading-tight text-center">
                        {cfg.label}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
            {errors.type && (
              <p className="text-red-500 text-xs mt-1.5">{errors.type}</p>
            )}
          </div>

          {/* Titulo (auto-sugerido) */}
          <Input
            label="Título"
            placeholder="Nombre del evento"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            error={errors.title}
            required
          />

      {/* Fecha + Hora para tipos que no son vuelo ni hotel */}
      {type && type !== 'flight' && type !== 'hotel' && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
            required
            min={tripStartDate}
            max={tripEndDate}
          />
          <Input
            label="Hora"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      )}

      {/* Fecha de salida para vuelos (within essentials) */}
      {type === 'flight' && (
        <Input
          label="Fecha de salida"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
          required
          min={tripStartDate}
          max={tripEndDate}
        />
      )}

      {/* Fecha de check-in para hotel */}
      {type === 'hotel' && (
        <Input
          label="Fecha de check-in"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            handleDetailChange('checkInDate', e.target.value);
          }}
          error={errors.date}
          required
          min={tripStartDate}
          max={tripEndDate}
        />
      )}
        </>
      )}
    </div>
  );

  /* ─── Step 1: Type-specific details ─────────────── */
  const renderStep1 = () => (
    <div className="space-y-3">
      {type && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Detalles de {EVENT_TYPES[type].label}
          </p>
          {fields.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {fields.map(renderField)}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">
              No hay campos adicionales para este tipo
            </p>
          )}
          {/* Zona horaria para hotel */}
          {type === 'hotel' && (
            <div className="pt-1 border-t border-gray-200 mt-2">
              <TimezoneSelect
                label="Zona horaria"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                compact
              />
            </div>
          )}
          {/* Salida y llegada para vuelos */}
          {type === 'flight' && (
            <>
              {/* Salida */}
              <div className="pt-1 border-t border-gray-200 mt-2 space-y-2">
                <p className="text-[11px] font-medium text-cyan-500 uppercase tracking-wider">Salida</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Hora salida"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    compact
                  />
                  <TimezoneSelect
                    label="Zona horaria"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    compact
                  />
                </div>
              </div>
              {/* Llegada */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-cyan-500 uppercase tracking-wider">Llegada</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Fecha llegada"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    compact
                  />
                  <Input
                    label="Hora llegada"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    compact
                  />
                  <TimezoneSelect
                    label="Zona horaria"
                    value={arrivalTimezone}
                    onChange={(e) => setArrivalTimezone(e.target.value)}
                    compact
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Coordenadas — auto-llenadas por Places Autocomplete */}

      {/* Salida y llegada para tipos que NO son vuelo ni hotel */}
      {type && type !== 'flight' && type !== 'hotel' && type !== 'souvenirs' && type !== 'snacks' && type !== 'clothing' && type !== 'fuel' && type !== 'misc' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
          {/* Salida */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-blue-500 uppercase tracking-wider">Salida</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Hora"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                compact
              />
              <TimezoneSelect
                label="Zona horaria"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                compact
              />
            </div>
          </div>
          {/* Llegada */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-blue-500 uppercase tracking-wider">Llegada</p>
            <div className="grid grid-cols-3 gap-2">
              <Input
                label="Fecha"
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                compact
              />
              <Input
                label="Hora"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                compact
              />
              <TimezoneSelect
                label="Zona horaria"
                value={arrivalTimezone}
                onChange={(e) => setArrivalTimezone(e.target.value)}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ─── Step 2: Cost + Notes + Timezone ───────────── */
  const renderStep2 = () => (
    <div className="space-y-3">
      {/* Ciudad y país para contexto de fotos */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          Ubicación (para fotos)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Ciudad"
            type="text"
            placeholder="Ej. Mazatlán"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            compact
          />
          <Input
            label="País"
            type="text"
            placeholder="Ej. México"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            compact
          />
        </div>
      </div>

      {/* Scan receipt button (only if already paid) */}
      {!isEdit && isAlreadyPaid && (
        <div className="rounded-lg border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
          <input
            ref={receiptScanInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScanReceipt(file);
            }}
            className="hidden"
          />
          <p className="text-xs font-bold text-purple-700 mb-2 text-center uppercase tracking-wide">
            💡 Simplifica tu vida
          </p>
          <button
            type="button"
            onClick={() => receiptScanInputRef.current?.click()}
            disabled={scanningReceipt}
            className="w-full px-5 py-4 text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanningReceipt ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Escaneando ticket...
              </>
            ) : (
              <>
                📸 Escanear ticket (auto-detecta costo)
              </>
            )}
          </button>
          <p className="text-xs text-purple-700 mt-3 text-center font-medium">
            O puedes llenar el costo manualmente abajo ↓
          </p>
        </div>
      )}

      {/* Expense fields (only if already paid) */}
      {!isEdit && isAlreadyPaid && (
        <>
          {/* Payment method */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Forma de pago
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(key)}
                  className={classNames(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    paymentMethod === key
                      ? 'bg-purple-50 border-purple-600 text-purple-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Card picker — when paid by credit/debit, tag which card */}
            {(paymentMethod === 'credit' || paymentMethod === 'debit') && (
              <div className="pt-2">
                <CardPicker type={paymentMethod} value={cardId} onChange={setCardId} />
              </div>
            )}

            {/* Points fields */}
            {paymentMethod === 'points' && (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Puntos usados"
                    type="number"
                    placeholder="Ej: 45000"
                    value={pointsUsed}
                    onChange={(e) => setPointsUsed(e.target.value)}
                    compact
                  />
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Input
                        label="Valor real"
                        type="number"
                        step="0.01"
                        placeholder="Precio de mercado"
                        value={equivalentValue}
                        onChange={(e) => setEquivalentValue(e.target.value)}
                        compact
                      />
                    </div>
                    <Select
                      label="Moneda"
                      options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                      value={realValueCurrency}
                      onChange={(e) => setRealValueCurrency(e.target.value)}
                      compact
                    />
                  </div>
                </div>
                <p className="text-xs text-emerald-600">
                  Se agrega al presupuesto. Gasto real: $0 = ahorro
                </p>
              </div>
            )}
          </div>

          {/* Paid by */}
          {tripTravelers.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Pagado por
              </p>
              <Select
                options={tripTravelers.map((t) => ({ value: t.id, label: t.fullName }))}
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                compact
              />
            </div>
          )}

          {/* Split between */}
          {tripTravelers.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Dividir entre
              </p>
              <div className="flex flex-wrap gap-2">
                {tripTravelers.map((t) => {
                  const isSelected = splitBetween.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleSplitMember(t.id)}
                      className={classNames(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                        isSelected
                          ? 'bg-purple-50 border-purple-300 text-purple-700'
                          : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600',
                      )}
                    >
                      <div
                        className={classNames(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                          isSelected
                            ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white'
                            : 'bg-gray-100 text-gray-400',
                        )}
                      >
                        {getInitials(t.fullName)}
                      </div>
                      {t.fullName.split(' ')[0]}
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
              {splitBetween.length > 0 && parseFloat(cost) > 0 && paymentMethod !== 'points' && (
                <p className="text-xs text-gray-400">
                  ${(parseFloat(cost) / splitBetween.length).toFixed(2)} {currency} por persona
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Costo y moneda */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input
            label="Costo"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            error={errors.cost}
          />
        </div>
        <Select
          label="Moneda"
          options={currencyOptions}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />
      </div>

      {/* Show receipt file if one was selected */}
      {receiptFile && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-medium text-green-900 mb-2">✅ Ticket capturado</p>
          <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-green-200">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{receiptFile.name}</p>
              <p className="text-xs text-gray-600">{(receiptFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReceiptFile(null);
                // Optionally clear the cost if it was auto-filled
              }}
              className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
            >
              Cambiar
            </button>
          </div>
        </div>
      )}

      {/* Notas */}
      <Textarea
        label="Notas"
        placeholder="Detalles adicionales..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />

      {/* Timezone for non-flight non-hotel (already handled in step 1 for those) */}
      {type && type !== 'flight' && type !== 'hotel' && (
        <TimezoneSelect
          label="Zona horaria del evento"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
      )}
    </div>
  );

  /* Rich header for the modal — shows event identity at a glance */
  const typeColor = type ? EVENT_TYPES[type].color : '#94a3b8';
  const TypeIcon: LucideIcon | null = type
    ? ICON_MAP[EVENT_TYPES[type].icon] || MoreHorizontal
    : null;
  const richHeader = (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `${typeColor}1c`,
          color: typeColor,
          boxShadow: `0 0 0 1px ${typeColor}30`,
        }}
      >
        {TypeIcon ? <TypeIcon className="w-5 h-5" /> : <span className="text-xs font-bold">?</span>}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-gray-900 font-semibold text-base sm:text-lg leading-tight truncate">
          {isEdit ? (title || 'Editar Evento') : (title || 'Nuevo Evento')}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
          {type && (
            <span
              className="font-bold tracking-wide uppercase"
              style={{ color: typeColor }}
            >
              {EVENT_TYPES[type].label}
            </span>
          )}
          {date && (
            <>
              <span>·</span>
              <span>{date}</span>
            </>
          )}
          {startTime && (
            <>
              <span>·</span>
              <span>
                {startTime}
                {endTime ? ` – ${endTime}` : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      open
      onClose={handleClose}
      size="xl"
      titleSlot={richHeader}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        {/* Read-only banner — viewer/kid roles see the event but can't
            save changes. The form fields remain visible so they have
            the full context; only the submit affordances are removed
            below. */}
        {isReadOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-amber-800 text-xs font-medium">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Solo lectura — tu rol no permite editar este evento.</span>
          </div>
        )}
        {/* Edit mode: show all fields at once */}
        {step === -1 ? (
          <>
            <div className="space-y-4">
              {renderStep0()}
              {type && <div className="border-t border-gray-200 pt-3">{renderStep1()}</div>}
              <div className="border-t border-gray-200 pt-3">{renderStep2()}</div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                {/* Destructive + duplicate actions also hide for read-only roles.
                    Cerrar/Cancelar always shows so the user can dismiss the modal. */}
                {!isReadOnly && isEdit && onDelete && initialData && (
                  <Button
                    type="button"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Eliminar "${initialData.title}"? Esta accion no se puede deshacer.`
                        )
                      ) {
                        onDelete(initialData.id);
                      }
                    }}
                    disabled={loading}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Eliminar
                  </Button>
                )}
                {!isReadOnly && isEdit && onDuplicate && initialData && (
                  <Button
                    type="button"
                    variant="ghost"
                    icon={Copy}
                    onClick={() => onDuplicate(initialData)}
                    disabled={loading}
                    className="text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                  >
                    Duplicar
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                  {isReadOnly ? 'Cerrar' : 'Cancelar'}
                </Button>
                {!isReadOnly && (
                  <Button type="submit" loading={loading} onClick={() => setIntentionalSubmit(true)}>
                    Guardar Cambios
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
        <>
        {/* Step indicator */}
        <StepIndicator currentStep={step} onStepClick={setStep} />

        {/* Step content */}
        <div className="min-h-[200px]">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>

        {/* Navigation + Submit buttons */}
        <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-gray-200">
          <div>
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={goBack}
                disabled={loading}
                icon={ChevronLeft}
              >
                Atrás
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
            >
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </Button>

            {/* Step navigation + submit. Viewers/kids never see the
                submit button — they can browse the steps to inspect
                what's there, but can't persist anything. */}
            {!isReadOnly && (
              step < 2 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={loading}
                  icon={ChevronRight}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  type="submit"
                  loading={loading}
                  onClick={() => setIntentionalSubmit(true)}
                >
                  {isEdit ? 'Guardar Cambios' : 'Crear Evento'}
                </Button>
              )
            )}
          </div>
        </div>
        </>
        )}
      </form>
    </Modal>
  );
}
