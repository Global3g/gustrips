'use client';

import { useEffect, useRef } from 'react';
import { listPending, removePending, bumpAttempts } from '@/lib/pendingPhotos';
import { uploadOnePending, bumpTripUpdatedAtOnce } from '@/lib/photoUploader';

const SANITY_INTERVAL_MS = 30_000;

async function drainOnce(): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0;
  let failed = 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { uploaded, failed };
  }
  const items = await listPending();
  // Track which trips actually had at least one successful drained upload
  // so we can bump trip.updatedAt exactly once per affected trip at the
  // end of this drain pass. Previously each item bumped the trip doc,
  // which fired one onSnapshot round per subscriber per item — wasted
  // work that contributed to mobile lag when the queue had many photos
  // for the same trip.
  const bumpedTripIds = new Set<string>();
  for (const item of items) {
    try {
      await uploadOnePending(item, { skipTripBump: true });
      await removePending(item.id);
      bumpedTripIds.add(item.tripId);
      uploaded++;
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[PendingPhotoSync] upload failed', err);
      }
      await bumpAttempts(item.id);
      failed++;
    }
  }
  // One trip.updatedAt write per affected trip, regardless of how many
  // items drained for that trip in this pass.
  for (const tripId of bumpedTripIds) {
    try {
      await bumpTripUpdatedAtOnce(tripId);
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[PendingPhotoSync] trip bump failed', err);
      }
    }
  }
  return { uploaded, failed };
}

/**
 * Mounted globally. Drains the pending-photos IndexedDB queue when:
 *  - the component mounts
 *  - the browser fires the `online` event
 *  - every 30s as a sanity net (covers cases where `online` never fires)
 *
 * A re-entrancy guard prevents overlapping drains.
 */
export default function PendingPhotoSync() {
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await drainOnce();
      } catch (err) {
        if (typeof console !== 'undefined') {
          console.warn('[PendingPhotoSync] drain error', err);
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    // Initial drain on mount
    if (!cancelled) void run();

    const onOnline = () => { void run(); };
    window.addEventListener('online', onOnline);

    const interval = window.setInterval(() => { void run(); }, SANITY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
