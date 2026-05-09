/* AI Trip Assistant — tool definitions (Gemini function-calling schema)
   plus a client-side executor that maps tool calls onto the existing
   data hooks (createEvent, addTripExpense, updateTrip, etc.).

   The executor returns a compact, human-readable result string so the
   model can echo confirmation back to the user. */

import type { TripEvent, EventType, Trip, TripExpense, ExpenseCategory } from '@/types';

/* ─── Gemini function declarations ───────────────────── */

export const TOOL_SCHEMAS = [
  {
    name: 'createEvent',
    description:
      'Crea un nuevo evento en el itinerario del viaje actual. Úsalo cuando el usuario pida agregar un evento (cena, vuelo, hotel, actividad, transporte, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Título corto del evento, ej. "Cena en La Docena"' },
        type: {
          type: 'STRING',
          enum: [
            'flight',
            'hotel',
            'car_rental',
            'activity',
            'restaurant',
            'transport',
            'cruise',
            'souvenirs',
            'snacks',
            'clothing',
            'fuel',
            'misc',
          ],
          description: 'Tipo de evento',
        },
        date: { type: 'STRING', description: 'Fecha en formato YYYY-MM-DD' },
        startTime: { type: 'STRING', description: 'Hora de inicio HH:MM (24h), opcional' },
        endTime: { type: 'STRING', description: 'Hora de fin HH:MM (24h), opcional' },
        location: { type: 'STRING', description: 'Ubicación o dirección, opcional' },
        cost: { type: 'NUMBER', description: 'Costo estimado del evento, opcional' },
        currency: { type: 'STRING', description: 'Moneda (MXN, USD, EUR…), opcional' },
        notes: { type: 'STRING', description: 'Notas adicionales, opcional' },
      },
      required: ['title', 'type', 'date'],
    },
  },
  {
    name: 'updateEvent',
    description:
      'Actualiza un evento existente. Solo úsalo cuando el usuario pida cambiar un evento específico que ya existe.',
    parameters: {
      type: 'OBJECT',
      properties: {
        eventId: { type: 'STRING', description: 'ID del evento a actualizar' },
        title: { type: 'STRING' },
        date: { type: 'STRING' },
        startTime: { type: 'STRING' },
        endTime: { type: 'STRING' },
        location: { type: 'STRING' },
        cost: { type: 'NUMBER' },
        currency: { type: 'STRING' },
        notes: { type: 'STRING' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'deleteEvent',
    description: 'Elimina un evento del itinerario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        eventId: { type: 'STRING', description: 'ID del evento a eliminar' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'addExpense',
    description:
      'Registra un gasto del viaje. Úsalo cuando el usuario diga "gasté X en Y" o equivalente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        description: { type: 'STRING', description: 'Descripción corta del gasto' },
        amount: { type: 'NUMBER', description: 'Monto del gasto (puede ser 0 si fue ahorrado)' },
        currency: { type: 'STRING', description: 'Moneda del gasto (MXN, USD, EUR…)' },
        category: {
          type: 'STRING',
          enum: [
            'flight',
            'hotel',
            'car_rental',
            'activity',
            'restaurant',
            'transport',
            'cruise',
            'souvenirs',
            'snacks',
            'clothing',
            'fuel',
            'misc',
          ],
          description: 'Categoría del gasto',
        },
        date: { type: 'STRING', description: 'Fecha en YYYY-MM-DD; si no la dan, usa hoy' },
        eventId: { type: 'STRING', description: 'ID de evento relacionado, opcional' },
        notes: { type: 'STRING', description: 'Notas opcionales' },
      },
      required: ['description', 'amount', 'currency', 'category', 'date'],
    },
  },
  {
    name: 'updateBudget',
    description:
      'Cambia el presupuesto total del viaje y/o la moneda base. Úsalo solo cuando el usuario pida ajustar el presupuesto.',
    parameters: {
      type: 'OBJECT',
      properties: {
        budget: { type: 'NUMBER', description: 'Nuevo presupuesto total' },
        budgetCurrency: { type: 'STRING', description: 'Moneda base del viaje' },
      },
      required: ['budget'],
    },
  },
  {
    name: 'getStats',
    description:
      'Lee estadísticas del viaje (totales gastados, presupuesto, breakdown por categoría, balance) sin modificar nada. Úsalo para responder preguntas tipo "¿cuánto llevo gastado?".',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'searchPlaces',
    description:
      'Busca lugares reales (restaurantes, hoteles, atracciones, etc.) cerca de un destino o coordenadas usando Google Places. Úsalo cuando el usuario pida sugerencias o quiera saber qué hay cerca.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: "Texto de búsqueda, ej. 'restaurantes de mariscos' o 'cafés con wifi'",
        },
        near: {
          type: 'STRING',
          description:
            "Lugar o ciudad de referencia, ej. 'Mazatlán' o 'Hotel Playa'. Si no se da, usa el destino del viaje.",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getPlaceDetails',
    description:
      'Obtiene detalles de un lugar específico devuelto por searchPlaces (horarios, teléfono, reviews, fotos). Usa el placeId que viene en el resultado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        placeId: { type: 'STRING', description: 'ID del lugar devuelto por searchPlaces' },
      },
      required: ['placeId'],
    },
  },
  {
    name: 'addEventFromPlace',
    description:
      "Crea un evento del itinerario usando los datos de un lugar de Google Places. Útil después de searchPlaces — el usuario dice 'agrégalo' y tú llamas a este tool con el placeId, fecha y hora.",
    parameters: {
      type: 'OBJECT',
      properties: {
        placeId: { type: 'STRING', description: 'ID del lugar (de searchPlaces)' },
        date: { type: 'STRING', description: 'Fecha en formato YYYY-MM-DD' },
        startTime: { type: 'STRING', description: 'Hora de inicio HH:MM (24h), opcional' },
        endTime: { type: 'STRING', description: 'Hora de fin HH:MM (24h), opcional' },
        type: {
          type: 'STRING',
          enum: [
            'flight',
            'hotel',
            'car_rental',
            'activity',
            'restaurant',
            'transport',
            'cruise',
            'souvenirs',
            'snacks',
            'clothing',
            'fuel',
            'misc',
          ],
          description: 'Tipo de evento. Si no se da, se infiere de los types del lugar.',
        },
        notes: { type: 'STRING', description: 'Notas adicionales, opcional' },
      },
      required: ['placeId', 'date'],
    },
  },
] as const;

/* ─── Client-side executor ───────────────────────────── */

export interface ToolDeps {
  trip: Trip | null;
  events: TripEvent[];
  expenses: TripExpense[];
  currentUserId: string;
  defaultPaidBy: string;
  defaultSplitBetween: string[];
  todayDate: string;
  /** Live device location, only present when the user has granted geo permission. */
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  createEvent: (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => Promise<string>;
  updateEvent: (id: string, updates: Partial<TripEvent>) => Promise<void>;
  deleteEvent: (
    id: string,
    options?: { onUndo?: () => void; onConfirm?: () => void },
  ) => Promise<{ undo: () => Promise<void> }>;
  addTripExpense: (data: Omit<TripExpense, 'id' | 'createdAt'>) => Promise<void>;
  updateTrip: (data: Partial<Omit<Trip, 'id' | 'createdBy' | 'createdAt'>>) => Promise<void>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function pickEventFields(args: Record<string, any>) {
  const fields: Partial<TripEvent> = {};
  if (args.title !== undefined) fields.title = String(args.title);
  if (args.type !== undefined) fields.type = args.type as EventType;
  if (args.date !== undefined) fields.date = String(args.date);
  if (args.startTime !== undefined) fields.startTime = String(args.startTime);
  if (args.endTime !== undefined) fields.endTime = String(args.endTime);
  if (args.location !== undefined) fields.location = String(args.location);
  if (args.cost !== undefined) fields.cost = Number(args.cost) || 0;
  if (args.currency !== undefined) fields.currency = String(args.currency);
  if (args.notes !== undefined) fields.notes = String(args.notes);
  return fields;
}

function formatCurrencyTuple(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export async function executeToolCall(
  name: string,
  args: Record<string, any>,
  deps: ToolDeps,
): Promise<string> {
  switch (name) {
    case 'createEvent': {
      const data = {
        title: String(args.title || 'Evento'),
        type: (args.type || 'misc') as EventType,
        date: String(args.date || deps.todayDate),
        startTime: args.startTime ? String(args.startTime) : '',
        endTime: args.endTime ? String(args.endTime) : '',
        location: args.location ? String(args.location) : '',
        notes: args.notes ? String(args.notes) : '',
        cost: args.cost ? Number(args.cost) : 0,
        currency: args.currency ? String(args.currency) : (deps.trip?.budgetCurrency || 'MXN'),
        attachments: [] as string[],
      };
      const id = await deps.createEvent(data);
      return JSON.stringify({
        ok: true,
        eventId: id,
        message: `Evento creado: "${data.title}" el ${data.date}${data.startTime ? ' a las ' + data.startTime : ''}.`,
      });
    }

    case 'updateEvent': {
      const eventId = String(args.eventId);
      if (!eventId) return JSON.stringify({ ok: false, error: 'Falta eventId' });
      const updates = pickEventFields(args);
      delete (updates as Record<string, unknown>).eventId;
      await deps.updateEvent(eventId, updates);
      return JSON.stringify({ ok: true, message: 'Evento actualizado.' });
    }

    case 'deleteEvent': {
      const eventId = String(args.eventId);
      if (!eventId) return JSON.stringify({ ok: false, error: 'Falta eventId' });
      await deps.deleteEvent(eventId);
      return JSON.stringify({ ok: true, message: 'Evento eliminado.' });
    }

    case 'addExpense': {
      const amount = Number(args.amount) || 0;
      const currency = String(args.currency || deps.trip?.budgetCurrency || 'MXN');
      const category = (args.category || 'misc') as ExpenseCategory;
      await deps.addTripExpense({
        tripId: deps.trip?.id || '',
        description: String(args.description || 'Gasto'),
        amount,
        currency,
        category,
        paidBy: deps.defaultPaidBy,
        splitBetween: deps.defaultSplitBetween,
        eventId: args.eventId ? String(args.eventId) : undefined,
        date: String(args.date || deps.todayDate),
        notes: args.notes ? String(args.notes) : undefined,
        paymentMethod: 'cash',
        receiptUrl: undefined,
        settled: false,
        createdBy: deps.currentUserId,
      });
      return JSON.stringify({
        ok: true,
        message: `Gasto registrado: ${formatCurrencyTuple(amount, currency)} — ${args.description}.`,
      });
    }

    case 'updateBudget': {
      const updates: Partial<Trip> = {};
      if (args.budget !== undefined) updates.budget = Number(args.budget);
      if (args.budgetCurrency !== undefined) updates.budgetCurrency = String(args.budgetCurrency);
      await deps.updateTrip(updates);
      const cur = updates.budgetCurrency || deps.trip?.budgetCurrency || 'MXN';
      return JSON.stringify({
        ok: true,
        message: `Presupuesto actualizado a ${formatCurrencyTuple(updates.budget ?? deps.trip?.budget ?? 0, cur)}.`,
      });
    }

    case 'getStats': {
      const baseCurrency = deps.trip?.budgetCurrency || 'MXN';
      const totalSpent = deps.expenses
        .filter((e) => e.paymentMethod !== 'points')
        .reduce((sum, e) => sum + (e.currency === baseCurrency ? e.amount : 0), 0);
      const otherCur: Record<string, number> = {};
      for (const e of deps.expenses) {
        if (e.paymentMethod === 'points') continue;
        if (e.currency === baseCurrency) continue;
        otherCur[e.currency] = (otherCur[e.currency] || 0) + e.amount;
      }
      const byCategory: Record<string, number> = {};
      for (const e of deps.expenses) {
        if (e.paymentMethod === 'points') continue;
        if (e.currency !== baseCurrency) continue;
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      }
      return JSON.stringify({
        ok: true,
        budget: deps.trip?.budget ?? 0,
        baseCurrency,
        totalSpent,
        otherCurrencies: otherCur,
        byCategoryBase: byCategory,
        eventsCount: deps.events.length,
        expensesCount: deps.expenses.length,
      });
    }

    case 'searchPlaces': {
      const rawQuery = String(args.query || '').trim();
      if (!rawQuery) {
        return JSON.stringify({ ok: false, error: 'Falta query' });
      }
      // Prefer the user's live device location when available — it makes
      // "qué hay cerca" actually mean "cerca de mí". Fall back to the
      // trip's destination as a textual hint.
      const hasGeo = !!deps.userLocation;
      const near = String(args.near || (hasGeo ? '' : deps.trip?.destination || '')).trim();
      const fullQuery = near ? `${rawQuery} en ${near}` : rawQuery;
      const params = new URLSearchParams({
        action: 'search',
        q: fullQuery,
      });
      if (hasGeo && deps.userLocation) {
        params.set('location', `${deps.userLocation.lat},${deps.userLocation.lng}`);
        params.set('radius', '2500');
      }
      try {
        const res = await fetch(
          `/api/places?${params.toString()}`,
          { signal: AbortSignal.timeout(30_000) },
        );
        const json = await res.json();
        if (!json?.ok) {
          return JSON.stringify({
            ok: false,
            error: json?.error || `Error ${res.status}`,
          });
        }
        const list = Array.isArray(json.data) ? json.data : [];
        const compact = list.slice(0, 5).map((p: any) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          rating: p.rating,
          openNow: p.openNow,
          types: p.types,
        }));
        return JSON.stringify({ ok: true, results: compact });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        return JSON.stringify({ ok: false, error: message });
      }
    }

    case 'getPlaceDetails': {
      const placeId = String(args.placeId || '').trim();
      if (!placeId) return JSON.stringify({ ok: false, error: 'Falta placeId' });
      try {
        const res = await fetch(
          `/api/places?action=details&id=${encodeURIComponent(placeId)}`,
          { signal: AbortSignal.timeout(30_000) },
        );
        const json = await res.json();
        if (!json?.ok) {
          return JSON.stringify({
            ok: false,
            error: json?.error || `Error ${res.status}`,
          });
        }
        return JSON.stringify({ ok: true, data: json.data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        return JSON.stringify({ ok: false, error: message });
      }
    }

    case 'addEventFromPlace': {
      const placeId = String(args.placeId || '').trim();
      const date = String(args.date || '').trim();
      if (!placeId) return JSON.stringify({ ok: false, error: 'Falta placeId' });
      if (!date) return JSON.stringify({ ok: false, error: 'Falta fecha (YYYY-MM-DD)' });

      let place: any;
      try {
        const res = await fetch(
          `/api/places?action=details&id=${encodeURIComponent(placeId)}`,
          { signal: AbortSignal.timeout(30_000) },
        );
        const json = await res.json();
        if (!json?.ok) {
          return JSON.stringify({
            ok: false,
            error: json?.error || `No se pudieron obtener detalles del lugar`,
          });
        }
        place = json.data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        return JSON.stringify({ ok: false, error: message });
      }

      // Infer event type from Google Places types when the caller didn't pick one.
      const placeTypes: string[] = Array.isArray(place?.types) ? place.types : [];
      const inferType = (): EventType => {
        if (placeTypes.some((t) => t === 'restaurant' || t === 'cafe' || t === 'bar' || t === 'food'))
          return 'restaurant';
        if (placeTypes.some((t) => t === 'lodging' || t === 'hotel')) return 'hotel';
        if (
          placeTypes.some(
            (t) =>
              t === 'tourist_attraction' ||
              t === 'museum' ||
              t === 'park' ||
              t === 'amusement_park' ||
              t === 'zoo' ||
              t === 'aquarium',
          )
        )
          return 'activity';
        if (placeTypes.some((t) => t === 'airport')) return 'flight';
        if (placeTypes.some((t) => t === 'car_rental')) return 'car_rental';
        return 'activity';
      };
      const eventType: EventType = (args.type as EventType) || inferType();

      const address: string = String(place?.address || '');
      // Best-effort city: penultimate comma segment.
      let city = '';
      const segments = address
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length >= 2) {
        city = segments[segments.length - 2];
        // Strip leading postal codes / numeric prefixes.
        city = city.replace(/^\d{4,6}\s+/, '').trim();
      } else if (segments.length === 1) {
        city = segments[0];
      }

      const userNotes = args.notes ? String(args.notes).trim() : '';
      const phoneLine = place?.phone ? `Phone: ${place.phone}` : '';
      const notes = [userNotes, phoneLine].filter(Boolean).join('\n');

      const data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'> = {
        title: String(place?.name || 'Lugar'),
        type: eventType,
        date,
        startTime: args.startTime ? String(args.startTime) : '',
        endTime: args.endTime ? String(args.endTime) : '',
        location: address,
        city: city || undefined,
        notes,
        cost: 0,
        currency: deps.trip?.budgetCurrency || 'MXN',
        attachments: [],
        latitude: typeof place?.lat === 'number' ? place.lat : undefined,
        longitude: typeof place?.lng === 'number' ? place.lng : undefined,
      };

      const id = await deps.createEvent(data);
      return JSON.stringify({
        ok: true,
        eventId: id,
        message: `Evento creado: ${data.title} el ${date}`,
      });
    }

    default:
      return JSON.stringify({ ok: false, error: `Herramienta desconocida: ${name}` });
  }
}
