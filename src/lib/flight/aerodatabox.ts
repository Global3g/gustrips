/**
 * Thin AeroDataBox client used by both the live status route and the cron
 * watcher. Always resolves with a `FlightLive` object — never throws — so
 * callers can treat "no key / not found / network error" uniformly.
 *
 * Keep this file CALLER-cacheless: the HTTP route caches per-flight for 8min
 * and the cron decides its own polling cadence. Putting a cache here would
 * just hide their decisions.
 */

const API_HOST = 'aerodatabox.p.rapidapi.com';

export interface FlightEndpointLive {
  airportIata: string | null;
  airportName: string | null;
  scheduled: string | null;
  revised: string | null;
  delayed: boolean;
  terminal: string | null;
  gate: string | null;
  baggageBelt: string | null;
}

export type FlightSeverity = 'ok' | 'warn' | 'bad' | 'info';

export interface FlightLive {
  available: boolean;
  reason?: string;
  flight?: string;
  statusRaw?: string | null;
  statusLabel?: string;
  severity?: FlightSeverity;
  departure?: FlightEndpointLive | null;
  arrival?: FlightEndpointLive | null;
  fetchedAt?: string;
}

/** AeroDataBox flight-status enum → Spanish label + severity for the UI. */
export function mapStatus(raw: string | undefined): { label: string; severity: FlightSeverity } {
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

function normalizeEndpoint(e: ADBxEndpoint | undefined): FlightEndpointLive | null {
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

/** Returns the normalized status for `flight` on `date` (YYYY-MM-DD, optional). */
export async function fetchFlightStatus(flight: string, date?: string): Promise<FlightLive> {
  const apiKey = process.env.AERODATABOX_API_KEY || '';
  if (!apiKey) return { available: false, reason: 'no-key' };

  const clean = flight.replace(/\s+/g, '').toUpperCase();
  if (!clean || !/[A-Z]/.test(clean) || !/\d/.test(clean)) {
    return { available: false, reason: 'bad-flight-number' };
  }

  const path = date
    ? `https://${API_HOST}/flights/number/${encodeURIComponent(clean)}/${encodeURIComponent(date)}`
    : `https://${API_HOST}/flights/number/${encodeURIComponent(clean)}`;
  const url = `${path}?withAircraftImage=false&withLocation=false&dateLocalRole=Both`;

  try {
    const res = await fetch(url, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': API_HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { available: false, reason: `http-${res.status}` };

    const data = await res.json();
    const list: ADBxFlight[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.flights)
        ? data.flights
        : [];
    const f = list[0];
    if (!f) return { available: false, reason: 'not-found' };

    const status = mapStatus(f.status);
    return {
      available: true,
      flight: clean,
      statusRaw: f.status ?? null,
      statusLabel: status.label,
      severity: status.severity,
      departure: normalizeEndpoint(f.departure),
      arrival: normalizeEndpoint(f.arrival),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[aerodatabox] fetch failed:', err);
    return { available: false, reason: 'error' };
  }
}
