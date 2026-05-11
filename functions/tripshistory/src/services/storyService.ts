/**
 * Story service — CRUD operations for trip stories backed by Firestore.
 *
 * Documents live at /users/{userId}/tripstories/{storyId}.
 * Recursive delete cascades all child subcollections
 * (photos, questions, days, events).
 */
import type {
  CreateStoryRequest,
  Story,
  StoryStatus,
  ApproximateDates,
} from '../models/types';
import { HttpError } from '../middleware/errors';
import { db, paths, admin } from '../lib/firestore';

type FirestoreTimestamp = admin.firestore.Timestamp;

interface StoredStory {
  userId: string;
  tripId: string | null;
  title?: string;
  status: StoryStatus;
  photoCount: number;
  dayCount: number;
  eventCount: number;
  pendingQuestionCount: number;
  approximateDates?: ApproximateDates;
  createdAt?: FirestoreTimestamp | admin.firestore.FieldValue;
  updatedAt?: FirestoreTimestamp | admin.firestore.FieldValue;
}

/**
 * Convert a Firestore Timestamp (or already-serialized value) to ISO 8601.
 * Falls back to current time if the field is missing (e.g. just-written
 * doc whose serverTimestamp has not yet resolved on read).
 */
function timestampToIso(
  ts: FirestoreTimestamp | Date | string | undefined | null,
): string {
  if (!ts) {
    return new Date().toISOString();
  }
  if (typeof ts === 'string') {
    return ts;
  }
  if (ts instanceof Date) {
    return ts.toISOString();
  }
  // Firestore Timestamp
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') {
    return maybe.toDate().toISOString();
  }
  return new Date().toISOString();
}

function serializeStory(id: string, data: StoredStory): Story {
  const story: Story = {
    id,
    userId: data.userId,
    tripId: data.tripId ?? null,
    status: data.status,
    photoCount: data.photoCount ?? 0,
    dayCount: data.dayCount ?? 0,
    eventCount: data.eventCount ?? 0,
    pendingQuestionCount: data.pendingQuestionCount ?? 0,
    createdAt: timestampToIso(data.createdAt as FirestoreTimestamp | undefined),
    updatedAt: timestampToIso(data.updatedAt as FirestoreTimestamp | undefined),
  };
  if (data.title !== undefined) {
    story.title = data.title;
  }
  return story;
}

export const storyService = {
  async create(userId: string, body: CreateStoryRequest): Promise<Story> {
    const ref = db.collection(paths.storiesCollection(userId)).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const stored: StoredStory = {
      userId,
      tripId: body.tripId ?? null,
      title: body.title ?? 'Untitled story',
      status: 'draft',
      photoCount: 0,
      dayCount: 0,
      eventCount: 0,
      pendingQuestionCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (body.approximateDates) {
      stored.approximateDates = body.approximateDates;
    }

    await ref.set(stored);

    // Serialize for response. serverTimestamp() hasn't materialized yet,
    // so fall back to local now() for the immediate response.
    const nowIso = new Date().toISOString();
    const responseStory: Story = {
      id: ref.id,
      userId,
      tripId: stored.tripId,
      status: stored.status,
      photoCount: 0,
      dayCount: 0,
      eventCount: 0,
      pendingQuestionCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    if (stored.title !== undefined) {
      responseStory.title = stored.title;
    }
    return responseStory;
  },

  async get(userId: string, storyId: string): Promise<Story> {
    if (!storyId) {
      throw HttpError.notFound('Story not found');
    }
    const snap = await db.doc(paths.story(userId, storyId)).get();
    if (!snap.exists) {
      throw HttpError.notFound('Story not found');
    }
    const data = snap.data() as StoredStory;
    return serializeStory(snap.id, data);
  },

  /**
   * List stories owned by `userId`, optionally filtered by `tripId`
   * and/or `status`. Ordered by updatedAt desc and capped at 50 results
   * (no pagination for MVP — see plan).
   */
  async list(
    userId: string,
    filters: { tripId?: string; status?: StoryStatus } = {},
  ): Promise<Story[]> {
    let q: FirebaseFirestore.Query = db.collection(
      paths.storiesCollection(userId),
    );
    if (filters.tripId) {
      q = q.where('tripId', '==', filters.tripId);
    }
    if (filters.status) {
      q = q.where('status', '==', filters.status);
    }
    q = q.orderBy('updatedAt', 'desc').limit(50);

    const snap = await q.get();
    return snap.docs.map((d) => serializeStory(d.id, d.data() as StoredStory));
  },

  async delete(userId: string, storyId: string): Promise<void> {
    if (!storyId) {
      throw HttpError.notFound('Story not found');
    }
    const ref = db.doc(paths.story(userId, storyId));

    // Verify existence first so we surface 404 instead of silently succeeding.
    const snap = await ref.get();
    if (!snap.exists) {
      throw HttpError.notFound('Story not found');
    }

    // recursiveDelete cascades all subcollections (photos, questions,
    // days, events). Uses an internal BulkWriter so we don't have to
    // chunk by 500 ourselves.
    await db.recursiveDelete(ref);
  },
};
