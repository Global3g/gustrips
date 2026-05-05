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
import type { TripEvent } from '@/types';

const UNDO_DELAY_MS = 8000;

export function useEvents(tripId: string) {
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean old deleted items on mount
  useEffect(() => {
    clearOldDeletedItems();
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
    return docRef.id;
  };

  const updateEvent = async (eventId: string, data: Partial<TripEvent>) => {
    const db = getClientDb();
    const eventRef = doc(db, `trips/${tripId}/events`, eventId);
    await updateDoc(eventRef, data);
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

      // Clear any previous undo timer
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }

      // Return undo function
      const undo = async () => {
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current);
          undoTimerRef.current = null;
        }
        // Remove deletedAt to restore the event
        await updateDoc(eventRef, { deletedAt: null });
        options?.onUndo?.();
      };

      // Schedule hard delete after undo window
      undoTimerRef.current = setTimeout(async () => {
        try {
          await deleteDoc(eventRef);
          options?.onConfirm?.();
        } catch (err) {
          console.error('Error al eliminar evento permanentemente:', err);
        }
        undoTimerRef.current = null;
      }, UNDO_DELAY_MS);

      return { undo };
    },
    [tripId, events],
  );

  return { events, loading, createEvent, updateEvent, deleteEvent };
}
