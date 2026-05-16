export const APP_NAV_ITEMS = [
  { href: '/dashboard', label: 'Mis Viajes', icon: 'LayoutDashboard' },
  { href: '/travelers', label: 'Viajeros', icon: 'Users' },
  { href: '/trips/new', label: 'Nuevo Viaje', icon: 'PlaneTakeoff' },
  { href: '/tripshistory', label: 'Historias', icon: 'BookHeart' },
] as const;

export const APP_BOTTOM_NAV_ITEMS = [
  { href: '/dashboard', label: 'Viajes', icon: 'LayoutDashboard' },
  { href: '/travelers', label: 'Viajeros', icon: 'Users' },
  { href: '/trips/new', label: 'Nuevo', icon: 'PlaneTakeoff' },
  { href: '/tripshistory', label: 'Historias', icon: 'BookHeart' },
] as const;

export const TRIP_NAV_ITEMS = [
  { href: '/today', label: 'Hoy', icon: 'CalendarDays' },
  { href: '', label: 'General', icon: 'MapPin' },
  { href: '/itinerary', label: 'Itinerario', icon: 'Calendar' },
  { href: '/map', label: 'Mapa', icon: 'Map' },
  { href: '/members', label: 'Viajeros', icon: 'Users' },
  { href: '/documents', label: 'Documentos', icon: 'FileText' },
  { href: '/checklist', label: 'Checklist', icon: 'CheckSquare' },
  { href: '/budget', label: 'Presupuesto', icon: 'Wallet' },
  { href: '/links', label: 'Links', icon: 'ExternalLink' },
  { href: '/photos', label: 'Fotos', icon: 'Camera' },
] as const;
