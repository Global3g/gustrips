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
         
        console.log('[sw] registered, scope:', reg.scope);

        // If there is already a waiting worker (user has visited before and an
        // updated SW is queued), activate it now.
        if (reg.waiting) {
           
          console.log('[sw] activating waiting worker');
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if (reg.active) {
           
          console.log('[sw] active worker present — offline mode ready');
        }

        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
             
            console.log('[sw] new worker state:', newSW.state);
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
            if (newSW.state === 'activated') {
               
              console.log('[sw] new version activated — offline cache primed');
            }
          });
        });

        // Force an immediate update check on every visit.
        reg.update().catch(() => {/* ignore */});
      } catch (err) {
         
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
