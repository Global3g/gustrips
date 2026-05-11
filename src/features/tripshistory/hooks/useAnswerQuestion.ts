'use client';

import { useCallback, useState } from 'react';
import { answerQuestion, skipQuestion } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type { AnswerRequest, AnswerResponse } from '@/features/tripshistory/types';

interface UseAnswerQuestionResult {
  mutate: (
    storyId: string,
    questionId: string,
    body: AnswerRequest,
  ) => Promise<AnswerResponse>;
  skip: (storyId: string, questionId: string) => Promise<void>;
  loading: boolean;
  error: TripshistoryError | null;
  data: AnswerResponse | null;
}

export function useAnswerQuestion(): UseAnswerQuestionResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TripshistoryError | null>(null);
  const [data, setData] = useState<AnswerResponse | null>(null);

  const mutate = useCallback(
    async (
      storyId: string,
      questionId: string,
      body: AnswerRequest,
    ): Promise<AnswerResponse> => {
      setLoading(true);
      setError(null);
      try {
        const result = await answerQuestion(storyId, questionId, body);
        setData(result);
        return result;
      } catch (err) {
        const e =
          err instanceof TripshistoryError
            ? err
            : new TripshistoryError(
                'unknown',
                err instanceof Error ? err.message : 'Unknown error',
                0,
              );
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const skip = useCallback(
    async (storyId: string, questionId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await skipQuestion(storyId, questionId);
        setData(null);
      } catch (err) {
        const e =
          err instanceof TripshistoryError
            ? err
            : new TripshistoryError(
                'unknown',
                err instanceof Error ? err.message : 'Unknown error',
                0,
              );
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { mutate, skip, loading, error, data };
}
