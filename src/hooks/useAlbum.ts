'use client';

import { useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getClientStorage, getClientDb } from '@/lib/firebase/client';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { nowISO } from '@/lib/utils/helpers';
import type { Trip, AlbumPhoto } from '@/types';

/* ─── Image compression ─────────────────────────── */

async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/* ─── Hook ──────────────────────────────────────── */

interface UseAlbumReturn {
  albumPhotos: AlbumPhoto[];
  addPhoto: (file: File, date: string, caption?: string) => Promise<AlbumPhoto>;
  deletePhoto: (photo: AlbumPhoto) => Promise<void>;
  updateCaption: (photo: AlbumPhoto, caption: string) => Promise<void>;
}

export function useAlbum(tripId: string, trip: Trip | null): UseAlbumReturn {
  const albumPhotos: AlbumPhoto[] = trip?.albumPhotos ?? [];

  const addPhoto = useCallback(
    async (file: File, date: string, caption?: string): Promise<AlbumPhoto> => {
      const storage = getClientStorage();
      const db = getClientDb();
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `trips/${tripId}/album/${timestamp}_${safeName}`;
      const storageRef = ref(storage, storagePath);

      // Compress before upload
      const compressed = await compressImage(file);
      await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(storageRef);

      const photo: AlbumPhoto = {
        url,
        date,
        caption: caption || undefined,
        uploadedAt: nowISO(),
      };

      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        albumPhotos: arrayUnion(photo),
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

      // Remove from Firestore
      await updateDoc(tripRef, {
        albumPhotos: arrayRemove(photo),
        updatedAt: nowISO(),
      });

      // Try to delete from storage (best-effort)
      try {
        const storage = getClientStorage();
        // Extract path from URL
        const urlObj = new URL(photo.url);
        const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
        if (pathMatch) {
          const storagePath = decodeURIComponent(pathMatch[1]);
          const storageRef = ref(storage, storagePath);
          await deleteObject(storageRef);
        }
      } catch (err) {
        console.error('Error deleting photo from storage:', err);
      }
    },
    [tripId],
  );

  const updateCaption = useCallback(
    async (photo: AlbumPhoto, caption: string): Promise<void> => {
      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);

      // Firestore arrayRemove/arrayUnion requires exact match
      // So we remove old and add updated
      const updatedPhoto: AlbumPhoto = { ...photo, caption };

      await updateDoc(tripRef, {
        albumPhotos: arrayRemove(photo),
        updatedAt: nowISO(),
      });
      await updateDoc(tripRef, {
        albumPhotos: arrayUnion(updatedPhoto),
        updatedAt: nowISO(),
      });
    },
    [tripId],
  );

  return { albumPhotos, addPhoto, deletePhoto, updateCaption };
}
