'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import type { ActivityLogEntry } from '@/types';

export function useActivityLog(tripId: string) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!tripId) return;

    const db = getClientDb();
    const logRef = collection(db, `trips/${tripId}/activityLog`);
    const q = query(logRef, orderBy('createdAt', 'desc'), limit(20));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ActivityLogEntry[];
        setEntries(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error al escuchar actividad:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  const logActivity = useCallback(
    async (
      action: ActivityLogEntry['action'],
      entityType: ActivityLogEntry['entityType'],
      entityName: string,
    ) => {
      if (!user || !tripId) return;

      const db = getClientDb();
      const logRef = collection(db, `trips/${tripId}/activityLog`);
      await addDoc(logRef, {
        action,
        entityType,
        entityName,
        userId: user.uid,
        userName: user.displayName || user.email,
        createdAt: nowISO(),
      });
    },
    [tripId, user],
  );

  return { entries, loading, logActivity };
}
