/**
 * Standalone photo uploader: compresses + uploads thumb + full + writes to
 * Firestore. Shared by `useAlbum.addPhoto` (online path) and
 * `PendingPhotoSync` (background drain of the offline queue).
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getClientStorage, getClientDb } from '@/lib/firebase/client';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import { isHeicFile, normalizeImageFile } from '@/lib/heic';
import type { AlbumPhoto } from '@/types';
import type { PendingPhoto } from '@/lib/pendingPhotos';

async function compressImage(
  fileOrBlob: Blob,
  maxWidth = 1200,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

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
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob returned null'));
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

function cleanUndefined<T extends object>(obj: T): T {
  const clean = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean as T;
}

interface UploadInput {
  tripId: string;
  date: string;
  caption?: string;
  eventId?: string;
  fileBlob: Blob;
  fileName: string;
  fileType: string;
}

/**
 * Compress and upload a single photo to Firebase Storage and append it to the
 * trip's `albumPhotos` array. Returns the persisted `AlbumPhoto`.
 */
export async function uploadPhoto(input: UploadInput): Promise<AlbumPhoto> {
  const { tripId, date, caption, eventId, fileBlob, fileName, fileType } = input;
  const storage = getClientStorage();
  const db = getClientDb();
  const timestamp = Date.now();

  // HEIC from Photos.app can't be decoded by canvas. Convert to JPEG up-front
  // so the rest of the pipeline (compression, upload, thumbnails) works.
  let workingFile: File =
    fileBlob instanceof File
      ? fileBlob
      : new File([fileBlob], fileName || 'photo', { type: fileType || fileBlob.type || 'image/jpeg' });
  if (isHeicFile(workingFile)) {
    workingFile = await normalizeImageFile(workingFile);
  }

  const safeName = (workingFile.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storage_thumb = ref(storage, `trips/${tripId}/album/${timestamp}_${safeName}`);
  const storage_full = ref(storage, `trips/${tripId}/album/${timestamp}_full_${safeName}`);

  const blobForCompression: Blob = workingFile;

  const [thumbBlob, fullBlob] = await Promise.all([
    compressImage(blobForCompression, 600, 0.75),
    compressImage(blobForCompression, 3000, 0.92),
  ]);
  await Promise.all([
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
    optimized: true,
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
}

/** Upload a single queued pending photo. Caller handles success/failure. */
export async function uploadOnePending(item: PendingPhoto): Promise<AlbumPhoto> {
  return uploadPhoto({
    tripId: item.tripId,
    date: item.date,
    caption: item.caption,
    eventId: item.eventId,
    fileBlob: item.fileBlob,
    fileName: item.fileName,
    fileType: item.fileType,
  });
}
