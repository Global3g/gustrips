/**
 * IndexedDB-backed queue for photo uploads that fail (or are deferred) while
 * the device is offline. Used by `useAlbum.addPhoto` to persist the raw image
 * blob so it can be re-uploaded once connectivity returns.
 *
 * No external dependencies — uses the native IndexedDB API and degrades to
 * safe no-op defaults if IndexedDB is unavailable (private mode, SSR, etc).
 */

export interface PendingPhoto {
  id: string;
  tripId: string;
  date: string;
  caption?: string;
  eventId?: string;
  fileBlob: Blob;
  fileType: string;
  fileName: string;
  enqueuedAt: number;
  attempts: number;
}

const DB_NAME = 'gustrips-pending-photos';
const DB_VERSION = 1;
const STORE_NAME = 'pending';
const TRIP_INDEX = 'tripId';

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function generateId(): string {
  // ulid-like: timestamp prefix + random suffix for ordering
  const ts = Date.now().toString(36).padStart(10, '0');
  const rand = Math.random().toString(36).slice(2, 10);
  const rand2 = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}${rand2}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex(TRIP_INDEX, 'tripId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open DB'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result: T;
    Promise.resolve(fn(store))
      .then((v) => {
        result = v;
      })
      .catch((err) => {
        try { tx.abort(); } catch { /* noop */ }
        reject(err);
      });
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Transaction failed'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('Transaction aborted'));
    };
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Request failed'));
  });
}

export async function enqueuePhoto(
  item: Omit<PendingPhoto, 'id' | 'enqueuedAt' | 'attempts'>,
): Promise<string> {
  if (!isAvailable()) return '';
  try {
    const id = generateId();
    const record: PendingPhoto = {
      ...item,
      id,
      enqueuedAt: Date.now(),
      attempts: 0,
    };
    await withStore('readwrite', (store) => reqToPromise(store.add(record)));
    return id;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[pendingPhotos] enqueue failed', err);
    }
    return '';
  }
}

export async function listPending(tripId?: string): Promise<PendingPhoto[]> {
  if (!isAvailable()) return [];
  try {
    return await withStore('readonly', async (store) => {
      if (tripId) {
        const idx = store.index(TRIP_INDEX);
        const req = idx.getAll(IDBKeyRange.only(tripId));
        const all = await reqToPromise<PendingPhoto[]>(req);
        return all ?? [];
      }
      const req = store.getAll();
      const all = await reqToPromise<PendingPhoto[]>(req);
      return all ?? [];
    });
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[pendingPhotos] list failed', err);
    }
    return [];
  }
}

export async function removePending(id: string): Promise<void> {
  if (!isAvailable() || !id) return;
  try {
    await withStore('readwrite', (store) => reqToPromise(store.delete(id)));
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[pendingPhotos] remove failed', err);
    }
  }
}

export async function bumpAttempts(id: string): Promise<void> {
  if (!isAvailable() || !id) return;
  try {
    await withStore('readwrite', async (store) => {
      const existing = await reqToPromise<PendingPhoto | undefined>(store.get(id));
      if (!existing) return;
      existing.attempts = (existing.attempts ?? 0) + 1;
      await reqToPromise(store.put(existing));
    });
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[pendingPhotos] bumpAttempts failed', err);
    }
  }
}

export async function clearPending(tripId?: string): Promise<void> {
  if (!isAvailable()) return;
  try {
    await withStore('readwrite', async (store) => {
      if (!tripId) {
        await reqToPromise(store.clear());
        return;
      }
      const idx = store.index(TRIP_INDEX);
      const req = idx.openCursor(IDBKeyRange.only(tripId));
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => reject(req.error ?? new Error('Cursor failed'));
      });
    });
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[pendingPhotos] clear failed', err);
    }
  }
}
