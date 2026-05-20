'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { saveDeletedItem, clearOldDeletedItems } from '@/lib/utils/recovery';
import { markMutation } from '@/components/SyncIndicator';
import type { TripEvent } from '@/types';

const UNDO_DELAY_MS = 8000;

export function useEvents(tripId: string) {
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // One timer per deleted event id. Sharing a single ref let rapid
  // successive deletes cancel each other and leave zombies in Firestore.
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean old deleted items on mount + clear pending timers on unmount.
  useEffect(() => {
    clearOldDeletedItems();
    const timers = undoTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

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
        })) as (TripEvent & { deletedAt?: string })[];
        // Filter out soft-deleted events
        setEvents(data.filter((e) => !e.deletedAt));
        setLoading(false);
      },
      (error) => {
        console.error('Error al escuchar eventos:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  const createEvent = async (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>): Promise<string> => {
    if (!user) throw new Error('Usuario no autenticado');
    const db = getClientDb();
    const eventsRef = collection(db, `trips/${tripId}/events`);
    const docRef = await addDoc(eventsRef, {
      ...data,
      createdBy: user.uid,
      createdAt: nowISO(),
    });
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
    return docRef.id;
  };

  const updateEvent = async (eventId: string, data: Partial<TripEvent>) => {
    const db = getClientDb();
    const eventRef = doc(db, `trips/${tripId}/events`, eventId);
    await updateDoc(eventRef, data);
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
  };

  /**
   * Soft-deletes an event by setting a `deletedAt` field.
   * Returns an object with an `undo` function and a `confirmDelete` promise
   * that resolves after the undo window expires.
   */
  const deleteEvent = useCallback(
    async (
      eventId: string,
      options?: { onUndo?: () => void; onConfirm?: () => void },
    ) => {
      const db = getClientDb();
      const eventRef = doc(db, `trips/${tripId}/events`, eventId);

      // Find the event data for localStorage backup
      const eventData = events.find((e) => e.id === eventId);
      if (eventData) {
        saveDeletedItem('event', eventId, tripId, eventData as unknown as Record<string, unknown>);
      }

      // Soft delete: set deletedAt timestamp
      await updateDoc(eventRef, { deletedAt: nowISO() });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      // Cancel any previous pending hard-delete for THIS event id
      // (re-deleting the same event while its undo window is open).
      const timers = undoTimersRef.current;
      const previous = timers.get(eventId);
      if (previous) clearTimeout(previous);

      const undo = async () => {
        const t = timers.get(eventId);
        if (t) {
          clearTimeout(t);
          timers.delete(eventId);
        }
        await updateDoc(eventRef, { deletedAt: null });
        try { markMutation(); } catch { /* localStorage may be unavailable */ }
        options?.onUndo?.();
      };

      const timer = setTimeout(async () => {
        try {
          await deleteDoc(eventRef);
          try { markMutation(); } catch { /* localStorage may be unavailable */ }
          options?.onConfirm?.();
        } catch (err) {
          console.error('Error al eliminar evento permanentemente:', err);
        }
        timers.delete(eventId);
      }, UNDO_DELAY_MS);
      timers.set(eventId, timer);

      return { undo };
    },
    [tripId, events],
  );

  return { events, loading, createEvent, updateEvent, deleteEvent };
}
