import type { TripStatus, EventType, ExpenseCategory, PaymentMethod, ChecklistPhase, MemberRole, DocumentCategory } from '@/types';

export const APP_NAME = 'GusTrips';
export const APP_DESCRIPTION = 'Organizador de Viajes Multiusuario';

export const TRIP_STATUS: Record<TripStatus, { label: string; color: string }> = {
  planning: { label: 'Planificando', color: '#f59e0b' },
  active: { label: 'Activo', color: '#22c55e' },
  completed: { label: 'Completado', color: '#3b82f6' },
  cancelled: { label: 'Cancelado', color: '#9ca3af' },
};

export const EVENT_TYPES: Record<EventType, { label: string; icon: string; color: string }> = {
  flight: { label: 'Vuelo', icon: 'Plane', color: '#ec4899' },
  hotel: { label: 'Hotel', icon: 'Hotel', color: '#8b5cf6' },
  car_rental: { label: 'Renta de Carro', icon: 'CarFront', color: '#eab308' },
  activity: { label: 'Actividad', icon: 'MapPin', color: '#22c55e' },
  restaurant: { label: 'Restaurante', icon: 'UtensilsCrossed', color: '#f97316' },
  transport: { label: 'Transporte', icon: 'Car', color: '#3b82f6' },
  cruise: { label: 'Puerto / Crucero', icon: 'Ship', color: '#7dd3fc' },
  other: { label: 'Otro', icon: 'MoreHorizontal', color: '#6b7280' },
};

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  flight: { label: 'Vuelo', icon: 'Plane', color: '#ec4899' },
  hotel: { label: 'Hotel', icon: 'Hotel', color: '#8b5cf6' },
  car_rental: { label: 'Renta de Carro', icon: 'CarFront', color: '#eab308' },
  activity: { label: 'Actividad', icon: 'MapPin', color: '#22c55e' },
  restaurant: { label: 'Restaurante', icon: 'UtensilsCrossed', color: '#f97316' },
  transport: { label: 'Transporte', icon: 'Car', color: '#3b82f6' },
  cruise: { label: 'Puerto / Crucero', icon: 'Ship', color: '#7dd3fc' },
  souvenirs: { label: 'Souvenirs', icon: 'Gift', color: '#e879f9' },
  snacks: { label: 'Snacks', icon: 'Coffee', color: '#fb923c' },
  clothing: { label: 'Ropa y Accesorios', icon: 'ShoppingBag', color: '#f43f5e' },
  fuel: { label: 'Combustible', icon: 'Fuel', color: '#84cc16' },
  misc: { label: 'Otros', icon: 'Package', color: '#94a3b8' },
};

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  debit: 'Tarjeta de Debito',
  credit: 'Tarjeta de Credito',
  transfer: 'Transferencia',
  points: 'Puntos',
  other: 'Otro',
};

export const CHECKLIST_PHASES: Record<ChecklistPhase, { label: string; icon: string; color: string }> = {
  'pre-7d': { label: '7 días antes', icon: 'Calendar', color: '#3b82f6' },
  'pre-1d': { label: '1 día antes', icon: 'CalendarCheck', color: '#f59e0b' },
  airport: { label: 'Aeropuerto', icon: 'PlaneTakeoff', color: '#06b6d4' },
  hotel: { label: 'Hotel', icon: 'Hotel', color: '#8b5cf6' },
  return: { label: 'Regreso', icon: 'RotateCcw', color: '#22c55e' },
};

export const MEMBER_ROLES: Record<MemberRole, { label: string; description: string }> = {
  owner: { label: 'Dueño', description: 'Control total del viaje' },
  editor: { label: 'Editor', description: 'Puede editar itinerario y documentos' },
  viewer: { label: 'Visor', description: 'Solo puede ver información' },
};

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, { label: string; icon: string; color: string }> = {
  flight: { label: 'Vuelos', icon: 'Plane', color: '#ec4899' },
  hotel: { label: 'Hoteles', icon: 'Hotel', color: '#8b5cf6' },
  car_rental: { label: 'Autos', icon: 'CarFront', color: '#eab308' },
  restaurant: { label: 'Restaurantes', icon: 'UtensilsCrossed', color: '#f97316' },
  activity: { label: 'Tours', icon: 'MapPin', color: '#22c55e' },
  transport: { label: 'Transporte', icon: 'Car', color: '#3b82f6' },
  cruise: { label: 'Crucero', icon: 'Ship', color: '#7dd3fc' },
  insurance: { label: 'Seguros', icon: 'Shield', color: '#ec4899' },
  passport: { label: 'Pasaportes', icon: 'BookOpen', color: '#14b8a6' },
  visa: { label: 'Visas', icon: 'Stamp', color: '#a855f7' },
  other: { label: 'Otros', icon: 'MoreHorizontal', color: '#6b7280' },
};

/** Map event types to document categories */
export const EVENT_TYPE_TO_DOC_CATEGORY: Record<EventType, DocumentCategory> = {
  flight: 'flight',
  hotel: 'hotel',
  car_rental: 'car_rental',
  restaurant: 'restaurant',
  activity: 'activity',
  transport: 'transport',
  cruise: 'cruise',
  other: 'other',
};

export const CURRENCIES = ['MXN', 'USD', 'EUR', 'GBP', 'CAD'] as const;
export const DEFAULT_CURRENCY = 'MXN';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const ROUTES = {
  login: '/login',
  register: '/register',
  app: {
    dashboard: '/dashboard',
    newTrip: '/trips/new',
    trip: (id: string) => `/trips/${id}`,
    itinerary: (id: string) => `/trips/${id}/itinerary`,
    members: (id: string) => `/trips/${id}/members`,
    documents: (id: string) => `/trips/${id}/documents`,
    checklist: (id: string) => `/trips/${id}/checklist`,
    map: (id: string) => `/trips/${id}/map`,
    budget: (id: string) => `/trips/${id}/budget`,
    expenses: (id: string) => `/trips/${id}/expenses`,
  },
} as const;

export const PROTECTED_ROUTES = ['/dashboard', '/trips'];
export const AUTH_ROUTES = ['/login', '/register'];

// ─── Zonas horarias agrupadas por región ─────────
export interface TimezoneOption {
  value: string;   // IANA timezone
  label: string;   // Nombre legible
}

export interface TimezoneGroup {
  label: string;
  options: TimezoneOption[];
}

export const TIMEZONES: TimezoneGroup[] = [
  {
    label: 'México',
    options: [
      { value: 'America/Mexico_City', label: 'CDMX / Centro' },
      { value: 'America/Cancun', label: 'Cancún / Sureste' },
      { value: 'America/Mazatlan', label: 'Mazatlán / Culiacán' },
      { value: 'America/Tijuana', label: 'Tijuana / Noroeste' },
      { value: 'America/Hermosillo', label: 'Hermosillo (sin horario de verano)' },
    ],
  },
  {
    label: 'Américas',
    options: [
      { value: 'America/New_York', label: 'Nueva York (Este)' },
      { value: 'America/Chicago', label: 'Chicago (Centro)' },
      { value: 'America/Los_Angeles', label: 'Los Ángeles (Pacífico)' },
      { value: 'America/Bogota', label: 'Bogotá' },
      { value: 'America/Lima', label: 'Lima' },
      { value: 'America/Sao_Paulo', label: 'São Paulo' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
    ],
  },
  {
    label: 'Europa',
    options: [
      { value: 'Europe/London', label: 'Londres' },
      { value: 'Europe/Paris', label: 'París / Madrid' },
      { value: 'Europe/Berlin', label: 'Berlín' },
      { value: 'Europe/Rome', label: 'Roma' },
      { value: 'Europe/Amsterdam', label: 'Ámsterdam' },
      { value: 'Europe/Istanbul', label: 'Estambul' },
    ],
  },
  {
    label: 'Asia / Pacífico',
    options: [
      { value: 'Asia/Dubai', label: 'Dubái' },
      { value: 'Asia/Tokyo', label: 'Tokio' },
      { value: 'Asia/Shanghai', label: 'Shanghái' },
      { value: 'Asia/Seoul', label: 'Seúl' },
      { value: 'Australia/Sydney', label: 'Sídney' },
      { value: 'Pacific/Auckland', label: 'Auckland' },
    ],
  },
];
