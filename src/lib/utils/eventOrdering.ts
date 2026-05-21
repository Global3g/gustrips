/**
 * Order event date-groups for "link to event" pickers so the user
 * — typically using the app DURING a trip — sees today's events first,
 * then the upcoming days, then past days at the bottom (in reverse so the
 * most recent past comes first).
 *
 * Result for a trip running 13–25 May, today = 21 May:
 *   21 (today) → 22 → 23 → 24 → 25 → 20 → 19 → 18 → 17 → 16 → 15 → 14 → 13
 *
 * If today is BEFORE or AFTER the trip, falls back to chronological order
 * (no rearranging when there's no "today" inside the date range).
 */

import { format } from 'date-fns';

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function orderDatesForEventPicker(dates: string[]): string[] {
  const today = todayISO();
  const sorted = [...dates].sort();
  // If today isn't in the trip range, just return chronological.
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (!min || !max || today < min || today > max) return sorted;

  const future: string[] = [];
  const past: string[] = [];
  let todayDate: string | null = null;
  for (const d of sorted) {
    if (d === today) todayDate = d;
    else if (d > today) future.push(d);
    else past.push(d);
  }
  // future already chronological (ascending); past reversed so newest first.
  past.reverse();
  return [...(todayDate ? [todayDate] : []), ...future, ...past];
}

/**
 * Build a `[date, events[]]` entry list grouped by date and ordered with
 * `orderDatesForEventPicker`. Generic so both `TripEvent` and `Trip*` etc
 * work.
 */
export function groupAndOrderEvents<T extends { date: string }>(
  events: T[],
): Array<[string, T[]]> {
  const grouped = new Map<string, T[]>();
  for (const ev of events) {
    const list = grouped.get(ev.date) || [];
    list.push(ev);
    grouped.set(ev.date, list);
  }
  const orderedDates = orderDatesForEventPicker([...grouped.keys()]);
  return orderedDates.map((d) => [d, grouped.get(d) ?? []]);
}
