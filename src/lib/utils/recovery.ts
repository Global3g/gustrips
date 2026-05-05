const STORAGE_PREFIX = 'gustrips-deleted-';
const RETENTION_DAYS = 30;

export interface DeletedItemRecord {
  key: string;
  type: 'event' | 'checklist' | 'trip';
  tripId: string;
  data: Record<string, unknown>;
  deletedAt: string;
}

/**
 * Saves a deleted item to localStorage for potential recovery.
 */
export function saveDeletedItem(
  type: 'event' | 'checklist' | 'trip',
  id: string,
  tripId: string,
  data: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  const key = `${STORAGE_PREFIX}${type}-${id}`;
  const record: DeletedItemRecord = {
    key,
    type,
    tripId,
    data,
    deletedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch (err) {
    console.error('Error saving deleted item to localStorage:', err);
  }
}

/**
 * Returns all deleted items from localStorage.
 */
export function getDeletedItems(): DeletedItemRecord[] {
  if (typeof window === 'undefined') return [];

  const items: DeletedItemRecord[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const record = JSON.parse(raw) as DeletedItemRecord;
        items.push(record);
      }
    } catch {
      // Skip malformed entries
    }
  }

  return items.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
  );
}

/**
 * Retrieves a single deleted item by its localStorage key.
 */
export function getDeletedItem(key: string): DeletedItemRecord | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DeletedItemRecord;
  } catch {
    return null;
  }
}

/**
 * Removes a deleted item from localStorage (after recovery or expiration).
 */
export function removeDeletedItem(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

/**
 * Removes items older than 30 days from localStorage.
 */
export function clearOldDeletedItems(): void {
  if (typeof window === 'undefined') return;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const record = JSON.parse(raw) as DeletedItemRecord;
      if (new Date(record.deletedAt).getTime() < cutoff) {
        keysToRemove.push(key);
      }
    } catch {
      // Remove malformed entries as well
      if (key) keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
