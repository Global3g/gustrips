'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStoryboard } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { Storyboard } from '@/features/tripshistory/types';

interface UseStoryboardResult {
  data: Storyboard | null;
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
}

export function useStoryboard(
  storyId: string | null | undefined,
): UseStoryboardResult {
  const [data, setData] = useState<Storyboard | null>(null);
  const [loading, setLoading] = useState<boolean>(!!storyId);
  const [error, setError] = useState<TripshistoryError | null>(null);

  const load = useCallback(async () => {
    if (!storyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const board = await getStoryboard(storyId);
      setData(board);
    } catch (err) {
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
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    let cancelled = false;
    if (!storyId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getStoryboard(storyId)
      .then((board) => {
        if (!cancelled) setData(board);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof TripshistoryError
            ? err
            : new TripshistoryError(
                'unknown',
                err instanceof Error ? err.message : 'Unknown error',
                0,
              ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  return { data, loading, error, refetch: load };
}
