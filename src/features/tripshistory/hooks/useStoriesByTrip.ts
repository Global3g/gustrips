'use client';

import { useCallback, useEffect, useState } from 'react';
import { listStories } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { Story } from '@/features/tripshistory/types';

interface UseStoriesByTripResult {
  stories: Story[];
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches the list of stories associated with a given Trip.
 *
 * Auto-fetches on mount and whenever `tripId` changes. If `tripId` is
 * falsy the hook resolves to an empty list without hitting the network.
 */
export function useStoriesByTrip(
  tripId: string | null | undefined,
): UseStoriesByTripResult {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState<boolean>(!!tripId);
  const [error, setError] = useState<TripshistoryError | null>(null);

  const refetch = useCallback(async () => {
    if (!tripId) {
      setStories([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { stories: result } = await listStories({ tripId });
      setStories(result ?? []);
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
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;
    if (!tripId) {
      setStories([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    listStories({ tripId })
      .then((res) => {
        if (!cancelled) setStories(res.stories ?? []);
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
  }, [tripId]);

  return { stories, loading, error, refetch };
}
