/**
 * Storyboard service — assembles the final hierarchical view and
 * supports edits to Day / Event docs.
 *
 * Reads Story + Days + Events + Photos from their subcollections;
 * writes through Firestore directly (no transactions for now —
 * single-user collections, low contention).
 */
import type {
  Day,
  DayPatch,
  DayWithEvents,
  Event,
  EventPatch,
  Storyboard,
} from '../models/types';
import { HttpError } from '../middleware/errors';
import { db, paths, admin } from '../lib/firestore';
import { storyService } from './storyService';

// ─────────────────────────────────────────────────────────────────
// Internal shapes
// ─────────────────────────────────────────────────────────────────

interface StoredDay {
  storyId: string;
  date: string;
  title?: string;
  summary?: string;
  coverPhotoId?: string;
  eventIds?: string[];
  photoCount?: number;
  primaryLocation?: string;
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
  photoCount?: number;
}

// ─────────────────────────────────────────────────────────────────
// Serializers
// ─────────────────────────────────────────────────────────────────

function serializeDay(id: string, data: StoredDay): Day {
  const day: Day = {
    id,
    storyId: data.storyId,
    date: data.date,
  };
  if (data.title !== undefined) day.title = data.title;
  if (data.summary !== undefined) day.summary = data.summary;
  if (data.coverPhotoId !== undefined) day.coverPhotoId = data.coverPhotoId;
  if (data.eventIds !== undefined) day.eventIds = data.eventIds;
  if (data.photoCount !== undefined) day.photoCount = data.photoCount;
  if (data.primaryLocation !== undefined) day.primaryLocation = data.primaryLocation;
  return day;
}

function serializeEvent(id: string, data: StoredEvent): Event {
  const ev: Event = {
    id,
    storyId: data.storyId,
    dayId: data.dayId,
  };
  if (data.title !== undefined) ev.title = data.title;
  if (data.startTime !== undefined) ev.startTime = data.startTime;
  if (data.endTime !== undefined) ev.endTime = data.endTime;
  if (data.location !== undefined) ev.location = data.location;
  if (
    data.coordinates &&
    typeof data.coordinates.lat === 'number' &&
    typeof data.coordinates.lng === 'number'
  ) {
    ev.coordinates = { lat: data.coordinates.lat, lng: data.coordinates.lng };
  }
  if (data.photoIds !== undefined) ev.photoIds = data.photoIds;
  if (data.highlightPhotoIds !== undefined) ev.highlightPhotoIds = data.highlightPhotoIds;
  if (data.photoCount !== undefined) ev.photoCount = data.photoCount;
  return ev;
}

// ─────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────

export const storyboardService = {
  async get(userId: string, storyId: string): Promise<Storyboard> {
    const story = await storyService.get(userId, storyId);

    const [daysSnap, eventsSnap, unassignedSnap] = await Promise.all([
      db.collection(paths.daysCollection(userId, storyId)).get(),
      db.collection(paths.eventsCollection(userId, storyId)).get(),
      db
        .collection(paths.photosCollection(userId, storyId))
        .where('eventId', '==', null)
        .get(),
    ]);

    const days: Day[] = [];
    daysSnap.forEach((doc) =>
      days.push(serializeDay(doc.id, doc.data() as StoredDay)),
    );
    days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const eventsByDay = new Map<string, Event[]>();
    eventsSnap.forEach((doc) => {
      const ev = serializeEvent(doc.id, doc.data() as StoredEvent);
      const arr = eventsByDay.get(ev.dayId) ?? [];
      arr.push(ev);
      eventsByDay.set(ev.dayId, arr);
    });
    for (const arr of eventsByDay.values()) {
      arr.sort((a, b) => {
        const ta = a.startTime ?? '';
        const tb = b.startTime ?? '';
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
    }

    const daysWithEvents: DayWithEvents[] = days.map((d) => ({
      ...d,
      events: eventsByDay.get(d.id) ?? [],
    }));

    return {
      story,
      days: daysWithEvents,
      unassignedPhotoCount: unassignedSnap.size,
    };
  },

  async patchDay(
    userId: string,
    storyId: string,
    dayId: string,
    patch: DayPatch,
  ): Promise<Day> {
    const ref = db.doc(paths.day(userId, storyId, dayId));
    const snap = await ref.get();
    if (!snap.exists) throw HttpError.notFound('Day not found');

    const update: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.summary !== undefined) update.summary = patch.summary;
    if (patch.coverPhotoId !== undefined) update.coverPhotoId = patch.coverPhotoId;

    await ref.update(update);
    const after = await ref.get();
    return serializeDay(after.id, after.data() as StoredDay);
  },

  async patchEvent(
    userId: string,
    storyId: string,
    eventId: string,
    patch: EventPatch,
  ): Promise<Event> {
    const ref = db.doc(paths.event(userId, storyId, eventId));
    const snap = await ref.get();
    if (!snap.exists) throw HttpError.notFound('Event not found');

    const existing = snap.data() as StoredEvent;
    const existingPhotoIds = existing.photoIds ?? [];

    const removeSet = new Set(patch.removePhotoIds ?? []);
    const addSet = patch.addPhotoIds ?? [];
    const nextPhotoIds = existingPhotoIds
      .filter((p) => !removeSet.has(p))
      .concat(addSet.filter((p) => !existingPhotoIds.includes(p)));

    const update: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.location !== undefined) update.location = patch.location;
    if (patch.startTime !== undefined) update.startTime = patch.startTime;
    if (patch.endTime !== undefined) update.endTime = patch.endTime;
    if (patch.addPhotoIds || patch.removePhotoIds) {
      update.photoIds = nextPhotoIds;
      update.photoCount = nextPhotoIds.length;
    }

    await ref.update(update);

    // Update each touched Photo doc's eventId so the inverse index stays sane.
    let batch = db.batch();
    let opCount = 0;
    const commitIfFull = async (): Promise<void> => {
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    for (const pid of removeSet) {
      batch.update(db.doc(paths.photo(userId, storyId, pid)), { eventId: null });
      opCount++;
      await commitIfFull();
    }
    for (const pid of addSet) {
      batch.update(db.doc(paths.photo(userId, storyId, pid)), {
        eventId,
        dayId: existing.dayId,
      });
      opCount++;
      await commitIfFull();
    }
    if (opCount > 0) await batch.commit();

    const after = await ref.get();
    return serializeEvent(after.id, after.data() as StoredEvent);
  },

  async deleteEvent(userId: string, storyId: string, eventId: string): Promise<void> {
    const ref = db.doc(paths.event(userId, storyId, eventId));
    const snap = await ref.get();
    if (!snap.exists) throw HttpError.notFound('Event not found');

    const data = snap.data() as StoredEvent;
    const photoIds = data.photoIds ?? [];
    const dayId = data.dayId;

    // Clear eventId on each photo (keep dayId, just lose the event link).
    let batch = db.batch();
    let opCount = 0;
    const commitIfFull = async (): Promise<void> => {
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    // If no photoIds stored on the event, fall back to a query so we don't
    // leave dangling references.
    if (photoIds.length === 0) {
      const photosSnap = await db
        .collection(paths.photosCollection(userId, storyId))
        .where('eventId', '==', eventId)
        .get();
      photosSnap.forEach((doc) => {
        batch.update(doc.ref, { eventId: null });
        opCount++;
      });
    } else {
      for (const pid of photoIds) {
        batch.update(db.doc(paths.photo(userId, storyId, pid)), { eventId: null });
        opCount++;
        await commitIfFull();
      }
    }

    // Remove this event from its Day's eventIds array, decrement story counter.
    if (dayId) {
      const dayRef = db.doc(paths.day(userId, storyId, dayId));
      const daySnap = await dayRef.get();
      if (daySnap.exists) {
        const dayData = daySnap.data() as StoredDay;
        const nextEventIds = (dayData.eventIds ?? []).filter((id) => id !== eventId);
        batch.update(dayRef, {
          eventIds: nextEventIds,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        opCount++;
      }
    }

    batch.delete(ref);
    opCount++;
    await batch.commit();

    // Decrement story.eventCount.
    const storyRef = db.doc(paths.story(userId, storyId));
    await storyRef.update({
      eventCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
};
