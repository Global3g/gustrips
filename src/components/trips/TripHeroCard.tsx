'use client';

/**
 * Trip hero card — the dashboard's leading visual.
 *
 * Renders differently depending on the trip's lifecycle:
 *   - planning  → big countdown ("11 días para Tokyo") on cream palette
 *   - active    → day-X-of-Y status on dark palette with coral accent
 *   - memories  → "Hace 3 días volviste de Tokyo" on sepia palette
 *
 * Also surfaces the three pillars (logistics / memories / money) as compact
 * footer chips so the user always sees the trip's pulse at a glance — the
 * tesis is "combinar lo logístico + emocional + financiero sin que uno
 * tape al otro," and this card is the place that promise gets cashed.
 */

import Link from 'next/link';
import { Plane, Camera, Wallet, ArrowRight, MapPin } from 'lucide-react';
import { useTripMode, type TripModeInfo } from '@/hooks/useTripMode';
import type { Trip } from '@/types';

interface Props {
  trip: Trip;
  /** Compact chips with each pillar's current state. Optional — passing
   *  `undefined` for any pillar shows a neutral placeholder. */
  pillars?: {
    nextEvent?: { title: string; time: string } | null;
    photoCount?: number | null;
    budgetPct?: number | null; // 0..100 of budget spent
  };
}

function eyebrowForMode(info: TripModeInfo, destination: string): string {
  switch (info.mode) {
    case 'planning':
      return 'Tu próximo viaje';
    case 'active':
      return `Estás en ${destination}`;
    case 'memories':
      return 'Tu último viaje';
  }
}

function statusForMode(info: TripModeInfo): { primary: string; secondary: string } {
  switch (info.mode) {
    case 'planning': {
      const d = info.daysUntilStart ?? 0;
      if (d === 0) return { primary: 'Mañana arrancas', secondary: 'Último día de planning' };
      if (d === 1) return { primary: 'En 1 día', secondary: 'Te espera el viaje' };
      return { primary: `En ${d} días`, secondary: 'Te espera el viaje' };
    }
    case 'active': {
      const d = (info.daysSinceStart ?? 0) + 1;
      const total = info.tripLengthDays ?? 0;
      return {
        primary: `Día ${d} de ${total}`,
        secondary: total - d > 0 ? `Te quedan ${total - d} ${total - d === 1 ? 'día' : 'días'}` : 'Último día',
      };
    }
    case 'memories': {
      const d = info.daysSinceEnd ?? 0;
      if (d === 0) return { primary: 'Acabás de volver', secondary: 'Revivilo cuando quieras' };
      if (d === 1) return { primary: 'Hace 1 día', secondary: 'Volviste de tu viaje' };
      return { primary: `Hace ${d} días`, secondary: 'Volviste de tu viaje' };
    }
  }
}

export default function TripHeroCard({ trip, pillars }: Props) {
  const info = useTripMode(trip);
  const eyebrow = eyebrowForMode(info, trip.destination);
  const status = statusForMode(info);

  const coverUrl = trip.coverImage;

  // Per-mode visual treatment. We use the mode palette CSS vars set by the
  // wrapping `mode-*` class so future palette tweaks don't require code
  // changes here — just CSS.
  const isDark = info.mode === 'active';

  return (
    <Link
      href={`/trips/${trip.id}`}
      className={`group block relative ${info.modeClass}`}
      style={{ textDecoration: 'none' }}
    >
      <div
        className="relative overflow-hidden rounded-3xl border transition-all duration-300 group-hover:shadow-2xl"
        style={{
          background: 'var(--pillar-bg)',
          borderColor: 'var(--pillar-rule)',
          color: 'var(--pillar-ink)',
          minHeight: 320,
          boxShadow: '0 12px 40px -12px rgba(0,0,0,0.18), 0 4px 12px -4px rgba(0,0,0,0.08)',
        }}
      >
        {/* Background photo (if any) — blurred + dimmed so the type sits on top.
            In active mode we keep the photo more present; planning/memories
            push it back to let the palette speak. */}
        {coverUrl && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: isDark ? 'brightness(0.55)' : 'brightness(0.92) saturate(1.1)',
              opacity: isDark ? 0.7 : 0.32,
            }}
          />
        )}

        {/* Subtle vignette so text-on-photo always has contrast. */}
        {coverUrl && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isDark
                ? 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.45) 100%)',
            }}
          />
        )}

        {/* Main content */}
        <div className="relative z-10 flex flex-col h-full p-6 sm:p-8" style={{ minHeight: 320 }}>
          {/* Eyebrow + destination chip */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <span
              className="text-eyebrow"
              style={{ color: 'var(--pillar-accent)' }}
            >
              {eyebrow}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: 'var(--pillar-ink)',
              }}
            >
              <MapPin className="w-3 h-3" />
              {trip.destination}
            </span>
          </div>

          {/* Trip name — editorial display */}
          <h2
            className="text-hero mb-1"
            style={{ color: 'var(--pillar-ink)' }}
          >
            {trip.title}
          </h2>

          {/* Status line — the emotional anchor */}
          <div className="mt-auto pt-6">
            <p
              className="text-editorial-italic text-2xl sm:text-3xl"
              style={{ color: 'var(--pillar-accent)' }}
            >
              {status.primary}
            </p>
            <p
              className="text-footnote mt-1"
              style={{ color: 'var(--pillar-ink-soft)' }}
            >
              {status.secondary}
            </p>
          </div>

          {/* Three-pillar footer chips — the tesis cashed out visually */}
          <div
            className="mt-6 pt-5 grid grid-cols-3 gap-3 border-t"
            style={{ borderColor: 'var(--pillar-rule)' }}
          >
            <PillarChip
              icon={Plane}
              label={pillars?.nextEvent ? 'Próximo' : 'Logística'}
              value={pillars?.nextEvent?.title ?? 'Sin eventos'}
              hint={pillars?.nextEvent?.time}
              isDark={isDark}
            />
            <PillarChip
              icon={Camera}
              label="Memorias"
              value={pillars?.photoCount != null ? `${pillars.photoCount}` : '—'}
              hint={pillars?.photoCount != null ? 'fotos' : 'aún'}
              isDark={isDark}
            />
            <PillarChip
              icon={Wallet}
              label="Presupuesto"
              value={pillars?.budgetPct != null ? `${Math.round(pillars.budgetPct)}%` : '—'}
              hint={pillars?.budgetPct != null ? 'usado' : 'sin set'}
              isDark={isDark}
            />
          </div>

          {/* CTA caret on hover */}
          <div
            className="absolute top-6 right-6 sm:top-8 sm:right-8 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--pillar-accent)' }}
          >
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

interface ChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  isDark: boolean;
}

function PillarChip({ icon: Icon, label, value, hint, isDark }: ChipProps) {
  return (
    <div
      className="flex flex-col gap-0.5 min-w-0"
      style={{ color: 'var(--pillar-ink)' }}
    >
      <div
        className="flex items-center gap-1.5 text-eyebrow"
        style={{ color: 'var(--pillar-ink-soft)' }}
      >
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <div
        className="text-sm font-semibold truncate"
        style={{ color: 'var(--pillar-ink)' }}
        title={value}
      >
        {value}
      </div>
      {hint && (
        <div
          className="text-[10px]"
          style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'var(--pillar-ink-soft)' }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
