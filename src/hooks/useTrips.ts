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

export function useTrips(): UseTripsReturn {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setTrips([]);
      setLoading(false);
      return;
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

    const emit = () => {
      // Merge + dedupe by id (the user can be BOTH owner and traveler).
      const byId = new Map<string, Trip>();
      for (const t of owned) byId.set(t.id, t);
      for (const t of shared) if (!byId.has(t.id)) byId.set(t.id, t);
      const merged = Array.from(byId.values()).sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
      );
      setTrips(merged);
      if (ownedLoaded && sharedLoaded) setLoading(false);
      setError(null);
    };

    const handleError = (label: string) => (err: unknown) => {
      console.error(`Error al escuchar viajes (${label}):`, err);
      setError('Error al cargar los viajes');
      setLoading(false);
    };

    const unsubOwned = onSnapshot(
      ownedQuery,
      (snapshot) => {
        owned = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
        ownedLoaded = true;
        emit();
      },
      handleError('owned'),
    );
    const unsubShared = onSnapshot(
      sharedQuery,
      (snapshot) => {
        shared = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
        sharedLoaded = true;
        emit();
      },
      handleError('shared'),
    );

    return () => {
      unsubOwned();
      unsubShared();
    };
  }, [user?.uid]);

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
