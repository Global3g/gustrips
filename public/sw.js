/* GusTrips Service Worker — Push Notifications */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* ── Fetch handler intentionally omitted ──
   We previously called `event.respondWith(fetch(event.request))` for same-origin
   requests, which forced every navigation through the SW with no caching benefit
   and added latency on slow mobile networks. Removing the listener entirely lets
   the browser handle requests directly. The PWA install prompt does not require
   the SW to actively intercept fetches — registration alone is sufficient on
   modern browsers. */

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
