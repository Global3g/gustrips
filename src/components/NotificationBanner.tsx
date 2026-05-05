'use client';

import { useState } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationBanner() {
  const { permission, subscribing, subscribe } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already granted, denied, unsupported, or dismissed
  if (permission !== 'prompt' || dismissed) return null;

  return (
    <div className="mx-4 mb-4 rounded-xl bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Activar recordatorios</p>
          <p className="text-white/70 text-xs mt-0.5">
            Recibe alertas 30 min antes de cada evento de tu itinerario
          </p>
          <button
            onClick={subscribe}
            disabled={subscribing}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#1e3a5f] text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {subscribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            {subscribing ? 'Activando...' : 'Activar notificaciones'}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
