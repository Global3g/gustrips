'use client';

import { useEffect, useState } from 'react';

export interface SizedPhoto {
  src: string;
  width: number;
  height: number;
}

/** Load image natural dimensions in parallel. Used by the masonry template
 *  so react-photo-album can compute a real aspect-aware layout instead of
 *  treating every photo as a square. Falls back to 1:1 if a load fails. */
export function useImageDimensions(urls: string[]): {
  sized: SizedPhoto[];
  loading: boolean;
} {
  const [sized, setSized] = useState<SizedPhoto[]>([]);
  const [loading, setLoading] = useState(urls.length > 0);

  useEffect(() => {
    if (urls.length === 0) {
      setSized([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const measure = (src: string): Promise<SizedPhoto> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve({ src, width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
        img.onerror = () => resolve({ src, width: 1, height: 1 });
        img.src = src;
      });

    Promise.all(urls.map(measure)).then((results) => {
      if (cancelled) return;
      setSized(results);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [urls.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { sized, loading };
}
