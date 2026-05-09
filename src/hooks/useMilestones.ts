'use client';

import { useEffect } from 'react';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
import { useAlbum } from '@/hooks/useAlbum';
import { fireMilestone } from '@/lib/confetti';

type MilestoneKey =
  | 'first-expense'
  | '100-photos'
  | 'under-budget'
  | 'events-25'
  | 'first-event'
  | 'points-savings-1k';

const STORAGE_PREFIX = 'gustrips:milestone';

function storageKey(tripId: string, key: MilestoneKey): string {
  return `${STORAGE_PREFIX}:${tripId}:${key}`;
}

function alreadyFired(tripId: string, key: MilestoneKey): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(storageKey(tripId, key)) !== null;
  } catch {
    return true;
  }
}

function markFired(tripId: string, key: MilestoneKey): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(tripId, key), String(Date.now()));
  } catch {
    /* Quota or privacy-mode — silently ignore. */
  }
}

/**
 * Watches a trip's data and triggers celebratory confetti + a `gustrips:milestone`
 * window event whenever the user crosses a memorable threshold.
 *
 * Each milestone fires AT MOST ONCE per trip — state is persisted in
 * `localStorage` under `gustrips:milestone:<tripId>:<milestoneKey>`.
 */
export function useMilestones(tripId: string): void {
  const { trip } = useTrip(tripId);
  const { events } = useEvents(tripId);
  const { expenses } = useExpenses(tripId);
  const { albumPhotos } = useAlbum(tripId, trip);

  useEffect(() => {
    if (!tripId || !trip) return;

    // ── first-expense ──────────────────────────────────
    if (expenses.length >= 1 && !alreadyFired(tripId, 'first-expense')) {
      markFired(tripId, 'first-expense');
      fireMilestone('first-expense', '🎉 Primer gasto registrado', 'small');
    }

    // ── first-event ────────────────────────────────────
    if (events.length >= 1 && !alreadyFired(tripId, 'first-event')) {
      markFired(tripId, 'first-event');
      fireMilestone('first-event', '✨ Primer evento creado', 'small');
    }

    // ── events-25 ──────────────────────────────────────
    if (events.length >= 25 && !alreadyFired(tripId, 'events-25')) {
      markFired(tripId, 'events-25');
      fireMilestone('events-25', '🗓 25 eventos planeados', 'small');
    }

    // ── 100-photos ─────────────────────────────────────
    if (albumPhotos.length >= 100 && !alreadyFired(tripId, '100-photos')) {
      markFired(tripId, '100-photos');
      fireMilestone('100-photos', '📸 ¡100 fotos! Vaya recuerdo', 'big');
    }

    // ── points-savings-1k ──────────────────────────────
    // Sum equivalentValue across all expenses paid with points (any currency).
    const totalSavings = expenses.reduce((sum, e) => {
      if (e.paymentMethod === 'points' && typeof e.equivalentValue === 'number') {
        return sum + e.equivalentValue;
      }
      return sum;
    }, 0);
    if (totalSavings >= 1000 && !alreadyFired(tripId, 'points-savings-1k')) {
      markFired(tripId, 'points-savings-1k');
      fireMilestone(
        'points-savings-1k',
        '★ Más de $1000 ahorrados con puntos',
        'big',
      );
    }

    // ── under-budget ───────────────────────────────────
    // Trip completed AND total spent stayed within a defined budget.
    const budget = trip.budget ?? 0;
    if (trip.status === 'completed' && budget > 0) {
      const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      if (totalSpent <= budget && !alreadyFired(tripId, 'under-budget')) {
        markFired(tripId, 'under-budget');
        fireMilestone('under-budget', '🏆 Cerraste bajo presupuesto', 'huge');
      }
    }
  }, [tripId, trip, events, expenses, albumPhotos]);
}
