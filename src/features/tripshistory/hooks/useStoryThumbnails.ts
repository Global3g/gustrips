'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listPhotos } from '@/features/tripshistory/api/endpoints';
import { TripshistoryError } from '@/features/tripshistory/api/client';

const PAGE_SIZE = 200;
const MAX_PAGES = 25; // hard cap so a runaway story can't loop forever

interface UseStoryThumbnailsResult {
  /** Map of photoId → thumbnail URL (best size available). */
  thumbnailById: Record<string, string>;
  /** Map of photoId → full-size URL (for lightbox / detail). */
  fullById: Record<string, string>;
  loading: boolean;
  error: TripshistoryError | null;
  refetch: () => Promise<void>;
}

/**
 * Walks every page of /stories/{id}/photos and assembles two maps:
 *   photoId -> thumbnailUrl  (used by storyboard cards)
 *   photoId -> fullUrl       (used by lightbox)
 *
 * Prefers thumbnailUrl, then mediumUrl, then fullUrl — whatever the engine
 * has on the doc. Cheap to call repeatedly; pages are small and Firestore
 * returns mostly cached data.
 */
export function useStoryThumbnails(
  storyId: string | null | undefined,
): UseStoryThumbnailsResult {
  const [thumbnailById, setThumbnailById] = useState<Record<string, string>>({});
  const [fullById, setFullById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(!!storyId);
  const [error, setError] = useState<TripshistoryError | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setThumbnailById({});
      setFullById({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const thumbs: Record<string, string> = {};
    const fulls: Record<string, string> = {};
    let cursor: string | undefined;
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await listPhotos(storyId, { limit: PAGE_SIZE, cursor });
        if (cancelledRef.current) return;
        for (const p of res.photos) {
          const thumb = p.thumbnailUrl ?? p.mediumUrl ?? p.fullUrl;
          if (thumb) thumbs[p.id] = thumb;
          const full = p.fullUrl ?? p.mediumUrl ?? p.thumbnailUrl;
          if (full) fulls[p.id] = full;
        }
        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }
      if (cancelledRef.current) return;
      setThumbnailById(thumbs);
      setFullById(fulls);
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
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return { thumbnailById, fullById, loading, error, refetch: load };
}
