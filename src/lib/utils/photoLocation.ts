/**
 * Infer the likely city/country for a given trip date from data the user
 * already entered in the itinerary — so uploading photos (or creating an
 * event) on a date can pre-fill the location instead of asking the user to
 * retype what the app already knows. Always editable by the caller.
 *
 * Priority:
 *   1. An event on that exact date that has an explicit city.
 *   2. The trip's manual per-day location (`dayLocations["YYYY-MM-DD"]`,
 *      stored as "City, Country").
 *   3. The nearest dated event (± a few days) that has a city — for cruises
 *      where each date is a different port and a day might lack its own event.
 */

interface EventLite {
  date: string;
  city?: string;
  country?: string;
}

interface TripLite {
  dayLocations?: Record<string, string>;
}

export interface InferredLocation {
  city: string;
  country: string;
}

function daysApart(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(da - db) / 86_400_000;
}

export function inferDateLocation(
  date: string,
  events: EventLite[] = [],
  trip?: TripLite | null,
): InferredLocation {
  if (!date) return { city: '', country: '' };

  // 1. Exact-date event with a city.
  const exact = events.find((e) => e.date === date && (e.city || '').trim());
  if (exact) {
    return { city: (exact.city || '').trim(), country: (exact.country || '').trim() };
  }

  // 2. Manual per-day location "City, Country".
  const manual = trip?.dayLocations?.[date];
  if (manual && manual.trim()) {
    const parts = manual.split(',').map((s) => s.trim()).filter(Boolean);
    return { city: parts[0] || '', country: parts[1] || '' };
  }

  // 3. Nearest dated event with a city, within a week.
  let best: { city: string; country: string; dist: number } | null = null;
  for (const e of events) {
    if (!(e.city || '').trim()) continue;
    const dist = daysApart(date, e.date);
    if (dist <= 7 && (!best || dist < best.dist)) {
      best = { city: (e.city || '').trim(), country: (e.country || '').trim(), dist };
    }
  }
  if (best) return { city: best.city, country: best.country };

  return { city: '', country: '' };
}
