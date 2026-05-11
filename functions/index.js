const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();
const db = admin.firestore();

/* ── Tripshistory Engine (TypeScript subproject) ──
   Mounts the Express app compiled from functions/tripshistory/src to
   functions/tripshistory/dist. Build with:
     cd functions/tripshistory && npm install && npm run build
   The require below is wrapped so that if `dist/` is missing the rest
   of this file (notably checkEventReminders) still loads. */
let tripshistoryApp = null;
try {
  // eslint-disable-next-line global-require
  tripshistoryApp = require('./tripshistory/dist/index').default;
} catch (e) {
  console.warn(
    '[tripshistory] dist/ not found — run `cd functions/tripshistory && npm run build` before deploy.',
    e && e.message ? e.message : e,
  );
}

if (tripshistoryApp) {
  exports.tripshistory = onRequest(
    {
      region: 'us-central1',
      // Express handles its own body parsing; let onRequest pass the raw body through.
    },
    tripshistoryApp,
  );
}

/* ── Scheduled function: every 5 min, blocked 10pm-5:30am (Mexico City) ── */
exports.checkEventReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Mexico_City',
    region: 'us-central1',
  },
  async () => {
    const now = new Date();

    // Configure web-push from env
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'gustavo@global3g.com';

    if (!vapidPublic || !vapidPrivate) {
      console.error('VAPID keys not configured');
      return;
    }

    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate);

    // Window: events starting in 25-35 minutes
    const windowStartTime = formatTime(new Date(now.getTime() + 25 * 60_000));
    const windowEndTime = formatTime(new Date(now.getTime() + 35 * 60_000));
    const todayDate = formatDate(now);

    const tripsSnap = await db.collection('trips').get();
    let sent = 0;

    for (const tripDoc of tripsSnap.docs) {
      const trip = tripDoc.data();

      // Skip trips not in active date range
      if (todayDate < trip.startDate || todayDate > trip.endDate) continue;

      // Get today's events
      const eventsSnap = await db
        .collection(`trips/${tripDoc.id}/events`)
        .where('date', '==', todayDate)
        .get();

      const upcoming = eventsSnap.docs.filter((d) => {
        const ev = d.data();
        if (!ev.startTime || ev.deletedAt) return false;
        return ev.startTime >= windowStartTime && ev.startTime <= windowEndTime;
      });

      if (upcoming.length === 0) continue;

      // Collect unique member UIDs
      const uids = new Set([trip.createdBy]);
      if (trip.travelerIds) trip.travelerIds.forEach((id) => uids.add(id));

      for (const uid of uids) {
        const subsSnap = await db
          .collection('pushSubscriptions')
          .where('userId', '==', uid)
          .get();

        if (subsSnap.empty) continue;

        for (const eventDoc of upcoming) {
          const ev = eventDoc.data();

          const payload = JSON.stringify({
            title: `${trip.title} — en 30 min`,
            body: `${ev.startTime} — ${ev.title}${ev.location ? ` en ${ev.location}` : ''}`,
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
              sent++;
            } catch (err) {
              if (err.statusCode === 410) {
                await subDoc.ref.delete();
              } else {
                console.error('Push error:', err.message);
              }
            }
          }
        }
      }
    }

    console.log(`Sent ${sent} notifications at ${mxTime.toLocaleTimeString()}`);
  },
);

/* ── Helpers ── */

function formatTime(date) {
  const mx = new Date(date.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  return `${String(mx.getHours()).padStart(2, '0')}:${String(mx.getMinutes()).padStart(2, '0')}`;
}

function formatDate(date) {
  const mx = new Date(date.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const y = mx.getFullYear();
  const m = String(mx.getMonth() + 1).padStart(2, '0');
  const d = String(mx.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
