export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getAdminDb } from '@/lib/firebase/admin';

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

      for (const uid of [...new Set(memberUids)]) {
        const subsSnap = await db
          .collection('pushSubscriptions')
          .where('userId', '==', uid)
          .get();

        if (subsSnap.empty) continue;

        for (const eventDoc of upcomingEvents) {
          const event = eventDoc.data();
          const eventTime = event.startTime;
          const eventTitle = event.title || 'Evento';

          const payload = JSON.stringify({
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
          });

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
