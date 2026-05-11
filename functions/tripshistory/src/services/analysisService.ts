/**
 * Analysis service — automatic photo analysis state.
 *
 * Reads the photos subcollection, groups by day, clusters by temporal
 * gaps (>90 min), and counts duplicate groups via perceptual-hash
 * Hamming distance (≤10 bits) within the same day.
 *
 * `enqueueReanalysis` runs synchronously for the MVP: it materializes
 * Day and Event docs from the detected clusters, assigns each Photo
 * to a dayId/eventId, advances the Story status from `analyzing`
 * → `questioning`, then triggers questionService to seed questions.
 */
import type {
  AnalysisState,
  DetectedCluster,
  DetectedDay,
  StoryStatus,
} from '../models/types';
import { db, paths, admin } from '../lib/firestore';
import { questionService } from './questionService';

// ─────────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────────

/** Gap (ms) that splits one event-cluster from the next. */
const CLUSTER_GAP_MS = 90 * 60 * 1000;

/** Max hex-Hamming distance for two pHashes to be considered duplicates. */
const DUP_HAMMING_MAX = 10;

// ─────────────────────────────────────────────────────────────────
// Internal shapes (what we read from Firestore — keep loose)
// ─────────────────────────────────────────────────────────────────

interface StoredPhotoLite {
  id: string;
  capturedAt?: admin.firestore.Timestamp | string | Date;
  timezone?: string;
  location?: { lat?: number; lng?: number } | null;
  perceptualHash?: string;
  blurScore?: number;
}

interface StoredStoryLite {
  status?: StoryStatus;
  title?: string;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function toDate(value: StoredPhotoLite['capturedAt']): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate();
  return null;
}

/**
 * Format a Date as YYYY-MM-DD honoring the given IANA timezone.
 * Falls back to UTC if timezone is missing or invalid.
 */
function dateKey(d: Date, timezone?: string): string {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      if (y && m && day) return `${y}-${m}-${day}`;
    } catch {
      // fall through to UTC
    }
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Format a YYYY-MM-DD string as a Spanish human-readable day.
 * Example: "2025-08-12" → "12 de agosto de 2025".
 */
function spanishLongDate(dateStr: string): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d || m < 1 || m > 12) return dateStr;
  return `${d} de ${months[m - 1]} de ${y}`;
}

function hexNibbleToBits(c: string): number {
  const n = parseInt(c, 16);
  return isNaN(n) ? 0 : n;
}

/**
 * Hamming distance between two hex strings (case-insensitive).
 * Returns Infinity if either string is empty or they differ in length
 * — callers should treat that as "not comparable".
 */
function hammingHex(a: string, b: string): number {
  if (!a || !b) return Infinity;
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = hexNibbleToBits(a[i]) ^ hexNibbleToBits(b[i]);
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/** Count groups in a connected-components sense over a same-day photo list. */
function countDuplicateGroups(photos: StoredPhotoLite[]): number {
  const hashed = photos.filter((p) => typeof p.perceptualHash === 'string' && p.perceptualHash!.length > 0);
  if (hashed.length < 2) return 0;

  // Union-find
  const parent = hashed.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const nx = parent[x];
      parent[x] = r;
      x = nx;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < hashed.length; i++) {
    for (let j = i + 1; j < hashed.length; j++) {
      const dist = hammingHex(hashed[i].perceptualHash!, hashed[j].perceptualHash!);
      if (dist <= DUP_HAMMING_MAX) union(i, j);
    }
  }

  const rootCounts = new Map<number, number>();
  for (let i = 0; i < hashed.length; i++) {
    const r = find(i);
    rootCounts.set(r, (rootCounts.get(r) ?? 0) + 1);
  }
  let groups = 0;
  for (const count of rootCounts.values()) {
    if (count >= 2) groups++;
  }
  return groups;
}

interface RawCluster {
  photos: StoredPhotoLite[];
  startTime: Date;
  endTime: Date;
  hasLocation: boolean;
}

/**
 * Cluster a single day's photos by temporal gap > CLUSTER_GAP_MS.
 * Assumes input is already date-sorted ascending.
 */
function clusterDay(dayPhotos: StoredPhotoLite[]): RawCluster[] {
  const clusters: RawCluster[] = [];
  let current: RawCluster | null = null;

  for (const p of dayPhotos) {
    const d = toDate(p.capturedAt);
    if (!d) continue;
    const hasGeo =
      !!p.location &&
      typeof p.location.lat === 'number' &&
      typeof p.location.lng === 'number';

    if (!current) {
      current = { photos: [p], startTime: d, endTime: d, hasLocation: hasGeo };
      continue;
    }
    const gap = d.getTime() - current.endTime.getTime();
    if (gap > CLUSTER_GAP_MS) {
      clusters.push(current);
      current = { photos: [p], startTime: d, endTime: d, hasLocation: hasGeo };
    } else {
      current.photos.push(p);
      current.endTime = d;
      current.hasLocation = current.hasLocation || hasGeo;
    }
  }
  if (current) clusters.push(current);
  return clusters;
}

async function readPhotosLite(
  userId: string,
  storyId: string,
): Promise<StoredPhotoLite[]> {
  const snap = await db.collection(paths.photosCollection(userId, storyId)).get();
  const out: StoredPhotoLite[] = [];
  snap.forEach((doc) => {
    const data = doc.data() as Omit<StoredPhotoLite, 'id'>;
    out.push({ id: doc.id, ...data });
  });
  return out;
}

async function readStoryLite(
  userId: string,
  storyId: string,
): Promise<StoredStoryLite | null> {
  const snap = await db.doc(paths.story(userId, storyId)).get();
  if (!snap.exists) return null;
  return snap.data() as StoredStoryLite;
}

/**
 * Run cluster+day detection and return the photos grouped by day,
 * plus the raw clusters in chronological order. Used by both
 * getState (read-only) and enqueueReanalysis (writes).
 */
function detect(photos: StoredPhotoLite[]): {
  byDay: Map<string, StoredPhotoLite[]>;
  clustersInOrder: { dateKey: string; cluster: RawCluster }[];
  photosWithDates: number;
  photosWithGps: number;
} {
  let photosWithDates = 0;
  let photosWithGps = 0;

  const byDay = new Map<string, StoredPhotoLite[]>();
  for (const p of photos) {
    const d = toDate(p.capturedAt);
    if (!d) continue;
    photosWithDates++;
    if (
      p.location &&
      typeof p.location.lat === 'number' &&
      typeof p.location.lng === 'number'
    ) {
      photosWithGps++;
    }
    const key = dateKey(d, p.timezone);
    let bucket = byDay.get(key);
    if (!bucket) {
      bucket = [];
      byDay.set(key, bucket);
    }
    bucket.push(p);
  }

  // sort each day's bucket by capturedAt asc
  for (const arr of byDay.values()) {
    arr.sort((a, b) => {
      const da = toDate(a.capturedAt)?.getTime() ?? 0;
      const db_ = toDate(b.capturedAt)?.getTime() ?? 0;
      return da - db_;
    });
  }

  const clustersInOrder: { dateKey: string; cluster: RawCluster }[] = [];
  const dateKeysSorted = Array.from(byDay.keys()).sort();
  for (const key of dateKeysSorted) {
    const dayPhotos = byDay.get(key)!;
    const clusters = clusterDay(dayPhotos);
    for (const c of clusters) {
      clustersInOrder.push({ dateKey: key, cluster: c });
    }
  }

  return { byDay, clustersInOrder, photosWithDates, photosWithGps };
}

export const analysisService = {
  async getState(userId: string, storyId: string): Promise<AnalysisState> {
    const [photos, story] = await Promise.all([
      readPhotosLite(userId, storyId),
      readStoryLite(userId, storyId),
    ]);

    const { byDay, clustersInOrder, photosWithDates, photosWithGps } = detect(photos);

    const detectedDays: DetectedDay[] = Array.from(byDay.entries())
      .map(([date, arr]) => ({ date, photoCount: arr.length }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const detectedClusters: DetectedCluster[] = clustersInOrder.map((entry, idx) => ({
      clusterId: `cluster_${idx + 1}`,
      startTime: entry.cluster.startTime.toISOString(),
      endTime: entry.cluster.endTime.toISOString(),
      photoCount: entry.cluster.photos.length,
      hasLocation: entry.cluster.hasLocation,
    }));

    // Duplicate groups — count per day, then sum (avoids O(N^2) across all photos).
    let duplicateGroups = 0;
    for (const arr of byDay.values()) {
      duplicateGroups += countDuplicateGroups(arr);
    }

    return {
      status: (story?.status ?? 'draft') as StoryStatus,
      photoCount: photos.length,
      photosWithGps,
      photosWithDates,
      detectedDays,
      detectedClusters,
      duplicateGroups,
      lastAnalyzedAt: nowIso(),
    };
  },

  /**
   * Synchronously materialize Day + Event docs from clusters, assign
   * Photos to those, update Story counters/status, and seed questions.
   * Idempotent: deterministic doc IDs let it run again after new photos.
   */
  async enqueueReanalysis(userId: string, storyId: string): Promise<void> {
    const photos = await readPhotosLite(userId, storyId);
    const { byDay, clustersInOrder } = detect(photos);

    const daysCol = db.collection(paths.daysCollection(userId, storyId));
    const eventsCol = db.collection(paths.eventsCollection(userId, storyId));

    // Wipe existing days/events so re-analysis is deterministic.
    // We keep Photo docs but clear their dayId/eventId in a batch below.
    const existingDays = await daysCol.get();
    const existingEvents = await eventsCol.get();

    let batch = db.batch();
    let opCount = 0;
    const commitIfFull = async (): Promise<void> => {
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    for (const doc of existingDays.docs) {
      batch.delete(doc.ref);
      opCount++;
      await commitIfFull();
    }
    for (const doc of existingEvents.docs) {
      batch.delete(doc.ref);
      opCount++;
      await commitIfFull();
    }

    // Sort days chronologically and build Day docs.
    const sortedDayKeys = Array.from(byDay.keys()).sort();

    // Map dateKey → dayId. Use deterministic doc ID = `day-{YYYY-MM-DD}`.
    const dayIdByDate = new Map<string, string>();
    for (let i = 0; i < sortedDayKeys.length; i++) {
      const date = sortedDayKeys[i];
      const dayId = `day-${date}`;
      dayIdByDate.set(date, dayId);

      const dayPhotos = byDay.get(date)!;
      const ref = daysCol.doc(dayId);
      const stored: Record<string, unknown> = {
        storyId,
        date,
        title: `Día ${i + 1} — ${spanishLongDate(date)}`,
        photoCount: dayPhotos.length,
        eventIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, stored);
      opCount++;
      await commitIfFull();
    }

    // Build Event docs grouped per day. eventIds get added to the
    // Day docs in a second pass once we know their IDs.
    const eventIdsByDay = new Map<string, string[]>();
    const photoAssignments = new Map<string, { dayId: string; eventId: string }>();

    let clusterCounter = 0;
    for (const entry of clustersInOrder) {
      clusterCounter++;
      const dayId = dayIdByDate.get(entry.dateKey);
      if (!dayId) continue; // shouldn't happen
      const eventId = `event-${entry.dateKey}-${clusterCounter}`;

      const c = entry.cluster;
      const photoIds = c.photos.map((p) => p.id);

      // Compute centroid coordinates if we have any.
      let coordinates: { lat: number; lng: number } | undefined;
      const geoPts = c.photos.filter(
        (p) =>
          !!p.location &&
          typeof p.location.lat === 'number' &&
          typeof p.location.lng === 'number',
      );
      if (geoPts.length > 0) {
        let latSum = 0;
        let lngSum = 0;
        for (const p of geoPts) {
          latSum += p.location!.lat as number;
          lngSum += p.location!.lng as number;
        }
        coordinates = {
          lat: latSum / geoPts.length,
          lng: lngSum / geoPts.length,
        };
      }

      const eventRef = eventsCol.doc(eventId);
      const eventDoc: Record<string, unknown> = {
        storyId,
        dayId,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime.toISOString(),
        photoIds,
        photoCount: photoIds.length,
        highlightPhotoIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (coordinates) eventDoc.coordinates = coordinates;
      batch.set(eventRef, eventDoc);
      opCount++;
      await commitIfFull();

      const list = eventIdsByDay.get(dayId) ?? [];
      list.push(eventId);
      eventIdsByDay.set(dayId, list);

      for (const pid of photoIds) {
        photoAssignments.set(pid, { dayId, eventId });
      }
    }

    // Second pass on Day docs: write eventIds.
    for (const [dayId, eventIds] of eventIdsByDay.entries()) {
      const ref = daysCol.doc(dayId);
      batch.update(ref, { eventIds });
      opCount++;
      await commitIfFull();
    }

    // Assign / clear dayId & eventId on every Photo we know about.
    const photosCol = db.collection(paths.photosCollection(userId, storyId));
    for (const p of photos) {
      const assignment = photoAssignments.get(p.id);
      const update: Record<string, unknown> = assignment
        ? { dayId: assignment.dayId, eventId: assignment.eventId }
        : { dayId: null, eventId: null };
      batch.update(photosCol.doc(p.id), update);
      opCount++;
      await commitIfFull();
    }

    // Update the Story doc — counters + status transition.
    const storyRef = db.doc(paths.story(userId, storyId));
    const storySnap = await storyRef.get();
    const currentStatus = (storySnap.exists
      ? (storySnap.data() as StoredStoryLite).status
      : undefined) as StoryStatus | undefined;

    const nextStatus: StoryStatus =
      currentStatus === 'analyzing' || currentStatus === 'draft'
        ? 'questioning'
        : currentStatus ?? 'questioning';

    batch.update(storyRef, {
      dayCount: sortedDayKeys.length,
      eventCount: clusterCounter,
      photoCount: photos.length,
      status: nextStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    opCount++;

    await batch.commit();

    // Seed questions based on the freshly written structure.
    await questionService.generateForStory(userId, storyId);
  },
};
