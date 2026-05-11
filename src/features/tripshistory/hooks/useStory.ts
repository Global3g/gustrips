'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStory } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { Story } from '@/features/tripshistory/types';

interface UseStoryResult {
  data: Story | null;
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
}

export function useStory(storyId: string | null | undefined): UseStoryResult {
  const [data, setData] = useState<Story | null>(null);
  const [loading, setLoading] = useState<boolean>(!!storyId);
  const [error, setError] = useState<TripshistoryError | null>(null);

  const refetch = useCallback(async () => {
    if (!storyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const story = await getStory(storyId);
      setData(story);
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
    getStory(storyId)
      .then((story) => {
        if (!cancelled) setData(story);
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

  return { data, loading, error, refetch };
}
