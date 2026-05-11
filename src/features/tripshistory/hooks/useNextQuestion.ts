'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getNextQuestion } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { Question } from '@/features/tripshistory/types';

interface UseNextQuestionResult {
  data: Question | null;
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
  /** True when the engine returned 204 — no more questions. */
  done: boolean;
}

/**
 * Polls for the next pending question.
 *
 * If `pollIntervalMs` is provided, refetches periodically until the engine
 * returns a question or `done` becomes true. Default: no polling.
 */
export function useNextQuestion(
  storyId: string | null | undefined,
  pollIntervalMs?: number,
): UseNextQuestionResult {
  const [data, setData] = useState<Question | null>(null);
  const [loading, setLoading] = useState<boolean>(!!storyId);
  const [error, setError] = useState<TripshistoryError | null>(null);
  const [done, setDone] = useState<boolean>(false);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setData(null);
      setDone(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = await getNextQuestion(storyId);
      if (cancelledRef.current) return;
      setData(q);
      setDone(q === null);
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
      setDone(false);
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
    if (done) return;
    const id = window.setInterval(() => {
      load();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [storyId, pollIntervalMs, done, load]);

  return { data, loading, error, refetch: load, done };
}
