'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const STORAGE_KEY = 'gustrips:lastMutationAt';
const RECENT_MUTATION_WINDOW_MS = 60_000;
const SYNCED_FLASH_MS = 2200;

/**
 * Record that a write/mutation was just attempted. Used by SyncIndicator to
 * decide whether to display the "pending changes" pill while offline.
 */
export function markMutation(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage may be unavailable (private mode, etc.) - silently ignore.
  }
}

function readLastMutationAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Tiny pill in the bottom-right that surfaces sync status. While offline and
 * the user has performed a mutation in the last minute, show "Cambios
 * pendientes". When connectivity returns, briefly flash "Sincronizado".
 */
export default function SyncIndicator() {
  const isOnline = useOnlineStatus();
  const wasOfflineWithPendingRef = useRef(false);
  const [hasRecentMutation, setHasRecentMutation] = useState(false);
  const [showSyncedFlash, setShowSyncedFlash] = useState(false);

  // Re-evaluate whether there is a recent mutation while offline.
  useEffect(() => {
    if (isOnline) {
      setHasRecentMutation(false);
      return;
    }

    const recompute = () => {
      const last = readLastMutationAt();
      setHasRecentMutation(last > 0 && Date.now() - last < RECENT_MUTATION_WINDOW_MS);
    };

    recompute();
    const interval = window.setInterval(recompute, 5_000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) recompute();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [isOnline]);

  // Track whether we should show the synced flash on reconnect.
  useEffect(() => {
    if (!isOnline) {
      if (hasRecentMutation) wasOfflineWithPendingRef.current = true;
      return;
    }

    if (wasOfflineWithPendingRef.current) {
      wasOfflineWithPendingRef.current = false;
      setShowSyncedFlash(true);
      const timeout = window.setTimeout(() => setShowSyncedFlash(false), SYNCED_FLASH_MS);
      return () => window.clearTimeout(timeout);
    }
  }, [isOnline, hasRecentMutation]);

  const showPending = !isOnline && hasRecentMutation;

  return (
    <AnimatePresence>
      {showPending && (
        <motion.div
          key="sync-pending"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-44 right-6 lg:bottom-28 z-[55] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-amber-50 bg-amber-500/20 border border-amber-300/40 backdrop-blur-md shadow-lg shadow-amber-900/20 animate-pulse">
            <span aria-hidden="true">⏳</span>
            <span>Cambios pendientes</span>
          </div>
        </motion.div>
      )}

      {!showPending && showSyncedFlash && (
        <motion.div
          key="sync-done"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-44 right-6 lg:bottom-28 z-[55] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-50 bg-emerald-500/20 border border-emerald-300/40 backdrop-blur-md shadow-lg shadow-emerald-900/20">
            <span aria-hidden="true">✓</span>
            <span>Sincronizado</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
