'use client';

/**
 * TripDataContext — single source of truth for the live trip data inside
 * `/trips/[tripId]/*`.
 *
 * Why this exists
 * ---------------
 * Before this provider, every page under a trip layout mounted its own
 * `useTrip`, `useEvents`, `useAlbum`, ... hooks. Each of those hooks opens a
 * Firestore `onSnapshot` subscription. Because the layout also mounted some of
 * them (so the sidebar could render the itinerary days and trip title), the
 * `/photos` route opened:
 *
 *   - 2× `useTrip` subscriptions (layout + page)
 *   - 2× `useEvents` subscriptions (layout + page)
 *   - 2× `useAlbum` subscriptions on the photos subcollection (1 from the
 *     page, plus duplicated trips/{id}/events listeners feeding two trees)
 *
 * For a trip with 300+ photos and 50 events that meant every page navigation
 * inside a trip re-did ~7 onSnapshot bootstraps and processed every Firestore
 * change event N times. The mobile experience felt noticeably laggy.
 *
 * Now the layout wraps every child in a single `TripDataProvider` which owns
 * the three "heavy" hooks. Pages call `useTripData()` and consume the same
 * subscriptions — adding a new page costs zero new listeners.
 *
 * What's NOT in here
 * ------------------
 * `useDocuments`, `useExpenses`, `useMembers`, `useChecklist` aren't included
 * because they're only used by 1-2 pages each, and globalizing them would
 * pay a permanent subscription cost for pages that never read them. They
 * stay local to the pages that use them.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useAlbum } from '@/hooks/useAlbum';
import type { Trip, TripEvent, AlbumPhoto } from '@/types';

interface TripDataValue {
  // Trip
  trip: Trip | null;
  tripLoading: boolean;
  updateTrip: (data: Partial<Omit<Trip, 'id' | 'createdBy' | 'createdAt'>>) => Promise<void>;
  generateShareToken: () => Promise<string>;

  // Events
  events: TripEvent[];
  eventsLoading: boolean;
  createEvent: (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => Promise<string>;
  updateEvent: (eventId: string, data: Partial<TripEvent>) => Promise<void>;
  deleteEvent: (
    eventId: string,
    options?: { onUndo?: () => void; onConfirm?: () => void },
  ) => Promise<{ undo: () => Promise<void> }>;

  // Album
  albumPhotos: AlbumPhoto[];
  addPhoto: (file: File, date: string, caption?: string, eventId?: string) => Promise<AlbumPhoto>;
  deletePhoto: (photo: AlbumPhoto) => Promise<void>;
  updateCaption: (photo: AlbumPhoto, caption: string) => Promise<void>;
  updatePhoto: (oldPhoto: AlbumPhoto, updates: Partial<AlbumPhoto>) => Promise<void>;
  realignEventPhotoDates: (eventId: string, newDate: string) => Promise<number>;
  migrateThumbnails: (
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ migrated: number; failed: number; skipped: number; urlMap: Record<string, string> }>;
  markAllOptimized: () => Promise<number>;
  processPendingUploads: () => Promise<{ uploaded: number; failed: number }>;
}

const TripDataContext = createContext<TripDataValue | undefined>(undefined);

interface TripDataProviderProps {
  tripId: string;
  children: ReactNode;
}

export function TripDataProvider({ tripId, children }: TripDataProviderProps) {
  // Single instance of each "live" hook — these own the only Firestore
  // listeners for the trip across the whole subtree.
  const tripHook = useTrip(tripId);
  const eventsHook = useEvents(tripId);
  const albumHook = useAlbum(tripId, tripHook.trip);

  // Inline value — we intentionally don't memoize. React will only re-render
  // children when one of the underlying Firestore subscriptions actually
  // fires (i.e. `trip`/`events`/`albumPhotos` change), and the bulk of the
  // downstream work happens inside memoized derivations on each page.
  const value: TripDataValue = {
    trip: tripHook.trip,
    tripLoading: tripHook.loading,
    updateTrip: tripHook.updateTrip,
    generateShareToken: tripHook.generateShareToken,

    events: eventsHook.events,
    eventsLoading: eventsHook.loading,
    createEvent: eventsHook.createEvent,
    updateEvent: eventsHook.updateEvent,
    deleteEvent: eventsHook.deleteEvent,

    albumPhotos: albumHook.albumPhotos,
    addPhoto: albumHook.addPhoto,
    deletePhoto: albumHook.deletePhoto,
    updateCaption: albumHook.updateCaption,
    updatePhoto: albumHook.updatePhoto,
    realignEventPhotoDates: albumHook.realignEventPhotoDates,
    migrateThumbnails: albumHook.migrateThumbnails,
    markAllOptimized: albumHook.markAllOptimized,
    processPendingUploads: albumHook.processPendingUploads,
  };

  return <TripDataContext.Provider value={value}>{children}</TripDataContext.Provider>;
}

/**
 * Read the shared live trip data. Must be called from a component rendered
 * inside `TripDataProvider` (which the trip layout provides).
 */
export function useTripData(): TripDataValue {
  const ctx = useContext(TripDataContext);
  if (!ctx) {
    throw new Error('useTripData must be used inside a <TripDataProvider>');
  }
  return ctx;
}

/**
 * Drop-in replacement for `useTrip(tripId)` that pulls from context.
 *
 * Components inside the trip layout should prefer this — it returns the
 * same shape as `useTrip` (so call sites barely change) but does not open
 * a new Firestore subscription.
 */
export function useTripFromContext(): {
  trip: Trip | null;
  loading: boolean;
  updateTrip: TripDataValue['updateTrip'];
  generateShareToken: TripDataValue['generateShareToken'];
} {
  const ctx = useTripData();
  return {
    trip: ctx.trip,
    loading: ctx.tripLoading,
    updateTrip: ctx.updateTrip,
    generateShareToken: ctx.generateShareToken,
  };
}

/** Drop-in replacement for `useEvents(tripId)` that pulls from context. */
export function useEventsFromContext(): {
  events: TripEvent[];
  loading: boolean;
  createEvent: TripDataValue['createEvent'];
  updateEvent: TripDataValue['updateEvent'];
  deleteEvent: TripDataValue['deleteEvent'];
} {
  const ctx = useTripData();
  return {
    events: ctx.events,
    loading: ctx.eventsLoading,
    createEvent: ctx.createEvent,
    updateEvent: ctx.updateEvent,
    deleteEvent: ctx.deleteEvent,
  };
}

/** Drop-in replacement for `useAlbum(tripId, trip)` that pulls from context. */
export function useAlbumFromContext(): {
  albumPhotos: AlbumPhoto[];
  addPhoto: TripDataValue['addPhoto'];
  deletePhoto: TripDataValue['deletePhoto'];
  updateCaption: TripDataValue['updateCaption'];
  updatePhoto: TripDataValue['updatePhoto'];
  realignEventPhotoDates: TripDataValue['realignEventPhotoDates'];
  migrateThumbnails: TripDataValue['migrateThumbnails'];
  markAllOptimized: TripDataValue['markAllOptimized'];
  processPendingUploads: TripDataValue['processPendingUploads'];
} {
  const ctx = useTripData();
  return {
    albumPhotos: ctx.albumPhotos,
    addPhoto: ctx.addPhoto,
    deletePhoto: ctx.deletePhoto,
    updateCaption: ctx.updateCaption,
    updatePhoto: ctx.updatePhoto,
    realignEventPhotoDates: ctx.realignEventPhotoDates,
    migrateThumbnails: ctx.migrateThumbnails,
    markAllOptimized: ctx.markAllOptimized,
    processPendingUploads: ctx.processPendingUploads,
  };
}
