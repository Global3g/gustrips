'use client';

/**
 * Hotel mode — command center for the active (or imminent) hotel stay.
 * Surfaces check-in / check-out countdowns, address with a Maps deep-link,
 * tap-to-call phone and a "wifi cheat sheet" the user can fill on the fly
 * (Firestore-persisted via updateEvent so the next guest in the trip gets
 * it too).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Hotel,
  ArrowLeft,
  MapPin,
  Phone,
  Wifi,
  Save,
  AlertCircle,
} from 'lucide-react';
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import type { TripEvent } from '@/types';

/* ─── Helpers ───────────────────────────────────────── */

function parseLocalDateTime(date: string | undefined, time?: string): Date | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  let h = 0;
  let min = 0;
  if (time) {
    const parts = time.split(':').map(Number);
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      h = parts[0];
      min = parts[1];
    }
  }
  return new Date(y, m - 1, d, h, min);
}

/**
 * Pick the hotel that "matters now": currently active (check-in passed,
 * check-out not yet) or the next upcoming one. Falls back to the most
 * recent past hotel so a user revisiting the page after check-out still
 * sees relevant context.
 */
function pickRelevantHotel(events: TripEvent[]): TripEvent | null {
  const hotels = events.filter((e) => e.type === 'hotel');
  if (hotels.length === 0) return null;
  const now = Date.now();

  const enriched = hotels.map((event) => {
    const checkInDate = event.details?.checkInDate || event.date;
    const checkOutDate = event.details?.checkOutDate || event.date;
    const checkIn = parseLocalDateTime(checkInDate, event.details?.checkInTime || event.startTime);
    const checkOut = parseLocalDateTime(checkOutDate, event.details?.checkOutTime || event.endTime);
    return { event, checkIn, checkOut };
  });

  const active = enriched.find(
    (x) => x.checkIn && x.checkOut && x.checkIn.getTime() <= now && x.checkOut.getTime() > now,
  );
  if (active) return active.event;

  const upcoming = enriched
    .filter((x): x is { event: TripEvent; checkIn: Date; checkOut: Date | null } => !!x.checkIn && x.checkIn.getTime() > now)
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
  if (upcoming.length > 0) return upcoming[0].event;

  const past = enriched
    .filter((x): x is { event: TripEvent; checkIn: Date | null; checkOut: Date } => !!x.checkOut)
    .sort((a, b) => b.checkOut.getTime() - a.checkOut.getTime());
  return past[0]?.event ?? null;
}

function formatCountdown(deltaMs: number, verb: string): { primary: string; secondary: string } {
  if (deltaMs <= 0) {
    return { primary: 'Disponible', secondary: verb };
  }
  const totalMinutes = Math.floor(deltaMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) return { primary: `${days}d ${hours}h`, secondary: verb };
  if (hours >= 1) return { primary: `${hours}h ${minutes}m`, secondary: verb };
  return { primary: `${minutes}m`, secondary: verb };
}

/* ─── Component ─────────────────────────────────────── */

const NEEDS_CHIPS = ['Agua', 'Toallas extra', 'Almohadas extra', 'Servicio de cuarto', 'Late check-out'];

export default function HotelModePage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const { trip, loading: tripLoading } = useTrip();
  const { events, loading: eventsLoading, updateEvent } = useEvents();

  const hotel = useMemo(() => pickRelevantHotel(events), [events]);

  // 60s tick for the countdowns — good enough for the "Xd Yh" granularity.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Inline editor for wifi info. Pre-fills from event.details when present,
  // saves back to the same `details` map so every device on the trip sees it.
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSaving, setWifiSaving] = useState(false);
  const [wifiSavedAt, setWifiSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!hotel) return;
    setWifiName(hotel.details?.wifi || hotel.details?.wifiName || '');
    setWifiPassword(hotel.details?.wifiPassword || '');
  }, [hotel?.id, hotel?.details?.wifi, hotel?.details?.wifiName, hotel?.details?.wifiPassword]);

  if (tripLoading || eventsLoading) {
    return (
      <div className="mode-active flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#ff9595] rounded-full animate-spin" />
      </div>
    );
  }

  const hotelName = hotel?.details?.hotelName || hotel?.title || 'Hotel';
  const address = hotel?.details?.address || hotel?.location || '';
  const phone = hotel?.details?.phone || hotel?.details?.hotelPhone || '';
  const checkInDate = hotel?.details?.checkInDate || hotel?.date || '';
  const checkOutDate = hotel?.details?.checkOutDate || hotel?.date || '';
  const checkInTime = hotel?.details?.checkInTime || hotel?.startTime || '';
  const checkOutTime = hotel?.details?.checkOutTime || hotel?.endTime || '';

  const checkInTs = parseLocalDateTime(checkInDate, checkInTime)?.getTime() ?? null;
  const checkOutTs = parseLocalDateTime(checkOutDate, checkOutTime)?.getTime() ?? null;

  const inStay = checkInTs !== null && checkOutTs !== null && checkInTs <= now && checkOutTs > now;
  const beforeStay = checkInTs !== null && checkInTs > now;

  const heroCountdown = (() => {
    if (inStay && checkOutTs !== null) return formatCountdown(checkOutTs - now, 'hasta el check-out');
    if (beforeStay && checkInTs !== null) return formatCountdown(checkInTs - now, 'hasta el check-in');
    return null;
  })();

  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
  const phoneHref = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;

  const handleSaveWifi = async () => {
    if (!hotel) return;
    setWifiSaving(true);
    try {
      const mergedDetails: Record<string, string> = {
        ...(hotel.details || {}),
        wifi: wifiName.trim(),
        wifiName: wifiName.trim(),
        wifiPassword: wifiPassword.trim(),
      };
      await updateEvent(hotel.id, { details: mergedDetails });
      setWifiSavedAt(Date.now());
    } finally {
      setWifiSaving(false);
    }
  };

  return (
    <div
      className="mode-active min-h-[60vh] -m-5 sm:-m-8 lg:-m-12 p-5 sm:p-8 lg:p-12 rounded-3xl"
      style={{ background: 'var(--pillar-bg, #0d1320)', color: 'var(--pillar-ink, #f4f0e6)' }}
    >
      <div className="flex items-center justify-between mb-8">
        <Link
          href={`/trips/${tripId}/today`}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#ff9595] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a hoy
        </Link>
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-bold text-white/50">
          <Hotel className="w-3 h-3" />
          Modo hotel
        </div>
      </div>

      {!hotel && (
        <div className="text-center py-16">
          <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center bg-white/5 mb-4">
            <AlertCircle className="w-7 h-7 text-[#ff9595]" />
          </div>
          <h2 className="text-xl font-bold mb-1">No hay hoteles cargados</h2>
          <p className="text-sm text-white/60 max-w-xs mx-auto">
            Agregá un hotel al itinerario para activar este modo.
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

      {hotel && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="rounded-3xl p-6 sm:p-8 border border-white/10 bg-white/[0.04]">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#ff9595] mb-2">
              {inStay ? 'Estás hospedado' : beforeStay ? 'Próximo hospedaje' : 'Hospedaje pasado'}
            </div>
            <h1 className="text-hero" style={{ color: '#f4f0e6' }}>
              {hotelName}
            </h1>
            {heroCountdown && (
              <p className="text-sm text-white/70 mt-3">
                <span className="font-bold text-white">{heroCountdown.primary}</span>{' '}
                <span className="opacity-80">{heroCountdown.secondary}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <InfoTile
                label="Check-in"
                value={
                  checkInDate
                    ? `${checkInDate}${checkInTime ? ` · ${checkInTime}` : ''}`
                    : 'Pendiente'
                }
              />
              <InfoTile
                label="Check-out"
                value={
                  checkOutDate
                    ? `${checkOutDate}${checkOutTime ? ` · ${checkOutTime}` : ''}`
                    : 'Pendiente'
                }
              />
            </div>
          </div>

          {/* Address + phone */}
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href={mapsUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!mapsUrl) e.preventDefault();
              }}
              className={[
                'rounded-2xl p-5 border flex items-start gap-3 transition-all',
                mapsUrl
                  ? 'bg-[#ff6b6b] border-[#ff6b6b] text-[#0d1320] hover:brightness-110'
                  : 'bg-white/5 border-white/10 text-white/50 cursor-not-allowed',
              ].join(' ')}
            >
              <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-bold">Cómo llegar</div>
                <div className="text-[11px] opacity-80 break-words">
                  {address || 'Sin dirección cargada'}
                </div>
              </div>
            </a>

            <a
              href={phoneHref || '#'}
              onClick={(e) => {
                if (!phoneHref) e.preventDefault();
              }}
              className={[
                'rounded-2xl p-5 border flex items-start gap-3 transition-all',
                phoneHref
                  ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed',
              ].join(' ')}
            >
              <Phone className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-bold">Llamar al hotel</div>
                <div className="text-[11px] opacity-70 break-words">
                  {phone || 'Sin teléfono cargado'}
                </div>
              </div>
            </a>
          </div>

          {/* Wifi card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[#ff9595]" />
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50">
                  Wifi
                </span>
              </div>
              {wifiSavedAt && (
                <span className="text-[10px] text-white/40">Guardado</span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-white/50 font-bold uppercase tracking-wider">
                  Nombre de red
                </span>
                <input
                  type="text"
                  value={wifiName}
                  onChange={(e) => setWifiName(e.target.value)}
                  placeholder="Ej. Hotel-Guest"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-[#ff9595] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-white/50 font-bold uppercase tracking-wider">
                  Contraseña
                </span>
                <input
                  type="text"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="Ej. bienvenidos2025"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-[#ff9595] focus:outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleSaveWifi}
              disabled={wifiSaving}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ff6b6b] text-[#0d1320] text-xs font-bold disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {wifiSaving ? 'Guardando…' : 'Guardar wifi'}
            </button>
          </div>

          {/* Needs chips — purely visual reminders */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 mb-3">
              Necesidades rápidas
            </div>
            <div className="flex flex-wrap gap-2">
              {NEEDS_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70"
                >
                  {chip}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-3">
              Pedilos en recepción o por teléfono.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small presentational tile ─────────────────────── */

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50">{label}</div>
      <div className="text-sm font-bold text-white mt-1">{value}</div>
    </div>
  );
}
