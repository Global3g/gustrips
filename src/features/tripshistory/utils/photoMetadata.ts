/**
 * Client-side photo metadata extraction.
 *
 * Reads EXIF via `exifr` (DateTimeOriginal/CreateDate, GPS, dimensions,
 * timezone offset, orientation) and falls back to File primitives for
 * photos without EXIF (WhatsApp screenshots, re-encoded images, etc.).
 *
 * HEIC files are normalized to JPEG before parsing so the rest of the
 * pipeline (perceptual hash, upload) can use the same File object.
 */

import exifr from 'exifr';
import type { PhotoMetadata } from '@/features/tripshistory/types';
import {
  computePerceptualHash,
  computePerceptualHashStub,
} from '@/features/tripshistory/utils/perceptualHash';
import { isHeicFile, normalizeImageFile } from '@/lib/heic';

/* ─── ID generation ────────────────────────────────── */

function randomClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ─── EXIF parsing ─────────────────────────────────── */

interface ExifPayload {
  capturedAt: string;
  timezone?: string;
  location?: {
    lat?: number;
    lng?: number;
    altitude?: number;
    accuracy?: number;
  };
  dimensions?: { width?: number; height?: number };
}

function toIsoSafe(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
  }
  return undefined;
}

/**
 * Convert exifr's `tzoffset` (string like "+02:00" or number of minutes) to
 * an IANA-ish identifier. We don't ship a full tz lookup; we just emit the
 * offset as `Etc/GMT±N` so the engine knows roughly which timezone the
 * camera was set to. Returns undefined if we can't reason about it.
 */
function normalizeTimezone(raw: unknown): string | undefined {
  if (typeof raw === 'string' && /^[+-]\d{2}:?\d{2}$/.test(raw)) {
    return raw.includes(':') ? raw : `${raw.slice(0, 3)}:${raw.slice(3)}`;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // exifr reports tzoffset in minutes.
    const totalMinutes = Math.round(raw);
    const sign = totalMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(totalMinutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}`;
  }
  return undefined;
}

async function parseExif(file: File): Promise<Partial<ExifPayload>> {
  try {
    // Pull the tags we care about. Keep the option set small to limit how
    // much of the file exifr reads.
    const tags = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'OffsetTime',
        'OffsetTimeOriginal',
        'OffsetTimeDigitized',
        'GPSLatitude',
        'GPSLongitude',
        'GPSAltitude',
        'GPSHPositioningError',
        'latitude',
        'longitude',
        'ExifImageWidth',
        'ExifImageHeight',
        'PixelXDimension',
        'PixelYDimension',
        'ImageWidth',
        'ImageHeight',
        'Orientation',
      ],
    })) as Record<string, unknown> | undefined;
    if (!tags) return {};

    const capturedAt =
      toIsoSafe(tags.DateTimeOriginal) ??
      toIsoSafe(tags.CreateDate) ??
      toIsoSafe(tags.ModifyDate);

    const timezone = normalizeTimezone(
      tags.OffsetTimeOriginal ?? tags.OffsetTime ?? tags.OffsetTimeDigitized,
    );

    let location: ExifPayload['location'] | undefined;
    const lat = typeof tags.latitude === 'number' ? tags.latitude : undefined;
    const lng = typeof tags.longitude === 'number' ? tags.longitude : undefined;
    if (lat !== undefined && lng !== undefined) {
      location = { lat, lng };
      if (typeof tags.GPSAltitude === 'number') {
        location.altitude = tags.GPSAltitude as number;
      }
      if (typeof tags.GPSHPositioningError === 'number') {
        location.accuracy = tags.GPSHPositioningError as number;
      }
    }

    const pickNumber = (...candidates: unknown[]): number | undefined => {
      for (const c of candidates) if (typeof c === 'number') return c;
      return undefined;
    };
    const width = pickNumber(tags.ExifImageWidth, tags.PixelXDimension, tags.ImageWidth);
    const height = pickNumber(tags.ExifImageHeight, tags.PixelYDimension, tags.ImageHeight);
    const dimensions =
      width !== undefined || height !== undefined ? { width, height } : undefined;

    return {
      capturedAt,
      timezone,
      location,
      dimensions,
    };
  } catch {
    // Corrupt EXIF / unsupported codec / etc. — caller falls back to File.lastModified.
    return {};
  }
}

/* ─── Public API ───────────────────────────────────── */

export interface ExtractMetadataOptions {
  /** Override capturedAt detection. */
  capturedAtFallback?: string;
  /** Skip the pHash computation (e.g. when the caller will recompute later). */
  skipPerceptualHash?: boolean;
}

/**
 * Extract a complete PhotoMetadata record from a File.
 *
 * Workflow:
 *  1. If HEIC, normalize to JPEG first.
 *  2. Parse EXIF — pull capturedAt, timezone, GPS, dimensions.
 *  3. Compute perceptual hash + blur score on a 32x32 grayscale canvas.
 *  4. Backfill missing fields from File primitives.
 *
 * Never throws — always returns at least clientId + capturedAt.
 */
export async function extractPhotoMetadata(
  file: File,
  options: ExtractMetadataOptions = {},
): Promise<PhotoMetadata> {
  const working: File = isHeicFile(file) ? await normalizeImageFile(file) : file;

  const exif = await parseExif(working);

  const capturedAt =
    exif.capturedAt ??
    options.capturedAtFallback ??
    new Date(working.lastModified || file.lastModified || Date.now()).toISOString();

  let perceptualHash: string | undefined;
  let blurScore: number | undefined;
  let dimensions = exif.dimensions;

  if (!options.skipPerceptualHash) {
    try {
      const ph = await computePerceptualHash(working);
      perceptualHash = ph.phash;
      blurScore = ph.blurScore;
      if (!dimensions || (!dimensions.width && !dimensions.height)) {
        dimensions = { width: ph.width, height: ph.height };
      }
    } catch {
      // Image couldn't be decoded by canvas — fall back to a cheap deterministic hash
      // so the engine still has something to dedupe on.
      perceptualHash = computePerceptualHashStub(
        `${file.name}:${file.size}:${file.lastModified}`,
      );
    }
  }

  const metadata: PhotoMetadata = {
    clientId: randomClientId(),
    capturedAt,
    sizeBytes: working.size,
    mimeType: working.type || file.type || undefined,
  };

  if (exif.timezone) metadata.timezone = exif.timezone;
  if (exif.location && (exif.location.lat !== undefined || exif.location.lng !== undefined)) {
    metadata.location = exif.location;
  }
  if (dimensions && (dimensions.width || dimensions.height)) {
    metadata.dimensions = dimensions;
  }
  if (perceptualHash) metadata.perceptualHash = perceptualHash;
  if (typeof blurScore === 'number') metadata.blurScore = blurScore;

  return metadata;
}

/**
 * Extract metadata for a list of files in parallel — with a small concurrency
 * window so we don't melt the device on a 500-photo drop.
 */
export async function extractPhotoMetadataBatch(
  files: File[],
  options?: ExtractMetadataOptions & { concurrency?: number },
): Promise<PhotoMetadata[]> {
  const concurrency = Math.max(1, options?.concurrency ?? 4);
  const out: PhotoMetadata[] = new Array(files.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= files.length) return;
      out[idx] = await extractPhotoMetadata(files[idx], options);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return out;
}
