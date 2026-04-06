'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import type { TripEvent } from '@/types';

export function useEvents(tripId: string) {
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!tripId) return;

    const db = getClientDb();
    const eventsRef = collection(db, `trips/${tripId}/events`);
    const q = query(eventsRef, orderBy('date', 'asc'), orderBy('startTime', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as TripEvent[];
        setEvents(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error al escuchar eventos:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  const createEvent = async (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => {
    if (!user) throw new Error('Usuario no autenticado');
    const db = getClientDb();
    const eventsRef = collection(db, `trips/${tripId}/events`);
    await addDoc(eventsRef, {
      ...data,
      createdBy: user.uid,
      createdAt: nowISO(),
    });
  };

  const updateEvent = async (eventId: string, data: Partial<TripEvent>) => {
    const db = getClientDb();
    const eventRef = doc(db, `trips/${tripId}/events`, eventId);
    await updateDoc(eventRef, data);
  };

  const deleteEvent = async (eventId: string) => {
    const db = getClientDb();
    const eventRef = doc(db, `trips/${tripId}/events`, eventId);
    await deleteDoc(eventRef);
  };

  return { events, loading, createEvent, updateEvent, deleteEvent };
}
