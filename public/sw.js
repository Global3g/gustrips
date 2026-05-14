/* GusTrips Service Worker
 * - Cache-first for /_next/static, fonts, JS, CSS (immutable)
 * - Stale-while-revalidate for HTML app-shell routes
 * - Cache-first w/ 30-day max age for Firebase Storage images
 * - Excludes /login, /api, /share (POST) from caching
 * - Preserves: Web Share Target (POST /share) + Push notifications
 */

const SW_VERSION = 'gustrips-v3-2026-05-14';
const STATIC_CACHE = `${SW_VERSION}-static`;
const SHELL_CACHE = `${SW_VERSION}-shell`;
const IMAGE_CACHE = `${SW_VERSION}-images`;

const IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SHELL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days fallback freshness

// Routes we never cache responses for (auth-sensitive or POST endpoints).
const NEVER_CACHE_PATHS = [
  '/login',
  '/register',
  '/api/',
];

const APP_SHELL_URLS = [
  '/dashboard',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const shell = await caches.open(SHELL_CACHE);
      // Try to prime the dashboard + icons. If the user is offline at install
      // time, individual failures are swallowed so install still succeeds.
      await Promise.all(
        APP_SHELL_URLS.map((url) =>
          shell.add(url).catch(() => {/* best-effort */})
        )
      );
    } catch {
      // best-effort
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(SW_VERSION))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ── Web Share Target ──
 * PWA manifest declares share_target.action = "/share". On POST we stash files
 * in IndexedDB then redirect to GET /share so the page can route them. */

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

/* ── Cache helpers ── */

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:js|css|woff2?|ttf|otf|eot|ico)$/i.test(url.pathname)
  );
}

function isAppIcon(url) {
  return /\/(favicon\.(?:png|ico|svg)|apple-touch-icon\.png|icon-\d+\.png|compass-icon\.png|manifest\.json)$/i.test(
    url.pathname,
  );
}

function isFirebaseImage(url) {
  return (
    url.hostname === 'firebasestorage.googleapis.com' ||
    url.hostname.endsWith('.googleusercontent.com')
  );
}

function isHtmlRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

function isExcluded(url) {
  if (NEVER_CACHE_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p))) {
    return true;
  }
  return false;
}

async function cacheFirst(req, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    // Check freshness for images / shell. Static immutable assets get no TTL.
    if (maxAgeMs) {
      const dateHeader = cached.headers.get('sw-cached-at');
      if (dateHeader) {
        const cachedAt = Number(dateHeader);
        if (!Number.isNaN(cachedAt) && Date.now() - cachedAt < maxAgeMs) {
          return cached;
        }
      } else {
        return cached;
      }
    } else {
      return cached;
    }
  }
  try {
    const network = await fetch(req);
    if (network && network.ok && network.type !== 'opaqueredirect') {
      // Wrap the response to stamp cached-at metadata.
      const cloned = await stampedResponse(network.clone());
      cache.put(req, cloned).catch(() => {/* quota / opaque issues */});
    }
    return network;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then(async (res) => {
      if (res && res.ok && res.type !== 'opaqueredirect') {
        const stamped = await stampedResponse(res.clone());
        cache.put(req, stamped).catch(() => {});
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    // Kick off revalidation but return cached immediately.
    networkPromise.catch(() => {});
    return cached;
  }
  const network = await networkPromise;
  if (network) return network;
  // Last-resort offline fallback: try the cached dashboard.
  const fallback = await cache.match('/dashboard');
  if (fallback) return fallback;
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function stampedResponse(res) {
  // Wrap a response so we know when it was cached. We can't mutate headers on
  // an opaque/network response directly, so we rebuild it.
  try {
    const body = await res.blob();
    const headers = new Headers(res.headers);
    headers.set('sw-cached-at', String(Date.now()));
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch {
    return res;
  }
}

/* ── Fetch handler ── */

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // ── Web Share Target (POST /share) ──
  if (req.method === 'POST') {
    const url = new URL(req.url);
    if (url.pathname === '/share') {
      event.respondWith((async () => {
        try {
          const formData = await req.formData();
          const files = formData.getAll('files');
          if (files.length > 0) {
            await stashSharedFiles(files);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[SW] share target stash failed', err);
        }
        return Response.redirect('/share?incoming=1', 303);
      })());
      return;
    }
    // All other POSTs: passthrough.
    return;
  }

  // Only GETs from here on.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin: only handle Firebase Storage images, skip the rest.
  if (url.origin !== self.location.origin) {
    if (isFirebaseImage(url)) {
      event.respondWith(cacheFirst(req, IMAGE_CACHE, IMAGE_MAX_AGE_MS));
    }
    return;
  }

  // Auth-sensitive / API endpoints: passthrough, no caching.
  if (isExcluded(url)) {
    return;
  }

  // Service worker itself: always network so updates land.
  if (url.pathname === '/sw.js') {
    return;
  }

  // Static assets (JS/CSS/fonts/_next/static): cache-first, immutable.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE, null));
    return;
  }

  // PWA icons / favicons: cache-first with shell TTL.
  if (isAppIcon(url)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE, SHELL_MAX_AGE_MS));
    return;
  }

  // HTML / navigation: stale-while-revalidate against shell cache.
  if (isHtmlRequest(req)) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }

  // Everything else (images, fetches, etc.): try network with cache fallback.
  event.respondWith((async () => {
    try {
      const network = await fetch(req);
      return network;
    } catch {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      throw new Error('Offline and no cached response');
    }
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
      for (const client of clients) {
        if (client.url.includes('/trips/') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

/* ── Allow the page to ask us to skipWaiting (forces fresh SW activation) ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
