'use client';

import { useCallback, useState } from 'react';
import { uploadPhotoBatch } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';
import type {
  PhotoBatch,
  PhotoBatchResponse,
  PhotoMetadata,
} from '@/features/tripshistory/types';

interface UsePhotoBatchResult {
  mutate: (storyId: string, photos: PhotoMetadata[]) => Promise<PhotoBatchResponse>;
  loading: boolean;
  error: TripshistoryError | null;
  data: PhotoBatchResponse | null;
  /** Cumulative count of photos accepted across calls in this hook instance. */
  uploadedCount: number;
}

const MAX_PHOTOS_PER_BATCH = 100;

export function usePhotoBatch(): UsePhotoBatchResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TripshistoryError | null>(null);
  const [data, setData] = useState<PhotoBatchResponse | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  const mutate = useCallback(
    async (
      storyId: string,
      photos: PhotoMetadata[],
    ): Promise<PhotoBatchResponse> => {
      setLoading(true);
      setError(null);
      try {
        // Chunk to satisfy spec's maxItems=100.
        let accumulated: PhotoBatchResponse | null = null;
        for (let i = 0; i < photos.length; i += MAX_PHOTOS_PER_BATCH) {
          const slice = photos.slice(i, i + MAX_PHOTOS_PER_BATCH);
          const batch: PhotoBatch = { photos: slice };
          const result = await uploadPhotoBatch(storyId, batch);
          accumulated = accumulated
            ? {
                storyId: result.storyId,
                photosReceived:
                  accumulated.photosReceived + result.photosReceived,
                photosRejected:
                  accumulated.photosRejected + result.photosRejected,
                rejectionReasons: [
                  ...(accumulated.rejectionReasons ?? []),
                  ...(result.rejectionReasons ?? []),
                ],
              }
            : result;
          setUploadedCount(
            (prev) => prev + result.photosReceived,
          );
        }
        const finalResult = accumulated ?? {
          storyId,
          photosReceived: 0,
          photosRejected: 0,
          rejectionReasons: [],
        };
        setData(finalResult);
        return finalResult;
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

  return { mutate, loading, error, data, uploadedCount };
}
