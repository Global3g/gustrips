'use client';

import { useMemo } from 'react';
import type { Trip } from '@/types';

/**
 * Trip "mode" derived from its start/end dates against today. Drives the
 * three-pillar palette (planning / active / memories) so the same trip
 * card / hero feels different at each lifecycle stage.
 */
export type TripMode = 'planning' | 'active' | 'memories';

export interface TripModeInfo {
  mode: TripMode;
  /** Whole days until the trip starts (>= 0 when in planning). */
  daysUntilStart: number | null;
  /** Whole days into the trip (0 = today is day 1). */
  daysSinceStart: number | null;
  /** Whole days since the trip ended (>= 0 when in memories). */
  daysSinceEnd: number | null;
  /** Trip duration in whole days, inclusive. */
  tripLengthDays: number | null;
  /** Convenience class to drop on a wrapper to load the mode palette. */
  modeClass: 'mode-planning' | 'mode-active' | 'mode-memories';
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

function parseTripDate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  // Trip dates are YYYY-MM-DD strings stored in Firestore. Parse as local
  // date — using `new Date(iso)` would treat them as UTC and shift them a
  // day off in negative-UTC timezones.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function getTripModeInfo(trip: Pick<Trip, 'startDate' | 'endDate'>): TripModeInfo {
  const today = startOfDay(new Date());
  const start = parseTripDate(trip.startDate);
  const end = parseTripDate(trip.endDate);

  // Defensive default when dates are missing or malformed: treat as planning.
  if (!start || !end) {
    return {
      mode: 'planning',
      daysUntilStart: null,
      daysSinceStart: null,
      daysSinceEnd: null,
      tripLengthDays: null,
      modeClass: 'mode-planning',
    };
  }

  const tripLengthDays = daysBetween(start, end) + 1;

  if (today < start) {
    return {
      mode: 'planning',
      daysUntilStart: daysBetween(today, start),
      daysSinceStart: null,
      daysSinceEnd: null,
      tripLengthDays,
      modeClass: 'mode-planning',
    };
  }

  if (today > end) {
    return {
      mode: 'memories',
      daysUntilStart: null,
      daysSinceStart: null,
      daysSinceEnd: daysBetween(end, today),
      tripLengthDays,
      modeClass: 'mode-memories',
    };
  }

  // Today is within the trip dates (inclusive both ends).
  return {
    mode: 'active',
    daysUntilStart: null,
    daysSinceStart: daysBetween(start, today),
    daysSinceEnd: null,
    tripLengthDays,
    modeClass: 'mode-active',
  };
}

export function useTripMode(trip: Pick<Trip, 'startDate' | 'endDate'> | null | undefined): TripModeInfo {
  // Recompute when the dates themselves change. We intentionally don't
  // subscribe to "current time" — recomputing once per render is enough,
  // and the mode crosses date boundaries at midnight which the next render
  // will pick up naturally.
  return useMemo(() => {
    if (!trip) {
      return {
        mode: 'planning',
        daysUntilStart: null,
        daysSinceStart: null,
        daysSinceEnd: null,
        tripLengthDays: null,
        modeClass: 'mode-planning',
      };
    }
    return getTripModeInfo(trip);
  }, [trip?.startDate, trip?.endDate]);
}

/**
 * From a list of trips, pick the one whose mode is most relevant to surface
 * on the dashboard hero card. Priority order:
 *   1. Active trip (in dates today) — always wins
 *   2. Nearest upcoming trip (smallest daysUntilStart)
 *   3. Most recent past trip (smallest daysSinceEnd)
 */
export function pickHeroTrip<T extends Pick<Trip, 'startDate' | 'endDate'>>(
  trips: T[],
): { trip: T; info: TripModeInfo } | null {
  if (trips.length === 0) return null;
  const withInfo = trips.map((trip) => ({ trip, info: getTripModeInfo(trip) }));

  const active = withInfo.find((x) => x.info.mode === 'active');
  if (active) return active;

  const upcoming = withInfo
    .filter((x) => x.info.mode === 'planning' && x.info.daysUntilStart !== null)
    .sort((a, b) => (a.info.daysUntilStart ?? Infinity) - (b.info.daysUntilStart ?? Infinity));
  if (upcoming.length > 0) return upcoming[0];

  const past = withInfo
    .filter((x) => x.info.mode === 'memories' && x.info.daysSinceEnd !== null)
    .sort((a, b) => (a.info.daysSinceEnd ?? Infinity) - (b.info.daysSinceEnd ?? Infinity));
  if (past.length > 0) return past[0];

  return withInfo[0];
}
