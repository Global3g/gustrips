/**
 * Non-hook event writer. `useEvents` is a hook bound to a single tripId, but
 * the share page picks the destination trip at runtime, so it can't use it.
 * This mirrors `useEvents.createEvent` for those one-off, trip-id-at-runtime
 * writes (currently: importing a shared reservation onto the itinerary).
 */

import { collection, addDoc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import type { TripEvent } from '@/types';

export async function addEventToTrip(
  tripId: string,
  uid: string,
  data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>,
): Promise<string> {
  if (!tripId) throw new Error('Falta tripId');
  if (!uid) throw new Error('Usuario no autenticado');
  const db = getClientDb();
  const eventsRef = collection(db, `trips/${tripId}/events`);
  const docRef = await addDoc(eventsRef, {
    ...data,
    createdBy: uid,
    createdAt: nowISO(),
  });
  try {
    markMutation();
  } catch {
    /* localStorage may be unavailable */
  }
  return docRef.id;
}
