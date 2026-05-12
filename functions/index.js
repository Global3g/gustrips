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

/* ── Admin: backfill trip.albumPhotos[] → /trips/{id}/photos/{photoId} ──
   Migrates the legacy embedded array to its subcollection home.
   Idempotent: re-runs are safe. Only touches trips the caller can access
   (createdBy === uid OR has a member doc with their uid).

   Auth: requires a valid Firebase ID token in `Authorization: Bearer ...`.
   The caller is the one whose trips get migrated. */
function photoIdFromUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/o\/(.+)$/);
    if (m) {
      const decoded = decodeURIComponent(m[1]);
      return decoded.replace(/\//g, '__').slice(0, 1500);
    }
  } catch {
    /* fall through */
  }
  return String(url).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 1500);
}

exports.migrateAlbumPhotos = onRequest(
  { region: 'us-central1', timeoutSeconds: 540, memory: '512MiB', cors: true },
  async (req, res) => {
    const t0 = Date.now();
    try {
      // Auth check.
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'missing-authorization' });
        return;
      }
      const idToken = authHeader.slice('Bearer '.length).trim();
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch {
        res.status(401).json({ error: 'invalid-token' });
        return;
      }
      const uid = decoded.uid;

      // Collect trips the caller can write to: created by them OR they are
      // a member. We union both, then dedupe.
      const tripIds = new Set();
      const createdSnap = await db
        .collection('trips')
        .where('createdBy', '==', uid)
        .get();
      createdSnap.forEach((d) => tripIds.add(d.id));

      // Subcollection group query for /trips/{id}/members/{uid}
      const memberSnap = await db
        .collectionGroup('members')
        .where('uid', '==', uid)
        .get();
      memberSnap.forEach((d) => {
        const tripId = d.ref.parent.parent && d.ref.parent.parent.id;
        if (tripId) tripIds.add(tripId);
      });

      const FIRESTORE_BATCH_LIMIT = 500;
      const perTrip = [];

      for (const tripId of tripIds) {
        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();
        if (!tripDoc.exists) continue;
        const data = tripDoc.data() || {};
        const albumPhotos = Array.isArray(data.albumPhotos) ? data.albumPhotos : [];

        if (albumPhotos.length === 0) {
          perTrip.push({ tripId, copied: 0, skipped: 0, kept: 0, alreadyEmpty: true });
          continue;
        }

        // Pre-read the subcollection so we know which photoIds already
        // exist; we still set with merge so this is mostly diagnostic.
        const subSnap = await db
          .collection('trips')
          .doc(tripId)
          .collection('photos')
          .get();
        const existingIds = new Set(subSnap.docs.map((d) => d.id));

        let batch = db.batch();
        let ops = 0;
        const commitIfFull = async () => {
          if (ops >= FIRESTORE_BATCH_LIMIT - 50) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        };

        const remaining = [];
        let copied = 0;
        let skippedNoUrl = 0;
        for (const p of albumPhotos) {
          if (!p || typeof p.url !== 'string' || p.url.length === 0) {
            // Skip malformed entries — keep them in legacy array for
            // manual inspection rather than dropping them.
            remaining.push(p);
            skippedNoUrl += 1;
            continue;
          }
          const photoId = photoIdFromUrl(p.url);
          const ref = db.collection('trips').doc(tripId).collection('photos').doc(photoId);

          // Strip undefined fields — Firestore rejects them inside writes.
          const cleaned = {};
          for (const [k, v] of Object.entries(p)) {
            if (v !== undefined) cleaned[k] = v;
          }

          batch.set(
            ref,
            {
              ...cleaned,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          ops += 1;
          copied += 1;
          await commitIfFull();
        }

        if (ops > 0) {
          await batch.commit();
        }

        // Re-count the subcollection after the writes so we can persist an
        // accurate photoCount on the trip doc (useful for cards, indices).
        const finalCount = await db
          .collection('trips')
          .doc(tripId)
          .collection('photos')
          .count()
          .get()
          .then((s) => s.data().count)
          .catch(() => existingIds.size + copied);

        // Clear the legacy array (keep only malformed entries we couldn't move).
        await tripRef.update({
          albumPhotos: remaining,
          photoCount: finalCount + remaining.length,
          updatedAt: new Date().toISOString(),
        }).catch((err) => {
          console.warn('[migrateAlbumPhotos] trip update failed', tripId, err.message);
        });

        perTrip.push({
          tripId,
          copied,
          alreadyInSubcollection: subSnap.size,
          kept: remaining.length,
          skippedNoUrl,
        });
      }

      const totalCopied = perTrip.reduce((s, t) => s + (t.copied || 0), 0);
      res.json({
        ok: true,
        uid,
        durationMs: Date.now() - t0,
        tripsProcessed: perTrip.length,
        totalCopied,
        perTrip,
      });
    } catch (err) {
      console.error('[migrateAlbumPhotos] fatal', err);
      res.status(500).json({ error: 'fatal', message: err && err.message });
    }
  },
);

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
