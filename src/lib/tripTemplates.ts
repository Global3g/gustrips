/**
 * Trip-type templates.
 *
 * When a user creates a new trip they can pick one of these to pre-seed
 * the itinerary with suggested events, a starting checklist and a
 * matching packing template. Each template is intentionally a SMALL set
 * of opinionated suggestions — the user fills the rest.
 *
 * `daysFromStart` is the offset from the trip's startDate where the
 * event should be created (0 = arrival day). When the offset would put
 * the event past the trip's endDate it is clamped to the last day.
 */

import type { EventType, ChecklistPhase } from '@/types';
import type { PackingTemplateId } from '@/lib/packingTemplates';

export type TripTemplateId =
  | 'HONEYMOON'
  | 'ROADTRIP'
  | 'FAMILY'
  | 'BUSINESS'
  | 'CRUISE';

export interface TripTemplateEventSuggestion {
  type: EventType;
  title: string;
  daysFromStart: number;
  notes?: string;
}

export interface TripTemplateChecklistItem {
  text: string;
  phase: ChecklistPhase;
}

export interface TripTemplate {
  id: TripTemplateId;
  label: string;
  description: string;
  emoji: string;
  suggestedEvents: TripTemplateEventSuggestion[];
  packingTemplate: PackingTemplateId;
  checklistDefaults: TripTemplateChecklistItem[];
}

const HONEYMOON: TripTemplate = {
  id: 'HONEYMOON',
  label: 'Luna de miel',
  description: 'Cenas románticas, spa y poco estrés.',
  emoji: '💍',
  suggestedEvents: [
    { type: 'flight', title: 'Vuelo de ida', daysFromStart: 0 },
    { type: 'hotel', title: 'Check-in en el resort', daysFromStart: 0 },
    { type: 'restaurant', title: 'Cena romántica de bienvenida', daysFromStart: 0 },
    { type: 'activity', title: 'Día de spa para dos', daysFromStart: 1 },
    { type: 'activity', title: 'Excursión sorpresa', daysFromStart: 2 },
    { type: 'restaurant', title: 'Cena con vista', daysFromStart: 3 },
    { type: 'hotel', title: 'Check-out', daysFromStart: 6 },
    { type: 'flight', title: 'Vuelo de regreso', daysFromStart: 6 },
  ],
  packingTemplate: 'BEACH',
  checklistDefaults: [
    { text: 'Confirmar reserva del paquete romántico', phase: 'pre-7d' },
    { text: 'Avisar al hotel que es luna de miel (a veces hay upgrade)', phase: 'pre-7d' },
    { text: 'Comprar regalo / detalle sorpresa', phase: 'pre-1d' },
    { text: 'Reservar cena especial para una noche', phase: 'pre-1d' },
    { text: 'Cargar cámara para las fotos', phase: 'pre-1d' },
  ],
};

const ROADTRIP_TPL: TripTemplate = {
  id: 'ROADTRIP',
  label: 'Roadtrip',
  description: 'Ruta, paradas pintorescas y mucho mate.',
  emoji: '🚗',
  suggestedEvents: [
    { type: 'car_rental', title: 'Retiro del auto', daysFromStart: 0 },
    { type: 'fuel', title: 'Carga inicial de nafta', daysFromStart: 0 },
    { type: 'hotel', title: 'Parada noche 1', daysFromStart: 0 },
    { type: 'activity', title: 'Punto panorámico / mirador', daysFromStart: 1 },
    { type: 'restaurant', title: 'Almuerzo en parador típico', daysFromStart: 1 },
    { type: 'hotel', title: 'Parada noche 2', daysFromStart: 1 },
    { type: 'fuel', title: 'Reabastecer combustible', daysFromStart: 2 },
    { type: 'car_rental', title: 'Devolución del auto', daysFromStart: 4 },
  ],
  packingTemplate: 'ROADTRIP',
  checklistDefaults: [
    { text: 'Revisar presión de neumáticos y aceite', phase: 'pre-1d' },
    { text: 'Descargar mapas offline de toda la ruta', phase: 'pre-1d' },
    { text: 'Armar playlist y podcasts para el viaje', phase: 'pre-1d' },
    { text: 'Verificar seguro y asistencia al viajero', phase: 'pre-7d' },
    { text: 'Llevar efectivo para peajes', phase: 'airport' },
  ],
};

const FAMILY: TripTemplate = {
  id: 'FAMILY',
  label: 'Familia con niños',
  description: 'Logística doble, paradas frecuentes y entretenimiento.',
  emoji: '👨‍👩‍👧',
  suggestedEvents: [
    { type: 'flight', title: 'Vuelo familiar de ida', daysFromStart: 0 },
    { type: 'transport', title: 'Traslado al alojamiento', daysFromStart: 0 },
    { type: 'hotel', title: 'Check-in en alojamiento familiar', daysFromStart: 0 },
    { type: 'restaurant', title: 'Cena temprano con los chicos', daysFromStart: 0 },
    { type: 'activity', title: 'Día de parque temático / atracción kids', daysFromStart: 1 },
    { type: 'activity', title: 'Día tranquilo de pileta / playa', daysFromStart: 2 },
    { type: 'restaurant', title: 'Almuerzo familiar', daysFromStart: 3 },
    { type: 'flight', title: 'Vuelo de regreso', daysFromStart: 5 },
  ],
  packingTemplate: 'CITY',
  checklistDefaults: [
    { text: 'Verificar documentación de menores (DNI/pasaporte/permisos)', phase: 'pre-7d' },
    { text: 'Confirmar cuna o cama extra en el hotel', phase: 'pre-7d' },
    { text: 'Armar mochila de mano con snacks y juegos', phase: 'pre-1d' },
    { text: 'Cargar tablets y descargar contenido offline', phase: 'pre-1d' },
    { text: 'Llevar botiquín pediátrico básico', phase: 'pre-1d' },
    { text: 'Reservar sillita de auto si se necesita', phase: 'pre-7d' },
  ],
};

const BUSINESS: TripTemplate = {
  id: 'BUSINESS',
  label: 'Trabajo',
  description: 'Viaje corto y eficiente, todo agendado.',
  emoji: '💼',
  suggestedEvents: [
    { type: 'flight', title: 'Vuelo de ida', daysFromStart: 0 },
    { type: 'transport', title: 'Traslado del aeropuerto al hotel', daysFromStart: 0 },
    { type: 'hotel', title: 'Check-in', daysFromStart: 0 },
    { type: 'activity', title: 'Reunión / kickoff', daysFromStart: 1 },
    { type: 'restaurant', title: 'Almuerzo de trabajo', daysFromStart: 1 },
    { type: 'activity', title: 'Sesión / call del día 2', daysFromStart: 2 },
    { type: 'restaurant', title: 'Cena con cliente', daysFromStart: 2 },
    { type: 'transport', title: 'Traslado al aeropuerto', daysFromStart: 3 },
    { type: 'flight', title: 'Vuelo de regreso', daysFromStart: 3 },
  ],
  packingTemplate: 'CITY',
  checklistDefaults: [
    { text: 'Cargar laptop, mouse y adaptadores', phase: 'pre-1d' },
    { text: 'Confirmar agenda de reuniones', phase: 'pre-1d' },
    { text: 'Imprimir / guardar tarjetas de visita', phase: 'pre-1d' },
    { text: 'Activar roaming corporativo', phase: 'pre-1d' },
    { text: 'Configurar out of office', phase: 'pre-1d' },
    { text: 'Pasar gastos a rendición', phase: 'return' },
  ],
};

const CRUISE: TripTemplate = {
  id: 'CRUISE',
  label: 'Crucero',
  description: 'Embarque, excursiones de puerto y mucho buffet.',
  emoji: '🚢',
  suggestedEvents: [
    { type: 'transport', title: 'Traslado al puerto', daysFromStart: 0 },
    { type: 'cruise', title: 'Embarque y check-in del crucero', daysFromStart: 0 },
    { type: 'restaurant', title: 'Cena de bienvenida a bordo', daysFromStart: 0 },
    { type: 'activity', title: 'Excursión en puerto 1', daysFromStart: 1 },
    { type: 'activity', title: 'Día en el mar (spa / shows)', daysFromStart: 2 },
    { type: 'activity', title: 'Excursión en puerto 2', daysFromStart: 3 },
    { type: 'restaurant', title: 'Cena especial / gala', daysFromStart: 4 },
    { type: 'cruise', title: 'Desembarque', daysFromStart: 6 },
  ],
  packingTemplate: 'BEACH',
  checklistDefaults: [
    { text: 'Imprimir boarding pass del crucero y vouchers de excursiones', phase: 'pre-1d' },
    { text: 'Llevar atuendo formal para la noche de gala', phase: 'pre-1d' },
    { text: 'Confirmar reservas de excursiones por puerto', phase: 'pre-7d' },
    { text: 'Contratar paquete de internet a bordo', phase: 'pre-1d' },
    { text: 'Pastillas para el mareo / muñequeras', phase: 'pre-1d' },
    { text: 'Llevar adaptador de enchufes (varía por naviera)', phase: 'pre-1d' },
  ],
};

export const TRIP_TEMPLATES: Record<TripTemplateId, TripTemplate> = {
  HONEYMOON,
  ROADTRIP: ROADTRIP_TPL,
  FAMILY,
  BUSINESS,
  CRUISE,
};

export const TRIP_TEMPLATE_LIST: TripTemplate[] = [
  HONEYMOON,
  ROADTRIP_TPL,
  FAMILY,
  BUSINESS,
  CRUISE,
];
