/// <reference lib="webworker" />

/**
 * Photo-processing Web Worker.
 *
 * Runs the expensive parts of the upload pipeline OFF the main thread so the
 * UI stays responsive when the user picks 20+ photos at once:
 *
 *   1. SHA-256 hash of the original bytes (used for dedup fingerprinting).
 *   2. HEIC -> JPEG conversion via heic2any (when applicable).
 *   3. Two compression passes (thumb @ 600px / 0.75 and full @ 3000px / 0.92)
 *      using OffscreenCanvas + createImageBitmap.
 *
 * heic2any internally instantiates libheif-js (a WASM module). It works inside
 * a module Worker in modern browsers, but if the dynamic import or the WASM
 * instantiation throws we degrade gracefully and tell the main thread to
 * handle HEIC there (the server fallback in heic.ts is main-thread-only
 * anyway because it needs Firebase Auth).
 *
 * Message protocol (main -> worker):
 *   { id: string, op: 'process', file: File | Blob, fileName: string, fileType: string }
 *
 * Message protocol (worker -> main):
 *   { id, ok: true, thumb: Blob, full: Blob, contentHash: string }
 *   { id, ok: false, error: string }
 *   { id, ok: false, reason: 'heic-needs-main-thread' }
 */

// Tell TypeScript this file runs in a DedicatedWorkerGlobalScope, not Window.
declare const self: DedicatedWorkerGlobalScope;

const HEIC_EXTENSIONS = ['.heic', '.heif'];
const HEIC_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

interface ProcessRequest {
  id: string;
  op: 'process';
  file: File | Blob;
  fileName: string;
  fileType: string;
}

interface ProcessSuccess {
  id: string;
  ok: true;
  thumb: Blob;
  /**
   * The full-resolution original to archive (download / print / photobook).
   * For HEIC inputs this is the converted JPEG; otherwise the source bytes
   * pass through untouched. The big display version is no longer produced
   * here — the Resize Images extension generates the WebP derivatives
   * server-side from this original.
   */
  original: Blob;
  contentHash: string;
}

interface ProcessFailure {
  id: string;
  ok: false;
  error: string;
  reason?: 'heic-needs-main-thread';
}

type WorkerResponse = ProcessSuccess | ProcessFailure;

function isHeicHint(fileName: string, fileType: string): boolean {
  const type = (fileType || '').toLowerCase();
  if (HEIC_MIME_TYPES.includes(type)) return true;
  const name = (fileName || '').toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Magic-byte check for HEIF containers. Mirrors the logic in src/lib/heic.ts
 * so we don't pay the heic2any import cost for files that just happen to
 * carry a .heic extension but actually contain JPEG/PNG bytes.
 */
async function isActuallyHeif(blob: Blob): Promise<boolean> {
  try {
    const head = await blob.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(head);
    if (bytes.length < 12) return false;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return false;
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return false;
    }
    if (
      bytes[4] !== 0x66 ||
      bytes[5] !== 0x74 ||
      bytes[6] !== 0x79 ||
      bytes[7] !== 0x70
    ) {
      return false;
    }
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    const heifBrands = new Set([
      'heic', 'heix', 'mif1', 'msf1', 'heim', 'heis', 'hevc', 'hevx', 'avif',
    ]);
    return heifBrands.has(brand);
  } catch {
    return false;
  }
}

/** SHA-256 of the raw bytes -> hex string. */
async function computeContentHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Convert a HEIC blob to JPEG using heic2any inside the worker.
 * Returns null if heic2any can't be loaded here — the caller will signal
 * the main thread to take over.
 */
async function convertHeicInWorker(blob: Blob): Promise<Blob | null> {
  try {
    const mod = (await import('heic2any')) as unknown as {
      default?: (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;
    } & ((opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>);
    const heic2any = mod.default ?? mod;
    const out = await heic2any({ blob, toType: 'image/jpeg', quality: 0.92 });
    const jpeg = Array.isArray(out) ? out[0] : out;
    if (!jpeg) return null;
    return jpeg;
  } catch {
    // heic2any unavailable in this worker context (some browsers still
    // block dynamic WASM in module workers). Fall back to main thread.
    return null;
  }
}

/**
 * Decode a blob into an ImageBitmap. createImageBitmap is available in
 * Workers and decodes off the main thread internally.
 */
async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/**
 * Compress an ImageBitmap to a JPEG Blob via OffscreenCanvas.
 * Mirrors the main-thread `compressImage` in photoUploader.ts but stays
 * inside the worker.
 */
async function compressBitmap(
  bitmap: ImageBitmap,
  maxWidth: number,
  quality: number,
): Promise<Blob> {
  const ratio = Math.min(maxWidth / bitmap.width, 1);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  if (!blob) throw new Error('convertToBlob returned null');
  return blob;
}

async function handleProcess(req: ProcessRequest): Promise<WorkerResponse> {
  const { id, file, fileName, fileType } = req;

  // Hash the ORIGINAL bytes before any conversion, so the fingerprint is
  // stable across HEIC pipeline changes (matches behaviour in photoUploader).
  const hashPromise = computeContentHash(file).catch(() => '');

  let workingBlob: Blob = file;

  if (isHeicHint(fileName, fileType)) {
    const reallyHeif = await isActuallyHeif(file);
    if (reallyHeif) {
      const converted = await convertHeicInWorker(file);
      if (!converted) {
        // Tell the main thread to handle HEIC (server fallback needs Auth).
        return {
          id,
          ok: false,
          error: 'heic-needs-main-thread',
          reason: 'heic-needs-main-thread',
        };
      }
      workingBlob = converted;
    }
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeBitmap(workingBlob);
  } catch (err) {
    return {
      id,
      ok: false,
      error: `decode failed: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  try {
    // Only the small grid thumb is generated on-device now. The expensive
    // 3000px encode is gone — the extension makes the display sizes (WebP)
    // server-side from `original`.
    const thumb = await compressBitmap(bitmap, 400, 0.78);
    const contentHash = await hashPromise;
    return { id, ok: true, thumb, original: workingBlob, contentHash };
  } catch (err) {
    return {
      id,
      ok: false,
      error: `compress failed: ${(err as Error)?.message ?? String(err)}`,
    };
  } finally {
    // Release the decoded bitmap promptly so the worker's heap doesn't
    // balloon during a 20-photo batch.
    bitmap.close();
  }
}

self.addEventListener('message', (event: MessageEvent<ProcessRequest>) => {
  const req = event.data;
  if (!req || req.op !== 'process' || typeof req.id !== 'string') {
    return;
  }
  void handleProcess(req)
    .then((response) => {
      self.postMessage(response);
    })
    .catch((err: unknown) => {
      const fail: ProcessFailure = {
        id: req.id,
        ok: false,
        error: (err as Error)?.message ?? String(err),
      };
      self.postMessage(fail);
    });
});

// Make this file a module (required for `type: 'module'` workers).
export {};
