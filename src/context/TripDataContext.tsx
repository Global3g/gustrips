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

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useAlbum } from '@/hooks/useAlbum';
import { useExpenses } from '@/hooks/useExpenses';
import { useMembers } from '@/hooks/useMembers';
import { useDocuments } from '@/hooks/useDocuments';
import { useChecklist } from '@/hooks/useChecklist';
import type { Trip, TripEvent, AlbumPhoto } from '@/types';

// We expose the FULL hook return for the secondary collections so the
// `useXxxFromContext` shims have the same shape as the original hooks.
// This way callsites that currently do `const { items } = useChecklist(...)`
// can switch to `useChecklistFromContext()` with zero other changes.
type ExpensesHookReturn = ReturnType<typeof useExpenses>;
type MembersHookReturn = ReturnType<typeof useMembers>;
type DocumentsHookReturn = ReturnType<typeof useDocuments>;
type ChecklistHookReturn = ReturnType<typeof useChecklist>;

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
  // Review mode mutations.
  markReviewed: (photo: AlbumPhoto, reviewed?: boolean) => Promise<void>;
  markFavorite: (photo: AlbumPhoto, favorite?: boolean) => Promise<void>;
  softDelete: (photo: AlbumPhoto) => Promise<void>;
  restorePhoto: (photo: AlbumPhoto) => Promise<void>;

  // Secondary collections — added 2026-05-23 to stop the duplicate
  // subscriptions (chatbot + banners + modals + pages all opened their
  // own onSnapshot to the same /expenses, /members, /documents).
  expensesHook: ExpensesHookReturn;
  membersHook: MembersHookReturn;
  documentsHook: DocumentsHookReturn;
  checklistHook: ChecklistHookReturn;
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
  // Secondary subscriptions — consolidated here so the chatbot, the
  // various banners, the FAB and each page all reuse them instead of
  // opening their own. Each onSnapshot has a real cost in mobile
  // battery and CPU (WebSocket + JSON parsing per change event), so
  // keeping the listener count low matters on 4G.
  const expensesHook = useExpenses(tripId);
  const membersHook = useMembers(tripId);
  const documentsHook = useDocuments(tripId);
  const checklistHook = useChecklist(tripId);

  // Memoize the context value so consumers re-render only when one of the
  // underlying subscriptions actually fires. Without this, every render of
  // the provider creates a new object and propagates a re-render through
  // the entire subtree.
  const value: TripDataValue = useMemo(
    () => ({
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
      markReviewed: albumHook.markReviewed,
      markFavorite: albumHook.markFavorite,
      softDelete: albumHook.softDelete,
      restorePhoto: albumHook.restorePhoto,

      // The hook objects are stable references between renders thanks
      // to React's hook identity guarantees, so passing them as-is into
      // memo deps doesn't widen the dep list unnecessarily.
      expensesHook,
      membersHook,
      documentsHook,
      checklistHook,
    }),
    [
      tripHook.trip,
      tripHook.loading,
      tripHook.updateTrip,
      tripHook.generateShareToken,
      eventsHook.events,
      eventsHook.loading,
      eventsHook.createEvent,
      eventsHook.updateEvent,
      eventsHook.deleteEvent,
      albumHook.albumPhotos,
      albumHook.addPhoto,
      albumHook.deletePhoto,
      albumHook.updateCaption,
      albumHook.updatePhoto,
      albumHook.realignEventPhotoDates,
      albumHook.migrateThumbnails,
      albumHook.markAllOptimized,
      albumHook.processPendingUploads,
      albumHook.markReviewed,
      albumHook.markFavorite,
      albumHook.softDelete,
      albumHook.restorePhoto,
      expensesHook,
      membersHook,
      documentsHook,
      checklistHook,
    ],
  );

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

/**
 * Drop-in replacement for `useExpenses(tripId)` that pulls from context.
 * Same return shape as the original hook — call sites just swap the
 * import. No new Firestore subscription is opened.
 */
export function useExpensesFromContext(): ExpensesHookReturn {
  return useTripData().expensesHook;
}

/** Drop-in replacement for `useMembers(tripId)` that pulls from context. */
export function useMembersFromContext(): MembersHookReturn {
  return useTripData().membersHook;
}

/** Drop-in replacement for `useDocuments(tripId)` that pulls from context. */
export function useDocumentsFromContext(): DocumentsHookReturn {
  return useTripData().documentsHook;
}

/** Drop-in replacement for `useChecklist(tripId)` that pulls from context. */
export function useChecklistFromContext(): ChecklistHookReturn {
  return useTripData().checklistHook;
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
  markReviewed: TripDataValue['markReviewed'];
  markFavorite: TripDataValue['markFavorite'];
  softDelete: TripDataValue['softDelete'];
  restorePhoto: TripDataValue['restorePhoto'];
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
    markReviewed: ctx.markReviewed,
    markFavorite: ctx.markFavorite,
    softDelete: ctx.softDelete,
    restorePhoto: ctx.restorePhoto,
  };
}
