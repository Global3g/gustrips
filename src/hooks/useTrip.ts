'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { nowISO } from '@/lib/utils/helpers';
import type { Trip } from '@/types';

interface UseTripReturn {
  trip: Trip | null;
  loading: boolean;
  updateTrip: (data: Partial<Omit<Trip, 'id' | 'createdBy' | 'createdAt'>>) => Promise<void>;
}

export function useTrip(tripId: string): UseTripReturn {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      setLoading(false);
      return;
    }

    const db = getClientDb();
    const tripRef = doc(db, 'trips', tripId);

    const unsubscribe = onSnapshot(
      tripRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setTrip({ id: snapshot.id, ...snapshot.data() } as Trip);
        } else {
          setTrip(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error al escuchar viaje:', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  const updateTrip = useCallback(
    async (data: Partial<Omit<Trip, 'id' | 'createdBy' | 'createdAt'>>): Promise<void> => {
      if (!tripId) throw new Error('ID de viaje no proporcionado');

      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);

      await updateDoc(tripRef, {
        ...data,
        updatedAt: nowISO(),
      });
    },
    [tripId],
  );

  return { trip, loading, updateTrip };
}
