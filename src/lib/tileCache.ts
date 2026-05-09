/**
 * Offline-friendly tile cache backed by IndexedDB.
 *
 * Stores fetched map tiles keyed by URL so the map keeps working
 * within previously viewed areas even without internet.
 *
 * All functions are best-effort: if IndexedDB is unavailable
 * (private mode, SSR, etc.) they resolve to a no-op result.
 */

const DB_NAME = 'gustrips-tiles';
const STORE_NAME = 'tiles';
const DB_VERSION = 1;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_BYTES = 80 * 1024 * 1024; // ~80 MB
const PURGE_FRACTION = 0.25;

interface TileRecord {
  url: string;
  blob: Blob;
  ts: number;
  size: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          store.createIndex('ts', 'ts', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedTile(url: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const store = tx(db, 'readonly');
    const record = (await reqToPromise(store.get(url))) as TileRecord | undefined;
    if (!record) return null;

    // Stale: purge in background, return null
    if (Date.now() - record.ts > TTL_MS) {
      void deleteTile(url);
      return null;
    }
    return record.blob;
  } catch {
    return null;
  }
}

export async function putCachedTile(url: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const record: TileRecord = {
      url,
      blob,
      ts: Date.now(),
      size: blob.size,
    };
    const store = tx(db, 'readwrite');
    await reqToPromise(store.put(record));
    // Best-effort cleanup, don't await
    void maybePurgeOversize();
  } catch {
    // ignore
  }
}

export async function getCacheStats(): Promise<{ count: number; bytes: number }> {
  try {
    const db = await openDb();
    if (!db) return { count: 0, bytes: 0 };
    const store = tx(db, 'readonly');
    return await new Promise<{ count: number; bytes: number }>((resolve) => {
      let count = 0;
      let bytes = 0;
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const record = cursor.value as TileRecord;
          count += 1;
          bytes += record.size || 0;
          cursor.continue();
        } else {
          resolve({ count, bytes });
        }
      };
      cursorReq.onerror = () => resolve({ count, bytes });
    });
  } catch {
    return { count: 0, bytes: 0 };
  }
}

export async function clearTileCache(): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const store = tx(db, 'readwrite');
    await reqToPromise(store.clear());
  } catch {
    // ignore
  }
}

async function deleteTile(url: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const store = tx(db, 'readwrite');
    await reqToPromise(store.delete(url));
  } catch {
    // ignore
  }
}

let purging = false;
async function maybePurgeOversize(): Promise<void> {
  if (purging) return;
  purging = true;
  try {
    const db = await openDb();
    if (!db) return;

    // First pass: count + bytes
    const stats = await getCacheStats();
    if (stats.bytes <= MAX_BYTES) return;

    // Collect all records sorted by ts ascending and drop the oldest 25%
    const store = tx(db, 'readonly');
    const index = store.index('ts');
    const records: { url: string; ts: number }[] = await new Promise((resolve) => {
      const out: { url: string; ts: number }[] = [];
      const cursorReq = index.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const record = cursor.value as TileRecord;
          out.push({ url: record.url, ts: record.ts });
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      cursorReq.onerror = () => resolve(out);
    });

    const dropCount = Math.max(1, Math.floor(records.length * PURGE_FRACTION));
    const toDrop = records.slice(0, dropCount);
    if (toDrop.length === 0) return;

    const writeStore = tx(db, 'readwrite');
    for (const { url } of toDrop) {
      writeStore.delete(url);
    }
  } catch {
    // ignore
  } finally {
    purging = false;
  }
}
