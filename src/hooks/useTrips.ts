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

    // Cargar todos los viajes (las reglas permiten leer todos si estás autenticado)
    // Luego filtraremos por usuario en el cliente
    const q = query(
      tripsRef,
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filtrar solo los viajes del usuario actual
        const tripsData: Trip[] = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((trip: any) => trip.createdBy === user.uid) as Trip[];

        setTrips(tripsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error al escuchar viajes:', err);
        setError('Error al cargar los viajes');
        setLoading(false);
      },
    );

    return () => unsubscribe();
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

      return docRef.id;
    },
    [user],
  );

  const deleteTrip = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');
      const db = getClientDb();
      await deleteDoc(doc(db, 'trips', id));
    },
    [user],
  );

  return { trips, loading, error, createTrip, deleteTrip };
}
