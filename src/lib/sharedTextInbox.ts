/**
 * IndexedDB store for text/url payloads arriving via the Web Share Target —
 * the "share a reservation into GusTrips" flow. Kept separate from the photo
 * `sharedInbox` because the payload shape differs (no blobs, just strings) and
 * we don't want a shared reservation to ever show up in the photo importer.
 *
 * The service worker writes here on POST /share when the share carried text or
 * a URL but no files; the `/share` page drains it on mount.
 */

export interface SharedTextItem {
  id: string;
  title: string;
  text: string;
  url: string;
  receivedAt: number;
}

export const SHARED_TEXT_DB_NAME = 'gustrips-shared-text';
export const SHARED_TEXT_DB_VERSION = 1;
export const SHARED_TEXT_STORE = 'inbox';

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(SHARED_TEXT_DB_NAME, SHARED_TEXT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARED_TEXT_STORE)) {
        db.createObjectStore(SHARED_TEXT_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open shared-text DB'));
  });
}

export async function listTextInbox(): Promise<SharedTextItem[]> {
  if (!isAvailable()) return [];
  try {
    const db = await openDb();
    return await new Promise<SharedTextItem[]>((resolve, reject) => {
      const tx = db.transaction(SHARED_TEXT_STORE, 'readonly');
      const store = tx.objectStore(SHARED_TEXT_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const all = (req.result ?? []) as SharedTextItem[];
        all.sort((a, b) => a.receivedAt - b.receivedAt);
        resolve(all);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('listTextInbox failed'));
      };
    });
  } catch {
    return [];
  }
}

export async function removeTextItem(id: string): Promise<void> {
  if (!isAvailable() || !id) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SHARED_TEXT_STORE, 'readwrite');
      const store = tx.objectStore(SHARED_TEXT_STORE);
      const req = store.delete(id);
      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('removeTextItem failed'));
      };
    });
  } catch {
    // ignore
  }
}

export async function clearTextInbox(): Promise<void> {
  if (!isAvailable()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SHARED_TEXT_STORE, 'readwrite');
      const store = tx.objectStore(SHARED_TEXT_STORE);
      const req = store.clear();
      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('clearTextInbox failed'));
      };
    });
  } catch {
    // ignore
  }
}
