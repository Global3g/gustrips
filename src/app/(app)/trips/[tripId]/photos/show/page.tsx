'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useTrip } from '@/hooks/useTrip';
import { useAlbum } from '@/hooks/useAlbum';
import { useEvents } from '@/hooks/useEvents';
import type { AlbumPhoto, TripEvent } from '@/types';
import type { SlideshowPhoto } from '@/components/trips/photos/SlideshowViewer';

// The viewer pulls in framer-motion and next/image with a fill-fullscreen
// layer; defer it so the loading flash uses the lightweight skeleton below
// and so SSR doesn't try to render the (fullscreen, gesture-bound) DOM.
const SlideshowViewer = dynamic(
  () => import('@/components/trips/photos/SlideshowViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-zinc-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
);

/**
 * Fullscreen slideshow route. Reuses the same `useTrip` / `useAlbum` /
 * `useEvents` data flow as /photos so the photo set, captions and event
 * links stay in sync across navigation.
 *
 * Optional `?start=<index>` query lets the launcher button on /photos open
 * the slideshow at a specific photo (e.g. "play from here"). Anything out of
 * range falls back to 0.
 */
export default function SlideshowPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { trip, loading: tripLoading } = useTrip(tripId);
  const { events, loading: eventsLoading } = useEvents(tripId);
  const { albumPhotos } = useAlbum(tripId, trip);

  /* ── Same dedup + merge logic as /photos ──
     We rebuild the flat photo list locally so the slideshow stays a pure
     view: no shared store, no cache, just the canonical hooks. The page does
     this in one memo per dependency change so the viewer's `photos` prop is
     stable across re-renders that don't touch the underlying data. */
  const flatPhotos = useMemo<SlideshowPhoto[]>(() => {
    const photos: SlideshowPhoto[] = [];
    const albumUrls = new Set<string>();
    for (const p of albumPhotos as AlbumPhoto[]) {
      albumUrls.add(p.url);
      const linkedEvent = p.eventId ? events.find((e) => e.id === p.eventId) : undefined;
      photos.push({ ...p, eventTitle: linkedEvent?.title });
    }
    for (const event of events) {
      if (!event.photos || event.photos.length === 0) continue;
      for (const url of event.photos) {
        if (albumUrls.has(url)) continue;
        photos.push({
          url,
          date: event.date,
          uploadedAt: event.createdAt,
          eventId: event.id,
          eventTitle: event.title,
        });
      }
    }
    // Chronological by date → uploadedAt. Matches the /photos default order
    // so the slideshow narrates the trip in itinerary sequence.
    return photos.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.uploadedAt.localeCompare(b.uploadedAt);
    });
  }, [albumPhotos, events]);

  const eventsById = useMemo(() => {
    const m = new Map<string, TripEvent>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const initialIndex = useMemo(() => {
    const raw = searchParams.get('start');
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(n, Math.max(0, flatPhotos.length - 1)));
  }, [searchParams, flatPhotos.length]);

  const handleExit = useMemo(
    () => () => router.push(`/trips/${tripId}/photos`),
    [router, tripId],
  );

  /* ── Avoid stranding the user on this route after a hard refresh that
        wipes the data; if everything's loaded and there are zero photos we
        keep the viewer mounted but in its empty state so they see a clear
        "back to /photos" CTA. The exit handler routes them to /photos. */
  const loading = tripLoading || eventsLoading;

  // Belt-and-suspenders body class wipe — the layout's sidebar wraps the
  // tree in a div with light background, and our overlay covers it, but on
  // some Android browsers the safe-area paint underneath bleeds through.
  // Forcing the html background to black for the duration of the route
  // removes that seam without touching the shared layout.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = '#000';
    return () => { html.style.backgroundColor = prev; };
  }, []);

  if (loading && flatPhotos.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-zinc-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <SlideshowViewer
      photos={flatPhotos}
      tripTitle={trip?.title}
      eventsById={eventsById}
      onExit={handleExit}
      initialIndex={initialIndex}
    />
  );
}
