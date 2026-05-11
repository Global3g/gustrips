/**
 * Client-side photo metadata extraction.
 *
 * Stub implementation. Real EXIF parsing (DateTimeOriginal, GPS, dimensions,
 * orientation, etc.) lives in a future iteration once a parser is chosen
 * (e.g. exifr, piexifjs). For now, we fall back to File / Blob primitives
 * and let the engine fill in the blanks via the questions flow.
 */

import type { PhotoMetadata } from '@/features/tripshistory/types';
import { computePerceptualHashStub } from '@/features/tripshistory/utils/perceptualHash';

/* ─── ID generation ────────────────────────────────── */

function randomClientId(file: File): string {
  // Deterministic-ish: name + size + lastModified. Falls back to random.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/* ─── Public API ───────────────────────────────────── */

export interface ExtractMetadataOptions {
  /** Override capturedAt detection (used when EXIF parsing isn't wired yet). */
  capturedAtFallback?: string;
}

/**
 * Extract a PhotoMetadata record from a File.
 *
 * Today this returns the minimum the API requires (`clientId` + `capturedAt`)
 * plus what we can read cheaply from the File object. The engine treats any
 * field as optional except `clientId` and `capturedAt`.
 */
export async function extractPhotoMetadata(
  file: File,
  options: ExtractMetadataOptions = {},
): Promise<PhotoMetadata> {
  const capturedAtFallback =
    options.capturedAtFallback ?? new Date(file.lastModified).toISOString();

  // Stub: in the real impl we'd parse EXIF DateTimeOriginal here.
  const capturedAt = capturedAtFallback;

  // Stub: real impl would compute a 64-bit perceptual hash from pixel data.
  const perceptualHash = computePerceptualHashStub(
    `${file.name}:${file.size}:${file.lastModified}`,
  );

  return {
    clientId: randomClientId(file),
    capturedAt,
    sizeBytes: file.size,
    mimeType: file.type || undefined,
    perceptualHash,
  };
}

/**
 * Extract metadata for a list of files in parallel.
 */
export async function extractPhotoMetadataBatch(
  files: File[],
  options?: ExtractMetadataOptions,
): Promise<PhotoMetadata[]> {
  return Promise.all(files.map((f) => extractPhotoMetadata(f, options)));
}
