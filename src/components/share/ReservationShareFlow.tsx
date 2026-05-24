'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTrips } from '@/hooks/useTrips';
import { useAuth } from '@/hooks/useAuth';
import { addEventToTrip } from '@/lib/data/events';
import { classNames } from '@/lib/utils/helpers';
import {
  listTextInbox,
  removeTextItem,
  type SharedTextItem,
} from '@/lib/sharedTextInbox';
import {
  parseReservationLocal,
  isParseConfident,
  providerLabel,
  type ParsedReservation,
} from '@/lib/parsers/reservation';
import type { EventType } from '@/types';

const TYPE_OPTIONS: { value: EventType; label: string; emoji: string }[] = [
  { value: 'restaurant', label: 'Restaurante', emoji: '🍽️' },
  { value: 'hotel', label: 'Hotel', emoji: '🏨' },
  { value: 'activity', label: 'Actividad', emoji: '🎟️' },
  { value: 'transport', label: 'Transporte', emoji: '🚗' },
  { value: 'misc', label: 'Otro', emoji: '📌' },
];

interface FormState {
  type: EventType;
  title: string;
  date: string;
  startTime: string;
  location: string;
  partySize: string;
  confirmationCode: string;
}

function toForm(r: ParsedReservation): FormState {
  return {
    type: r.type === 'misc' ? 'restaurant' : r.type,
    title: r.title.startsWith('Reserva') ? '' : r.title,
    date: r.date ?? '',
    startTime: r.startTime ?? '',
    location: r.location ?? '',
    partySize: r.partySize ? String(r.partySize) : '',
    confirmationCode: r.confirmationCode ?? '',
  };
}

/**
 * Handles reservations shared into GusTrips (Web Share Target text/url).
 * Parses each shared item (local regex first, Gemini fallback when needed),
 * shows an editable form, and on confirm drops it on the chosen trip's
 * itinerary as a TripEvent. Processes items one at a time as a queue.
 */
export default function ReservationShareFlow({
  initialItems,
}: {
  initialItems: SharedTextItem[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { trips, loading: tripsLoading } = useTrips();

  const [queue, setQueue] = useState<SharedTextItem[]>(initialItems);
  const [parsing, setParsing] = useState(true);
  const [parsed, setParsed] = useState<ParsedReservation | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = queue[0];

  const sortedTrips = useMemo(() => {
    const order: Record<string, number> = { active: 0, planning: 1, completed: 2, cancelled: 3 };
    return [...trips].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }, [trips]);

  // Default to the active or most-recent trip.
  useEffect(() => {
    if (selectedTripId || trips.length === 0) return;
    const active = trips.find((t) => t.status === 'active') ?? trips[0];
    setSelectedTripId(active.id);
  }, [trips, selectedTripId]);

  // Parse the head of the queue: local first, Gemini fallback when unconfident.
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setParsing(true);
    setError(null);
    (async () => {
      const local = parseReservationLocal(current.text, current.url);
      let result = local;

      if (!isParseConfident(local) && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const res = await fetch('/api/parse-reservation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: current.text, url: current.url }),
            signal: AbortSignal.timeout(30_000),
          });
          const json = await res.json();
          if (json?.ok && json.data && json.data.isReservation !== false) {
            const d = json.data as Record<string, unknown>;
            // Merge: prefer model values, keep local for anything the model left blank.
            result = {
              ...local,
              type: (d.type as EventType) || local.type,
              title: (d.title as string) || local.title,
              date: (d.date as string) || local.date,
              startTime: (d.startTime as string) || local.startTime,
              endDate: (d.endDate as string) || local.endDate,
              location: (d.location as string) || local.location,
              partySize:
                typeof d.partySize === 'number' ? d.partySize : local.partySize,
              confirmationCode:
                (d.confirmationCode as string) || local.confirmationCode,
            };
          }
        } catch {
          // Network/model failure — fall back to local parse silently.
        }
      }

      if (cancelled) return;
      setParsed(result);
      setForm(toForm(result));
      setParsing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  if (!current) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h1 className="text-2xl font-bold text-white mb-2">Nada por agregar</h1>
        <p className="text-white/60 mb-6">No hay reservas esperando en la bandeja.</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 transition border border-white/10"
        >
          Volver al dashboard
        </button>
      </div>
    );
  }

  const advance = async () => {
    await removeTextItem(current.id);
    const rest = queue.slice(1);
    if (rest.length === 0) {
      // Refresh from store in case more arrived while we were here.
      const fresh = (await listTextInbox()).filter((it) => it.id !== current.id);
      if (fresh.length === 0) {
        router.push(selectedTripId ? `/trips/${selectedTripId}` : '/dashboard');
        return;
      }
      setQueue(fresh);
    } else {
      setQueue(rest);
    }
  };

  const handleAdd = async () => {
    if (!form || !selectedTripId || busy) return;
    if (!user?.uid) {
      setError('Necesitas iniciar sesión para agregar la reserva.');
      return;
    }
    if (!form.title.trim()) {
      setError('Ponle un nombre a la reserva.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trip = trips.find((t) => t.id === selectedTripId);
      const currency = trip?.budgetCurrency || 'MXN';

      const notesLines: string[] = [];
      if (form.confirmationCode) notesLines.push(`Confirmación: ${form.confirmationCode}`);
      if (form.partySize) notesLines.push(`Personas: ${form.partySize}`);
      if (parsed?.endDate) notesLines.push(`Check-out: ${parsed.endDate}`);
      const label = parsed ? providerLabel(parsed.provider) : '';
      if (label) notesLines.push(`Reservado vía ${label}`);
      if (parsed?.sourceUrl) notesLines.push(parsed.sourceUrl);

      const details: Record<string, string> = {};
      if (form.confirmationCode) details.confirmationCode = form.confirmationCode;
      if (form.partySize) details.partySize = form.partySize;
      if (label) details.provider = label;
      if (parsed?.endDate) details.checkOut = parsed.endDate;

      await addEventToTrip(selectedTripId, user.uid, {
        title: form.title.trim(),
        type: form.type,
        date: form.date || new Date().toISOString().slice(0, 10),
        startTime: form.startTime || '',
        endTime: '',
        location: form.location.trim(),
        notes: notesLines.join('\n'),
        cost: 0,
        currency,
        attachments: [],
        details: Object.keys(details).length ? details : undefined,
      });

      await advance();
    } catch (err) {
      console.warn('[share] add reservation failed', err);
      setError('No se pudo agregar la reserva. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    if (busy) return;
    await advance();
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const label = parsed ? providerLabel(parsed.provider) : '';
  const remaining = queue.length;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
        Agregar reserva al viaje
      </h1>
      <p className="text-white/60 text-sm mb-6">
        {label ? (
          <>Detectamos una reserva de <span className="text-white/90 font-medium">{label}</span>. Revisa los datos y agrégala a tu itinerario.</>
        ) : (
          <>Detectamos una reserva. Revisa los datos y agrégala a tu itinerario.</>
        )}
        {remaining > 1 && (
          <span className="text-amber-300/80"> · {remaining} en cola</span>
        )}
      </p>

      {parsing || !form ? (
        <div className="space-y-3">
          <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse w-2/3" />
          <p className="text-white/40 text-xs">Leyendo la reserva…</p>
        </div>
      ) : (
        <>
          {/* Type */}
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            Tipo
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            {TYPE_OPTIONS.map((opt) => {
              const selected = form.type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('type', opt.value)}
                  className={classNames(
                    'px-3.5 py-2 rounded-full text-sm border transition',
                    selected
                      ? 'bg-amber-500/15 border-amber-300/40 text-amber-50'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/80 hover:bg-white/[0.07]',
                  )}
                >
                  <span className="mr-1.5">{opt.emoji}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Title */}
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            Nombre
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ej. La Docena, Hotel Habita…"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white mb-4 outline-none focus:border-amber-300/40 placeholder:text-white/30"
          />

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white outline-none focus:border-amber-300/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Hora
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white outline-none focus:border-amber-300/40"
              />
            </div>
          </div>

          {/* Location */}
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            Lugar / dirección
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Opcional"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white mb-4 outline-none focus:border-amber-300/40 placeholder:text-white/30"
          />

          {/* Party size + confirmation */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Personas
              </label>
              <input
                type="number"
                min={1}
                value={form.partySize}
                onChange={(e) => set('partySize', e.target.value)}
                placeholder="—"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white outline-none focus:border-amber-300/40 placeholder:text-white/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Confirmación
              </label>
              <input
                type="text"
                value={form.confirmationCode}
                onChange={(e) => set('confirmationCode', e.target.value)}
                placeholder="—"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white outline-none focus:border-amber-300/40 placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Trip picker */}
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            Viaje
          </label>
          {tripsLoading ? (
            <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse mb-4" />
          ) : sortedTrips.length === 0 ? (
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-white/60 text-sm mb-4">
              Aún no tienes viajes. Crea uno primero para poder agregar la reserva.
            </div>
          ) : (
            <div className="grid gap-2 mb-6">
              {sortedTrips.map((trip) => {
                const selected = trip.id === selectedTripId;
                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => setSelectedTripId(trip.id)}
                    className={classNames(
                      'flex items-center justify-between text-left px-4 py-3 rounded-xl border transition',
                      selected
                        ? 'bg-amber-500/15 border-amber-300/40 text-amber-50'
                        : 'bg-white/[0.04] border-white/[0.08] text-white/85 hover:bg-white/[0.07]',
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{trip.title}</span>
                      <span className="text-xs opacity-70">{trip.destination}</span>
                    </span>
                    <span className="text-xs opacity-70">
                      {trip.startDate} → {trip.endDate}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-300/30 px-4 py-3 text-sm text-rose-100 mb-4">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={busy}
              className="flex-1 px-5 py-3 rounded-full text-sm font-medium text-white/85 bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] transition disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !selectedTripId || sortedTrips.length === 0}
              className="flex-[2] px-5 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 transition disabled:opacity-50 disabled:from-white/10 disabled:to-white/10"
            >
              {busy ? 'Agregando…' : 'Agregar al viaje'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
