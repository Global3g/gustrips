'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { z } from 'zod';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { EVENT_TYPES, CURRENCIES, DEFAULT_CURRENCY } from '@/config/constants';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TimezoneSelect from '@/components/ui/TimezoneSelect';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { classNames } from '@/lib/utils/helpers';
import type { TripEvent, EventType } from '@/types';

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
  other: [],
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
  type: z.enum(['flight', 'hotel', 'activity', 'restaurant', 'transport', 'car_rental', 'cruise', 'other'] as const),
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
  onSubmit: (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => Promise<void>;
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

export default function EventForm({ initialData, defaultDate, defaultTime, tripStartDate, tripEndDate, onSubmit, onCancel, loading = false }: EventFormProps) {
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const titleManuallyEdited = useRef(!!initialData);
  const destinationRef = useRef<HTMLInputElement>(null);

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

    await onSubmit({
      ...parsed.data,
      ...(timezone ? { timezone } : {}),
      ...(!isNaN(latNum) ? { latitude: latNum } : {}),
      ...(!isNaN(lngNum) ? { longitude: lngNum } : {}),
      attachments: initialData?.attachments || [],
    });
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
      ) : type === 'other' ? (
        <div className="text-center py-8 text-gray-300 text-sm">
          Este tipo no tiene detalles adicionales. Puedes continuar al siguiente paso.
        </div>
      ) : (
        <div className="text-center py-8 text-gray-300 text-sm">
          Selecciona un tipo de evento en el paso anterior.
        </div>
      )}

      {/* Coordenadas (solo para activity, restaurant, hotel, car_rental) */}
      {type && ['activity', 'restaurant', 'hotel', 'car_rental'].includes(type) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Ubicacion en mapa
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Latitud"
              type="number"
              step="any"
              placeholder="Ej. 20.6736"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              compact
            />
            <Input
              label="Longitud"
              type="number"
              step="any"
              placeholder="Ej. -103.3440"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              compact
            />
          </div>
          <p className="text-[10px] text-gray-300">
            Tip: busca las coordenadas en Google Maps
          </p>
        </div>
      )}

      {/* Salida y llegada para tipos que NO son vuelo ni hotel */}
      {type && type !== 'flight' && type !== 'hotel' && (
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
