/**
 * Initial BookState generation from trip data.
 *
 * When the user opens the editor for the first time (no localStorage), we
 * auto-fill the book with a cover + one page per event that has photos.
 * The layout chosen for each event scales with photo count so users see a
 * meaningful starting point — they can rearrange or delete from there.
 *
 * Photo selection per event prefers event.photos[] (the photos directly
 * attached on the event document) and then fills with albumPhotos linked
 * via eventId.
 */

import type { AlbumPhoto, Trip, TripEvent } from '@/types';
import { LAYOUTS } from './layouts';
import type { BookPage, BookState, LayoutId } from './types';

// Note: the editor lives entirely in the browser. We need stable IDs but
// don't need crypto strength — Math.random + Date.now is plenty.
function newId(prefix = 'pg'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const MONTH_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatDateRangeES(start: string, end: string): string {
  const sm = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  const em = /^(\d{4})-(\d{2})-(\d{2})/.exec(end);
  if (!sm || !em) return `${start} — ${end}`;
  const sMonth = MONTH_ES[parseInt(sm[2], 10) - 1] ?? '';
  const eMonth = MONTH_ES[parseInt(em[2], 10) - 1] ?? '';
  const sYear = sm[1];
  const eYear = em[1];
  if (sYear === eYear && sMonth === eMonth) {
    return `${sm[3]} – ${em[3]} de ${eMonth} ${eYear}`;
  }
  if (sYear === eYear) {
    return `${sm[3]} ${sMonth} – ${em[3]} ${eMonth} ${eYear}`;
  }
  return `${sm[3]} ${sMonth} ${sYear} – ${em[3]} ${eMonth} ${eYear}`;
}

/** Pick a layout that comfortably fits N photos. */
export function layoutForPhotoCount(n: number): LayoutId {
  if (n <= 0) return 'text-only';
  if (n === 1) return '1-hero';
  if (n === 2) return '2-stacked';
  if (n === 3) return '3-mosaic';
  if (n <= 5) return '4-grid';
  return '6-grid';
}

/** Make an empty page with the given layout (slots filled with null). */
export function blankPage(layoutId: LayoutId): BookPage {
  const def = LAYOUTS[layoutId];
  return {
    id: newId(),
    layoutId,
    photoUrls: Array.from({ length: def.slotCount }, () => null),
  };
}

/**
 * Build the initial book state from the trip, events and album photos.
 *
 * If the trip has zero events with photos, we still produce a cover + one
 * empty 1-hero page so the editor never opens to a blank screen.
 */
export function seedBookFromTrip(
  trip: Trip,
  events: TripEvent[],
  albumPhotos: AlbumPhoto[],
): BookState {
  // Cover photo: prefer first album photo, else trip.coverImage.
  const coverPhoto =
    albumPhotos[0]?.fullUrl ||
    albumPhotos[0]?.url ||
    trip.coverImage ||
    null;

  const cover: BookPage = {
    id: newId('cover'),
    layoutId: 'cover',
    photoUrls: [coverPhoto],
    title: trip.title || 'Mi viaje',
    subtitle: [
      trip.destination,
      trip.startDate && trip.endDate ? formatDateRangeES(trip.startDate, trip.endDate) : null,
    ]
      .filter(Boolean)
      .join('  ·  '),
  };

  // Sort events chronologically.
  const sortedEvents = [...events].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  const pages: BookPage[] = [];

  for (const ev of sortedEvents) {
    // Collect candidate photos: event.photos first (direct attachments),
    // then albumPhotos linked by eventId. De-dupe by URL.
    const seen = new Set<string>();
    const photos: string[] = [];
    for (const url of ev.photos ?? []) {
      if (url && !seen.has(url)) {
        seen.add(url);
        photos.push(url);
      }
    }
    for (const p of albumPhotos) {
      if (p.eventId !== ev.id) continue;
      const url = p.fullUrl || p.url;
      if (url && !seen.has(url)) {
        seen.add(url);
        photos.push(url);
      }
    }

    if (photos.length === 0) continue;

    const layoutId = layoutForPhotoCount(photos.length);
    const def = LAYOUTS[layoutId];
    const photoUrls: (string | null)[] = Array.from(
      { length: def.slotCount },
      (_, i) => photos[i] ?? null,
    );

    pages.push({
      id: newId(),
      layoutId,
      photoUrls,
      title: ev.title || undefined,
      caption: ev.notes || undefined,
      date: ev.date || undefined,
      location: [ev.city, ev.country].filter(Boolean).join(', ') || ev.location || undefined,
    });
  }

  // Fallback: at least one empty page so the editor never feels broken.
  if (pages.length === 0) {
    pages.push(blankPage('1-hero'));
  }

  return {
    theme: 'editorial',
    size: 'a4',
    cover,
    pages,
  };
}

/**
 * Empty starting state: cover takes only the trip title/destination (no
 * auto-picked photo) and a single blank 1-hero page. Lets the user build the
 * book photo-by-photo from the pool.
 */
export function seedEmptyBook(trip: Trip): BookState {
  const cover: BookPage = {
    id: newId('cover'),
    layoutId: 'cover',
    photoUrls: [trip.coverImage || null],
    title: trip.title || 'Mi viaje',
    subtitle: [
      trip.destination,
      trip.startDate && trip.endDate ? formatDateRangeES(trip.startDate, trip.endDate) : null,
    ]
      .filter(Boolean)
      .join('  ·  '),
  };
  return {
    theme: 'editorial',
    size: 'a4',
    cover,
    pages: [blankPage('1-hero')],
  };
}

/**
 * Resize a page's photoUrls (and matching per-slot arrays) when its layout
 * changes. Preserves existing photos / filters / frames / captions for
 * matching slot indexes and pads/truncates as needed.
 */
export function applyLayout(page: BookPage, layoutId: LayoutId): BookPage {
  const def = LAYOUTS[layoutId];
  const next: (string | null)[] = Array.from(
    { length: def.slotCount },
    (_, i) => page.photoUrls[i] ?? null,
  );
  const nextFilters = page.photoFilters
    ? Array.from(
        { length: def.slotCount },
        (_, i) => page.photoFilters?.[i] ?? null,
      )
    : undefined;
  const nextFrames = page.photoFrames
    ? Array.from(
        { length: def.slotCount },
        (_, i) => page.photoFrames?.[i] ?? null,
      )
    : undefined;
  const nextCaptions = page.slotCaptions
    ? Array.from(
        { length: def.slotCount },
        (_, i) => page.slotCaptions?.[i] ?? null,
      )
    : undefined;
  // slotCrops carry source-image coordinates (0..1) so they survive a layout
  // change unchanged — what they describe is the chunk of the photo to show,
  // not where in the page it goes.
  const nextCrops = page.slotCrops
    ? Array.from(
        { length: def.slotCount },
        (_, i) => page.slotCrops?.[i] ?? null,
      )
    : undefined;
  return {
    ...page,
    layoutId,
    photoUrls: next,
    photoFilters: nextFilters,
    photoFrames: nextFrames,
    slotCaptions: nextCaptions,
    slotCrops: nextCrops,
  };
}

export { newId };
