'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/constants';

/**
 * Optimistic auth gate. Instead of blocking the entire app behind a
 * spinner while Firebase Auth restores the session from IndexedDB (~1-3 s
 * on phones), we render children immediately if we've ever seen a signed-in
 * user before (persisted in localStorage). If the real auth check later
 * says "no", we redirect to /login then. The downside — a logged-out user
 * sees app chrome for a moment before the redirect — is far better than
 * every visit eating 2 seconds of dead spinner.
 */
const LAST_AUTHED_KEY = 'gustrips:lastAuthed';

function readOptimisticAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LAST_AUTHED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  // Always `false` on the server (and on the very first client render so
  // hydration matches). The "have we logged in before?" verdict is read
  // from localStorage in the effect below, AFTER hydration is committed.
  // Reading localStorage during render breaks hydration (server says false,
  // client says true) — that triggers React #418 and then a cascading
  // re-render storm (#301) once the error boundary catches it.
  const [optimistic, setOptimistic] = useState<boolean>(false);

  // Hydrate the optimistic verdict from localStorage after mount.
  useEffect(() => {
    setOptimistic(readOptimisticAuthed());
  }, []);

  // Persist the verdict so the next visit can skip the spinner entirely.
  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined') return;
    try {
      if (isAuthenticated) {
        window.localStorage.setItem(LAST_AUTHED_KEY, '1');
        setOptimistic(true);
      } else {
        window.localStorage.removeItem(LAST_AUTHED_KEY);
        setOptimistic(false);
      }
    } catch {
      /* localStorage unavailable — proceed */
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push(ROUTES.login);
    }
  }, [loading, isAuthenticated, router]);

  // Fast path: optimistically render — Firebase Auth almost always
  // restores the same session that was here last time.
  if (optimistic || isAuthenticated) {
    return <>{children}</>;
  }

  // Cold first-ever visit (no cached verdict) and auth still resolving.
  if (loading) {
    return (
      <div className="app-bg-gradient flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70 text-sm font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // Auth resolved → not authenticated. Redirect already queued; render nothing.
  return null;
}
