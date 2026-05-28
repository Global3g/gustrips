export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { fetchFlightStatus, type FlightLive } from '@/lib/flight/aerodatabox';

/**
 * Live flight status — thin HTTP wrapper around the AeroDataBox client in
 * `@/lib/flight/aerodatabox`. The wrapper adds:
 *   - an 8-min in-memory cache per (flight+date)
 *   - a monthly call cap so a misbehaving client can't drain the free tier
 *   - the "no key → graceful fallback" contract: ALWAYS 200 with
 *     `{ available, reason }`, so the UI never hard-fails.
 *
 * The cron watcher in /api/notifications/check uses the same client directly
 * (no cache/cap there — it controls its own polling cadence).
 */

const CACHE_TTL_MS = 8 * 60 * 1000;
const MONTHLY_CAP = 600;

interface CacheEntry {
  at: number;
  payload: FlightLive;
}
const cache = new Map<string, CacheEntry>();

let monthKey = '';
let monthCount = 0;
function withinCap(): boolean {
  const nowMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  if (nowMonth !== monthKey) {
    monthKey = nowMonth;
    monthCount = 0;
  }
  return monthCount < MONTHLY_CAP;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const flight = (searchParams.get('flight') || '').replace(/\s+/g, '').toUpperCase();
  const date = searchParams.get('date') || '';

  if (!flight) {
    return NextResponse.json({ available: false, reason: 'bad-flight-number' });
  }

  const key = `${flight}|${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.payload);
  }
  if (!withinCap()) {
    return NextResponse.json({ available: false, reason: 'cap-reached' });
  }

  monthCount += 1;
  const payload = await fetchFlightStatus(flight, date || undefined);
  if (payload.available) {
    cache.set(key, { at: Date.now(), payload });
  }
  return NextResponse.json(payload);
}
