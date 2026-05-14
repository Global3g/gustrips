'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js. When a new SW is found the page receives a
 * `controllerchange` event; we silently activate it (skipWaiting) so the next
 * navigation runs against fresh assets — no hard reload prompt.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register after first paint to avoid contending with the initial render.
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // If there is already a waiting worker (user has visited before and an
        // updated SW is queued), activate it now.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // An update is ready. Activate it on the next nav — don't force
              // a reload mid-session.
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[sw] register failed', err);
      }
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
