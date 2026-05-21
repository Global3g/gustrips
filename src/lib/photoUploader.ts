/**
 * Standalone photo uploader: compresses + uploads thumb + full + writes to
 * Firestore. Shared by `useAlbum.addPhoto` (online path) and
 * `PendingPhotoSync` (background drain of the offline queue).
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getClientStorage, getClientDb } from '@/lib/firebase/client';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import { isHeicFile, normalizeImageFile } from '@/lib/heic';
import { computeFileHash } from '@/lib/utils/photoHash';
import type { AlbumPhoto } from '@/types';
import type { PendingPhoto } from '@/lib/pendingPhotos';

/** Generate a stable docId from a Storage URL so each photo only ever lives
 *  in one subcollection doc, even after retries. Mirrors useAlbum. */
function photoIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/o\/(.+)$/);
    if (m) {
      const decoded = decodeURIComponent(m[1]);
      return decoded.replace(/\//g, '__').slice(0, 1500);
    }
  } catch {
    /* fall through */
  }
  return url.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 1500);
}

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

  // Fingerprint the raw bytes BEFORE any conversion. This way re-uploading
  // the same camera-roll item (same HEIC, same JPEG) always yields the
  // same `contentHash` — even if we change the HEIC pipeline tomorrow.
  // Hashing runs in parallel with HEIC conversion to keep upload fast.
  const hashPromise = computeFileHash(fileBlob).catch((err) => {
    console.warn('[uploadPhoto] hash failed, skipping dedup fingerprint:', err);
    return null;
  });

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

  // Track which blobs landed in Storage so we can clean up if a later
  // step fails — otherwise a failed upload leaves orphans that Storage
  // bills us for forever.
  let thumbUploaded = false;
  let fullUploaded = false;
  try {
    const results = await Promise.allSettled([
      uploadBytes(storage_thumb, thumbBlob, { contentType: 'image/jpeg' }),
      uploadBytes(storage_full, fullBlob, { contentType: 'image/jpeg' }),
    ]);
    thumbUploaded = results[0].status === 'fulfilled';
    fullUploaded = results[1].status === 'fulfilled';
    if (!thumbUploaded || !fullUploaded) {
      const reason = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      throw reason?.reason ?? new Error('uploadBytes failed');
    }

    const [url, fullUrl] = await Promise.all([
      getDownloadURL(storage_thumb),
      getDownloadURL(storage_full),
    ]);

    const contentHash = await hashPromise;

    const photo: AlbumPhoto = {
      url,
      fullUrl,
      optimized: true,
      date,
      uploadedAt: nowISO(),
    };
    if (caption) photo.caption = caption;
    if (eventId) photo.eventId = eventId;
    if (contentHash) photo.contentHash = contentHash;

    // Write to the photos subcollection (new home). Each photo is its own
    // small doc — trip docs stay light and the page can paginate later.
    const photoId = photoIdFromUrl(url);
    const photoRef = doc(db, 'trips', tripId, 'photos', photoId);
    await setDoc(
      photoRef,
      cleanUndefined({
        ...photo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    // From here on, ownership is in Firestore — return inside the try.
    await bumpTripUpdatedAt(tripId);
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
    return photo;
  } catch (err) {
    // Best-effort cleanup of orphaned Storage objects.
    await Promise.allSettled([
      thumbUploaded ? deleteObject(storage_thumb) : Promise.resolve(),
      fullUploaded ? deleteObject(storage_full) : Promise.resolve(),
    ]);
    throw err;
  }
}

async function bumpTripUpdatedAt(tripId: string): Promise<void> {
  const db = getClientDb();

  // Bump the trip's updatedAt so other listeners know something changed
  // (without re-writing the trip-wide albumPhotos array — that path is
  // legacy and the migration banner clears it).
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, {
    updatedAt: nowISO(),
  }).catch((err) => {
    // Best-effort: if the trip ref update fails, the subcollection write
    // already succeeded so the photo is safe.
    console.warn('[uploadPhoto] trip.updatedAt bump failed:', err);
  });
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
