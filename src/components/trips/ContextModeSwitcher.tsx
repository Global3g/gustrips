'use client';

/**
 * ContextModeSwitcher — three quick-access chips that jump the user into a
 * dedicated "command center" screen for the relevant moment of the trip:
 * aeropuerto (vuelo), hotel (check-in/out) o restaurante (reserva).
 *
 * Designed to live inside `/today` while the trip is active and there's at
 * least one relevant event in the next 24 hours. The parent decides when to
 * render this; the switcher only paints the chips and routes.
 */

import Link from 'next/link';
import { Plane, Hotel, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EventType } from '@/types';

type ModeKey = 'airport' | 'hotel' | 'restaurant';

interface ModeChipConfig {
  key: ModeKey;
  /** Which event type triggers the chip to highlight. */
  eventType: EventType;
  label: string;
  icon: LucideIcon;
  /** Accent on the chip when it has a near event (uses inline style so
   *  Tailwind's purge doesn't strip dynamic class names). */
  accent: string;
}

const MODES: ModeChipConfig[] = [
  { key: 'airport', eventType: 'flight', label: 'Aeropuerto', icon: Plane, accent: '#22d3ee' },
  { key: 'hotel', eventType: 'hotel', label: 'Hotel', icon: Hotel, accent: '#a78bfa' },
  { key: 'restaurant', eventType: 'restaurant', label: 'Restaurante', icon: UtensilsCrossed, accent: '#fb923c' },
];

interface ContextModeSwitcherProps {
  tripId: string;
  /**
   * Set of event types that currently have an upcoming event in the
   * "near" window. Chips for these types render highlighted. The
   * other chips stay visible but muted, so the user can always
   * manually jump to any mode.
   */
  activeTypes: Set<EventType>;
}

export default function ContextModeSwitcher({ tripId, activeTypes }: ContextModeSwitcherProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeTypes.has(mode.eventType);
        return (
          <Link
            key={mode.key}
            href={`/trips/${tripId}/mode/${mode.key}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all border"
            style={
              isActive
                ? {
                    background: mode.accent,
                    color: '#0d1320',
                    borderColor: mode.accent,
                    boxShadow: `0 6px 18px -8px ${mode.accent}`,
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(244,240,230,0.7)',
                    borderColor: 'rgba(255,255,255,0.12)',
                  }
            }
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{mode.label}</span>
            {isActive && <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-[#0d1320]/40" />}
          </Link>
        );
      })}
    </div>
  );
}
