/**
 * Trips conversion service — promotes a finished tripshistory Story
 * into a real GusTrips Trip.
 *
 * What it does (single atomic op from the caller's perspective):
 *   1. Reads the Story + its Days + Events + Photos.
 *   2. Writes a new Trip doc at `/trips/{newTripId}` whose shape matches
 *      a manually-created Trip (see src/types Trip).
 *   3. Mirrors each Story Event into `/trips/{newTripId}/events/{eventId}`
 *      as a TripEvent (activity-typed).
 *   4. Writes the trip owner as a member at
 *      `/trips/{newTripId}/members/{userId}` so the Trip is visible to
 *      the same security rules that gate `/trips/{id}`.
 *   5. Stamps the Story doc with the new `tripId` so the standalone
 *      page knows the conversion already happened.
 *
 * Batches respect Firestore's 500-op limit. We chunk Events + Photos
 * across multiple commits when needed.
 */
import { HttpError } from '../middleware/errors';
import { db, paths, admin } from '../lib/firestore';
import type {
  ConvertToTripRequest,
  ConvertToTripResponse,
} from '../models/types';

type FirestoreTimestamp = admin.firestore.Timestamp;

interface StoredStory {
  userId: string;
  tripId: string | null;
  title?: string;
  status?: string;
  approximateDates?: { start?: string; end?: string };
}

interface StoredDay {
  storyId: string;
  date: string; // YYYY-MM-DD
  title?: string;
  summary?: string;
  primaryLocation?: string;
  photoCount?: number;
}

interface StoredEvent {
  storyId: string;
  dayId: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  coordinates?: { lat?: number; lng?: number };
  photoIds?: string[];
  highlightPhotoIds?: string[];
}

interface StoredPhoto {
  storyId: string;
  capturedAt: FirestoreTimestamp;
  thumbnailUrl?: string;
  mediumUrl?: string;
  fullUrl?: string;
  dayId?: string | null;
  eventId?: string | null;
  uploadedAt?: FirestoreTimestamp | admin.firestore.FieldValue;
}

interface AlbumPhotoOut {
  url: string;
  fullUrl?: string;
  date: string;
  eventId?: string;
  uploadedAt: string;
  optimized?: boolean;
}

const FIRESTORE_BATCH_LIMIT = 500;

/** Stable doc id derived from a Firebase Storage URL — used so the photos
 *  subcollection never duplicates a photo even if convertToTrip is retried.
 *  Mirrors the client helper in src/hooks/useAlbum.ts. */
function photoIdFromUrl(url: string): string {
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
  return url.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 1500);
}

/**
 * Format a Firestore Timestamp as a YYYY-MM-DD date string in UTC.
 * We deliberately use UTC so the same photo lands on the same date
 * regardless of where the client reads from.
 */
function tsToYmd(ts: FirestoreTimestamp): string {
  const d = ts.toDate();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tsToIso(
  ts: FirestoreTimestamp | admin.firestore.FieldValue | undefined,
): string {
  if (!ts) return new Date().toISOString();
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') {
    return maybe.toDate().toISOString();
  }
  return new Date().toISOString();
}

function pickStartTime(time: string | undefined, date: string): string {
  // Story events store wall-clock times like "10:00:00" or ISO strings.
  // Normalize to "HH:mm" for TripEvent.startTime; fall back to "09:00".
  if (!time) return '09:00';
  // ISO datetime → take the time component
  const isoMatch = time.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
  // Wall-clock HH:mm or HH:mm:ss
  const wallMatch = time.match(/^(\d{2}):(\d{2})/);
  if (wallMatch) return `${wallMatch[1]}:${wallMatch[2]}`;
  void date;
  return '09:00';
}

function pickEndTime(time: string | undefined, startTime: string): string {
  if (!time) return startTime;
  const isoMatch = time.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
  const wallMatch = time.match(/^(\d{2}):(\d{2})/);
  if (wallMatch) return `${wallMatch[1]}:${wallMatch[2]}`;
  return startTime;
}

export const tripsService = {
  async convertToTrip(
    userId: string,
    storyId: string,
    body: ConvertToTripRequest,
  ): Promise<ConvertToTripResponse> {
    // 1. Load the story
    const storyRef = db.doc(paths.story(userId, storyId));
    const storySnap = await storyRef.get();
    if (!storySnap.exists) {
      throw HttpError.notFound('Story not found');
    }
    const story = storySnap.data() as StoredStory;

    if (story.tripId) {
      // Already converted — return the existing tripId so this op is idempotent.
      return { tripId: story.tripId, storyId };
    }

    // 2. Load days + events + photos in parallel
    const [daysSnap, eventsSnap, photosSnap] = await Promise.all([
      db.collection(paths.daysCollection(userId, storyId)).get(),
      db.collection(paths.eventsCollection(userId, storyId)).get(),
      db.collection(paths.photosCollection(userId, storyId)).get(),
    ]);

    // Maps for cross-referencing
    const daysById = new Map<string, StoredDay>();
    daysSnap.forEach((d) => daysById.set(d.id, d.data() as StoredDay));

    const events = eventsSnap.docs.map((d) => ({
      id: d.id,
      data: d.data() as StoredEvent,
    }));

    const photos = photosSnap.docs.map((d) => ({
      id: d.id,
      data: d.data() as StoredPhoto,
    }));

    // 3. Compute date range from photos (preferred) or days (fallback)
    let minDate: string | undefined;
    let maxDate: string | undefined;

    for (const p of photos) {
      if (!p.data.capturedAt) continue;
      const ymd = tsToYmd(p.data.capturedAt);
      if (!minDate || ymd < minDate) minDate = ymd;
      if (!maxDate || ymd > maxDate) maxDate = ymd;
    }

    if (!minDate || !maxDate) {
      for (const d of daysById.values()) {
        if (!d.date) continue;
        if (!minDate || d.date < minDate) minDate = d.date;
        if (!maxDate || d.date > maxDate) maxDate = d.date;
      }
    }

    if (!minDate || !maxDate) {
      // Fall back to approximate dates or today.
      const today = new Date().toISOString().slice(0, 10);
      minDate = story.approximateDates?.start ?? today;
      maxDate = story.approximateDates?.end ?? minDate;
    }

    // 4. Resolve title / destination
    const title =
      body.title?.trim() ||
      story.title?.trim() ||
      'Viaje reconstruido';
    const destination = body.destination?.trim() ?? '';

    // 5. Build the AlbumPhoto array from story photos (chronological)
    const sortedPhotos = [...photos].sort((a, b) => {
      const ta = a.data.capturedAt?.toMillis?.() ?? 0;
      const tb = b.data.capturedAt?.toMillis?.() ?? 0;
      return ta - tb;
    });

    // Map storyEventId -> newEventId once we generate them, so AlbumPhoto.eventId
    // refers to the TripEvent (not the storyboard Event).
    const newTripRef = db.collection('trips').doc();
    const newTripId = newTripRef.id;

    const eventIdMap = new Map<string, string>();
    for (const ev of events) {
      const newEventRef = db
        .collection('trips')
        .doc(newTripId)
        .collection('events')
        .doc();
      eventIdMap.set(ev.id, newEventRef.id);
    }

    const albumPhotos: AlbumPhotoOut[] = sortedPhotos
      .map((p) => {
        const url = p.data.thumbnailUrl ?? p.data.mediumUrl ?? p.data.fullUrl;
        if (!url) return null;
        const photo: AlbumPhotoOut = {
          url,
          date: tsToYmd(p.data.capturedAt),
          uploadedAt: tsToIso(p.data.uploadedAt),
          optimized: true,
        };
        if (p.data.fullUrl) {
          photo.fullUrl = p.data.fullUrl;
        }
        if (p.data.eventId) {
          const mapped = eventIdMap.get(p.data.eventId);
          if (mapped) photo.eventId = mapped;
        }
        return photo;
      })
      .filter((p): p is AlbumPhotoOut => p !== null);

    const nowIso = new Date().toISOString();

    // 6. Build TripEvent docs
    const tripEventDocs: Array<{
      ref: FirebaseFirestore.DocumentReference;
      data: Record<string, unknown>;
    }> = [];

    for (const { id: storyEventId, data: ev } of events) {
      const newEventId = eventIdMap.get(storyEventId);
      if (!newEventId) continue;
      const day = daysById.get(ev.dayId);
      const eventDate = day?.date ?? minDate;
      const startTime = pickStartTime(ev.startTime, eventDate);
      const endTime = pickEndTime(ev.endTime, startTime);
      const photoUrls: string[] = [];
      for (const pid of ev.photoIds ?? []) {
        const found = photos.find((p) => p.id === pid);
        if (!found) continue;
        const url = found.data.thumbnailUrl ?? found.data.mediumUrl ?? found.data.fullUrl;
        if (url) photoUrls.push(url);
      }
      const tripEvent: Record<string, unknown> = {
        title: ev.title ?? day?.title ?? 'Evento',
        type: 'activity',
        date: eventDate,
        startTime,
        endTime,
        location: ev.location ?? day?.primaryLocation ?? '',
        notes: '',
        cost: 0,
        currency: 'MXN',
        attachments: [],
        autoGenerated: true,
        // Back-link to the originating story so the client can match
        // open questions against this TripEvent. The day id is included
        // so day-level questions can also be mapped without an extra fetch.
        metadata: {
          storyId,
          storyEventId,
          storyDayId: ev.dayId,
        },
        createdBy: userId,
        createdAt: nowIso,
      };
      // Defensive: only propagate coords that look like real lat/lng in range.
      // A bug in some EXIF readers strips GPSLatitudeRef/GPSLongitudeRef and
      // returns the unsigned magnitude (lng -99 -> 99 = China). The client
      // re-applies the ref now, but stories converted before that fix may
      // still hold sign-mangled centroids — drop anything out of bounds.
      const lat = ev.coordinates?.lat;
      const lng = ev.coordinates?.lng;
      const latOk =
        typeof lat === 'number' && !Number.isNaN(lat) && lat >= -90 && lat <= 90;
      const lngOk =
        typeof lng === 'number' && !Number.isNaN(lng) && lng >= -180 && lng <= 180;
      if (latOk && lngOk) {
        tripEvent.latitude = lat;
        tripEvent.longitude = lng;
      }
      if (photoUrls.length > 0) tripEvent.photos = photoUrls;

      tripEventDocs.push({
        ref: db
          .collection('trips')
          .doc(newTripId)
          .collection('events')
          .doc(newEventId),
        data: tripEvent,
      });
    }

    // 7. Build the Trip doc itself.
    // NOTE: photos are NOT inlined into trip.albumPhotos any more. They
    // live as individual docs under /trips/{newTripId}/photos/{photoId}
    // and are written below as part of the same batch. Keeping the trip
    // doc small is the whole point of the migration.
    const tripDoc: Record<string, unknown> = {
      title,
      destination,
      startDate: minDate,
      endDate: maxDate,
      description: '',
      coverImage: null,
      createdBy: userId,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'completed',
      travelerIds: [],
      photoCount: albumPhotos.length,
    };

    // Member doc — matches TripMember (uid, email omitted since service has
    // no access to user profile; client app fills this on demand).
    const memberDoc: Record<string, unknown> = {
      uid: userId,
      email: '',
      displayName: '',
      role: 'owner',
      joinedAt: nowIso,
      invitedBy: userId,
    };

    // 8. Commit everything. We chunk events by 450 to stay under the 500-op
    //    Firestore batch limit (counting trip + member + event docs).
    let batch = db.batch();
    let opCount = 0;
    const commitIfFull = async (): Promise<void> => {
      if (opCount >= FIRESTORE_BATCH_LIMIT - 50) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    // Trip doc
    batch.set(newTripRef, tripDoc);
    opCount++;

    // Member doc
    batch.set(
      db.collection('trips').doc(newTripId).collection('members').doc(userId),
      memberDoc,
    );
    opCount++;

    // Event docs
    for (const { ref, data } of tripEventDocs) {
      batch.set(ref, data);
      opCount++;
      await commitIfFull();
    }

    // Photo docs — one per AlbumPhotoOut, in the /trips/{id}/photos
    // subcollection. Doc id is derived from the storage path inside the
    // url so re-running the conversion is idempotent.
    const tripPhotosCol = db.collection('trips').doc(newTripId).collection('photos');
    for (const photo of albumPhotos) {
      const photoId = photoIdFromUrl(photo.url);
      batch.set(tripPhotosCol.doc(photoId), {
        ...photo,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      opCount++;
      await commitIfFull();
    }

    // Update the story to record the new tripId
    batch.update(storyRef, {
      tripId: newTripId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    opCount++;

    await batch.commit();

    return { tripId: newTripId, storyId };
  },
};
