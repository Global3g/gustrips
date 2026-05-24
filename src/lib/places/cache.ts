/**
 * Cost controls for the Google Places calls behind /api/places.
 *
 * Three independent levers, all best-effort and FAIL-OPEN: if Firestore is
 * unavailable we never block a real request — caching/limits are an
 * optimization, not a hard dependency, and breaking the assistant to save a
 * few cents would be the wrong trade.
 *
 *  1. Cache    — searches keyed by query+location (7d), details by id (30d).
 *                Kills 70-90% of real calls in normal use.
 *  2. Monthly cap — global call counter; hard ceiling against a runaway bill.
 *  3. Trip/day limit — caps searches per trip per day; stops one trip from
 *                burning the budget by accident.
 *
 * Server-only (uses firebase-admin). Do not import from client components.
 */

import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const CACHE_COLLECTION = 'placesCache';
const USAGE_COLLECTION = 'placesUsage';

const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DETAILS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const MONTHLY_MAX_CALLS = Number(process.env.PLACES_MONTHLY_MAX_CALLS) || 2000;
const TRIP_DAILY_MAX = Number(process.env.PLACES_TRIP_DAILY_MAX) || 20;

function db() {
  return getAdminDb();
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayKey(d = new Date()): string {
  return `${monthKey(d)}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Stable, collision-resistant id from an arbitrary string (no crypto needed). */
function hashKey(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // >>> 0 to keep it unsigned; base36 for a short id.
  return (h >>> 0).toString(36) + '-' + input.length.toString(36);
}

/** Round a "lat,lng" to ~110m buckets so nearby searches share a cache entry. */
function bucketLocation(location: string): string {
  if (!location) return '';
  const [latS, lngS] = location.split(',').map((s) => s.trim());
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return location;
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function searchCacheKey(query: string, location: string, radius: string): string {
  const norm = query.toLowerCase().replace(/\s+/g, ' ').trim();
  return 'search:' + hashKey(`${norm}|${bucketLocation(location)}|${radius || ''}`);
}

export function detailsCacheKey(id: string): string {
  return 'details:' + hashKey(id);
}

/** Returns cached payload or null. Never throws. */
export async function getCached<T = unknown>(key: string): Promise<T | null> {
  try {
    const snap = await db().collection(CACHE_COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    const d = snap.data() as { data?: T; expiresAt?: number } | undefined;
    if (!d || typeof d.expiresAt !== 'number' || d.expiresAt < Date.now()) return null;
    return (d.data ?? null) as T | null;
  } catch {
    return null;
  }
}

/** Best-effort cache write. Never throws. */
export async function setCached(key: string, data: unknown, kind: 'search' | 'details'): Promise<void> {
  try {
    const ttl = kind === 'details' ? DETAILS_TTL_MS : SEARCH_TTL_MS;
    await db()
      .collection(CACHE_COLLECTION)
      .doc(key)
      .set({ data, kind, createdAt: Date.now(), expiresAt: Date.now() + ttl });
  } catch {
    // ignore — cache is optional
  }
}

export interface GateResult {
  allowed: boolean;
  /** User-facing message when blocked. */
  reason?: string;
}

/**
 * Check the monthly cap and (when tripId is known) the per-trip daily limit
 * BEFORE making a real Google call. Read-only — does not increment. Fail-open.
 */
export async function checkLimits(tripId?: string): Promise<GateResult> {
  try {
    const monthRef = db().collection(USAGE_COLLECTION).doc(monthKey());
    const monthSnap = await monthRef.get();
    const monthCalls = (monthSnap.data()?.calls as number) || 0;
    if (monthCalls >= MONTHLY_MAX_CALLS) {
      return {
        allowed: false,
        reason:
          'El asistente alcanzó su límite de búsquedas de este mes. Se reactiva el mes que viene.',
      };
    }

    if (tripId) {
      const dayRef = db()
        .collection(USAGE_COLLECTION)
        .doc(`trip_${tripId}_${dayKey()}`);
      const daySnap = await dayRef.get();
      const dayCalls = (daySnap.data()?.calls as number) || 0;
      if (dayCalls >= TRIP_DAILY_MAX) {
        return {
          allowed: false,
          reason:
            'Hiciste muchas búsquedas hoy en este viaje. Probá de nuevo mañana o revisá las que ya hiciste.',
        };
      }
    }

    return { allowed: true };
  } catch {
    // Can't read counters → don't block. Cache + small user base keep cost low.
    return { allowed: true };
  }
}

/** Increment usage counters after a real (non-cached) Google call. Fail-open. */
export async function recordCall(tripId?: string): Promise<void> {
  try {
    const batch = db().batch();
    const monthRef = db().collection(USAGE_COLLECTION).doc(monthKey());
    batch.set(
      monthRef,
      { calls: FieldValue.increment(1), updatedAt: Date.now() },
      { merge: true },
    );
    if (tripId) {
      const dayRef = db()
        .collection(USAGE_COLLECTION)
        .doc(`trip_${tripId}_${dayKey()}`);
      batch.set(
        dayRef,
        { calls: FieldValue.increment(1), tripId, day: dayKey(), updatedAt: Date.now() },
        { merge: true },
      );
    }
    await batch.commit();
  } catch {
    // ignore — counter is best-effort
  }
}
