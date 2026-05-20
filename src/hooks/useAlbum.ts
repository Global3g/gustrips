'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getClientStorage, getClientDb } from '@/lib/firebase/client';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import { uploadPhoto, uploadOnePending } from '@/lib/photoUploader';
import { isHeicFile, normalizeImageFile } from '@/lib/heic';
import {
  enqueuePhoto,
  listPending,
  removePending,
  bumpAttempts,
} from '@/lib/pendingPhotos';
import type { Trip, AlbumPhoto } from '@/types';

/**
 * Photo storage model migration (2026-05).
 *
 * Before: every Trip doc embedded a `trip.albumPhotos[]` array. With hundreds
 * of photos that doc grew to >500KB, slow to fetch on mobile and dangerously
 * close to Firestore's 1MB per-doc limit.
 *
 * Now: photos live in a subcollection `/trips/{tripId}/photos/{photoId}`.
 * Each doc is small, queries scale, the parent Trip doc stays light.
 *
 * Reading: subscribes to the subcollection AND falls back to the legacy
 * array on the trip doc. We merge by URL — the subcollection wins. Until the
 * backfill runs on a given trip, both sources are visible side by side.
 *
 * Writing: every new add/update/delete targets the subcollection. Edits to
 * legacy photos (still living in the array) are mirrored into the
 * subcollection at write time so they migrate naturally as the user
 * interacts with them.
 *
 * Backfill: `migrateThumbnails` (already user-facing in the photos page)
 * doubles as the migration helper — it now also copies each photo into
 * the subcollection and clears it from the legacy array.
 */

/* ─── Image compression ─────────────────────────── */

async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    // Safety timeout — 30s max for compression
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image compression timed out'));
    }, 30_000);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          'image/jpeg',
          quality,
        );
      } catch (err) {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

/** Remove undefined values from an object (Firestore rejects them) */
function cleanUndefined<T extends object>(obj: T): T {
  const clean = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean as T;
}

/** Generate a stable docId from a Storage URL (so a single photo only ever
 *  lives in one subcollection doc, even if migrated multiple times). */
function photoIdFromUrl(url: string): string {
  // Hash-ish: take the storage object path so docId stays deterministic.
  // Firebase Storage URLs look like .../o/<encoded-path>?token=...
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/o\/(.+)$/);
    if (m) {
      const decoded = decodeURIComponent(m[1]);
      // Firestore docIds disallow `/`. Replace with `__`.
      return decoded.replace(/\//g, '__').slice(0, 1500);
    }
  } catch {
    /* fall through */
  }
  // Fallback: sanitized URL itself.
  return url.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 1500);
}

/* ─── Hook ──────────────────────────────────────── */

interface UseAlbumReturn {
  albumPhotos: AlbumPhoto[];
  addPhoto: (file: File, date: string, caption?: string, eventId?: string) => Promise<AlbumPhoto>;
  deletePhoto: (photo: AlbumPhoto) => Promise<void>;
  updateCaption: (photo: AlbumPhoto, caption: string) => Promise<void>;
  updatePhoto: (oldPhoto: AlbumPhoto, updates: Partial<AlbumPhoto>) => Promise<void>;
  realignEventPhotoDates: (eventId: string, newDate: string) => Promise<number>;
  migrateThumbnails: (
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ migrated: number; failed: number; skipped: number; urlMap: Record<string, string> }>;
  markAllOptimized: () => Promise<number>;
  processPendingUploads: () => Promise<{ uploaded: number; failed: number }>;
  // ─── Review mode ───
  /** Mark the photo as reviewed (or undo). Used by /photos/review. */
  markReviewed: (photo: AlbumPhoto, reviewed?: boolean) => Promise<void>;
  /** Toggle/set favorite. Stars are visible across album views. */
  markFavorite: (photo: AlbumPhoto, favorite?: boolean) => Promise<void>;
  /** Soft-delete (sets deletedAt). The photo disappears from album views
   *  but Storage objects stay until a cleanup pass purges them. */
  softDelete: (photo: AlbumPhoto) => Promise<void>;
  /** Reverse a soft-delete within the undo window. */
  restorePhoto: (photo: AlbumPhoto) => Promise<void>;
}

export function useAlbum(tripId: string, trip: Trip | null): UseAlbumReturn {
  // Live subcollection of photos. This is the new source of truth.
  const [subPhotos, setSubPhotos] = useState<AlbumPhoto[]>([]);

  useEffect(() => {
    if (!tripId) return;
    const db = getClientDb();
    const photosRef = collection(db, 'trips', tripId, 'photos');
    const unsub = onSnapshot(
      query(photosRef),
      (snap) => {
        const out: AlbumPhoto[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<AlbumPhoto> & { url?: string };
          if (!data.url) return;
          // Firestore can hand us Timestamps for uploadedAt; coerce to ISO
          // string so consumers never have to think about it.
          let uploadedAt: string;
          if (typeof data.uploadedAt === 'string') {
            uploadedAt = data.uploadedAt;
          } else if (data.uploadedAt && typeof (data.uploadedAt as { toDate?: () => Date }).toDate === 'function') {
            uploadedAt = (data.uploadedAt as { toDate: () => Date }).toDate().toISOString();
          } else {
            uploadedAt = nowISO();
          }
          out.push(
            cleanUndefined({
              url: data.url,
              fullUrl: data.fullUrl,
              optimized: data.optimized,
              date: data.date ?? '',
              caption: data.caption,
              eventId: data.eventId,
              uploadedAt,
              reviewed: data.reviewed,
              reviewedAt: typeof data.reviewedAt === 'string' ? data.reviewedAt : undefined,
              favorite: data.favorite,
              deletedAt: typeof data.deletedAt === 'string' ? data.deletedAt : undefined,
            }) as AlbumPhoto,
          );
        });
        setSubPhotos(out);
      },
      (err) => {
        // Don't break the page if the subcollection is unreachable; the
        // legacy array stays visible.
        console.error('[useAlbum] photos subcollection error:', err);
      },
    );
    return unsub;
  }, [tripId]);

  // Legacy: photos still living in the trip.albumPhotos[] array.
  // Memoize the merge — without this, a single render anywhere upstream
  // (e.g. a parent re-rendering because of an unrelated state change) rebuilt
  // the Map on every render and invalidated every downstream useMemo that
  // depends on `albumPhotos` (and there are big ones: photoGroups, allPhotos,
  // dayCounts, etc. on the photos page). With 300+ photos the Map build
  // itself wasn't free, and the new array identity cascaded everywhere.
  const legacyPhotos: AlbumPhoto[] | undefined = trip?.albumPhotos;
  const albumPhotos: AlbumPhoto[] = useMemo(() => {
    const byUrl = new Map<string, AlbumPhoto>();
    if (legacyPhotos) {
      for (const p of legacyPhotos) {
        if (!p?.url) continue;
        byUrl.set(p.url, p);
      }
    }
    for (const p of subPhotos) {
      byUrl.set(p.url, p);
    }
    return Array.from(byUrl.values());
  }, [legacyPhotos, subPhotos]);

  const addPhoto = useCallback(
    async (file: File, date: string, caption?: string, eventId?: string): Promise<AlbumPhoto> => {
      // Normalize HEIC → JPEG before anything else so neither path (online
      // upload nor offline queue) holds an unrenderable blob.
      const normalized = isHeicFile(file) ? await normalizeImageFile(file) : file;

      // If we're offline, persist the raw blob to IndexedDB and return a
      // synthetic AlbumPhoto so the caller doesn't crash. PendingPhotoSync
      // will drain the queue when the device comes back online.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const id = await enqueuePhoto({
          tripId,
          date,
          caption,
          eventId,
          fileBlob: normalized,
          fileType: normalized.type,
          fileName: normalized.name,
        });
        try { markMutation(); } catch { /* localStorage may be unavailable */ }
        const pendingPhoto: AlbumPhoto = {
          url: id ? `pending:${id}` : 'pending:',
          optimized: true,
          date,
          uploadedAt: nowISO(),
        };
        if (caption) pendingPhoto.caption = caption;
        if (eventId) pendingPhoto.eventId = eventId;
        return pendingPhoto;
      }

      return uploadPhoto({
        tripId,
        date,
        caption,
        eventId,
        fileBlob: normalized,
        fileName: normalized.name,
        fileType: normalized.type,
      });
    },
    [tripId],
  );

  /** Drain the offline queue for this trip. Returns success/failure tallies. */
  const processPendingUploads = useCallback(
    async (): Promise<{ uploaded: number; failed: number }> => {
      let uploaded = 0;
      let failed = 0;
      const items = await listPending(tripId);
      for (const item of items) {
        try {
          await uploadOnePending(item);
          await removePending(item.id);
          uploaded++;
        } catch (err) {
          if (typeof console !== 'undefined') {
            console.warn('[useAlbum] pending upload failed', err);
          }
          await bumpAttempts(item.id);
          failed++;
        }
      }
      return { uploaded, failed };
    },
    [tripId],
  );

  const deletePhoto = useCallback(
    async (photo: AlbumPhoto): Promise<void> => {
      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);

      // Delete from the subcollection if it lives there. setDoc with merge
      // is no-op-safe if the doc doesn't exist, but for delete we use
      // deleteDoc which silently no-ops on a missing doc as well.
      const photoId = photoIdFromUrl(photo.url);
      const photoRef = doc(db, 'trips', tripId, 'photos', photoId);
      try {
        await deleteDoc(photoRef);
      } catch (err) {
        console.warn('[useAlbum] delete subdoc failed (may not exist):', err);
      }

      // Also strip from the legacy array (if still present there).
      const currentPhotos = trip?.albumPhotos ?? [];
      if (currentPhotos.some((p) => p.url === photo.url)) {
        const filtered = currentPhotos.filter((p) => p.url !== photo.url);
        await updateDoc(tripRef, {
          albumPhotos: filtered,
          updatedAt: nowISO(),
        });
      }
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      // Try to delete both thumbnail and full-quality versions from storage (best-effort)
      const tryDelete = async (firebaseUrl: string) => {
        try {
          const storage = getClientStorage();
          const urlObj = new URL(firebaseUrl);
          const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
          if (pathMatch) {
            const storagePath = decodeURIComponent(pathMatch[1]);
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
          }
        } catch (err) {
          console.error('Error deleting photo from storage:', err);
        }
      };
      await Promise.all([
        tryDelete(photo.url),
        photo.fullUrl ? tryDelete(photo.fullUrl) : Promise.resolve(),
      ]);
    },
    [tripId, trip],
  );

  /** Helper: write a photo to the subcollection (idempotent upsert). */
  const upsertSubPhoto = useCallback(
    async (photo: AlbumPhoto): Promise<void> => {
      const db = getClientDb();
      const photoId = photoIdFromUrl(photo.url);
      const ref = doc(db, 'trips', tripId, 'photos', photoId);
      await setDoc(
        ref,
        cleanUndefined({
          ...photo,
          updatedAt: serverTimestamp(),
        }),
        { merge: true },
      );
    },
    [tripId],
  );

  const updateCaption = useCallback(
    async (photo: AlbumPhoto, caption: string): Promise<void> => {
      // Always write through to the subcollection — also migrates legacy
      // photos out of the array on first edit.
      await upsertSubPhoto({ ...photo, caption });

      // If the photo still lives in the legacy array, update it there too
      // until the next backfill clears it.
      const currentPhotos = trip?.albumPhotos ?? [];
      if (currentPhotos.some((p) => p.url === photo.url)) {
        const db = getClientDb();
        const tripRef = doc(db, 'trips', tripId);
        const updatedPhotos = currentPhotos.map((p) =>
          p.url === photo.url ? { ...p, caption } : p,
        );
        await updateDoc(tripRef, {
          albumPhotos: updatedPhotos,
          updatedAt: nowISO(),
        });
      }
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId, trip, upsertSubPhoto],
  );

  const updatePhoto = useCallback(
    async (oldPhoto: AlbumPhoto, updates: Partial<AlbumPhoto>): Promise<void> => {
      const merged = cleanUndefined({ ...oldPhoto, ...updates }) as AlbumPhoto;

      // If the URL changed (rare — happens during a migration step), delete
      // the old subdoc first.
      if (updates.url && updates.url !== oldPhoto.url) {
        const db = getClientDb();
        const oldId = photoIdFromUrl(oldPhoto.url);
        try {
          await deleteDoc(doc(db, 'trips', tripId, 'photos', oldId));
        } catch {
          /* ignore — doc may not exist yet */
        }
      }

      await upsertSubPhoto(merged);

      // Mirror into the legacy array if the photo is still living there.
      const currentPhotos = trip?.albumPhotos ?? [];
      if (currentPhotos.some((p) => p.url === oldPhoto.url)) {
        const db = getClientDb();
        const tripRef = doc(db, 'trips', tripId);
        const updatedPhotos = currentPhotos.map((p) =>
          p.url === oldPhoto.url ? merged : p,
        );
        await updateDoc(tripRef, {
          albumPhotos: updatedPhotos,
          updatedAt: nowISO(),
        });
      }
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId, trip, upsertSubPhoto],
  );

  /* ─── Re-compress legacy thumbnails AND migrate them to the subcollection ─── */
  const migrateThumbnails = useCallback(
    async (
      onProgress?: (done: number, total: number) => void,
    ): Promise<{ migrated: number; failed: number; skipped: number; urlMap: Record<string, string> }> => {
      const db = getClientDb();
      const storage = getClientStorage();
      const tripRef = doc(db, 'trips', tripId);

      const currentPhotos = trip?.albumPhotos ?? [];
      const total = currentPhotos.length;
      const urlMap: Record<string, string> = {};
      const remaining: AlbumPhoto[] = []; // photos that stay in the array
      let migrated = 0;
      let failed = 0;
      let skipped = 0;
      let done = 0;

      // Helper: read an image's natural width without re-uploading.
      const measureWidth = (url: string): Promise<number> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth);
          img.onerror = () => reject(new Error('image load failed'));
          img.src = url;
        });

      // Subcollection writes happen in batched chunks of up to 450 to stay
      // under Firestore's 500-op limit.
      let batch = writeBatch(db);
      let opsInBatch = 0;
      const flushBatch = async (): Promise<void> => {
        if (opsInBatch === 0) return;
        await batch.commit();
        batch = writeBatch(db);
        opsInBatch = 0;
      };
      const queueSubdocWrite = (photo: AlbumPhoto): void => {
        const photoId = photoIdFromUrl(photo.url);
        const ref = doc(db, 'trips', tripId, 'photos', photoId);
        batch.set(
          ref,
          cleanUndefined({
            ...photo,
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );
        opsInBatch++;
      };

      for (const photo of currentPhotos) {
        try {
          if (photo.optimized) {
            // Already optimized — just migrate to the subcollection.
            queueSubdocWrite(photo);
            skipped++;
          } else {
            // Smart-skip: if the existing thumbnail is already small enough,
            // stamp optimized=true and migrate.
            let alreadySmall = false;
            try {
              const w = await measureWidth(photo.url);
              if (w > 0 && w <= 800) alreadySmall = true;
            } catch {
              // ignore — fall back to recompress
            }

            if (alreadySmall) {
              queueSubdocWrite({ ...photo, optimized: true });
              skipped++;
            } else {
              // Recompress through the photo-proxy API (Firebase Storage
              // doesn't expose CORS; this routes through our origin).
              const source = photo.fullUrl || photo.url;
              const proxied = `/api/photo-proxy?url=${encodeURIComponent(source)}`;
              const res = await fetch(proxied);
              if (!res.ok) throw new Error(`Proxy ${res.status}`);
              const sourceBlob = await res.blob();
              const sourceFile = new File([sourceBlob], 'photo.jpg', {
                type: sourceBlob.type || 'image/jpeg',
              });

              const newThumb = await compressImage(sourceFile, 600, 0.75);

              const timestamp = Date.now() + done;
              const newPath = `trips/${tripId}/album/${timestamp}_optimized.jpg`;
              const newRef = ref(storage, newPath);
              await uploadBytes(newRef, newThumb, { contentType: 'image/jpeg' });
              const newUrl = await getDownloadURL(newRef);

              urlMap[photo.url] = newUrl;
              queueSubdocWrite({ ...photo, url: newUrl, optimized: true });
              migrated++;

              // Best-effort delete of the old thumbnail to free storage.
              try {
                const oldUrlObj = new URL(photo.url);
                const m = oldUrlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
                if (m) {
                  await deleteObject(ref(storage, decodeURIComponent(m[1])));
                }
              } catch {
                // ignore — orphaned blob is not critical
              }
            }
          }

          // Flush mid-loop if the batch is filling up.
          if (opsInBatch >= 450) {
            await flushBatch();
          }
        } catch (err) {
          console.error('Failed to migrate photo:', photo.url, err);
          // Keep it in the legacy array so the user doesn't lose it.
          remaining.push(cleanUndefined(photo));
          failed++;
        }

        done++;
        onProgress?.(done, total);
      }

      await flushBatch();

      // Clear successfully-migrated photos from the legacy array. Failed
      // ones stay so the next run can retry them.
      await updateDoc(tripRef, {
        albumPhotos: remaining,
        updatedAt: nowISO(),
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      return { migrated, failed, skipped, urlMap };
    },
    [tripId, trip],
  );

  // Last-resort: stamp every photo with optimized=true so the migration
  // banner stops nagging when re-processing keeps failing. This now also
  // mirrors the photos into the subcollection.
  const markAllOptimized = useCallback(async (): Promise<number> => {
    const db = getClientDb();
    const tripRef = doc(db, 'trips', tripId);
    const currentPhotos = trip?.albumPhotos ?? [];
    if (currentPhotos.length === 0) return 0;

    let batch = writeBatch(db);
    let opsInBatch = 0;
    const flushBatch = async (): Promise<void> => {
      if (opsInBatch === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      opsInBatch = 0;
    };

    const cleaned = currentPhotos.map((p) =>
      cleanUndefined({ ...p, optimized: true }),
    );

    for (const p of cleaned) {
      const photoId = photoIdFromUrl(p.url);
      const ref = doc(db, 'trips', tripId, 'photos', photoId);
      batch.set(ref, { ...p, updatedAt: serverTimestamp() }, { merge: true });
      opsInBatch++;
      if (opsInBatch >= 450) await flushBatch();
    }
    await flushBatch();

    // Empty the legacy array — everything now lives in the subcollection.
    await updateDoc(tripRef, {
      albumPhotos: [],
      updatedAt: nowISO(),
    });
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
    return cleaned.length;
  }, [tripId, trip]);

  /**
   * Re-stamp the `date` of every photo linked to `eventId` to `newDate`.
   * Used by the itinerary editor: when the user moves an event to a different
   * day, the linked photos should follow — without this, the photos page
   * keeps them bucketed on the old date because it groups by `photo.date`,
   * not by `event.date`.
   *
   * Touches both the subcollection (source of truth) and the legacy
   * `trip.albumPhotos[]` array if any photos still live there. Returns the
   * total number of photos updated.
   */
  const realignEventPhotoDates = useCallback(
    async (eventId: string, newDate: string): Promise<number> => {
      if (!eventId || !newDate) return 0;
      const db = getClientDb();
      let updated = 0;

      // 1. Subcollection — batched updates of up to 450 ops per commit.
      const subMatches = subPhotos.filter(
        (p) => p.eventId === eventId && p.date !== newDate,
      );
      if (subMatches.length > 0) {
        let batch = writeBatch(db);
        let ops = 0;
        for (const p of subMatches) {
          const photoId = photoIdFromUrl(p.url);
          const ref = doc(db, 'trips', tripId, 'photos', photoId);
          batch.set(
            ref,
            { date: newDate, updatedAt: serverTimestamp() },
            { merge: true },
          );
          ops++;
          if (ops >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
          }
        }
        if (ops > 0) await batch.commit();
        updated += subMatches.length;
      }

      // 2. Legacy array — rewrite in place if any photos still live there.
      const legacy = trip?.albumPhotos ?? [];
      const legacyHits = legacy.filter(
        (p) => p.eventId === eventId && p.date !== newDate,
      );
      if (legacyHits.length > 0) {
        const next = legacy.map((p) =>
          p.eventId === eventId && p.date !== newDate ? { ...p, date: newDate } : p,
        );
        const tripRef = doc(db, 'trips', tripId);
        await updateDoc(tripRef, { albumPhotos: next, updatedAt: nowISO() });
        updated += legacyHits.length;
      }

      if (updated > 0) {
        try { markMutation(); } catch { /* localStorage may be unavailable */ }
      }
      return updated;
    },
    [tripId, trip, subPhotos],
  );

  /* ─── Review mode mutations ─────────────────────────
   * All four flow through the same `upsertSubPhoto` so legacy photos
   * (still living in trip.albumPhotos[]) get migrated to the subcollection
   * on first interaction. Effects on the legacy array are intentionally
   * NOT mirrored here — these are new fields the legacy schema doesn't have,
   * and the migration banner will clear the array eventually. */

  const markReviewed = useCallback(
    async (photo: AlbumPhoto, reviewed: boolean = true): Promise<void> => {
      await upsertSubPhoto({
        ...photo,
        reviewed,
        reviewedAt: reviewed ? nowISO() : undefined,
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [upsertSubPhoto],
  );

  const markFavorite = useCallback(
    async (photo: AlbumPhoto, favorite: boolean = true): Promise<void> => {
      await upsertSubPhoto({ ...photo, favorite });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [upsertSubPhoto],
  );

  const softDelete = useCallback(
    async (photo: AlbumPhoto): Promise<void> => {
      await upsertSubPhoto({ ...photo, deletedAt: nowISO() });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [upsertSubPhoto],
  );

  const restorePhoto = useCallback(
    async (photo: AlbumPhoto): Promise<void> => {
      // null clears deletedAt without dropping the field; upsertSubPhoto
      // sets the field via setDoc merge so this works as a real "undelete".
      await upsertSubPhoto({ ...photo, deletedAt: null });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [upsertSubPhoto],
  );

  return {
    albumPhotos,
    addPhoto,
    deletePhoto,
    updateCaption,
    updatePhoto,
    realignEventPhotoDates,
    migrateThumbnails,
    markAllOptimized,
    processPendingUploads,
    markReviewed,
    markFavorite,
    softDelete,
    restorePhoto,
  };
}
