'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Global offline banner. Shows a persistent amber/red bar while offline and a
 * brief green "reconnected" toast for 2.5s when connectivity returns.
 */
export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowReconnected(true);
      const timeout = window.setTimeout(() => setShowReconnected(false), 2500);
      return () => window.clearTimeout(timeout);
    }
  }, [isOnline]);

  const handleReconnect = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[60] py-1.5 px-4 backdrop-blur-md border-y border-amber-300/30"
          style={{
            background:
              'linear-gradient(90deg, rgba(245, 158, 11, 0.20), rgba(239, 68, 68, 0.20))',
          }}
        >
          <div className="flex items-center justify-center gap-3 text-sm text-amber-50">
            <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" aria-hidden="true" />
            <span className="text-center font-medium">
              Sin conexion - los cambios se guardan y se sincronizan al volver
            </span>
            <button
              type="button"
              onClick={handleReconnect}
              className="ml-2 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-amber-50 transition-colors"
            >
              Reconectar
            </button>
          </div>
        </motion.div>
      )}

      {isOnline && showReconnected && (
        <motion.div
          key="reconnected-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[60] py-1.5 px-4 backdrop-blur-md border-y border-emerald-300/30"
          style={{
            background:
              'linear-gradient(90deg, rgba(16, 185, 129, 0.22), rgba(34, 197, 94, 0.22))',
          }}
        >
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-50">
            <Check className="w-4 h-4 text-emerald-200" aria-hidden="true" />
            <span className="text-center font-medium">Conectado de nuevo</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
