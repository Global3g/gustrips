'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { z } from 'zod';
import { Search } from 'lucide-react';
import { EVENT_TYPES, CURRENCIES, DEFAULT_CURRENCY } from '@/config/constants';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TimezoneSelect from '@/components/ui/TimezoneSelect';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import FlightSearchModal from '@/components/trips/FlightSearchModal';
import type { TripEvent, EventType } from '@/types';
import type { FlightResult } from '@/lib/api/flights';

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
    default:
      return '';
  }
}

/* ─── Esquema de validacion Zod ─────────────────── */

const eventSchema = z.object({
  title: z.string().min(1, 'El titulo es obligatorio'),
  type: z.enum(['flight', 'hotel', 'activity', 'restaurant', 'transport', 'car_rental', 'other'] as const),
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

/* ─── Componente ────────────────────────────────── */

export default function EventForm({ initialData, onSubmit, onCancel, loading = false }: EventFormProps) {
  const [type, setType] = useState<EventType | ''>(initialData?.type || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(initialData?.date || '');
  const [startTime, setStartTime] = useState(initialData?.startTime || '');
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [cost, setCost] = useState(initialData?.cost?.toString() || '0');
  const [currency, setCurrency] = useState(initialData?.currency || DEFAULT_CURRENCY);
  const [details, setDetails] = useState<Record<string, string>>(initialData?.details || {});
  const [timezone, setTimezone] = useState(initialData?.timezone || '');
  const [arrivalTimezone, setArrivalTimezone] = useState(initialData?.details?.arrivalTimezone || '');
  const [arrivalDate, setArrivalDate] = useState(initialData?.details?.arrivalDate || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showFlightSearch, setShowFlightSearch] = useState(false);

  const titleManuallyEdited = useRef(!!initialData);

  /* Auto-generar titulo cuando cambian tipo o detalles */
  useEffect(() => {
    if (!titleManuallyEdited.current && type) {
      setTitle(generateTitle(type, details));
    }
  }, [type, details]);

  const handleTypeChange = (newType: EventType | '') => {
    setType(newType);
    setDetails({});
    setArrivalTimezone('');
    setArrivalDate('');
    titleManuallyEdited.current = false;
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

  const handleSelectFlight = (flight: FlightResult) => {
    // Auto-llenar campos con datos del vuelo
    setDetails({
      airline: flight.airline,
      flightNumber: flight.flight_number,
      origin: flight.origin,
      destination: flight.destination,
    });

    // Extraer horarios si están disponibles
    if (flight.departure_time) {
      // Asumiendo formato HH:MM
      setStartTime(flight.departure_time);
    }
    if (flight.arrival_time) {
      setEndTime(flight.arrival_time);
    }

    // Establecer precio
    setCost(flight.price.toString());
    setCurrency(flight.currency);

    // Generar título automáticamente
    setTitle(`Vuelo ${flight.origin} → ${flight.destination}`);
    titleManuallyEdited.current = false;

    // Cerrar modal
    setShowFlightSearch(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      return;
    }

    await onSubmit({
      ...parsed.data,
      ...(timezone ? { timezone } : {}),
      attachments: initialData?.attachments || [],
    });
  };

  const isEdit = !!initialData;
  const fields = type ? EVENT_FIELDS[type] : [];

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

    return (
      <div key={field.key} className={wrapperClass}>
        <Input
          label={field.label}
          type={field.type}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => handleDetailChange(field.key, e.target.value)}
          compact
        />
      </div>
    );
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? 'Editar Evento' : 'Nuevo Evento'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Tipo de evento (PRIMERO) */}
        <Select
          label="Tipo de evento"
          options={typeOptions}
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as EventType | '')}
          error={errors.type}
          required
        />

        {/* Campos dinamicos por tipo */}
        {type && fields.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                Detalles de {EVENT_TYPES[type].label}
              </p>
              {/* Botón de búsqueda de vuelos */}
              {type === 'flight' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowFlightSearch(true)}
                  className="h-7 text-xs"
                  icon={Search}
                >
                  Buscar vuelo
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fields.map(renderField)}
            </div>
            {/* Zona horaria para hotel */}
            {type === 'hotel' && (
              <div className="pt-1 border-t border-white/10 mt-2">
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
                <div className="pt-1 border-t border-white/10 mt-2 space-y-2">
                  <p className="text-[11px] font-medium text-cyan-400/60 uppercase tracking-wider">Salida</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      label="Fecha salida"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      error={errors.date}
                      compact
                      required
                    />
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
                  <p className="text-[11px] font-medium text-cyan-400/60 uppercase tracking-wider">Llegada</p>
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

        {/* Titulo (auto-sugerido) */}
        <Input
          label="Título"
          placeholder="Nombre del evento"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          error={errors.title}
          required
        />

        {/* Fecha + Horarios: Salida y Llegada (para tipos que NO son vuelo ni hotel) */}
        {type && type !== 'flight' && type !== 'hotel' && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
            {/* Salida */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-blue-400/60 uppercase tracking-wider">Salida</p>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Fecha"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  error={errors.date}
                  compact
                  required
                />
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
              <p className="text-[11px] font-medium text-blue-400/60 uppercase tracking-wider">Llegada</p>
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

        {/* Botones */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            {isEdit ? 'Guardar Cambios' : 'Crear Evento'}
          </Button>
        </div>
      </form>

      {/* Modal de búsqueda de vuelos */}
      {showFlightSearch && (
        <FlightSearchModal
          onClose={() => setShowFlightSearch(false)}
          onSelectFlight={handleSelectFlight}
          initialOrigin={details.origin || ''}
          initialDestination={details.destination || ''}
          initialDate={date}
        />
      )}
    </Modal>
  );
}
