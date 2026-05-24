/**
 * Main-thread client for the photo-processing Web Worker.
 *
 * Spawns a single shared Worker on first use, multiplexes concurrent calls
 * onto it via a per-request `id`, and tears the worker down after a period
 * of inactivity so it doesn't squat on ~10 MB of decoded-image memory for
 * the rest of the session.
 *
 * Falls back gracefully when:
 *   - the runtime has no `Worker` (very old browsers, some embedded views)
 *   - the runtime has no `OffscreenCanvas` (the worker's compression step
 *     requires it; older Safari and Firefox ESR were missing this until
 *     2023). In that case we return `{ fallback: true }` synchronously so
 *     the caller can run the original main-thread pipeline.
 *
 * The worker URL uses `new URL(..., import.meta.url)` which is the pattern
 * Next.js 15 / Webpack 5 understands natively — no special config needed,
 * the worker file gets bundled and emitted as a separate chunk.
 */

export interface PhotoWorkerResult {
  thumb: Blob;
  original: Blob;
  contentHash: string;
}

export interface PhotoWorkerFallback {
  fallback: true;
  reason: string;
}

interface PendingEntry {
  resolve: (value: PhotoWorkerResult | PhotoWorkerFallback) => void;
  reject: (reason: unknown) => void;
}

// Idle timeout: after 60 s with zero outstanding work we terminate the worker
// so we don't hold a libheif WASM instance forever.
const IDLE_TERMINATE_MS = 60_000;

let workerInstance: Worker | null = null;
const pending = new Map<string, PendingEntry>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
}

function scheduleIdleTeardown(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (pending.size === 0 && workerInstance) {
      try {
        workerInstance.terminate();
      } catch {
        /* ignore */
      }
      workerInstance = null;
    }
  }, IDLE_TERMINATE_MS);
}

function cancelIdleTeardown(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

interface WorkerMessage {
  id: string;
  ok: boolean;
  thumb?: Blob;
  original?: Blob;
  contentHash?: string;
  error?: string;
  reason?: string;
}

function getWorker(): Worker {
  if (workerInstance) {
    cancelIdleTeardown();
    return workerInstance;
  }
  const worker = new Worker(
    new URL('./photoProcessor.worker.ts', import.meta.url),
    { type: 'module' },
  );
  worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    if (!msg || typeof msg.id !== 'string') return;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);

    if (msg.ok && msg.thumb && msg.original && typeof msg.contentHash === 'string') {
      entry.resolve({
        thumb: msg.thumb,
        original: msg.original,
        contentHash: msg.contentHash,
      });
    } else if (!msg.ok && msg.reason === 'heic-needs-main-thread') {
      entry.resolve({ fallback: true, reason: 'heic-needs-main-thread' });
    } else {
      entry.reject(new Error(msg.error ?? 'photo worker failed'));
    }

    if (pending.size === 0) scheduleIdleTeardown();
  });
  worker.addEventListener('error', (event: ErrorEvent) => {
    // If the worker itself dies (e.g. module load failure), reject every
    // pending request so callers don't hang.
    const err = new Error(event.message || 'photo worker error');
    for (const [, entry] of pending) entry.reject(err);
    pending.clear();
    try {
      worker.terminate();
    } catch {
      /* ignore */
    }
    if (workerInstance === worker) workerInstance = null;
  });
  workerInstance = worker;
  return worker;
}

/**
 * Process a photo (HEIC convert + thumb/full compress + SHA-256) inside the
 * shared Web Worker.
 *
 * Returns either:
 *   - { thumb, full, contentHash } on success
 *   - { fallback: true, reason } if the worker isn't supported here, or if
 *     the worker decided HEIC must run on the main thread (server fallback
 *     needs Firebase Auth which only lives on the main thread).
 *
 * Rejects only on genuine processing failure (decode error, etc.) — the
 * caller should treat that as "give up on the worker for this file and
 * retry on the main thread" rather than as a fatal upload error.
 */
export async function processPhotoInWorker(
  file: File | Blob,
  fileName: string,
  fileType: string,
): Promise<PhotoWorkerResult | PhotoWorkerFallback> {
  if (!isWorkerSupported()) {
    return { fallback: true, reason: 'no-worker-support' };
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const worker = getWorker();
  cancelIdleTeardown();

  return new Promise<PhotoWorkerResult | PhotoWorkerFallback>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      worker.postMessage({
        id,
        op: 'process',
        file,
        fileName,
        fileType,
      });
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}

/**
 * Test / cleanup hook — terminate the worker immediately. Safe to call when
 * there are no in-flight requests; if there are, they will reject.
 */
export function terminatePhotoWorker(): void {
  cancelIdleTeardown();
  if (workerInstance) {
    try {
      workerInstance.terminate();
    } catch {
      /* ignore */
    }
    workerInstance = null;
  }
  for (const [, entry] of pending) {
    entry.reject(new Error('photo worker terminated'));
  }
  pending.clear();
}
