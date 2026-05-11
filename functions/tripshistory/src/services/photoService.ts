/**
 * Photo service — batch ingestion and listing backed by Firestore.
 *
 * Photos live at /users/{userId}/tripstories/{storyId}/photos/{photoId}
 * where photoId === clientId (so a retried upload is idempotent).
 *
 * capturedAt is stored as a Firestore Timestamp (so we can range-query
 * across day boundaries) and serialized back as ISO 8601 to clients.
 * createdAt and uploadedAt are written with serverTimestamp() and
 * serialized as ISO 8601 on read.
 */
import type {
  PhotoBatch,
  PhotoMetadata,
  PhotoBatchResponse,
  Photo,
  PhotoListResponse,
  GeoLocation,
  Dimensions,
} from '../models/types';
import { HttpError } from '../middleware/errors';
import { db, paths, admin } from '../lib/firestore';

type FirestoreTimestamp = admin.firestore.Timestamp;
type FirestoreDocSnap =
  FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>;

const FIRESTORE_BATCH_LIMIT = 500;

export interface ListPhotosOptions {
  dayId?: string;
  eventId?: string;
  limit?: number;
  cursor?: string;
}

interface StoredPhoto {
  clientId: string;
  storyId: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  fullUrl?: string;
  capturedAt: FirestoreTimestamp;
  timezone?: string;
  location?: GeoLocation;
  dimensions?: Dimensions;
  perceptualHash?: string;
  blurScore?: number;
  sizeBytes?: number;
  mimeType?: string;
  dayId: string | null;
  eventId: string | null;
  isDuplicate: boolean;
  isHighlight: boolean;
  createdAt?: FirestoreTimestamp | admin.firestore.FieldValue;
  uploadedAt?: FirestoreTimestamp | admin.firestore.FieldValue;
}

/**
 * Convert a Firestore Timestamp (or already-serialized value) to ISO 8601.
 */
function timestampToIso(
  ts: FirestoreTimestamp | Date | string | undefined | null,
): string | undefined {
  if (ts === undefined || ts === null) {
    return undefined;
  }
  if (typeof ts === 'string') {
    return ts;
  }
  if (ts instanceof Date) {
    return ts.toISOString();
  }
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') {
    return maybe.toDate().toISOString();
  }
  return undefined;
}

function parseCapturedAt(iso: string): FirestoreTimestamp | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return admin.firestore.Timestamp.fromDate(d);
}

/**
 * Strip undefined fields so Firestore doesn't reject the write
 * (Firestore disallows `undefined` values).
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

function serializePhoto(id: string, data: StoredPhoto): Photo {
  const capturedAtIso = timestampToIso(data.capturedAt) ?? new Date(0).toISOString();
  const photo: Photo = {
    id,
    storyId: data.storyId,
    clientId: data.clientId,
    capturedAt: capturedAtIso,
    dayId: data.dayId ?? null,
    eventId: data.eventId ?? null,
    isDuplicate: data.isDuplicate ?? false,
    isHighlight: data.isHighlight ?? false,
  };
  if (data.thumbnailUrl !== undefined) photo.thumbnailUrl = data.thumbnailUrl;
  if (data.mediumUrl !== undefined) photo.mediumUrl = data.mediumUrl;
  if (data.fullUrl !== undefined) photo.fullUrl = data.fullUrl;
  if (data.timezone !== undefined) photo.timezone = data.timezone;
  if (data.location !== undefined) photo.location = data.location;
  if (data.dimensions !== undefined) photo.dimensions = data.dimensions;
  if (data.perceptualHash !== undefined) photo.perceptualHash = data.perceptualHash;
  if (data.blurScore !== undefined) photo.blurScore = data.blurScore;
  if (data.sizeBytes !== undefined) photo.sizeBytes = data.sizeBytes;
  if (data.mimeType !== undefined) photo.mimeType = data.mimeType;
  const uploadedIso = timestampToIso(
    data.uploadedAt as FirestoreTimestamp | undefined,
  );
  if (uploadedIso) photo.uploadedAt = uploadedIso;
  return photo;
}

/**
 * Encode/decode cursor as base64 of "<capturedAtMillis>|<docId>" so it
 * pairs with our orderBy(capturedAt asc, __name__ asc).
 */
function encodeCursor(capturedAtMillis: number, docId: string): string {
  return Buffer.from(`${capturedAtMillis}|${docId}`, 'utf8').toString('base64');
}

function decodeCursor(
  cursor: string,
): { capturedAtMillis: number; docId: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const [millisStr, docId] = raw.split('|');
    const millis = Number.parseInt(millisStr, 10);
    if (!Number.isFinite(millis) || !docId) return null;
    return { capturedAtMillis: millis, docId };
  } catch {
    return null;
  }
}

export const photoService = {
  async ingestBatch(
    userId: string,
    storyId: string,
    batch: PhotoBatch,
  ): Promise<PhotoBatchResponse> {
    const storyRef = db.doc(paths.story(userId, storyId));
    const storySnap = await storyRef.get();
    if (!storySnap.exists) {
      throw HttpError.notFound('Story not found');
    }
    const storyData = storySnap.data() as { status?: string } | undefined;

    // Validate each photo. Reject (without throwing) the ones with bad
    // capturedAt — the spec calls this a soft rejection.
    const valid: Array<{ photoId: string; data: StoredPhoto }> = [];
    let photosRejected = 0;
    const rejectionReasons: string[] = [];

    for (const p of batch.photos) {
      const ts = parseCapturedAt(p.capturedAt);
      if (!ts) {
        photosRejected += 1;
        if (!rejectionReasons.includes('invalid_captured_at')) {
          rejectionReasons.push('invalid_captured_at');
        }
        continue;
      }
      const stored: StoredPhoto = {
        clientId: p.clientId,
        storyId,
        capturedAt: ts,
        dayId: null,
        eventId: null,
        isDuplicate: false,
        isHighlight: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      assignOptional(stored, p);
      valid.push({ photoId: p.clientId, data: stored });
    }

    // Detect which clientIds already exist so we don't double-count when
    // bumping photoCount. Firestore docRef.get() per id would be O(N);
    // a single getAll() is cheaper.
    const photosColl = db.collection(paths.photosCollection(userId, storyId));
    const refs = valid.map(({ photoId }) => photosColl.doc(photoId));
    const existingSnaps = refs.length > 0 ? await db.getAll(...refs) : [];
    const existingIds = new Set<string>();
    for (const snap of existingSnaps) {
      if (snap.exists) {
        existingIds.add(snap.id);
      }
    }

    // Batched writes — chunked at 500. We use set(..., {merge:true}) so a
    // retry doesn't clobber server-assigned fields like dayId/eventId once
    // analysis has run.
    let i = 0;
    while (i < valid.length) {
      const chunk = valid.slice(i, i + FIRESTORE_BATCH_LIMIT);
      const writeBatch = db.batch();
      for (const { photoId, data } of chunk) {
        const ref = photosColl.doc(photoId);
        // stripUndefined: Firestore rejects undefined values.
        writeBatch.set(ref, stripUndefined(data as unknown as Record<string, unknown>), {
          merge: true,
        });
      }
      await writeBatch.commit();
      i += FIRESTORE_BATCH_LIMIT;
    }

    // Update parent story: increment photoCount by NEW photos only;
    // flip status draft → analyzing on first ingest.
    const newPhotoCount = valid.filter(
      ({ photoId }) => !existingIds.has(photoId),
    ).length;

    const storyUpdate: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (newPhotoCount > 0) {
      storyUpdate.photoCount = admin.firestore.FieldValue.increment(newPhotoCount);
    }
    if (storyData?.status === 'draft' && valid.length > 0) {
      storyUpdate.status = 'analyzing';
    }
    if (Object.keys(storyUpdate).length > 1 || newPhotoCount > 0) {
      await storyRef.update(storyUpdate);
    }

    return {
      storyId,
      photosReceived: valid.length,
      photosRejected,
      rejectionReasons,
    };
  },

  async list(
    userId: string,
    storyId: string,
    opts: ListPhotosOptions,
  ): Promise<PhotoListResponse> {
    const storyRef = db.doc(paths.story(userId, storyId));
    const storyExists = await storyRef.get();
    if (!storyExists.exists) {
      throw HttpError.notFound('Story not found');
    }

    const photosColl = db.collection(paths.photosCollection(userId, storyId));
    const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));

    let q: FirebaseFirestore.Query = photosColl;
    if (opts.dayId) {
      q = q.where('dayId', '==', opts.dayId);
    }
    if (opts.eventId) {
      q = q.where('eventId', '==', opts.eventId);
    }
    q = q.orderBy('capturedAt', 'asc').orderBy(admin.firestore.FieldPath.documentId(), 'asc');

    if (opts.cursor) {
      const decoded = decodeCursor(opts.cursor);
      if (decoded) {
        const cursorTs = admin.firestore.Timestamp.fromMillis(decoded.capturedAtMillis);
        q = q.startAfter(cursorTs, decoded.docId);
      }
    }

    // Pull one extra to know whether there's a next page.
    const snap = await q.limit(limit + 1).get();
    const docs: FirestoreDocSnap[] = snap.docs.slice(0, limit);
    const hasMore = snap.docs.length > limit;

    const photos: Photo[] = docs.map((d) =>
      serializePhoto(d.id, d.data() as StoredPhoto),
    );

    let nextCursor: string | null = null;
    if (hasMore && docs.length > 0) {
      const last = docs[docs.length - 1];
      const lastData = last.data() as StoredPhoto;
      const millis = (lastData.capturedAt as FirestoreTimestamp).toMillis();
      nextCursor = encodeCursor(millis, last.id);
    }

    // Total — unfiltered count of the story's photos.
    let total = 0;
    try {
      const agg = await photosColl.count().get();
      total = agg.data().count;
    } catch {
      // count() requires Firestore SDK >= 6 + Datastore mode quirks; fall
      // back to photos.length if aggregation is unavailable.
      total = photos.length;
    }

    return {
      photos,
      nextCursor,
      total,
    };
  },
};

// ─────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────

function assignOptional(stored: StoredPhoto, p: PhotoMetadata): void {
  if (p.thumbnailUrl !== undefined) stored.thumbnailUrl = p.thumbnailUrl;
  if (p.mediumUrl !== undefined) stored.mediumUrl = p.mediumUrl;
  if (p.fullUrl !== undefined) stored.fullUrl = p.fullUrl;
  if (p.timezone !== undefined) stored.timezone = p.timezone;
  if (p.location !== undefined) stored.location = p.location;
  if (p.dimensions !== undefined) stored.dimensions = p.dimensions;
  if (p.perceptualHash !== undefined) stored.perceptualHash = p.perceptualHash;
  if (p.blurScore !== undefined) stored.blurScore = p.blurScore;
  if (p.sizeBytes !== undefined) stored.sizeBytes = p.sizeBytes;
  if (p.mimeType !== undefined) stored.mimeType = p.mimeType;
}
