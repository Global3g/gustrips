'use client';

import { useCallback, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getClientStorage, getClientDb } from '@/lib/firebase/client';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { nowISO } from '@/lib/utils/helpers';
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

      // Generate both versions in parallel — thumbnail for grids, full quality for lightbox
      const [thumbBlob, fullBlob] = await Promise.all([
        compressImage(file, 1200, 0.8),
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
    },
    [tripId, trip],
  );

  return { albumPhotos, addPhoto, deletePhoto, updateCaption, updatePhoto };
}
