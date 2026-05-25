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
import { processPhotoInWorker } from '@/lib/workers/photoWorkerClient';
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
  city?: string;
  country?: string;
  fileBlob: Blob;
  fileName: string;
  fileType: string;
  /**
   * Skip the per-photo `trip.updatedAt` bump at the end of this upload.
   *
   * Set to `true` when batching uploads (e.g. uploading 20 photos in a row)
   * to defer the trip-doc write — otherwise each upload fires its own
   * `onSnapshot` round-trip for every subscriber of the trip (sidebar,
   * banners, layout, etc.), which can mean 20 wasted re-renders per
   * subscriber for a 20-photo batch. The caller is then responsible for
   * calling `bumpTripUpdatedAtOnce(tripId)` exactly once after the batch.
   *
   * Defaults to `false` so legacy single-photo paths (and the offline
   * queue drain, if used directly) keep working unchanged.
   */
  skipTripBump?: boolean;
}

/**
 * Compress and upload a single photo to Firebase Storage and append it to the
 * trip's `albumPhotos` array. Returns the persisted `AlbumPhoto`.
 *
 * Pass `skipTripBump: true` in `input` to skip the per-photo trip.updatedAt
 * bump — used by batch uploaders that bump once at the end of the batch.
 */
export async function uploadPhoto(input: UploadInput): Promise<AlbumPhoto> {
  const { tripId, date, caption, eventId, city, country, fileBlob, fileName, fileType, skipTripBump } = input;
  const storage = getClientStorage();
  const db = getClientDb();
  const timestamp = Date.now();

  // Try the Web Worker first — it runs HEIC convert + both compress
  // passes + SHA-256 hash on a background thread, which prevents the
  // main thread from being pegged when the user uploads many photos at
  // once (the real cause of "phone gets hot" during the London trip).
  // Falls back to the synchronous main-thread pipeline if the worker
  // isn't supported here (older Safari, embedded webview), or if the
  // worker itself decided to bounce back (e.g. heic2any couldn't load
  // inside the worker context).
  let thumbBlob: Blob;
  let originalBlob: Blob;
  let contentHash: string | null;
  let safeName: string;

  let workerResult: Awaited<ReturnType<typeof processPhotoInWorker>>;
  try {
    workerResult = await processPhotoInWorker(fileBlob, fileName, fileType);
  } catch (err) {
    // Worker died mid-process — treat as fallback.
    console.warn('[uploadPhoto] worker rejected, falling back to main thread:', err);
    workerResult = { fallback: true, reason: 'worker-error' };
  }

  if ('fallback' in workerResult) {
    // ── Main-thread fallback (legacy pipeline) ────────────────────────
    // Hashing in parallel with HEIC conversion to keep upload fast.
    const hashPromise = computeFileHash(fileBlob).catch((err) => {
      console.warn('[uploadPhoto] hash failed, skipping dedup fingerprint:', err);
      return null;
    });

    // HEIC from Photos.app can't be decoded by canvas. Convert to JPEG
    // up-front so the rest of the pipeline works.
    let workingFile: File =
      fileBlob instanceof File
        ? fileBlob
        : new File([fileBlob], fileName || 'photo', { type: fileType || fileBlob.type || 'image/jpeg' });
    if (isHeicFile(workingFile)) {
      workingFile = await normalizeImageFile(workingFile);
    }
    safeName = (workingFile.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    // Archive the (HEIC-converted) full-res original untouched — no 3000px
    // re-encode. The Resize Images extension makes the display sizes from it.
    originalBlob = workingFile;
    thumbBlob = await compressImage(workingFile, 400, 0.78);
    contentHash = await hashPromise;
  } else {
    // ── Worker path ───────────────────────────────────────────────────
    // The worker did HEIC conversion + the small thumb + hashing, and hands
    // back the full-res original to archive. We just need a sane filename.
    thumbBlob = workerResult.thumb;
    originalBlob = workerResult.original;
    contentHash = workerResult.contentHash;
    safeName = (fileName || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    // Strip a .heic extension on the safeName since the bytes are now JPEG.
    if (/\.heic$/i.test(safeName) || /\.heif$/i.test(safeName)) {
      safeName = safeName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
    }
  }

  // The small thumb lives directly under album/ (NOT watched by the resize
  // extension). The original goes under album/originals/ — the extension
  // watches that path and writes the WebP derivatives ALONGSIDE the original
  // (the "resized images path" was left empty), with deterministic names
  // (verified against real output + the extension source):
  //   <fileNameWithoutExt>_<W>x<H>.webp
  const thumbPath = `trips/${tripId}/album/${timestamp}_thumb_${safeName}`;
  const originalPath = `trips/${tripId}/album/originals/${timestamp}_${safeName}`;
  const baseNoExt = safeName.replace(/\.[^.]+$/, '');
  const derivBase = `trips/${tripId}/album/originals/${timestamp}_${baseNoExt}`;
  const viewPath = `${derivBase}_1280x1280.webp`;
  const thumbWebpPath = `${derivBase}_400x400.webp`;

  const storage_thumb = ref(storage, thumbPath);
  const storage_original = ref(storage, originalPath);

  // Track which blobs landed in Storage so we can clean up if a later
  // step fails — otherwise a failed upload leaves orphans that Storage
  // bills us for forever.
  let thumbUploaded = false;
  let originalUploaded = false;
  try {
    const results = await Promise.allSettled([
      uploadBytes(storage_thumb, thumbBlob, { contentType: 'image/jpeg' }),
      uploadBytes(storage_original, originalBlob, {
        contentType: originalBlob.type || 'image/jpeg',
      }),
    ]);
    thumbUploaded = results[0].status === 'fulfilled';
    originalUploaded = results[1].status === 'fulfilled';
    if (!thumbUploaded || !originalUploaded) {
      const reason = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      throw reason?.reason ?? new Error('uploadBytes failed');
    }

    const [url, originalUrl] = await Promise.all([
      getDownloadURL(storage_thumb),
      getDownloadURL(storage_original),
    ]);

    // contentHash is already resolved (either from the worker or from
    // the awaited hashPromise inside the fallback branch above).

    const photo: AlbumPhoto = {
      url,
      // Until we swap the lightbox to the WebP view, full-quality views
      // (lightbox, photobook, collage) read the archived original.
      fullUrl: originalUrl,
      originalUrl,
      originalPath,
      viewPath,
      thumbWebpPath,
      optimized: true,
      date,
      uploadedAt: nowISO(),
    };
    if (caption) photo.caption = caption;
    if (eventId) photo.eventId = eventId;
    if (city) photo.city = city;
    if (country) photo.country = country;
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
    // Skip the bump when batching: the caller will fire `bumpTripUpdatedAtOnce`
    // once at the end of the batch to avoid firing N onSnapshot rounds for
    // every subscriber of the trip doc.
    if (!skipTripBump) {
      await bumpTripUpdatedAt(tripId);
    }
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
    return photo;
  } catch (err) {
    // Best-effort cleanup of orphaned Storage objects.
    await Promise.allSettled([
      thumbUploaded ? deleteObject(storage_thumb) : Promise.resolve(),
      originalUploaded ? deleteObject(storage_original) : Promise.resolve(),
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

/**
 * Public wrapper around the per-photo trip bump. Use this from batch
 * uploaders that call `uploadPhoto({ ..., skipTripBump: true })` per photo:
 * after the batch settles, call `bumpTripUpdatedAtOnce(tripId)` exactly
 * once so subscribers of the trip doc see a single onSnapshot round
 * instead of one per uploaded photo.
 */
export async function bumpTripUpdatedAtOnce(tripId: string): Promise<void> {
  return bumpTripUpdatedAt(tripId);
}

/**
 * Upload a single queued pending photo. Caller handles success/failure.
 *
 * Pass `{ skipTripBump: true }` when draining a batch of queued items so
 * the trip.updatedAt bump fires once for the whole drain instead of once
 * per item — keeps mobile subscribers from re-rendering N times.
 */
export async function uploadOnePending(
  item: PendingPhoto,
  options?: { skipTripBump?: boolean },
): Promise<AlbumPhoto> {
  return uploadPhoto({
    tripId: item.tripId,
    date: item.date,
    caption: item.caption,
    eventId: item.eventId,
    city: item.city,
    country: item.country,
    fileBlob: item.fileBlob,
    fileName: item.fileName,
    fileType: item.fileType,
    skipTripBump: options?.skipTripBump,
  });
}
