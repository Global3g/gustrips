/**
 * Nuclear sign-out: clears everything that can hold a stale auth state
 * (Service Workers, IndexedDB, localStorage, sessionStorage, cookies)
 * and redirects to /login. Used as a recovery escape hatch when the
 * regular Firebase Auth flow gets stuck on a corrupted persisted state
 * — symptom: requests sent without an auth token and 403 from
 * Firestore/Storage even though the app shows the user as "logged in".
 */
export async function resetSessionAndReload(): Promise<void> {
  // 1. Service Workers — unregister all so the next load is fresh.
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch (err) {
      console.warn('[resetSession] SW unregister failed', err);
    }
  }

  // 2. Cache Storage — drop all named caches the SW created.
  if (typeof caches !== 'undefined') {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (err) {
      console.warn('[resetSession] caches.delete failed', err);
    }
  }

  // 3. IndexedDB — Firebase Auth persists the session here, so this is
  //    the critical step. Iterate every database the browser knows about.
  if (typeof indexedDB !== 'undefined') {
    try {
      const dbs = (await indexedDB.databases?.()) ?? [];
      for (const { name } of dbs) {
        if (!name) continue;
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      }
    } catch (err) {
      console.warn('[resetSession] indexedDB clear failed', err);
    }
  }

  // 4. localStorage + sessionStorage.
  try {
    localStorage.clear();
  } catch {
    /* private mode — no-op */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* private mode — no-op */
  }

  // 5. Cookies — best-effort: clear any non-HttpOnly cookies on this domain.
  try {
    document.cookie.split(';').forEach((c) => {
      const eq = c.indexOf('=');
      const name = (eq > -1 ? c.slice(0, eq) : c).trim();
      if (!name) return;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  } catch {
    /* no-op */
  }

  // 6. Hard reload to /login. `location.replace` avoids a back-button
  //    entry to the (now-broken) authenticated state.
  window.location.replace('/login');
}
