'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnalysisState } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { AnalysisState } from '@/features/tripshistory/types';

interface UseAnalysisStateResult {
  data: AnalysisState | null;
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
}

/**
 * Polls the analysis endpoint while the story is in 'analyzing' status.
 * If `pollIntervalMs` is provided, refetches periodically. Default: no polling.
 */
export function useAnalysisState(
  storyId: string | null | undefined,
  pollIntervalMs?: number,
): UseAnalysisStateResult {
  const [data, setData] = useState<AnalysisState | null>(null);
  const [loading, setLoading] = useState<boolean>(!!storyId);
  const [error, setError] = useState<TripshistoryError | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const state = await getAnalysisState(storyId);
      if (cancelledRef.current) return;
      setData(state);
    } catch (err) {
      if (cancelledRef.current) return;
      setError(
        err instanceof TripshistoryError
          ? err
          : new TripshistoryError(
              'unknown',
              err instanceof Error ? err.message : 'Unknown error',
              0,
            ),
      );
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!storyId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [storyId, load]);

  useEffect(() => {
    if (!storyId || !pollIntervalMs || pollIntervalMs <= 0) return;
    // Stop polling once analysis has moved past 'analyzing'.
    if (data && data.status !== 'analyzing' && data.status !== 'draft') return;
    const id = window.setInterval(() => {
      load();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [storyId, pollIntervalMs, data, load]);

  return { data, loading, error, refetch: load };
}
