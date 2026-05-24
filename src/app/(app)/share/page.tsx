'use client';

import { useEffect, useState } from 'react';
import PhotoShareFlow from '@/components/share/PhotoShareFlow';
import ReservationShareFlow from '@/components/share/ReservationShareFlow';
import { listTextInbox, type SharedTextItem } from '@/lib/sharedTextInbox';

/**
 * Router for the Web Share Target. The service worker stashes either photos
 * (gustrips-shared-inbox) or a reservation (gustrips-shared-text) and redirects
 * here. We check the text inbox first: if it has items, this was a shared
 * reservation; otherwise fall back to the photo importer.
 */
export default function SharePage() {
  const [mode, setMode] = useState<'loading' | 'reservation' | 'photo'>('loading');
  const [textItems, setTextItems] = useState<SharedTextItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const items = await listTextInbox();
      if (cancelled) return;
      if (items.length > 0) {
        setTextItems(items);
        setMode('reservation');
      } else {
        setMode('photo');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === 'loading') {
    return (
      <div className="max-w-2xl mx-auto pt-16 space-y-3">
        <div className="h-8 rounded-xl bg-white/[0.04] animate-pulse w-1/2" />
        <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
        <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse w-2/3" />
      </div>
    );
  }

  if (mode === 'reservation') {
    return <ReservationShareFlow initialItems={textItems} />;
  }

  return <PhotoShareFlow />;
}
