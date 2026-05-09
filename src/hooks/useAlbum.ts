'use client';

import { useCallback, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getClientStorage, getClientDb } from '@/lib/firebase/client';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import type { Trip, AlbumPhoto } from '@/types';

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

/* ─── Hook ──────────────────────────────────────── */

interface UseAlbumReturn {
  albumPhotos: AlbumPhoto[];
  addPhoto: (file: File, date: string, caption?: string, eventId?: string) => Promise<AlbumPhoto>;
  deletePhoto: (photo: AlbumPhoto) => Promise<void>;
  updateCaption: (photo: AlbumPhoto, caption: string) => Promise<void>;
  updatePhoto: (oldPhoto: AlbumPhoto, updates: Partial<AlbumPhoto>) => Promise<void>;
  migrateThumbnails: (
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ migrated: number; failed: number; skipped: number; urlMap: Record<string, string> }>;
  markAllOptimized: () => Promise<number>;
}

export function useAlbum(tripId: string, trip: Trip | null): UseAlbumReturn {
  // Deduplicate photos by URL (keep the last occurrence)
  const rawPhotos = trip?.albumPhotos ?? [];
  const photoMap = new Map<string, AlbumPhoto>();
  rawPhotos.forEach((photo) => {
    photoMap.set(photo.url, photo);
  });
  const albumPhotos: AlbumPhoto[] = Array.from(photoMap.values());

  // Clean up duplicates in Firestore if detected
  useEffect(() => {
    if (rawPhotos.length > albumPhotos.length && albumPhotos.length > 0) {
      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);
      updateDoc(tripRef, {
        albumPhotos,
        updatedAt: nowISO(),
      }).catch((err) => {
        console.error('Error cleaning up duplicate photos:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, rawPhotos.length]);

  const addPhoto = useCallback(
    async (file: File, date: string, caption?: string, eventId?: string): Promise<AlbumPhoto> => {
      const storage = getClientStorage();
      const db = getClientDb();
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storage_thumb = ref(storage, `trips/${tripId}/album/${timestamp}_${safeName}`);
      const storage_full = ref(storage, `trips/${tripId}/album/${timestamp}_full_${safeName}`);

      // Generate both versions in parallel — gallery thumbnail (small, fast)
      // and full-quality original (used by the lightbox).
      // 600px @ 75% covers retina rendering up to ~300px display while keeping
      // each thumbnail around 50-100 KB for quick grid loading.
      const [thumbBlob, fullBlob] = await Promise.all([
        compressImage(file, 600, 0.75),
        compressImage(file, 3000, 0.92),
      ]);
      const [, ] = await Promise.all([
        uploadBytes(storage_thumb, thumbBlob, { contentType: 'image/jpeg' }),
        uploadBytes(storage_full, fullBlob, { contentType: 'image/jpeg' }),
      ]);
      const [url, fullUrl] = await Promise.all([
        getDownloadURL(storage_thumb),
        getDownloadURL(storage_full),
      ]);

      const photo: AlbumPhoto = {
        url,
        fullUrl,
        optimized: true, // already produced as a 600px thumbnail
        date,
        uploadedAt: nowISO(),
      };
      if (caption) photo.caption = caption;
      if (eventId) photo.eventId = eventId;

      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        albumPhotos: arrayUnion(cleanUndefined(photo)),
        updatedAt: nowISO(),
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      return photo;
    },
    [tripId],
  );

  const deletePhoto = useCallback(
    async (photo: AlbumPhoto): Promise<void> => {
      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);

      // Remove from Firestore by filtering out the photo by URL
      const currentPhotos = trip?.albumPhotos ?? [];
      const filtered = currentPhotos.filter((p) => p.url !== photo.url);
      await updateDoc(tripRef, {
        albumPhotos: filtered,
        updatedAt: nowISO(),
      });
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

  const updateCaption = useCallback(
    async (photo: AlbumPhoto, caption: string): Promise<void> => {
      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);

      // Get current photos and update the matching one
      const currentPhotos = trip?.albumPhotos ?? [];
      const updatedPhotos = currentPhotos.map((p) =>
        p.url === photo.url ? { ...p, caption } : p
      );

      await updateDoc(tripRef, {
        albumPhotos: updatedPhotos,
        updatedAt: nowISO(),
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId, trip],
  );

  const updatePhoto = useCallback(
    async (oldPhoto: AlbumPhoto, updates: Partial<AlbumPhoto>): Promise<void> => {
      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);

      // Get current photos and update the matching one
      const currentPhotos = trip?.albumPhotos ?? [];
      const updatedPhotos = currentPhotos.map((p) =>
        p.url === oldPhoto.url ? cleanUndefined({ ...p, ...updates }) : p
      );

      await updateDoc(tripRef, {
        albumPhotos: updatedPhotos,
        updatedAt: nowISO(),
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId, trip],
  );

  /* ─── Re-compress legacy thumbnails to 600px to speed up the gallery ─── */
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
      const updated: AlbumPhoto[] = [];
      let migrated = 0;
      let failed = 0;
      let skipped = 0;
      let done = 0;

      // Helper: read an image's natural width without re-uploading.
      // Lets us mark already-small thumbs as optimized=true cheaply.
      // No crossOrigin — we only need natural dimensions (not pixel data),
      // and crossOrigin breaks loading on hosts without explicit CORS.
      const measureWidth = (url: string): Promise<number> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth);
          img.onerror = () => reject(new Error('image load failed'));
          img.src = url;
        });

      for (const photo of currentPhotos) {
        if (photo.optimized) {
          updated.push(cleanUndefined(photo));
          skipped++;
          done++;
          onProgress?.(done, total);
          continue;
        }
        try {
          // Smart-skip: if the existing thumbnail is already small enough
          // (likely re-uploaded yesterday), just stamp optimized=true.
          let alreadySmall = false;
          try {
            const w = await measureWidth(photo.url);
            if (w > 0 && w <= 800) alreadySmall = true;
          } catch {
            // ignore — fall back to recompress
          }

          if (alreadySmall) {
            updated.push(cleanUndefined({ ...photo, optimized: true }));
            skipped++;
            done++;
            onProgress?.(done, total);
            continue;
          }

          // Prefer the full-quality original; fall back to the thumbnail.
          // Firebase Storage doesn't expose CORS on the bucket, so both
          // fetch() and the SDK's getBlob fail in the browser. Route
          // through our /api/photo-proxy which fetches server-side and
          // serves the bytes from our own origin.
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
          // cleanUndefined strips undefined optional fields (caption,
          // eventId, fullUrl) that Firestore rejects inside arrays.
          updated.push(cleanUndefined({ ...photo, url: newUrl, optimized: true }));
          migrated++;

          // Best-effort delete of the old thumbnail to free storage
          try {
            const oldUrlObj = new URL(photo.url);
            const m = oldUrlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
            if (m) {
              await deleteObject(ref(storage, decodeURIComponent(m[1])));
            }
          } catch {
            // ignore — orphaned blob is not critical
          }
        } catch (err) {
          console.error('Failed to migrate photo:', photo.url, err);
          updated.push(cleanUndefined(photo));
          failed++;
        }

        done++;
        onProgress?.(done, total);
      }

      await updateDoc(tripRef, {
        albumPhotos: updated,
        updatedAt: nowISO(),
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      return { migrated, failed, skipped, urlMap };
    },
    [tripId, trip],
  );

  // Last-resort: just stamp every photo with optimized=true so the
  // banner stops nagging when re-processing keeps failing.
  const markAllOptimized = useCallback(async (): Promise<number> => {
    const db = getClientDb();
    const tripRef = doc(db, 'trips', tripId);
    const currentPhotos = trip?.albumPhotos ?? [];
    if (currentPhotos.length === 0) return 0;
    const cleaned = currentPhotos.map((p) =>
      cleanUndefined({ ...p, optimized: true }),
    );
    await updateDoc(tripRef, {
      albumPhotos: cleaned,
      updatedAt: nowISO(),
    });
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
    return cleaned.length;
  }, [tripId, trip]);

  return {
    albumPhotos,
    addPhoto,
    deletePhoto,
    updateCaption,
    updatePhoto,
    migrateThumbnails,
    markAllOptimized,
  };
}
