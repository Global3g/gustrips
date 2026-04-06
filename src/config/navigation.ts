export const APP_NAV_ITEMS = [
  { href: '/dashboard', label: 'Mis Viajes', icon: 'LayoutDashboard' },
  { href: '/flights', label: 'Buscar Vuelos', icon: 'Plane' },
  { href: '/alerts', label: 'Alertas', icon: 'Bell' },
  { href: '/trips/new', label: 'Nuevo Viaje', icon: 'PlaneTakeoff' },
] as const;

export const APP_BOTTOM_NAV_ITEMS = [
  { href: '/dashboard', label: 'Viajes', icon: 'LayoutDashboard' },
  { href: '/flights', label: 'Vuelos', icon: 'Plane' },
  { href: '/alerts', label: 'Alertas', icon: 'Bell' },
  { href: '/trips/new', label: 'Nuevo', icon: 'PlaneTakeoff' },
] as const;

export const TRIP_NAV_ITEMS = [
  { href: '', label: 'General', icon: 'MapPin' },
  { href: '/itinerary', label: 'Itinerario', icon: 'Calendar' },
  { href: '/members', label: 'Miembros', icon: 'Users' },
  { href: '/documents', label: 'Documentos', icon: 'FileText' },
  { href: '/checklist', label: 'Checklist', icon: 'CheckSquare' },
] as const;
