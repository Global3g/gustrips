/**
 * Question service — generates and serves the conversational question
 * flow for a Tripstory.
 *
 * - `generateForStory` is idempotent: each question has a deterministic
 *   ID derived from its `{type}-{relatedId}`, so re-running just upserts.
 * - Priorities are integers; getNext sorts by priority desc.
 * - Applying answers patches the related Day/Event/Story doc in place.
 */
import type {
  AnswerQuestionResponse,
  AnswerRequest,
  ApproximateDates,
  Question,
  QuestionListFilter,
  QuestionStatus,
  QuestionType,
  StoryStatus,
} from '../models/types';
import { HttpError } from '../middleware/errors';
import { db, paths, admin } from '../lib/firestore';

// ─────────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────────

const TRANSITION_KM_THRESHOLD = 50;
const EVENT_NAME_PHOTO_THRESHOLD = 15;

// Priority offsets per question type (higher = ask sooner).
const TYPE_BASE_PRIORITY: Record<QuestionType, number> = {
  // critical: shape of the story
  trip_dates: 95,
  trip_title: 92,
  location: 80,
  transition: 70,
  // identity + emotion
  trip_companions: 88,
  trip_purpose: 85,
  trip_highlight: 80,
  event_name: 75,
  // logistics
  trip_transport: 70,
  trip_accommodation: 65,
  // per day
  day_phrase: 60,
  event_companions: 55,
  day_food: 50,
  day_gap: 50,
  event_rating: 45,
  // longer-tail emotional
  trip_anecdote: 40,
  trip_learnings: 35,
  day_weather: 30,
  day_surprise: 30,
  companions: 30,
  // optional / closing
  event_cost_approx: 25,
  trip_budget_approx: 20,
  trip_would_return: 15,
  trip_recommend: 10,
};

// Caps to keep the wizard from feeling like a survey.
const MAX_DAY_LEVEL_QUESTIONS_PER_DAY = 2;
const LONG_TRIP_DAY_THRESHOLD = 7;
const HIGH_PHOTO_DAY_THRESHOLD = 30;
const EVENT_LEVEL_MIN_PHOTOS = 8;

// ─────────────────────────────────────────────────────────────────
// Internal shapes
// ─────────────────────────────────────────────────────────────────

interface StoredQuestion {
  storyId: string;
  type: QuestionType;
  prompt: string;
  context?: Record<string, unknown>;
  suggestedAnswers?: string[];
  priority: number;
  status: QuestionStatus;
  answer?: { value?: string; structuredValue?: Record<string, unknown> } | null;
  createdAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  answeredAt?: admin.firestore.Timestamp | admin.firestore.FieldValue | null;
}

interface StoredStoryFull {
  status?: StoryStatus;
  title?: string;
  pendingQuestionCount?: number;
  approximateDates?: ApproximateDates;
}

interface StoredDay {
  storyId: string;
  date: string;
  title?: string;
  photoCount?: number;
  eventIds?: string[];
}

interface StoredEvent {
  storyId: string;
  dayId: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  coordinates?: { lat?: number; lng?: number };
  photoIds?: string[];
  photoCount?: number;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function tsToIso(
  ts: admin.firestore.Timestamp | admin.firestore.FieldValue | Date | string | undefined | null,
): string | undefined {
  if (!ts) return undefined;
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  return undefined;
}

function serializeQuestion(id: string, data: StoredQuestion): Question {
  const q: Question = {
    id,
    storyId: data.storyId,
    type: data.type,
    prompt: data.prompt,
    status: data.status,
    priority: data.priority,
    answer: data.answer ?? null,
  };
  if (data.context) q.context = data.context as Question['context'];
  if (data.suggestedAnswers) q.suggestedAnswers = data.suggestedAnswers;
  const createdIso = tsToIso(data.createdAt);
  if (createdIso) q.createdAt = createdIso;
  const answeredIso = tsToIso(data.answeredAt);
  q.answeredAt = answeredIso ?? null;
  return q;
}

/** Haversine in km between two lat/lng pairs. */
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (x: number): number => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
  return R * c;
}

function formatTimeHHmm(iso: string | undefined): string {
  if (!iso) return '??:??';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '??:??';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function spanishLongDate(dateStr: string): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d || m < 1 || m > 12) return dateStr;
  return `${d} de ${months[m - 1]} de ${y}`;
}

function daysBetweenInclusive(start: string, end: string): string[] {
  // Both YYYY-MM-DD, inclusive.
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return out;
  for (let t = s.getTime(); t <= e.getTime(); t += 86400000) {
    const d = new Date(t);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function readPendingQuestionCount(
  userId: string,
  storyId: string,
): Promise<number> {
  const snap = await db
    .collection(paths.questionsCollection(userId, storyId))
    .where('status', '==', 'pending')
    .get();
  return snap.size;
}

async function recalcStoryStatus(
  userId: string,
  storyId: string,
): Promise<{ pendingQuestionCount: number; storyDone: boolean }> {
  const pendingQuestionCount = await readPendingQuestionCount(userId, storyId);
  const storyRef = db.doc(paths.story(userId, storyId));
  const update: Record<string, unknown> = {
    pendingQuestionCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  let storyDone = false;
  if (pendingQuestionCount === 0) {
    update.status = 'ready';
    storyDone = true;
  }
  await storyRef.update(update);
  return { pendingQuestionCount, storyDone };
}

// ─────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────

export const questionService = {
  /**
   * Re-derive the question set from current story/day/event state.
   * Deterministic IDs → safe to call repeatedly. Existing answers
   * survive: we only upsert pending questions or skip generating new
   * ones whose ID already maps to an answered/skipped doc.
   */
  async generateForStory(userId: string, storyId: string): Promise<void> {
    const storyRef = db.doc(paths.story(userId, storyId));
    const storySnap = await storyRef.get();
    if (!storySnap.exists) return;
    const story = storySnap.data() as StoredStoryFull;

    const [daysSnap, eventsSnap, existingQuestionsSnap] = await Promise.all([
      db.collection(paths.daysCollection(userId, storyId)).get(),
      db.collection(paths.eventsCollection(userId, storyId)).get(),
      db.collection(paths.questionsCollection(userId, storyId)).get(),
    ]);

    const days: (StoredDay & { id: string })[] = [];
    daysSnap.forEach((doc) => {
      const d = doc.data() as StoredDay;
      days.push({ id: doc.id, ...d });
    });
    days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const events: (StoredEvent & { id: string })[] = [];
    eventsSnap.forEach((doc) => {
      const d = doc.data() as StoredEvent;
      events.push({ id: doc.id, ...d });
    });
    events.sort((a, b) => {
      const ta = a.startTime ?? '';
      const tb = b.startTime ?? '';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

    const existingIds = new Set<string>();
    const existingStatusById = new Map<string, QuestionStatus>();
    existingQuestionsSnap.forEach((doc) => {
      existingIds.add(doc.id);
      const data = doc.data() as StoredQuestion;
      existingStatusById.set(doc.id, data.status);
    });

    const proposed: { id: string; data: StoredQuestion }[] = [];

    // ─── trip_title ────────────────────────────────────────────────
    if (!story.title || story.title.trim() === '' || story.title === 'Untitled story') {
      proposed.push({
        id: 'trip_title-story',
        data: {
          storyId,
          type: 'trip_title',
          prompt: '¿Cómo le llamarías a este viaje?',
          priority: TYPE_BASE_PRIORITY.trip_title,
          status: 'pending',
          answer: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          answeredAt: null,
        },
      });
    }

    // ─── trip_dates ────────────────────────────────────────────────
    // Only if approximateDates exists AND disagrees with detected range by >1 day on either end.
    if (story.approximateDates && days.length > 0) {
      const detectedStart = days[0].date;
      const detectedEnd = days[days.length - 1].date;
      const aprStart = story.approximateDates.start;
      const aprEnd = story.approximateDates.end;
      let mismatch = false;
      if (aprStart) {
        const diff = Math.abs(
          (new Date(`${aprStart}T00:00:00Z`).getTime() -
            new Date(`${detectedStart}T00:00:00Z`).getTime()) /
            86400000,
        );
        if (diff > 1) mismatch = true;
      }
      if (aprEnd) {
        const diff = Math.abs(
          (new Date(`${aprEnd}T00:00:00Z`).getTime() -
            new Date(`${detectedEnd}T00:00:00Z`).getTime()) /
            86400000,
        );
        if (diff > 1) mismatch = true;
      }
      if (mismatch) {
        proposed.push({
          id: 'trip_dates-story',
          data: {
            storyId,
            type: 'trip_dates',
            prompt: `Mis fotos cubren del ${spanishLongDate(detectedStart)} al ${spanishLongDate(
              detectedEnd,
            )}. ¿Son esas las fechas correctas?`,
            context: {
              dateRange: {
                start: `${detectedStart}T00:00:00Z`,
                end: `${detectedEnd}T23:59:59Z`,
              },
            },
            priority: TYPE_BASE_PRIORITY.trip_dates,
            status: 'pending',
            answer: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            answeredAt: null,
          },
        });
      }
    }

    // ─── location & event_name (per event) ──────────────────────────
    for (const ev of events) {
      const photoCount = ev.photoCount ?? ev.photoIds?.length ?? 0;
      if (!ev.location) {
        const startHm = formatTimeHHmm(ev.startTime);
        const endHm = formatTimeHHmm(ev.endTime);
        // Higher photoCount → higher priority bump (cap at +15).
        const bump = Math.min(15, Math.floor(photoCount / 2));
        proposed.push({
          id: `location-${ev.id}`,
          data: {
            storyId,
            type: 'location',
            prompt: `¿Dónde estaban entre ${startHm} y ${endHm}?`,
            context: {
              relatedEventId: ev.id,
              relatedDayId: ev.dayId,
              photoCount,
              dateRange: { start: ev.startTime, end: ev.endTime },
            },
            priority: TYPE_BASE_PRIORITY.location + bump,
            status: 'pending',
            answer: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            answeredAt: null,
          },
        });
      }

      if (photoCount > EVENT_NAME_PHOTO_THRESHOLD && !ev.title) {
        proposed.push({
          id: `event_name-${ev.id}`,
          data: {
            storyId,
            type: 'event_name',
            prompt: `¿Qué fue este momento con ${photoCount} fotos?`,
            context: {
              relatedEventId: ev.id,
              relatedDayId: ev.dayId,
              photoCount,
              dateRange: { start: ev.startTime, end: ev.endTime },
            },
            priority: TYPE_BASE_PRIORITY.event_name,
            status: 'pending',
            answer: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            answeredAt: null,
          },
        });
      }
    }

    // ─── day_gap ───────────────────────────────────────────────────
    // Look at days with photos, and the calendar between them; flag missing dates.
    if (days.length >= 2) {
      const haveDates = new Set(days.map((d) => d.date));
      const allCalendarDays = daysBetweenInclusive(
        days[0].date,
        days[days.length - 1].date,
      );
      for (const cal of allCalendarDays) {
        if (!haveDates.has(cal)) {
          proposed.push({
            id: `day_gap-${cal}`,
            data: {
              storyId,
              type: 'day_gap',
              prompt: `No tengo fotos del ${spanishLongDate(
                cal,
              )}, ¿hicieron algo o fue día de descanso?`,
              context: { dateRange: { start: `${cal}T00:00:00Z`, end: `${cal}T23:59:59Z` } },
              priority: TYPE_BASE_PRIORITY.day_gap,
              status: 'pending',
              answer: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              answeredAt: null,
            },
          });
        }
      }
    }

    // ─── transition ────────────────────────────────────────────────
    // Two consecutive events with GPS coordinates > 50km apart.
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];
      if (
        prev.coordinates &&
        curr.coordinates &&
        typeof prev.coordinates.lat === 'number' &&
        typeof prev.coordinates.lng === 'number' &&
        typeof curr.coordinates.lat === 'number' &&
        typeof curr.coordinates.lng === 'number'
      ) {
        const km = haversineKm(
          { lat: prev.coordinates.lat, lng: prev.coordinates.lng },
          { lat: curr.coordinates.lat, lng: curr.coordinates.lng },
        );
        if (km > TRANSITION_KM_THRESHOLD) {
          const labelA = prev.location ?? `zona ${i}`;
          const labelB = curr.location ?? `zona ${i + 1}`;
          proposed.push({
            id: `transition-${prev.id}-${curr.id}`,
            data: {
              storyId,
              type: 'transition',
              prompt: `Cambio de zona detectado, ¿cómo se movieron de ${labelA} a ${labelB}?`,
              context: { relatedEventId: curr.id, relatedDayId: curr.dayId },
              priority: TYPE_BASE_PRIORITY.transition,
              status: 'pending',
              answer: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              answeredAt: null,
            },
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Trip-level expansion
    // ═══════════════════════════════════════════════════════════════

    const pushTripQ = (
      id: string,
      type: QuestionType,
      prompt: string,
      opts: {
        suggested?: string[];
        skippable?: boolean;
        multiline?: boolean;
        placeholder?: string;
        helperText?: string;
        priorityOverride?: number;
      } = {},
    ): void => {
      const ctx: Record<string, unknown> = {};
      if (opts.skippable) ctx.skippable = true;
      if (opts.multiline) ctx.multiline = true;
      if (opts.placeholder) ctx.placeholder = opts.placeholder;
      if (opts.helperText) ctx.helperText = opts.helperText;
      proposed.push({
        id,
        data: {
          storyId,
          type,
          prompt,
          context: Object.keys(ctx).length > 0 ? ctx : undefined,
          suggestedAnswers: opts.suggested,
          priority: opts.priorityOverride ?? TYPE_BASE_PRIORITY[type],
          status: 'pending',
          answer: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          answeredAt: null,
        },
      });
    };

    // Compañeros — clave para casi todo viaje.
    pushTripQ(
      'trip_companions-story',
      'trip_companions',
      '¿Con quién viajaron?',
      {
        suggested: ['Solo', 'En pareja', 'Familia', 'Con amigos', 'Grupo grande'],
        placeholder: 'Ej: Con María y los niños',
      },
    );

    // Propósito / motivo del viaje.
    pushTripQ(
      'trip_purpose-story',
      'trip_purpose',
      '¿Cuál fue la razón del viaje?',
      {
        suggested: [
          'Vacaciones',
          'Aniversario',
          'Luna de miel',
          'Cumpleaños',
          'Escape de fin de semana',
          'Trabajo',
          'Evento familiar',
        ],
        placeholder: 'Una razón simple alcanza',
      },
    );

    // Mejor momento de todo el viaje.
    pushTripQ(
      'trip_highlight-story',
      'trip_highlight',
      '¿Cuál fue el mejor momento de todo el viaje?',
      {
        multiline: true,
        placeholder: 'Cuéntame ese momento que se te quedó grabado',
      },
    );

    // Anécdota — algo gracioso/raro/que salió mal.
    pushTripQ(
      'trip_anecdote-story',
      'trip_anecdote',
      '¿Algo gracioso, raro o que salió mal y se acuerdan siempre?',
      {
        skippable: true,
        multiline: true,
        placeholder: 'Esa historia que siempre cuentan...',
        helperText: 'Opcional — si no se te ocurre, saltala',
      },
    );

    // Transporte para llegar.
    pushTripQ(
      'trip_transport-story',
      'trip_transport',
      '¿Cómo llegaron al destino?',
      {
        suggested: ['Avión', 'Auto', 'Tren', 'Bus', 'Ferry', 'Mix de varios'],
      },
    );

    // Hospedaje.
    pushTripQ(
      'trip_accommodation-story',
      'trip_accommodation',
      '¿Dónde se hospedaron?',
      {
        suggested: [
          'Hotel',
          'Airbnb',
          'Hostel',
          'Casa de familia',
          'Camping',
          'Cambiamos varias veces',
        ],
        placeholder: 'Nombre del hotel/zona si lo recuerdan',
      },
    );

    // Presupuesto aproximado (opcional).
    pushTripQ(
      'trip_budget_approx-story',
      'trip_budget_approx',
      'Más o menos, ¿cuánto gastaron en total?',
      {
        skippable: true,
        placeholder: 'Ej: $50.000 MXN — opcional',
        helperText: 'Ayuda a estimar viajes parecidos a futuro',
      },
    );

    // Aprendizajes.
    pushTripQ(
      'trip_learnings-story',
      'trip_learnings',
      '¿Aprendieron algo en este viaje? Una palabra, una comida nueva, una costumbre.',
      {
        skippable: true,
        multiline: true,
        placeholder: 'Lo primero que se te venga',
      },
    );

    // Recomendación.
    pushTripQ(
      'trip_recommend-story',
      'trip_recommend',
      '¿Le recomendarías este viaje a alguien?',
      {
        suggested: [
          'Sí, mil veces',
          'Sí',
          'Depende a quién',
          'No mucho',
          'No',
        ],
      },
    );

    // Volverían.
    pushTripQ(
      'trip_would_return-story',
      'trip_would_return',
      '¿Volverías a este destino?',
      {
        suggested: ['Mañana mismo', 'Sí', 'Tal vez', 'No creo'],
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // Day-level expansion (cap 2 per day)
    // ═══════════════════════════════════════════════════════════════

    const longTrip = days.length > LONG_TRIP_DAY_THRESHOLD;
    type DayProposal = {
      id: string;
      type: QuestionType;
      prompt: string;
      ctx: Record<string, unknown>;
      suggested?: string[];
      priority: number;
    };

    for (const day of days) {
      const dayProposals: DayProposal[] = [];
      const friendly = spanishLongDate(day.date);
      const photoCount = day.photoCount ?? 0;

      // day_phrase — only for high-photo days when the trip is long.
      if (!longTrip || photoCount >= HIGH_PHOTO_DAY_THRESHOLD) {
        dayProposals.push({
          id: `day_phrase-${day.date}`,
          type: 'day_phrase',
          prompt: `Si tuvieras que resumir el ${friendly} en una frase, ¿cuál sería?`,
          ctx: {
            relatedDayId: day.id,
            skippable: true,
            multiline: true,
            placeholder: 'Una frase corta basta',
          },
          priority: TYPE_BASE_PRIORITY.day_phrase,
        });
      }

      // day_weather — siempre, conversacional.
      dayProposals.push({
        id: `day_weather-${day.date}`,
        type: 'day_weather',
        prompt: `¿Cómo estuvo el clima el ${friendly}?`,
        ctx: { relatedDayId: day.id, skippable: true },
        suggested: ['Soleado', 'Nublado', 'Lluvioso', 'Frío', 'Caluroso', 'Mezcla'],
        priority: TYPE_BASE_PRIORITY.day_weather,
      });

      // day_food — solo si hay buen rastro de comida (cluster en horario o muchas fotos).
      const dayEvents = events.filter((e) => e.dayId === day.id);
      const mealHinted = dayEvents.some((e) => {
        const startIso = e.startTime;
        if (!startIso) return false;
        const h = new Date(startIso).getUTCHours();
        const c = e.photoCount ?? e.photoIds?.length ?? 0;
        const isLunch = h >= 12 && h <= 15;
        const isDinner = h >= 19 && h <= 22;
        return c >= 8 && (isLunch || isDinner);
      });
      if (mealHinted || photoCount > 20) {
        dayProposals.push({
          id: `day_food-${day.date}`,
          type: 'day_food',
          prompt: `¿Comieron algo memorable el ${friendly}?`,
          ctx: {
            relatedDayId: day.id,
            skippable: true,
            multiline: true,
            placeholder: 'El plato o el lugar que más se acuerdan',
          },
          priority: TYPE_BASE_PRIORITY.day_food,
        });
      }

      // day_surprise — heurística simple: si el día tiene >=15 fotos.
      if (photoCount >= 15) {
        dayProposals.push({
          id: `day_surprise-${day.date}`,
          type: 'day_surprise',
          prompt: `¿Algo de ese día les sorprendió?`,
          ctx: {
            relatedDayId: day.id,
            skippable: true,
            multiline: true,
            placeholder: 'Algo inesperado, bueno o malo',
          },
          priority: TYPE_BASE_PRIORITY.day_surprise,
        });
      }

      // Cap a top-N por prioridad para no inundar.
      dayProposals
        .sort((a, b) => b.priority - a.priority)
        .slice(0, MAX_DAY_LEVEL_QUESTIONS_PER_DAY)
        .forEach((p) => {
          proposed.push({
            id: p.id,
            data: {
              storyId,
              type: p.type,
              prompt: p.prompt,
              context: p.ctx,
              suggestedAnswers: p.suggested,
              priority: p.priority,
              status: 'pending',
              answer: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              answeredAt: null,
            },
          });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // Event-level expansion (only events with >=8 photos)
    // ═══════════════════════════════════════════════════════════════

    for (const ev of events) {
      const photoCount = ev.photoCount ?? ev.photoIds?.length ?? 0;
      if (photoCount < EVENT_LEVEL_MIN_PHOTOS) continue;

      const evLabel = ev.title ?? 'ese momento';

      // event_companions
      proposed.push({
        id: `event_companions-${ev.id}`,
        data: {
          storyId,
          type: 'event_companions',
          prompt: `¿Quiénes estaban en ${evLabel}? ¿Todo el grupo o solo algunos?`,
          context: {
            relatedEventId: ev.id,
            relatedDayId: ev.dayId,
            photoCount,
            skippable: true,
          },
          suggestedAnswers: ['Todo el grupo', 'Solo yo', 'En pareja', 'Subgrupo'],
          priority: TYPE_BASE_PRIORITY.event_companions,
          status: 'pending',
          answer: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          answeredAt: null,
        },
      });

      // event_rating
      proposed.push({
        id: `event_rating-${ev.id}`,
        data: {
          storyId,
          type: 'event_rating',
          prompt: `¿Cómo describirías ${evLabel} como experiencia?`,
          context: {
            relatedEventId: ev.id,
            relatedDayId: ev.dayId,
            skippable: true,
          },
          suggestedAnswers: [
            'Imperdible',
            'Está muy bueno',
            'Bien',
            'Nada del otro mundo',
            'Salteable',
          ],
          priority: TYPE_BASE_PRIORITY.event_rating,
          status: 'pending',
          answer: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          answeredAt: null,
        },
      });

      // event_cost_approx — solo si tiene location y el día tiene varios eventos
      const sameDayEvents = events.filter((e) => e.dayId === ev.dayId).length;
      if (ev.location && sameDayEvents > 1) {
        proposed.push({
          id: `event_cost_approx-${ev.id}`,
          data: {
            storyId,
            type: 'event_cost_approx',
            prompt: `¿Cuánto les costó ${evLabel}?`,
            context: {
              relatedEventId: ev.id,
              relatedDayId: ev.dayId,
              skippable: true,
              placeholder: 'Aprox, opcional',
              helperText: 'Suma al presupuesto del viaje',
            },
            priority: TYPE_BASE_PRIORITY.event_cost_approx,
            status: 'pending',
            answer: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            answeredAt: null,
          },
        });
      }
    }

    // ─── Persist: upsert each proposed question. Skip if existing doc
    //     is already answered/skipped (don't re-pend it).
    const qCol = db.collection(paths.questionsCollection(userId, storyId));
    let batch = db.batch();
    let opCount = 0;
    const commitIfFull = async (): Promise<void> => {
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    for (const q of proposed) {
      const existingStatus = existingStatusById.get(q.id);
      if (existingStatus === 'answered' || existingStatus === 'skipped') {
        continue;
      }
      if (existingIds.has(q.id)) {
        // Update prompt/priority/context but preserve createdAt by using merge.
        const merged: Record<string, unknown> = {
          storyId: q.data.storyId,
          type: q.data.type,
          prompt: q.data.prompt,
          priority: q.data.priority,
          status: 'pending',
        };
        if (q.data.context) merged.context = q.data.context;
        if (q.data.suggestedAnswers) merged.suggestedAnswers = q.data.suggestedAnswers;
        batch.set(qCol.doc(q.id), merged, { merge: true });
      } else {
        batch.set(qCol.doc(q.id), q.data);
      }
      opCount++;
      await commitIfFull();
    }

    if (opCount > 0) {
      await batch.commit();
    }

    // Update pendingQuestionCount on the Story (without status change here).
    const pendingQuestionCount = await readPendingQuestionCount(userId, storyId);
    await storyRef.update({
      pendingQuestionCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  async getNext(userId: string, storyId: string): Promise<Question | null> {
    const snap = await db
      .collection(paths.questionsCollection(userId, storyId))
      .where('status', '==', 'pending')
      .orderBy('priority', 'desc')
      .limit(1)
      .get();
    if (snap.empty) {
      // Self-heal: ensure the story status reflects "no pending questions".
      // This covers cases where pendingQuestionCount drifted (e.g. status was
      // still 'questioning' even though every question was answered/skipped).
      try {
        const storyRef = db.doc(paths.story(userId, storyId));
        const storySnap = await storyRef.get();
        if (storySnap.exists) {
          const data = storySnap.data() as StoredStoryFull;
          if (data.status === 'questioning' || data.status === 'analyzing') {
            await storyRef.update({
              status: 'ready',
              pendingQuestionCount: 0,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } else if (
            data.pendingQuestionCount !== undefined &&
            data.pendingQuestionCount !== 0
          ) {
            await storyRef.update({
              pendingQuestionCount: 0,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      } catch (err) {
        // Self-heal is best-effort; never break the read path.
        console.error('[getNext] self-heal failed', err);
      }
      return null;
    }
    const doc = snap.docs[0];
    return serializeQuestion(doc.id, doc.data() as StoredQuestion);
  },

  async list(
    userId: string,
    storyId: string,
    filter: QuestionListFilter,
  ): Promise<Question[]> {
    const col = db.collection(paths.questionsCollection(userId, storyId));
    const snap =
      filter === 'all'
        ? await col.orderBy('priority', 'desc').get()
        : await col.where('status', '==', filter).orderBy('priority', 'desc').get();
    const out: Question[] = [];
    snap.forEach((doc) => out.push(serializeQuestion(doc.id, doc.data() as StoredQuestion)));
    return out;
  },

  async answer(
    userId: string,
    storyId: string,
    questionId: string,
    body: AnswerRequest,
  ): Promise<AnswerQuestionResponse> {
    if (!body || typeof body.value !== 'string' || body.value.length === 0) {
      throw HttpError.badRequest('AnswerRequest.value is required and must be a non-empty string');
    }

    const qRef = db.doc(paths.question(userId, storyId, questionId));
    const qSnap = await qRef.get();
    if (!qSnap.exists) {
      throw HttpError.notFound('Question not found');
    }
    const stored = qSnap.data() as StoredQuestion;
    if (stored.status === 'answered') {
      throw HttpError.badRequest('Question already answered');
    }

    const answer: { value: string; structuredValue?: Record<string, unknown> } = {
      value: body.value,
    };
    if (body.structuredValue) answer.structuredValue = body.structuredValue;

    const now = admin.firestore.FieldValue.serverTimestamp();
    await qRef.update({
      status: 'answered',
      answer,
      answeredAt: now,
    });

    // Apply side effects per question type.
    const ctx = stored.context as
      | { relatedEventId?: string; relatedDayId?: string }
      | undefined;

    // For trip_*, day_*, event_* metadata questions, the metadata key is
    // derived from the type (e.g. trip_companions → companions).
    const stripPrefix = (t: string): string =>
      t.replace(/^(trip|day|event)_/, '');
    const structured =
      body.structuredValue && Object.keys(body.structuredValue).length > 0
        ? body.structuredValue
        : null;
    const valueForMetadata: unknown = structured ?? body.value;

    switch (stored.type) {
      // ─── Direct field writes (existing) ───────────────────────────
      case 'location':
        if (ctx?.relatedEventId) {
          await db
            .doc(paths.event(userId, storyId, ctx.relatedEventId))
            .update({ location: body.value, updatedAt: now });
        }
        break;
      case 'event_name':
        if (ctx?.relatedEventId) {
          await db
            .doc(paths.event(userId, storyId, ctx.relatedEventId))
            .update({ title: body.value, updatedAt: now });
        }
        break;
      case 'trip_title':
        await db.doc(paths.story(userId, storyId)).update({
          title: body.value,
          updatedAt: now,
        });
        break;
      case 'day_gap':
        if (ctx?.relatedDayId) {
          await db
            .doc(paths.day(userId, storyId, ctx.relatedDayId))
            .set(
              { metadata: { dayGapAnswer: body.value }, updatedAt: now },
              { merge: true },
            );
        }
        break;
      case 'transition':
        if (ctx?.relatedEventId) {
          await db
            .doc(paths.event(userId, storyId, ctx.relatedEventId))
            .set(
              { metadata: { transitionAnswer: body.value }, updatedAt: now },
              { merge: true },
            );
        }
        break;

      // ─── Trip-level metadata ──────────────────────────────────────
      case 'trip_companions':
      case 'trip_purpose':
      case 'trip_highlight':
      case 'trip_anecdote':
      case 'trip_transport':
      case 'trip_accommodation':
      case 'trip_budget_approx':
      case 'trip_learnings':
      case 'trip_recommend':
      case 'trip_would_return':
      case 'trip_dates':
      case 'companions': {
        const key = stripPrefix(stored.type);
        await db.doc(paths.story(userId, storyId)).set(
          {
            metadata: { [key]: valueForMetadata },
            updatedAt: now,
          },
          { merge: true },
        );
        break;
      }

      // ─── Day-level metadata ───────────────────────────────────────
      case 'day_phrase':
      case 'day_weather':
      case 'day_food':
      case 'day_surprise': {
        if (ctx?.relatedDayId) {
          const key = stripPrefix(stored.type);
          await db.doc(paths.day(userId, storyId, ctx.relatedDayId)).set(
            {
              metadata: { [key]: valueForMetadata },
              updatedAt: now,
            },
            { merge: true },
          );
        }
        break;
      }

      // ─── Event-level metadata ─────────────────────────────────────
      case 'event_companions':
      case 'event_rating':
      case 'event_cost_approx': {
        if (ctx?.relatedEventId) {
          const key = stripPrefix(stored.type);
          await db.doc(paths.event(userId, storyId, ctx.relatedEventId)).set(
            {
              metadata: { [key]: valueForMetadata },
              updatedAt: now,
            },
            { merge: true },
          );
        }
        break;
      }

      default:
        break;
    }

    await recalcStoryStatus(userId, storyId);

    // Reload the question to get serverTimestamp materialized.
    const updatedSnap = await qRef.get();
    const updated = serializeQuestion(
      updatedSnap.id,
      updatedSnap.data() as StoredQuestion,
    );

    const nextQuestion = await this.getNext(userId, storyId);
    return { question: updated, nextQuestion };
  },

  async skip(userId: string, storyId: string, questionId: string): Promise<void> {
    const qRef = db.doc(paths.question(userId, storyId, questionId));
    const qSnap = await qRef.get();
    if (!qSnap.exists) {
      throw HttpError.notFound('Question not found');
    }
    await qRef.update({
      status: 'skipped',
      answeredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await recalcStoryStatus(userId, storyId);
  },
};
