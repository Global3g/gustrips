'use client';

import { useCallback, useEffect, useState } from 'react';
import { listStories } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type {
  ListStoriesParams,
  Story,
} from '@/features/tripshistory/types';

interface UseStoriesListResult {
  stories: Story[];
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches all stories for the current user, optionally filtered.
 *
 * Pass `undefined` (or no argument) to list every story the user owns
 * — including standalone stories that are not yet linked to a trip.
 *
 * Pass `{ tripId }` to scope the list to a specific trip; pass
 * `{ status }` to scope by lifecycle stage. The filter object is the
 * same one accepted by the GET /stories endpoint.
 */
export function useStoriesList(
  filters: ListStoriesParams | undefined = undefined,
): UseStoriesListResult {
  // Serialize the filter so we don't refetch on every parent render when
  // a new object literal is passed.
  const filterKey = filters
    ? JSON.stringify({
        tripId: filters.tripId ?? null,
        status: filters.status ?? null,
      })
    : '';

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<TripshistoryError | null>(null);

  const fetchOnce = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const { stories: result } = await listStories(filters ?? {});
        if (!signal?.cancelled) {
          setStories(result ?? []);
        }
      } catch (err) {
        if (signal?.cancelled) return;
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
        if (!signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    // filterKey is a stable serialization of `filters` — we depend on it
    // intentionally to avoid refetching on parent-render new object literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  const refetch = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    const signal = { cancelled: false };
    void fetchOnce(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchOnce]);

  return { stories, loading, error, refetch };
}
