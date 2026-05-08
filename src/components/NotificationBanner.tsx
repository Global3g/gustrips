'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { format, addDays } from 'date-fns';
import {
  Bell,
  X,
  Loader2,
  PlayCircle,
  Clock,
  Coffee,
  Paperclip,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useEvents } from '@/hooks/useEvents';
import { useDocuments } from '@/hooks/useDocuments';
import type { TripEvent, TripAttachment, EventType } from '@/types';

// ─── Types ────────────────────────────────────────────
type ContextualBanner = {
  id: string;
  type: 'info' | 'warning' | 'urgent';
  icon: LucideIcon;
  message: string;
  action?: { label: string; href: string };
};

const DISMISSED_STORAGE_KEY = 'gustrips:dismissed-banners';
const ROTATE_INTERVAL_MS = 10000;
const TICK_INTERVAL_MS = 60000;

// ─── Banner builder ───────────────────────────────────
function buildBanners(
  events: TripEvent[],
  documents: TripAttachment[],
  tripId: string,
  now: Date,
): ContextualBanner[] {
  const banners: ContextualBanner[] = [];
  const todayStr = format(now, 'yyyy-MM-dd');

  // 2 + 3: live or imminent events (today only)
  for (const e of events) {
    if (!e.startTime || !e.date) continue;
    if (e.date !== todayStr) continue;
    try {
      const start = new Date(`${e.date}T${e.startTime}`);
      if (Number.isNaN(start.getTime())) continue;
      const end = e.endTime
        ? new Date(`${e.date}T${e.endTime}`)
        : start;
      const minsUntilStart = Math.round(
        (start.getTime() - now.getTime()) / 60000,
      );
      const minsUntilEnd = Math.round(
        (end.getTime() - now.getTime()) / 60000,
      );

      if (minsUntilStart <= 0 && minsUntilEnd > 0) {
        banners.push({
          id: `live:${e.id}`,
          type: 'urgent',
          icon: PlayCircle,
          message: `${e.title} está sucediendo ahora`,
          action: {
            label: 'Ver',
            href: `/trips/${tripId}/itinerary?day=${e.date}`,
          },
        });
      } else if (minsUntilStart > 0 && minsUntilStart <= 30) {
        banners.push({
          id: `soon:${e.id}`,
          type: 'warning',
          icon: Clock,
          message: `${e.title} comienza en ${minsUntilStart} min`,
          action: {
            label: 'Ver',
            href: `/trips/${tripId}/itinerary?day=${e.date}`,
          },
        });
      }
    } catch {
      /* skip */
    }
  }

  // 4: no breakfast today
  const todayEvents = events.filter((e) => e.date === todayStr);
  const hasBreakfast = todayEvents.some(
    (e) =>
      e.type === 'restaurant' &&
      (/(desayuno|breakfast|brunch)/i.test(e.title || '') ||
        (e.startTime && /^0[5-9]:|^10:/.test(e.startTime))),
  );
  if (todayEvents.length > 0 && !hasBreakfast) {
    banners.push({
      id: `no-breakfast:${todayStr}`,
      type: 'info',
      icon: Coffee,
      message: 'No has agregado desayuno para hoy',
      action: {
        label: 'Agregar',
        href: `/trips/${tripId}/itinerary?day=${todayStr}`,
      },
    });
  }

  // 5: tomorrow's important events without docs
  const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
  const importantTypes = new Set<EventType>([
    'flight',
    'hotel',
    'cruise',
    'car_rental',
  ]);
  for (const e of events.filter(
    (ev) => ev.date === tomorrow && importantTypes.has(ev.type),
  )) {
    const hasDoc = documents.some((d) => d.eventId === e.id);
    if (!hasDoc) {
      banners.push({
        id: `no-doc:${e.id}`,
        type: 'warning',
        icon: Paperclip,
        message: `Falta adjuntar boleto/reserva: ${e.title}`,
        action: {
          label: 'Adjuntar',
          href: `/trips/${tripId}/itinerary?day=${e.date}`,
        },
      });
    }
  }

  return banners;
}

// ─── Push permission banner (kept from original) ──────
function PushPermissionBanner({ onDismiss }: { onDismiss: () => void }) {
  const { subscribing, subscribe } = useNotifications();
  return (
    <div className="mx-4 mb-4 rounded-xl bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">
            Activar recordatorios
          </p>
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
          onClick={onDismiss}
          className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────
export default function NotificationBanner() {
  const { permission } = useNotifications();
  const params = useParams();
  const tripId =
    typeof params?.tripId === 'string'
      ? params.tripId
      : Array.isArray(params?.tripId)
        ? params.tripId[0]
        : '';

  const { events } = useEvents(tripId);
  const { documents } = useDocuments(tripId);

  // Push permission dismiss state (session-scoped)
  const [pushDismissed, setPushDismissed] = useState(false);

  // Tick once per minute so banner timing stays fresh
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Dismissed contextual banner IDs (persisted)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  // Build contextual banners
  const banners = useMemo<ContextualBanner[]>(() => {
    if (!tripId) return [];
    return buildBanners(events, documents, tripId, now);
  }, [events, documents, tripId, now]);

  const visibleBanners = useMemo(
    () => banners.filter((b) => !dismissedIds.has(b.id)),
    [banners, dismissedIds],
  );

  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  // Reset rotation index if list shrinks below current idx
  useEffect(() => {
    if (activeBannerIdx >= visibleBanners.length) {
      setActiveBannerIdx(0);
    }
  }, [visibleBanners.length, activeBannerIdx]);

  // Rotate every ~10s when more than one banner
  useEffect(() => {
    if (visibleBanners.length <= 1) return;
    const id = setInterval(() => {
      setActiveBannerIdx((i) => (i + 1) % visibleBanners.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visibleBanners.length]);

  // Show push permission prompt with highest priority (unchanged behavior)
  const showPushBanner =
    permission === 'prompt' && !pushDismissed;

  if (showPushBanner) {
    return <PushPermissionBanner onDismiss={() => setPushDismissed(true)} />;
  }

  const banner = visibleBanners[activeBannerIdx];
  if (!banner) return null;

  const dismiss = () => {
    const newSet = new Set(dismissedIds);
    newSet.add(banner.id);
    setDismissedIds(newSet);
    try {
      window.localStorage.setItem(
        DISMISSED_STORAGE_KEY,
        JSON.stringify(Array.from(newSet)),
      );
    } catch {
      /* ignore */
    }
  };

  const colorClasses: Record<ContextualBanner['type'], string> = {
    urgent: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const Icon = banner.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={banner.id}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className={`mx-4 mt-3 rounded-xl border ${colorClasses[banner.type]} px-4 py-2.5 flex items-center gap-3 shadow-sm`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-sm font-medium">{banner.message}</span>
        {banner.action && (
          <Link
            href={banner.action.href}
            className="text-xs font-bold underline hover:no-underline"
          >
            {banner.action.label}
          </Link>
        )}
        <button
          onClick={dismiss}
          className="p-1 hover:bg-black/10 rounded transition-colors"
          aria-label="Descartar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
