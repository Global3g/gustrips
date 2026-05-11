'use client';

import { useCallback, useEffect, useState } from 'react';
import { listStories, listQuestions } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { Question, Story } from '@/features/tripshistory/types';

interface UseStoryFromTripResult {
  story: Story | null;
  pendingQuestions: Question[];
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
}

/**
 * Given a trip id, locates the Story that was used to seed that trip
 * (if any) and returns it together with its currently pending questions.
 *
 * Behaviour:
 *  - Falsy tripId   → returns an empty result without hitting the network.
 *  - Trip with no story → `story === null`, `pendingQuestions === []`.
 *  - Trip with story → fetches `/stories?tripId=...`, picks the first one,
 *    then loads pending questions in a second call.
 *
 * The hook intentionally does not poll: the caller can re-invoke `refetch`
 * after answering or skipping a question to refresh the list.
 */
export function useStoryFromTrip(
  tripId: string | null | undefined,
): UseStoryFromTripResult {
  const [story, setStory] = useState<Story | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(!!tripId);
  const [error, setError] = useState<TripshistoryError | null>(null);

  const refetch = useCallback(async () => {
    if (!tripId) {
      setStory(null);
      setPendingQuestions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { stories } = await listStories({ tripId });
      const first = stories?.[0] ?? null;
      setStory(first);
      if (!first) {
        setPendingQuestions([]);
      } else {
        try {
          const qs = await listQuestions(first.id, 'pending');
          setPendingQuestions(Array.isArray(qs) ? qs : []);
        } catch (qErr) {
          // Don't blow up the whole hook if questions list fails —
          // a missing or empty story is more important than the list.
          setPendingQuestions([]);
          if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.warn('[useStoryFromTrip] listQuestions failed', qErr);
          }
        }
      }
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
      setStory(null);
      setPendingQuestions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { stories } = await listStories({ tripId });
        if (cancelled) return;
        const first = stories?.[0] ?? null;
        setStory(first);
        if (!first) {
          setPendingQuestions([]);
        } else {
          try {
            const qs = await listQuestions(first.id, 'pending');
            if (cancelled) return;
            setPendingQuestions(Array.isArray(qs) ? qs : []);
          } catch (qErr) {
            if (cancelled) return;
            setPendingQuestions([]);
            if (typeof console !== 'undefined') {
              // eslint-disable-next-line no-console
              console.warn('[useStoryFromTrip] listQuestions failed', qErr);
            }
          }
        }
      } catch (err) {
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return { story, pendingQuestions, loading, error, refetch };
}
