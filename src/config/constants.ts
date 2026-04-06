import type { TripStatus, EventType, ChecklistPhase, MemberRole } from '@/types';

export const APP_NAME = 'GusTrips';
export const APP_DESCRIPTION = 'Organizador de Viajes Multiusuario';

export const TRIP_STATUS: Record<TripStatus, { label: string; color: string }> = {
  planning: { label: 'Planificando', color: '#f59e0b' },
  active: { label: 'Activo', color: '#22c55e' },
  completed: { label: 'Completado', color: '#3b82f6' },
  cancelled: { label: 'Cancelado', color: '#6b7280' },
};

export const EVENT_TYPES: Record<EventType, { label: string; icon: string; color: string }> = {
  flight: { label: 'Vuelo', icon: 'Plane', color: '#06b6d4' },
  hotel: { label: 'Hotel', icon: 'Hotel', color: '#8b5cf6' },
  car_rental: { label: 'Renta de Carro', icon: 'CarFront', color: '#eab308' },
  activity: { label: 'Actividad', icon: 'MapPin', color: '#22c55e' },
  restaurant: { label: 'Restaurante', icon: 'UtensilsCrossed', color: '#f97316' },
  transport: { label: 'Transporte', icon: 'Car', color: '#3b82f6' },
  other: { label: 'Otro', icon: 'MoreHorizontal', color: '#6b7280' },
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

export const CURRENCIES = ['MXN', 'USD', 'EUR', 'COP'] as const;
export const DEFAULT_CURRENCY = 'MXN';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const ROUTES = {
  login: '/login',
  register: '/register',
  app: {
    dashboard: '/dashboard',
    flights: '/flights',
    alerts: '/alerts',
    newTrip: '/trips/new',
    trip: (id: string) => `/trips/${id}`,
    itinerary: (id: string) => `/trips/${id}/itinerary`,
    members: (id: string) => `/trips/${id}/members`,
    documents: (id: string) => `/trips/${id}/documents`,
    checklist: (id: string) => `/trips/${id}/checklist`,
  },
} as const;

export const PROTECTED_ROUTES = ['/dashboard', '/trips', '/flights', '/alerts'];
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
