/**
 * IndexedDB store for files arriving via the Web Share Target. The service
 * worker handles the POST that Photos.app (or any "Share to GusTrips" source)
 * sends; it stashes the raw blobs here, then the `/share` page picks them up.
 *
 * Kept separate from `pendingPhotos` because the semantics differ: pending
 * photos are committed-but-unuploaded mutations on a known trip; shared inbox
 * items are loose files awaiting a destination and a date.
 */

export interface SharedInboxItem {
  id: string;
  fileBlob: Blob;
  fileName: string;
  fileType: string;
  receivedAt: number;
}

export const SHARED_INBOX_DB_NAME = 'gustrips-shared-inbox';
export const SHARED_INBOX_DB_VERSION = 1;
export const SHARED_INBOX_STORE = 'inbox';

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(SHARED_INBOX_DB_NAME, SHARED_INBOX_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARED_INBOX_STORE)) {
        db.createObjectStore(SHARED_INBOX_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open shared-inbox DB'));
  });
}

export async function listInbox(): Promise<SharedInboxItem[]> {
  if (!isAvailable()) return [];
  try {
    const db = await openDb();
    return await new Promise<SharedInboxItem[]>((resolve, reject) => {
      const tx = db.transaction(SHARED_INBOX_STORE, 'readonly');
      const store = tx.objectStore(SHARED_INBOX_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const all = (req.result ?? []) as SharedInboxItem[];
        all.sort((a, b) => a.receivedAt - b.receivedAt);
        resolve(all);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('listInbox failed'));
      };
    });
  } catch {
    return [];
  }
}

export async function removeInboxItem(id: string): Promise<void> {
  if (!isAvailable() || !id) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SHARED_INBOX_STORE, 'readwrite');
      const store = tx.objectStore(SHARED_INBOX_STORE);
      const req = store.delete(id);
      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('removeInboxItem failed'));
      };
    });
  } catch {
    // ignore
  }
}

export async function clearInbox(): Promise<void> {
  if (!isAvailable()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SHARED_INBOX_STORE, 'readwrite');
      const store = tx.objectStore(SHARED_INBOX_STORE);
      const req = store.clear();
      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('clearInbox failed'));
      };
    });
  } catch {
    // ignore
  }
}

/**
 * Convert a SharedInboxItem back into a File for the upload pipeline.
 */
export function itemToFile(item: SharedInboxItem): File {
  return new File([item.fileBlob], item.fileName, {
    type: item.fileType || item.fileBlob.type || 'image/jpeg',
    lastModified: item.receivedAt,
  });
}
