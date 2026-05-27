'use client';

/**
 * Airport mode — command center for the next flight on this trip. Surfaces
 * the countdown, gate/terminal, attached boarding pass and a short security
 * checklist so the user lands on a focused screen instead of scrolling
 * the itinerary while running through TSA.
 *
 * The page is intentionally self-contained: no new Firestore subscriptions,
 * just `useEventsFromContext()` from the layout-level TripDataProvider.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plane,
  ArrowLeft,
  Clock,
  Ticket,
  Globe,
  FileText,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import type { TripEvent } from '@/types';

/* ─── Helpers ───────────────────────────────────────── */

/**
 * Build a Date from an event's `date` (YYYY-MM-DD) + optional `startTime`
 * (HH:mm). Parses as LOCAL time on purpose — trip dates aren't UTC. Returns
 * `null` when the inputs are missing or malformed so callers can fall back
 * gracefully.
 */
function eventDateTime(event: Pick<TripEvent, 'date' | 'startTime'>): Date | null {
  if (!event.date) return null;
  const [y, m, d] = event.date.split('-').map(Number);
  if (!y || !m || !d) return null;
  let h = 0;
  let min = 0;
  if (event.startTime) {
    const parts = event.startTime.split(':').map(Number);
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      h = parts[0];
      min = parts[1];
    }
  }
  return new Date(y, m - 1, d, h, min);
}

/**
 * Pick the most relevant flight: the next upcoming one. Falls back to the
 * most recent past flight (so a user landing 10 minutes after takeoff still
 * sees the right context).
 */
function pickRelevantFlight(events: TripEvent[]): TripEvent | null {
  const flights = events.filter((e) => e.type === 'flight');
  if (flights.length === 0) return null;
  const now = Date.now();
  const upcoming = flights
    .map((e) => ({ event: e, ts: eventDateTime(e)?.getTime() ?? null }))
    .filter((x): x is { event: TripEvent; ts: number } => x.ts !== null && x.ts >= now)
    .sort((a, b) => a.ts - b.ts);
  if (upcoming.length > 0) return upcoming[0].event;
  const past = flights
    .map((e) => ({ event: e, ts: eventDateTime(e)?.getTime() ?? null }))
    .filter((x): x is { event: TripEvent; ts: number } => x.ts !== null)
    .sort((a, b) => b.ts - a.ts);
  return past[0]?.event ?? null;
}

/** Format a millisecond delta as a human countdown. */
function formatCountdown(deltaMs: number): { primary: string; secondary: string } {
  if (deltaMs <= 0) {
    return { primary: 'Despegando', secondary: 'o ya en el aire' };
  }
  const totalMinutes = Math.floor(deltaMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) {
    return {
      primary: `${days}d ${hours}h`,
      secondary: 'hasta el despegue',
    };
  }
  if (hours >= 1) {
    return {
      primary: `${hours}h ${minutes}m`,
      secondary: 'hasta el despegue',
    };
  }
  return {
    primary: `${minutes}m`,
    secondary: 'hasta el despegue',
  };
}

/* ─── Live flight status (from /api/flight-status) ──── */

interface FlightEndpointLive {
  airportIata: string | null;
  airportName: string | null;
  scheduled: string | null;
  revised: string | null;
  delayed: boolean;
  terminal: string | null;
  gate: string | null;
  baggageBelt: string | null;
}
interface FlightLive {
  available: boolean;
  reason?: string;
  statusLabel?: string;
  severity?: 'ok' | 'warn' | 'bad' | 'info';
  departure?: FlightEndpointLive | null;
  arrival?: FlightEndpointLive | null;
}

const SEV_BG: Record<string, string> = {
  ok: 'bg-emerald-500/10 border-emerald-400/30',
  info: 'bg-sky-500/10 border-sky-400/30',
  warn: 'bg-amber-500/10 border-amber-400/30',
  bad: 'bg-rose-500/15 border-rose-400/40',
};
const SEV_DOT: Record<string, string> = {
  ok: '#34d399',
  info: '#38bdf8',
  warn: '#fbbf24',
  bad: '#fb7185',
};

/** AeroDataBox local times look like "2026-05-28 14:35+01:00" — pull HH:mm. */
function fmtLocal(s: string | null | undefined): string {
  if (!s) return '';
  const m = s.match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : s;
}

/* ─── Component ─────────────────────────────────────── */

const CHECKLIST_ITEMS = [
  { key: 'docs', label: 'Pasaporte / DNI a mano' },
  { key: 'baggage', label: 'Maleta facturada' },
  { key: 'security', label: 'Control de seguridad pasado' },
];

export default function AirportModePage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const { trip, loading: tripLoading } = useTrip();
  const { events, loading: eventsLoading } = useEvents();

  const flight = useMemo(() => pickRelevantFlight(events), [events]);

  // Re-render every 30s so the countdown stays roughly fresh without
  // burning CPU. Good enough for an "hours/minutes" granularity readout.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Local-only checklist state. Intentionally not persisted: this is a
  // "right now at the airport" affordance, not data we want to keep.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  // Live flight status. Fetched here — ABOVE the loading guard below — so we
  // never declare a hook after an early return (that's the React #310 trap).
  // Degrades silently: offline, no API key, or flight not found → `live`
  // stays unavailable and the UI falls back to the Google Flights link.
  const [live, setLive] = useState<FlightLive | null>(null);
  useEffect(() => {
    const fn = flight?.details?.flightNumber?.trim();
    const date = flight?.date;
    if (!fn) {
      setLive(null);
      return;
    }
    // No point hitting the network with no signal — keep whatever we had.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    let aborted = false;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ flight: fn, ...(date ? { date } : {}) });
        const res = await fetch(`/api/flight-status?${qs.toString()}`);
        const json = (await res.json()) as FlightLive;
        if (!aborted) setLive(json);
      } catch {
        if (!aborted) setLive(null);
      }
    };
    load();
    // Refresh while the screen is open — gate/delay can change minute to minute.
    const id = setInterval(load, 60_000);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, [flight?.details?.flightNumber, flight?.date]);

  if (tripLoading || eventsLoading) {
    return (
      <div className="mode-active flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#ff9595] rounded-full animate-spin" />
      </div>
    );
  }

  const flightTs = flight ? eventDateTime(flight)?.getTime() ?? null : null;
  const countdown = flightTs !== null ? formatCountdown(flightTs - now) : null;

  const airline = flight?.details?.airline?.trim() || '';
  const flightNumber = flight?.details?.flightNumber?.trim() || '';
  const gate = flight?.details?.gate?.trim() || 'Pendiente';
  const terminal = flight?.details?.departureTerminal?.trim() || flight?.details?.terminal?.trim() || 'Pendiente';
  const seat = flight?.details?.seatNumber?.trim() || '';
  const confirmation = flight?.details?.confirmationCode?.trim() || '';

  // Live values win over the static itinerary fields when the API responded.
  const liveDep = live?.available ? live.departure : null;
  const liveGate = liveDep?.gate || gate;
  const liveTerminal = liveDep?.terminal || terminal;

  // Boarding pass: first attachment URL on the event. We don't crack open
  // the documents subcollection here — attachments[0] is the canonical
  // boarding pass slot for flights.
  const boardingPassUrl = flight?.attachments?.[0] || null;

  // Best-effort airline check-in deep link. We can't reliably map every
  // carrier so we just fall back to a Google search "<airline> check-in".
  const checkInUrl = airline
    ? `https://www.google.com/search?q=${encodeURIComponent(`${airline} check-in online`)}`
    : null;

  // Flight status — placeholder Google search until we wire up a real
  // tracker (FlightStats, AviationStack, etc).
  const statusQuery = [airline, flightNumber].filter(Boolean).join(' ').trim();
  const statusUrl = statusQuery
    ? `https://www.google.com/search?q=${encodeURIComponent(`${statusQuery} estado del vuelo`)}`
    : null;

  return (
    <div className="mode-active min-h-[60vh] -m-5 sm:-m-8 lg:-m-12 p-5 sm:p-8 lg:p-12 rounded-3xl"
         style={{ background: 'var(--pillar-bg, #0d1320)', color: 'var(--pillar-ink, #f4f0e6)' }}>
      {/* Top bar — back to /today so the user can swap modes. */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href={`/trips/${tripId}/today`}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#ff9595] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a hoy
        </Link>
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-bold text-white/50">
          <Plane className="w-3 h-3" />
          Modo aeropuerto
        </div>
      </div>

      {!flight && (
        <div className="text-center py-16">
          <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center bg-white/5 mb-4">
            <AlertCircle className="w-7 h-7 text-[#ff9595]" />
          </div>
          <h2 className="text-xl font-bold mb-1">No hay vuelos cargados</h2>
          <p className="text-sm text-white/60 max-w-xs mx-auto">
            Agregá un vuelo al itinerario para activar este modo.
          </p>
          {trip && (
            <Link
              href={`/trips/${tripId}/itinerary`}
              className="inline-block mt-5 px-4 py-2 rounded-full bg-[#ff6b6b] text-[#0d1320] text-xs font-bold"
            >
              Ir al itinerario
            </Link>
          )}
        </div>
      )}

      {flight && (
        <div className="space-y-6">
          {/* Hero countdown */}
          <div className="rounded-3xl p-6 sm:p-8 border border-white/10 bg-white/[0.04]">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#ff9595] mb-2">
              {airline || 'Vuelo'} {flightNumber && `· ${flightNumber}`}
            </div>
            <h1 className="text-hero" style={{ color: '#f4f0e6' }}>
              {countdown?.primary ?? '—'}
            </h1>
            <p className="text-sm text-white/70 mt-1">{countdown?.secondary ?? ''}</p>
            <p className="text-xs text-white/50 mt-3 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {flight.startTime || 'Hora sin definir'} · {flight.date}
            </p>
          </div>

          {/* Info grid: gate / terminal / asiento / código */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoTile label="Puerta" value={liveGate} live={!!liveDep?.gate} />
            <InfoTile label="Terminal" value={liveTerminal} live={!!liveDep?.terminal} />
            <InfoTile label="Asiento" value={seat || 'Pendiente'} />
            <InfoTile label="Reserva" value={confirmation || 'Pendiente'} />
          </div>

          {/* Boarding pass + quick links */}
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href={boardingPassUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!boardingPassUrl) e.preventDefault();
              }}
              className={[
                'rounded-2xl p-5 border flex items-center gap-3 transition-all',
                boardingPassUrl
                  ? 'bg-[#ff6b6b] border-[#ff6b6b] text-[#0d1320] hover:brightness-110'
                  : 'bg-white/5 border-white/10 text-white/50 cursor-not-allowed',
              ].join(' ')}
            >
              <Ticket className="w-5 h-5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold">Mostrar boarding pass</div>
                <div className="text-[11px] opacity-80 truncate">
                  {boardingPassUrl ? 'Abrir adjunto del vuelo' : 'Sin adjunto cargado'}
                </div>
              </div>
            </a>

            <a
              href={checkInUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!checkInUrl) e.preventDefault();
              }}
              className={[
                'rounded-2xl p-5 border flex items-center gap-3 transition-all',
                checkInUrl
                  ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed',
              ].join(' ')}
            >
              <Globe className="w-5 h-5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold">Check-in online</div>
                <div className="text-[11px] opacity-70 truncate">
                  {airline ? `Buscar ${airline}` : 'Aerolínea no cargada'}
                </div>
              </div>
            </a>

            {live?.available ? (
              <div
                className={[
                  'rounded-2xl p-5 border flex items-center gap-3 sm:col-span-2 text-white',
                  SEV_BG[live.severity ?? 'info'],
                ].join(' ')}
              >
                <span className="relative flex h-3 w-3 flex-shrink-0">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                    style={{ background: SEV_DOT[live.severity ?? 'info'] }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-3 w-3"
                    style={{ background: SEV_DOT[live.severity ?? 'info'] }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold flex items-center gap-2">
                    {live.statusLabel}
                    <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white/15">
                      En vivo
                    </span>
                  </div>
                  <div className="text-[11px] opacity-80 truncate">
                    {liveDep?.delayed && liveDep.revised
                      ? `Ahora sale ${fmtLocal(liveDep.revised)} · programado ${fmtLocal(liveDep.scheduled)}`
                      : liveDep?.scheduled
                        ? `Salida ${fmtLocal(liveDep.scheduled)}${liveDep.airportIata ? ` · ${liveDep.airportIata}` : ''}`
                        : 'Datos del vuelo actualizados'}
                  </div>
                </div>
              </div>
            ) : (
              <a
                href={statusUrl || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (!statusUrl) e.preventDefault();
                }}
                className={[
                  'rounded-2xl p-5 border flex items-center gap-3 transition-all sm:col-span-2',
                  statusUrl
                    ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed',
                ].join(' ')}
              >
                <FileText className="w-5 h-5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold">Estado del vuelo</div>
                  <div className="text-[11px] opacity-70 truncate">
                    {live && !live.available
                      ? 'Sin datos en vivo — abrir en Google'
                      : statusUrl
                        ? 'Consultar demoras y puerta actualizada'
                        : 'Falta aerolínea + número'}
                  </div>
                </div>
              </a>
            )}
          </div>

          {/* Mini checklist — local, no persistence on purpose */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 mb-3">
              Checklist rápida
            </div>
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map((item) => {
                const isChecked = !!checked[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggle(item.key)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 hover:border-white/20 transition-colors text-left"
                    style={{ background: isChecked ? 'rgba(255,107,107,0.12)' : 'transparent' }}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-[#ff9595] flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-white/30 flex-shrink-0" />
                    )}
                    <span className={isChecked ? 'text-sm text-white' : 'text-sm text-white/70'}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small presentational tile ─────────────────────── */

function InfoTile({ label, value, live = false }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 flex items-center gap-1.5">
        {label}
        {live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" title="Actualizado en vivo" />}
      </div>
      <div className="text-base font-bold text-white mt-1 truncate">{value}</div>
    </div>
  );
}
