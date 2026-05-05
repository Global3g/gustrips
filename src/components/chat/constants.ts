import type { QuickAction } from './types';

export const GREETING = 'Hola! Soy tu asistente de viajes en GusTrips. Puedo ayudarte a:\n\n- **Planificar** tu proximo viaje\n- Recomendar **destinos, restaurantes y actividades**\n- Dar consejos sobre **que empacar**\n- Tips de **seguridad** y logistica\n\nEn que puedo ayudarte?';

export const QUICK_ACTIONS: ReadonlyArray<QuickAction> = [
  { label: 'Analiza mi viaje', prompt: 'Analiza mi viaje actual y dime si me falta algo por planificar. Revisa vuelos, hoteles, comidas, traslados y documentos.' },
  { label: 'Tips para mi viaje', prompt: 'Dame tips generales para planificar un viaje: que considerar, como ahorrar, y errores comunes a evitar.' },
  { label: 'Que empacar', prompt: 'Que deberia empacar para un viaje? Dame una lista organizada por categoria.' },
  { label: 'Restaurantes', prompt: 'Como encuentro los mejores restaurantes locales cuando viajo? Dame estrategias y apps utiles.' },
  { label: 'Consejos de seguridad', prompt: 'Cuales son los mejores consejos de seguridad para viajeros? Cuidados con dinero, documentos y pertenencias.' },
];
