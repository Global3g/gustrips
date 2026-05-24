'use client';

/**
 * Restaurant mode — command center for the next reservation. Big countdown
 * to sit-down, dress code (if set), Maps deep-link, "show reservation"
 * button (event attachment) and a pre-paid hint when the event has a cost
 * that's been marked as paid.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  UtensilsCrossed,
  ArrowLeft,
  Clock,
  MapPin,
  Ticket,
  Shirt,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { formatCurrency } from '@/lib/utils/helpers';
import type { TripEvent } from '@/types';

/* ─── Helpers ───────────────────────────────────────── */

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

/** Pick the next upcoming reservation, or fall back to most recent past. */
function pickRelevantRestaurant(events: TripEvent[]): TripEvent | null {
  const reservations = events.filter((e) => e.type === 'restaurant');
  if (reservations.length === 0) return null;
  const now = Date.now();
  const upcoming = reservations
    .map((e) => ({ event: e, ts: eventDateTime(e)?.getTime() ?? null }))
    .filter((x): x is { event: TripEvent; ts: number } => x.ts !== null && x.ts >= now)
    .sort((a, b) => a.ts - b.ts);
  if (upcoming.length > 0) return upcoming[0].event;
  const past = reservations
    .map((e) => ({ event: e, ts: eventDateTime(e)?.getTime() ?? null }))
    .filter((x): x is { event: TripEvent; ts: number } => x.ts !== null)
    .sort((a, b) => b.ts - a.ts);
  return past[0]?.event ?? null;
}

function formatCountdown(deltaMs: number): { primary: string; secondary: string } {
  if (deltaMs <= 0) {
    return { primary: '¡Hora!', secondary: 'de sentarse a la mesa' };
  }
  const totalMinutes = Math.floor(deltaMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) return { primary: `${days}d ${hours}h`, secondary: 'hasta la reserva' };
  if (hours >= 1) return { primary: `${hours}h ${minutes}m`, secondary: 'hasta la reserva' };
  return { primary: `${minutes}m`, secondary: 'hasta la reserva' };
}

/* ─── Component ─────────────────────────────────────── */

export default function RestaurantModePage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const { trip, loading: tripLoading } = useTrip();
  const { events, loading: eventsLoading } = useEvents();

  const restaurant = useMemo(() => pickRelevantRestaurant(events), [events]);

  // 30s tick for the countdown — restaurants are minute-sensitive.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (tripLoading || eventsLoading) {
    return (
      <div className="mode-active flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#ff9595] rounded-full animate-spin" />
      </div>
    );
  }

  const restaurantName = restaurant?.details?.restaurantName || restaurant?.title || 'Restaurante';
  const address = restaurant?.details?.address || restaurant?.location || '';
  const dressCode = restaurant?.details?.dressCode?.trim() || '';
  const cuisine = restaurant?.details?.cuisine?.trim() || '';
  const guests = restaurant?.details?.guests?.trim() || '';
  const reservationName = restaurant?.details?.reservationName?.trim() || '';

  const reservationTs = restaurant ? eventDateTime(restaurant)?.getTime() ?? null : null;
  const countdown = reservationTs !== null ? formatCountdown(reservationTs - now) : null;

  const reservationUrl = restaurant?.attachments?.[0] || null;
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  // "Pre-pago" hint: when there's a cost on the event AND a paid marker on
  // the details map (we use loose checks because details is `Record<string, string>`).
  const cost = restaurant?.cost ?? 0;
  const currency = restaurant?.currency || 'MXN';
  const paidFlag = (restaurant?.details?.paid || restaurant?.details?.paymentStatus || '').toLowerCase();
  const isPaid = cost > 0 && /pag|paid|si|yes|true/.test(paidFlag);
  const needsPrepay = cost > 0 && !isPaid;

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
          <UtensilsCrossed className="w-3 h-3" />
          Modo restaurante
        </div>
      </div>

      {!restaurant && (
        <div className="text-center py-16">
          <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center bg-white/5 mb-4">
            <AlertCircle className="w-7 h-7 text-[#ff9595]" />
          </div>
          <h2 className="text-xl font-bold mb-1">Sin reservas cargadas</h2>
          <p className="text-sm text-white/60 max-w-xs mx-auto">
            Agregá un restaurante al itinerario para activar este modo.
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

      {restaurant && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="rounded-3xl p-6 sm:p-8 border border-white/10 bg-white/[0.04]">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#ff9595] mb-2">
              {cuisine ? `Cocina ${cuisine}` : 'Reserva'}
            </div>
            <h1 className="text-hero" style={{ color: '#f4f0e6' }}>
              {restaurantName}
            </h1>
            <p className="text-sm text-white/70 mt-3">
              {countdown ? (
                <>
                  <span className="font-bold text-white">{countdown.primary}</span>{' '}
                  <span className="opacity-80">{countdown.secondary}</span>
                </>
              ) : (
                'Sin horario definido'
              )}
            </p>
            <p className="text-xs text-white/50 mt-3 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {restaurant.startTime || '—'} · {restaurant.date}
              {guests && <span className="ml-2">· {guests} personas</span>}
            </p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoTile label="A nombre de" value={reservationName || 'Pendiente'} />
            <InfoTile
              label="Dress code"
              value={dressCode || 'Casual'}
              icon={<Shirt className="w-3.5 h-3.5 text-[#ff9595]" />}
            />
            <InfoTile
              label="Costo"
              value={cost > 0 ? formatCurrency(cost, currency) : 'Sin pago'}
            />
          </div>

          {/* Maps + reservation buttons */}
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
              href={reservationUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!reservationUrl) e.preventDefault();
              }}
              className={[
                'rounded-2xl p-5 border flex items-start gap-3 transition-all',
                reservationUrl
                  ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed',
              ].join(' ')}
            >
              <Ticket className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-bold">Mostrar reserva</div>
                <div className="text-[11px] opacity-70 truncate">
                  {reservationUrl ? 'Abrir adjunto' : 'Sin adjunto cargado'}
                </div>
              </div>
            </a>
          </div>

          {/* Prepayment banner */}
          {needsPrepay && (
            <div className="rounded-2xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 p-4 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-[#ff9595] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Reserva con pre-pago</div>
                <div className="text-xs text-white/70 mt-0.5">
                  Hay {formatCurrency(cost, currency)} pendientes. Confirmá antes de ir si ya
                  pagaste o si te cobran en el restaurante.
                </div>
              </div>
            </div>
          )}
          {isPaid && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Pre-pago hecho</div>
                <div className="text-xs text-white/70 mt-0.5">
                  Ya pagaste {formatCurrency(cost, currency)}. Llevá el comprobante por las dudas.
                </div>
              </div>
            </div>
          )}

          {restaurant.notes && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 mb-2">
                Notas
              </div>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
                {restaurant.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Small presentational tile ─────────────────────── */

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-bold text-white mt-1 truncate">{value}</div>
    </div>
  );
}
