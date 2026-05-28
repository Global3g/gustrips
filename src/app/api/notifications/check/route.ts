export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getAdminDb } from '@/lib/firebase/admin';
import { fetchFlightStatus } from '@/lib/flight/aerodatabox';

/* ── Configure web-push ── */
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:gustavo@global3g.com', VAPID_PUBLIC, VAPID_PRIVATE);
}

/* ── Cron secret for Vercel ── */
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }

  try {
    const db = getAdminDb();
    const now = new Date();

    // Window: events starting in 25-35 minutes (to cover 5-min cron interval)
    const windowStart = new Date(now.getTime() + 25 * 60_000);
    const windowEnd = new Date(now.getTime() + 35 * 60_000);

    // Format as HH:MM for comparison
    const windowStartTime = formatTime(windowStart);
    const windowEndTime = formatTime(windowEnd);
    const todayDate = formatDate(now);

    // Get all trips
    const tripsSnap = await db.collection('trips').get();
    let notificationsSent = 0;

    for (const tripDoc of tripsSnap.docs) {
      const trip = tripDoc.data();

      // Skip trips not in active date range
      if (todayDate < trip.startDate || todayDate > trip.endDate) continue;

      // Get events for today within the time window
      const eventsSnap = await db
        .collection(`trips/${tripDoc.id}/events`)
        .where('date', '==', todayDate)
        .get();

      const upcomingEvents = eventsSnap.docs.filter((d) => {
        const event = d.data();
        if (!event.startTime || event.deletedAt) return false;
        return event.startTime >= windowStartTime && event.startTime <= windowEndTime;
      });

      if (upcomingEvents.length === 0) continue;

      // Get all push subscriptions for trip members
      const memberUids: string[] = [trip.createdBy];
      if (trip.travelerIds) {
        memberUids.push(...trip.travelerIds);
      }

      // Resolve every member's subscriptions once, so the 30-min reminder
      // AND the flight watcher below can reuse them.
      const uniqueUids = [...new Set(memberUids)];
      const subsByUid: Record<string, FirebaseFirestore.QuerySnapshot> = {};
      for (const uid of uniqueUids) {
        subsByUid[uid] = await db
          .collection('pushSubscriptions')
          .where('userId', '==', uid)
          .get();
      }

      const pushToAll = async (payload: string) => {
        for (const uid of uniqueUids) {
          const subsSnap = subsByUid[uid];
          if (!subsSnap || subsSnap.empty) continue;
          for (const subDoc of subsSnap.docs) {
            const { subscription } = subDoc.data();
            try {
              await webpush.sendNotification(subscription, payload);
              notificationsSent++;
            } catch (err: unknown) {
              // 410 Gone = subscription expired, remove it
              if (err instanceof webpush.WebPushError && err.statusCode === 410) {
                await subDoc.ref.delete();
              } else {
                console.error('Push send error:', err);
              }
            }
          }
        }
      };

      // ── 30-min event reminders ─────────────────────────────────────
      for (const eventDoc of upcomingEvents) {
        const event = eventDoc.data();
        const eventTime = event.startTime;
        const eventTitle = event.title || 'Evento';
        await pushToAll(
          JSON.stringify({
            title: `${trip.title} — en 30 min`,
            body: `${eventTime} — ${eventTitle}${event.location ? ` en ${event.location}` : ''}`,
            icon: '/logo.png',
            badge: '/logo.png',
            tag: `event-${eventDoc.id}`,
            data: {
              url: `/trips/${tripDoc.id}/itinerary`,
              tripId: tripDoc.id,
              eventId: eventDoc.id,
            },
          }),
        );
      }

      // ── Flight status watch ────────────────────────────────────────
      // For each of today's flights that's within the active window
      // (departing in the next 4h, or already in the air / boarding /
      // delayed), poll AeroDataBox once. Diff against the `flightWatch`
      // state we last stored on the event; only push when something
      // material moved (gate, terminal, status, revised time).
      const flightsSnap = await db
        .collection(`trips/${tripDoc.id}/events`)
        .where('date', '==', todayDate)
        .where('type', '==', 'flight')
        .get();

      for (const flightDoc of flightsSnap.docs) {
        const flight = flightDoc.data();
        if (flight.deletedAt) continue;
        const details = (flight.details || {}) as Record<string, string | undefined>;
        const fn = (details.flightNumber || '').replace(/\s+/g, '').toUpperCase();
        if (!fn || !/[A-Z]/.test(fn) || !/\d/.test(fn)) continue;

        const last = (flight.flightWatch || {}) as {
          statusRaw?: string;
          gate?: string | null;
          terminal?: string | null;
          revised?: string | null;
          scheduled?: string | null;
          checkedAt?: string;
        };
        const ACTIVE_STATUS = new Set([
          'EnRoute', 'Boarding', 'Delayed', 'Departed', 'Approaching', 'CheckIn', 'GateClosed',
        ]);
        const isActive = ACTIVE_STATUS.has(last.statusRaw || '');

        let withinWindow = false;
        if (flight.startTime) {
          const [h, m] = String(flight.startTime).split(':').map(Number);
          const dep = new Date(now);
          dep.setHours(h || 0, m || 0, 0, 0);
          const deltaMs = dep.getTime() - now.getTime();
          // Watch from 4h before until 6h after the scheduled departure.
          withinWindow = deltaMs <= 4 * 60 * 60_000 && deltaMs >= -6 * 60 * 60_000;
        }
        if (!withinWindow && !isActive) continue;

        const live = await fetchFlightStatus(fn, flight.date);
        if (!live.available) continue;

        const newGate = live.departure?.gate || null;
        const newTerm = live.departure?.terminal || null;
        const newRevised = live.departure?.revised || null;
        const newSched = live.departure?.scheduled || null;
        const newStatusRaw = live.statusRaw || null;

        const changes: string[] = [];
        if (newGate && newGate !== (last.gate ?? null)) {
          changes.push(`Puerta: ${newGate}`);
        }
        if (newTerm && newTerm !== (last.terminal ?? null)) {
          changes.push(`Terminal: ${newTerm}`);
        }
        // Only surface "material" status moves; ignore Unknown → Scheduled, etc.
        const MATERIAL_STATUS = new Set([
          'Delayed', 'Canceled', 'CanceledUncertain', 'Boarding',
          'GateClosed', 'EnRoute', 'Arrived', 'Diverted',
        ]);
        if (newStatusRaw && newStatusRaw !== (last.statusRaw || null) && MATERIAL_STATUS.has(newStatusRaw)) {
          changes.push(live.statusLabel || newStatusRaw);
        }
        if (newRevised && newRevised !== (last.revised || null) && newRevised !== newSched) {
          const t = newRevised.match(/(\d{1,2}:\d{2})/)?.[1];
          if (t) changes.push(`Ahora sale ${t}`);
        }

        // Always remember the latest snapshot so the next tick diffs cleanly.
        await flightDoc.ref.update({
          flightWatch: {
            statusRaw: newStatusRaw,
            gate: newGate,
            terminal: newTerm,
            revised: newRevised,
            scheduled: newSched,
            checkedAt: new Date().toISOString(),
          },
        });

        // First-ever observation: store state without spamming a push.
        if (!last.checkedAt) continue;
        if (changes.length === 0) continue;

        const airline = details.airline || 'Vuelo';
        await pushToAll(
          JSON.stringify({
            title: `${airline} ${fn} · ${live.statusLabel}`,
            body: changes.join(' · '),
            icon: '/logo.png',
            badge: '/logo.png',
            // Tag includes a stable suffix so each distinct change replaces
            // the previous one for that flight on the device.
            tag: `flight-${flightDoc.id}`,
            data: {
              url: `/trips/${tripDoc.id}/mode/airport`,
              tripId: tripDoc.id,
              eventId: flightDoc.id,
            },
          }),
        );
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent,
      checkedAt: now.toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error checking notifications:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ── Helpers ── */

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
