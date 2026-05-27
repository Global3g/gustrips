export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

/**
 * Live flight status via AeroDataBox (RapidAPI).
 *
 * Design goal: this endpoint NEVER hard-fails the UI. When the API key is
 * absent, the quota is spent, the network errors, or the flight isn't found,
 * we return `{ available: false, reason }` with HTTP 200 so the client can
 * fall back to the existing "open in Google Flights" link. Live data only
 * lights up when `AERODATABOX_API_KEY` is set in the environment.
 *
 * Free tier is tiny, so we cache aggressively (per flight+date) and cap the
 * monthly call count. The cache/counter live in module scope — best-effort on
 * serverless (per-instance), which is plenty for a personal-volume app.
 */

const API_KEY = process.env.AERODATABOX_API_KEY || '';
const API_HOST = 'aerodatabox.p.rapidapi.com';

const CACHE_TTL_MS = 8 * 60 * 1000; // 8 min — gate/delay don't change faster
const MONTHLY_CAP = 600; // guard against runaway usage on the free tier

interface CacheEntry {
  at: number;
  payload: unknown;
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

/** AeroDataBox flight-status enum → Spanish label + severity for the UI. */
function mapStatus(raw: string | undefined): { label: string; severity: 'ok' | 'warn' | 'bad' | 'info' } {
  switch ((raw || '').toLowerCase()) {
    case 'arrived': return { label: 'Aterrizó', severity: 'ok' };
    case 'enroute':
    case 'approaching': return { label: 'En vuelo', severity: 'info' };
    case 'departed': return { label: 'Despegó', severity: 'info' };
    case 'boarding': return { label: 'Abordando', severity: 'warn' };
    case 'gateclosed': return { label: 'Puerta cerrada', severity: 'warn' };
    case 'checkin': return { label: 'Check-in abierto', severity: 'info' };
    case 'expected':
    case 'scheduled': return { label: 'A tiempo', severity: 'ok' };
    case 'delayed': return { label: 'Demorado', severity: 'bad' };
    case 'canceled':
    case 'canceleduncertain': return { label: 'Cancelado', severity: 'bad' };
    case 'diverted': return { label: 'Desviado', severity: 'bad' };
    default: return { label: 'Estado no disponible', severity: 'info' };
  }
}

type TimeObj = { local?: string; utc?: string } | undefined;
function pickTime(t: TimeObj): string | null {
  return t?.local || t?.utc || null;
}

interface ADBxEndpoint {
  airport?: { iata?: string; name?: string };
  scheduledTime?: TimeObj;
  revisedTime?: TimeObj;
  runwayTime?: TimeObj;
  terminal?: string;
  gate?: string;
  baggageBelt?: string;
}
interface ADBxFlight {
  status?: string;
  departure?: ADBxEndpoint;
  arrival?: ADBxEndpoint;
}

function normalizeEndpoint(e: ADBxEndpoint | undefined) {
  if (!e) return null;
  const scheduled = pickTime(e.scheduledTime);
  const revised = pickTime(e.revisedTime) || pickTime(e.runwayTime);
  return {
    airportIata: e.airport?.iata || null,
    airportName: e.airport?.name || null,
    scheduled,
    revised,
    delayed: !!(scheduled && revised && revised !== scheduled),
    terminal: e.terminal || null,
    gate: e.gate || null,
    baggageBelt: e.baggageBelt || null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Flight number must include the airline code, e.g. "BA242". We strip
  // spaces; users sometimes type "BA 242".
  const flight = (searchParams.get('flight') || '').replace(/\s+/g, '').toUpperCase();
  const date = searchParams.get('date') || ''; // YYYY-MM-DD (optional)

  if (!API_KEY) {
    return NextResponse.json({ available: false, reason: 'no-key' });
  }
  if (!flight || !/[A-Z]/.test(flight) || !/\d/.test(flight)) {
    // Need an alphanumeric flight designator (airline code + number).
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

  const path = date
    ? `https://${API_HOST}/flights/number/${encodeURIComponent(flight)}/${encodeURIComponent(date)}`
    : `https://${API_HOST}/flights/number/${encodeURIComponent(flight)}`;
  const url = `${path}?withAircraftImage=false&withLocation=false&dateLocalRole=Both`;

  try {
    monthCount += 1;
    const res = await fetch(url, {
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST },
      // Don't let a slow upstream hang the airport screen.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ available: false, reason: `http-${res.status}` });
    }

    const data = await res.json();
    // The endpoint may return a bare array of flights, or an object wrapping
    // them. Handle both, defensively.
    const list: ADBxFlight[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.flights)
        ? data.flights
        : [];
    const f = list[0];
    if (!f) {
      return NextResponse.json({ available: false, reason: 'not-found' });
    }

    const status = mapStatus(f.status);
    const payload = {
      available: true,
      flight,
      statusRaw: f.status || null,
      statusLabel: status.label,
      severity: status.severity,
      departure: normalizeEndpoint(f.departure),
      arrival: normalizeEndpoint(f.arrival),
      fetchedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[flight-status] fetch failed:', err);
    return NextResponse.json({ available: false, reason: 'error' });
  }
}
