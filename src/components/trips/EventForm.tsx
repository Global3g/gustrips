'use client';

import { useState, useRef, useEffect, useMemo, type FormEvent } from 'react';
import { z } from 'zod';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { EVENT_TYPES, CURRENCIES, DEFAULT_CURRENCY, PAYMENT_METHODS } from '@/config/constants';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TimezoneSelect from '@/components/ui/TimezoneSelect';
import Textarea from '@/components/ui/Textarea';
import PlacesAutocomplete from '@/components/ui/PlacesAutocomplete';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { classNames, nowISO, getInitials } from '@/lib/utils/helpers';
import type { TripEvent, EventType, ExpenseCategory } from '@/types';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { getClientStorage } from '@/lib/firebase/client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { extractReceiptData } from '@/lib/utils/receiptOCR';

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
  souvenirs: [],
  snacks: [],
  clothing: [],
  fuel: [],
  misc: [],
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
      return 'Souvenirs';
    case 'snacks':
      return 'Snacks';
    case 'clothing':
      return 'Ropa y Accesorios';
    case 'fuel':
      return 'Combustible';
    case 'misc':
      return 'Otros';
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
    case 'fuel':
    case 'misc':
      return '';
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
  onSubmit: (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => Promise<string | void>;
  onCancel: () => void;
  loading?: boolean;
}

/* ─── Opciones para selects ─────────────────────── */

const typeOptions = [
  { value: '', label: 'Seleccionar tipo...' },
  ...Object.entries(EVENT_TYPES).map(([value, cfg]) => ({
    value,
    label: cfg.label,
  })),
];

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

export default function EventForm({ initialData, defaultDate, defaultTime, tripStartDate, tripEndDate, tripId, onSubmit, onCancel, loading = false }: EventFormProps) {
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
  const [createExpense, setCreateExpense] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState<boolean | null>(null); // null = not answered yet
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Expense fields (only used when isAlreadyPaid = true)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidBy, setPaidBy] = useState('');
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [pointsUsed, setPointsUsed] = useState('');
  const [equivalentValue, setEquivalentValue] = useState('');
  const [realValueCurrency, setRealValueCurrency] = useState(DEFAULT_CURRENCY);

  const titleManuallyEdited = useRef(!!initialData);
  const destinationRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const receiptScanInputRef = useRef<HTMLInputElement>(null);

  // Hooks for expense creation
  const { user } = useAuth();
  const { addTripExpense } = useExpenses(tripId || '');
  const { travelers: allTravelers } = useGlobalTravelers();

  // Get trip travelers (filtered by tripId)
  const tripTravelers = useMemo(() => {
    // For now, we'll use allTravelers. In a real scenario, you'd filter by trip.travelerIds
    // But we don't have the trip object here. We can pass it as a prop or get it from context
    return allTravelers;
  }, [allTravelers]);

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

  /* Smart default: restaurant time */
  useEffect(() => {
    if (type === 'restaurant' && !startTime && !initialData) {
      setStartTime('20:00');
    }
  }, [type, startTime, initialData]);

  /* Check if event date is in the past */
  const isEventInPast = useMemo(() => {
    if (!date) return false;
    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  }, [date]);

  /* Handle receipt scanning */
  const handleScanReceipt = async (file: File) => {
    setScanningReceipt(true);
    try {
      const scanned = await extractReceiptData(file);

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

  const [intentionalSubmit, setIntentionalSubmit] = useState(false);

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

  // Fields that should use Places Autocomplete
  const LOCATION_FIELDS = new Set(['address', 'pickupLocation', 'dropoffLocation', 'portName']);

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

    // Use Places Autocomplete for location/address fields
    if (LOCATION_FIELDS.has(field.key)) {
      return (
        <div key={field.key} className={wrapperClass}>
          <PlacesAutocomplete
            label={field.label}
            value={value}
            onChange={(v) => handleDetailChange(field.key, v)}
            onSelect={(place) => {
              handleDetailChange(field.key, place.address || place.name);
              setLatitude(String(place.lat));
              setLongitude(String(place.lng));
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
        <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 p-4">
          <p className="text-sm font-bold text-gray-900 mb-3">¿Este gasto ya lo pagaste?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAlreadyPaid(true);
                setCreateExpense(true);
              }}
              className="p-3 rounded-xl bg-white border-2 border-green-300 hover:border-green-500 hover:bg-green-50 transition-all text-center"
            >
              <div className="text-2xl mb-1">✅</div>
              <p className="text-sm font-bold text-gray-900">Ya lo pagué</p>
              <p className="text-xs text-gray-500">Registrar gasto</p>
            </button>
            <button
              type="button"
              onClick={() => setIsAlreadyPaid(false)}
              className="p-3 rounded-xl bg-white border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
            >
              <div className="text-2xl mb-1">📅</div>
              <p className="text-sm font-bold text-gray-900">Aún no</p>
              <p className="text-xs text-gray-500">Solo planear</p>
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
          {/* Tipo de evento */}
          <Select
            label="Tipo de evento"
            options={typeOptions}
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as EventType | '')}
            error={errors.type}
            required
          />

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
      {type && fields.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Detalles de {EVENT_TYPES[type].label}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {fields.map(renderField)}
          </div>
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
      ) : (type === 'souvenirs' || type === 'snacks' || type === 'clothing' || type === 'fuel' || type === 'misc') ? (
        <div className="text-center py-8 text-gray-300 text-sm">
          Este tipo no tiene detalles adicionales. Puedes continuar al siguiente paso.
        </div>
      ) : (
        <div className="text-center py-8 text-gray-300 text-sm">
          Selecciona un tipo de evento en el paso anterior.
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

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? 'Editar Evento' : 'Nuevo Evento'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Edit mode: show all fields at once */}
        {step === -1 ? (
          <>
            <div className="space-y-4">
              {renderStep0()}
              {type && <div className="border-t border-gray-200 pt-3">{renderStep1()}</div>}
              <div className="border-t border-gray-200 pt-3">{renderStep2()}</div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading} onClick={() => setIntentionalSubmit(true)}>
                Guardar Cambios
              </Button>
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
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
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
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>

            {step < 2 ? (
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
            )}

            {/* Allow quick submit from step 0 only */}
            {step === 0 && canAdvanceFromStep0 && (
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={loading}
                onClick={() => setIntentionalSubmit(true)}
              >
                {isEdit ? 'Guardar' : 'Crear'}
              </Button>
            )}
          </div>
        </div>
        </>
        )}
      </form>
    </Modal>
  );
}
