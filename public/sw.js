/* GusTrips Service Worker — Push Notifications + Web Share Target */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* ── Web Share Target ──
   The PWA manifest declares share_target.action = "/share" with method POST
   and multipart/form-data. When the user picks "GusTrips" from the macOS/iOS
   share sheet (Photos.app, Safari, etc.), the OS posts to /share. We intercept
   that POST here, stash the files in IndexedDB, and 303-redirect to GET /share
   so the page can pick them up and route them to the right trip.

   Falls through (no respondWith) for everything else — keeps the network path
   untouched and avoids the latency regression we hit before. */

const SHARED_INBOX_DB_NAME = 'gustrips-shared-inbox';
const SHARED_INBOX_DB_VERSION = 1;
const SHARED_INBOX_STORE = 'inbox';

function openSharedInboxDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARED_INBOX_DB_NAME, SHARED_INBOX_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARED_INBOX_STORE)) {
        db.createObjectStore(SHARED_INBOX_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('open shared-inbox failed'));
  });
}

function generateId() {
  const ts = Date.now().toString(36).padStart(10, '0');
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

async function stashSharedFiles(files) {
  const db = await openSharedInboxDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARED_INBOX_STORE, 'readwrite');
    const store = tx.objectStore(SHARED_INBOX_STORE);
    const now = Date.now();
    for (const file of files) {
      if (!file || typeof file === 'string') continue;
      const blob = file instanceof Blob ? file : null;
      if (!blob) continue;
      store.put({
        id: generateId(),
        fileBlob: blob,
        fileName: (file.name || 'shared.jpg'),
        fileType: file.type || blob.type || 'image/jpeg',
        receivedAt: now,
      });
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('stash failed')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('stash aborted')); };
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'POST') return;

  const url = new URL(req.url);
  if (url.pathname !== '/share') return;

  event.respondWith((async () => {
    try {
      const formData = await req.formData();
      const files = formData.getAll('files');
      if (files.length > 0) {
        await stashSharedFiles(files);
      }
    } catch (err) {
      // Fall through to GET — we'd rather show an empty share page than 500
      // since iOS/macOS doesn't surface error responses to the user.
      // eslint-disable-next-line no-console
      console.warn('[SW] share target stash failed', err);
    }
    return Response.redirect('/share?incoming=1', 303);
  })());
});

/* ── Push event — show notification ── */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'GusTrips', body: event.data.text() };
  }

  const { title, body, icon, badge, data, tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title || 'GusTrips', {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      tag: tag || 'gustrips-reminder',
      data: data || {},
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Ver evento' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
    }),
  );
});

/* ── Notification click — open trip page ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if found
      for (const client of clients) {
        if (client.url.includes('/trips/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url);
    }),
  );
});
