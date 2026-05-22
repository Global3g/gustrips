'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import { saveDeletedItem, clearOldDeletedItems } from '@/lib/utils/recovery';
import { markMutation } from '@/components/SyncIndicator';
import type { Trip, TripMember } from '@/types';

interface UseTripsReturn {
  trips: Trip[];
  loading: boolean;
  error: string | null;
  createTrip: (data: Omit<Trip, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteTrip: (id: string) => Promise<void>;
}

// Local mirror of the trips list, scoped per-uid. Lets the dashboard
// render immediately on mobile / cold-cache loads instead of staring at
// an empty page while Firebase Auth restores and Firestore round-trips.
const TRIPS_CACHE_PREFIX = 'gustrips:trips:';
const TRIPS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function loadCachedTrips(uid: string): Trip[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TRIPS_CACHE_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; trips: Trip[] };
    if (!parsed?.trips || !Array.isArray(parsed.trips)) return null;
    if (Date.now() - parsed.savedAt > TRIPS_CACHE_TTL_MS) return null;
    return parsed.trips;
  } catch {
    return null;
  }
}

function saveCachedTrips(uid: string, trips: Trip[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      TRIPS_CACHE_PREFIX + uid,
      JSON.stringify({ savedAt: Date.now(), trips }),
    );
  } catch {
    // Quota or private mode — best-effort cache, drop silently.
  }
}

export function useTrips(): UseTripsReturn {
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      // If auth is still restoring (typical on mobile cold start, where
      // Firebase reads its IndexedDB-backed session synchronously but slowly),
      // keep the skeleton up instead of flashing the empty state. The empty
      // state used to appear for a beat before the snapshot landed, which
      // looked like "the app forgot my trips".
      if (authLoading) {
        setLoading(true);
        return;
      }
      setTrips([]);
      setLoading(false);
      return;
    }

    // Optimistic hydration: paint the cached list before Firestore even
    // opens its socket. We still spin up the live listeners below so the
    // user gets fresh data once the network resolves — they just don't
    // have to stare at an empty dashboard in the meantime.
    const cached = loadCachedTrips(user.uid);
    if (cached && cached.length > 0) {
      setTrips(cached);
      setLoading(false);
    }

    const db = getClientDb();
    const tripsRef = collection(db, 'trips');
    const uid = user.uid;

    // After tightening the security rules to enforce per-trip ownership,
    // Firestore rejects unrestricted queries on /trips with "Missing or
    // insufficient permissions" because the query *could* return docs the
    // user can't read. We must scope the query by structure to match
    // exactly what the rules allow.
    //
    // We run two scoped subscriptions in parallel and merge them in the
    // client: one for trips this user created, one for trips they were
    // invited to. Two listeners use slightly more quota than one, but the
    // alternative (a single `or()` query) needs composite indexes for each
    // branch — cheaper to maintain this way for a tens-of-trips dataset.
    const ownedQuery = query(
      tripsRef,
      where('createdBy', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    const sharedQuery = query(
      tripsRef,
      where('travelerIds', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
    );

    let owned: Trip[] = [];
    let shared: Trip[] = [];
    let ownedLoaded = false;
    let sharedLoaded = false;
    // Track errors per-subscription so a transient retry on one doesn't
    // flap the page's `error` state (which would re-render listeners and
    // potentially loop). Error is "sticky": once either subscription
    // errors, the user sees the message until they refresh.
    let ownedError: string | null = null;
    let sharedError: string | null = null;

    const emit = () => {
      // Merge + dedupe by id (the user can be BOTH owner and traveler).
      const byId = new Map<string, Trip>();
      for (const t of owned) byId.set(t.id, t);
      for (const t of shared) if (!byId.has(t.id)) byId.set(t.id, t);
      const merged = Array.from(byId.values()).sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
      );
      setTrips(merged);
      if (ownedLoaded && sharedLoaded) {
        setLoading(false);
        // Persist a copy for the next cold start. Only after we've heard
        // back from BOTH listeners so we don't cache a half-merged view.
        saveCachedTrips(uid, merged);
      }
      // Only clear error if BOTH subscriptions are healthy now.
      if (!ownedError && !sharedError) setError(null);
    };

    const handleError = (label: 'owned' | 'shared') => (err: unknown) => {
      console.error(`Error al escuchar viajes (${label}):`, err);
      if (label === 'owned') ownedError = 'error';
      else sharedError = 'error';
      // Don't keep "loading" forever if the very first attempt errors —
      // mark this subscription as "loaded" (with empty) so the merged
      // view can render with whatever the other side has.
      if (label === 'owned') ownedLoaded = true;
      else sharedLoaded = true;
      if (ownedLoaded && sharedLoaded) setLoading(false);
      setError('Error al cargar los viajes');
    };

    const unsubOwned = onSnapshot(
      ownedQuery,
      (snapshot) => {
        owned = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
        ownedLoaded = true;
        ownedError = null;
        emit();
      },
      handleError('owned'),
    );
    const unsubShared = onSnapshot(
      sharedQuery,
      (snapshot) => {
        shared = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
        sharedLoaded = true;
        sharedError = null;
        emit();
      },
      handleError('shared'),
    );

    return () => {
      unsubOwned();
      unsubShared();
    };
  }, [user?.uid, authLoading]);

  const createTrip = useCallback(
    async (data: Omit<Trip, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      if (!user) throw new Error('Usuario no autenticado');

      const db = getClientDb();
      const now = nowISO();

      const tripData = {
        ...data,
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(collection(db, 'trips'), tripData);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      // Crear miembro owner en subcoleccion
      const memberData: Omit<TripMember, 'uid'> & { uid: string } = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: 'owner',
        joinedAt: now,
        invitedBy: user.uid,
      };

      await setDoc(doc(db, 'trips', docRef.id, 'members', user.uid), memberData);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      return docRef.id;
    },
    [user],
  );

  const deleteTrip = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');

      // Save trip data to localStorage before deleting
      const tripData = trips.find((t) => t.id === id);
      if (tripData) {
        saveDeletedItem('trip', id, id, tripData as unknown as Record<string, unknown>);
      }

      // Clean old deleted items
      clearOldDeletedItems();

      const db = getClientDb();
      await deleteDoc(doc(db, 'trips', id));
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [user, trips],
  );

  return { trips, loading, error, createTrip, deleteTrip };
}
