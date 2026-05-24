/**
 * Reservation parser — turns text/url shared into GusTrips (Web Share Target)
 * into a structured reservation we can drop on the itinerary.
 *
 * Two layers:
 *  1. `parseReservationLocal` — fast, offline, regex/heuristic parsers for the
 *     providers that account for most real traffic (OpenTable, Resy, TheFork,
 *     Booking, Airbnb, Hotels.com). Good enough when the user shares the
 *     confirmation text/link directly from those apps.
 *  2. The Gemini fallback lives in `/api/parse-reservation` and is only called
 *     by the UI when the local pass can't fill the key fields (title + date).
 *
 * The UI always shows an editable form, so partial results are fine — the goal
 * is to pre-fill, not to be perfect.
 */

import type { EventType } from '@/types';

export type ReservationProvider =
  | 'opentable'
  | 'resy'
  | 'thefork'
  | 'booking'
  | 'airbnb'
  | 'hotels'
  | 'getyourguide'
  | 'viator'
  | 'unknown';

export interface ParsedReservation {
  /** Mapped to a TripEvent type so it slots straight into the itinerary. */
  type: EventType;
  /** Restaurant / hotel / activity name. */
  title: string;
  /** YYYY-MM-DD if we could resolve it. */
  date?: string;
  /** HH:MM (24h) if present. */
  startTime?: string;
  /** Check-out date for lodging (YYYY-MM-DD). */
  endDate?: string;
  location?: string;
  partySize?: number;
  confirmationCode?: string;
  provider: ReservationProvider;
  /** The original shared payload, kept for the notes field / Gemini fallback. */
  raw: string;
  sourceUrl?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, ene: 1, enero: 1,
  feb: 2, february: 2, febrero: 2,
  mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, june: 6, junio: 6,
  jul: 7, july: 7, julio: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, septiembre: 9,
  oct: 10, october: 10, octubre: 10,
  nov: 11, november: 11, noviembre: 11,
  dec: 12, december: 12, dic: 12, diciembre: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Resolve a year for a parsed month/day: assume the soonest future date. */
function inferYear(month: number, day: number): number {
  const now = new Date();
  const y = now.getFullYear();
  const candidate = new Date(y, month - 1, day);
  // If the date already passed this year by more than a day, roll to next year.
  if (candidate.getTime() < now.getTime() - 24 * 3600 * 1000) return y + 1;
  return y;
}

/**
 * Best-effort date extraction. Returns the first match as YYYY-MM-DD.
 * Handles: ISO (2026-05-24), "May 24, 2026", "24 May 2026", "May 24",
 * "24 de mayo", "05/24/2026", "24/05/2026".
 */
export function extractDate(text: string): string | undefined {
  // ISO first — unambiguous.
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Month name + day (+ optional year), English or Spanish.
  const mName = text.match(
    /\b([A-Za-zÁÉÍÓÚáéíóú]{3,12})\.?\s+(\d{1,2})(?:\s*,?\s*(20\d{2}))?\b/,
  );
  if (mName) {
    const m = MONTHS[mName[1].toLowerCase()];
    if (m) {
      const day = parseInt(mName[2], 10);
      const year = mName[3] ? parseInt(mName[3], 10) : inferYear(m, day);
      if (day >= 1 && day <= 31) return `${year}-${pad2(m)}-${pad2(day)}`;
    }
  }

  // "24 May 2026" / "24 de mayo de 2026"
  const dMonth = text.match(
    /\b(\d{1,2})\s+(?:de\s+)?([A-Za-zÁÉÍÓÚáéíóú]{3,12})\.?(?:\s+(?:de\s+)?(20\d{2}))?\b/,
  );
  if (dMonth) {
    const m = MONTHS[dMonth[2].toLowerCase()];
    if (m) {
      const day = parseInt(dMonth[1], 10);
      const year = dMonth[3] ? parseInt(dMonth[3], 10) : inferYear(m, day);
      if (day >= 1 && day <= 31) return `${year}-${pad2(m)}-${pad2(day)}`;
    }
  }

  // Numeric: prefer DD/MM when day > 12, else assume MM/DD (US, what most
  // confirmation emails use). Best-effort — user can fix in the form.
  const numeric = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2}|\d{2})\b/);
  if (numeric) {
    const a = parseInt(numeric[1], 10);
    const b = parseInt(numeric[2], 10);
    let mo: number, day: number;
    if (a > 12 && b <= 12) {
      day = a;
      mo = b;
    } else {
      mo = a;
      day = b;
    }
    let year = parseInt(numeric[3], 10);
    if (year < 100) year += 2000;
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(mo)}-${pad2(day)}`;
    }
  }

  return undefined;
}

/** Extract a time as HH:MM (24h). Handles "8:00 PM", "8 pm", "20:00". */
export function extractTime(text: string): string | undefined {
  const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const min = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const isPm = ampm[3].toLowerCase() === 'p';
    if (h === 12) h = isPm ? 12 : 0;
    else if (isPm) h += 12;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return `${pad2(h)}:${pad2(min)}`;
  }
  const h24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) return `${pad2(parseInt(h24[1], 10))}:${h24[2]}`;
  return undefined;
}

export function extractPartySize(text: string): number | undefined {
  const m = text.match(
    /\b(?:party of|for|table for|mesa para|para)\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:people|guests|personas|comensales|pax)\b/i,
  );
  if (m) {
    const n = parseInt(m[1] || m[2], 10);
    if (n >= 1 && n <= 50) return n;
  }
  return undefined;
}

export function extractConfirmation(text: string): string | undefined {
  const m = text.match(
    /(?:confirmation|confirmación|reservation|reserva|booking|reference|ref|código|code)\s*(?:number|no\.?|#|:|nº)?\s*[:#]?\s*([A-Z0-9]{4,12})\b/i,
  );
  if (m) return m[1].toUpperCase();
  return undefined;
}

function detectProvider(text: string, url: string): ReservationProvider {
  const hay = `${url}\n${text}`.toLowerCase();
  if (hay.includes('opentable')) return 'opentable';
  if (hay.includes('resy.com') || /\bresy\b/.test(hay)) return 'resy';
  if (hay.includes('thefork') || hay.includes('eltenedor')) return 'thefork';
  if (hay.includes('booking.com')) return 'booking';
  if (hay.includes('airbnb')) return 'airbnb';
  if (hay.includes('hotels.com')) return 'hotels';
  if (hay.includes('getyourguide')) return 'getyourguide';
  if (hay.includes('viator')) return 'viator';
  return 'unknown';
}

const PROVIDER_TYPE: Record<ReservationProvider, EventType> = {
  opentable: 'restaurant',
  resy: 'restaurant',
  thefork: 'restaurant',
  booking: 'hotel',
  airbnb: 'hotel',
  hotels: 'hotel',
  getyourguide: 'activity',
  viator: 'activity',
  unknown: 'misc',
};

const PROVIDER_LABEL: Record<ReservationProvider, string> = {
  opentable: 'OpenTable',
  resy: 'Resy',
  thefork: 'TheFork',
  booking: 'Booking.com',
  airbnb: 'Airbnb',
  hotels: 'Hotels.com',
  getyourguide: 'GetYourGuide',
  viator: 'Viator',
  unknown: '',
};

export function providerLabel(p: ReservationProvider): string {
  return PROVIDER_LABEL[p] || '';
}

/** Turn an OpenTable slug (opentable.com/r/restaurant-name-city) into a name. */
function nameFromUrlSlug(url: string): string | undefined {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/r\/([a-z0-9-]+)/i) || u.pathname.match(/\/venues?\/([a-z0-9-]+)/i);
    if (m) {
      return m[1]
        .split('-')
        .filter((w) => !/^\d+$/.test(w))
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .trim();
    }
  } catch {
    /* not a url */
  }
  return undefined;
}

/** Try to pull a venue name from the text body. */
function extractTitle(text: string, provider: ReservationProvider): string | undefined {
  // "reservation at X" / "booking at X" / "tu reserva en X"
  const at = text.match(
    /(?:reservation|booking|table|reserva|mesa)\s+(?:at|en|para|in)\s+([A-ZÁÉÍÓ][^\n.,!]{2,50})/i,
  );
  if (at) return at[1].trim();
  // "Your reservation is confirmed\nRestaurant Name" — first non-generic line.
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const generic = /(confirm|reservation|booking|reserva|gracias|thank|hello|hola|dear|estimad)/i;
  for (const line of lines) {
    if (!generic.test(line) && line.length >= 3 && line.length <= 60 && /[A-Za-zÁÉÍÓ]/.test(line)) {
      return line;
    }
  }
  void provider;
  return undefined;
}

/**
 * Local-only parse. Returns a ParsedReservation with whatever it could fill;
 * `title` falls back to the provider label so the form is never blank.
 */
export function parseReservationLocal(text: string, url = ''): ParsedReservation {
  const raw = [text, url].filter(Boolean).join('\n').trim();
  const provider = detectProvider(text, url);
  const type = PROVIDER_TYPE[provider];

  const title =
    extractTitle(text, provider) ||
    nameFromUrlSlug(url) ||
    (providerLabel(provider) ? `Reserva — ${providerLabel(provider)}` : 'Reserva');

  return {
    type,
    title,
    date: extractDate(text),
    startTime: extractTime(text),
    partySize: extractPartySize(text),
    confirmationCode: extractConfirmation(text),
    provider,
    location: undefined,
    raw,
    sourceUrl: url || undefined,
  };
}

/** Whether the local parse is confident enough to skip the Gemini fallback. */
export function isParseConfident(r: ParsedReservation): boolean {
  const hasRealTitle = !!r.title && !r.title.startsWith('Reserva');
  return hasRealTitle && !!r.date;
}
