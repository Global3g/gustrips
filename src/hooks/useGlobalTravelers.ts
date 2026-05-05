'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import type { GlobalTraveler } from '@/types';

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#ef4444', '#6366f1',
  '#14b8a6', '#f97316',
];

function pickAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

interface UseGlobalTravelersReturn {
  travelers: GlobalTraveler[];
  loading: boolean;
  addTraveler: (data: Omit<GlobalTraveler, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTraveler: (id: string, data: Partial<Omit<GlobalTraveler, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteTraveler: (id: string) => Promise<void>;
}

export function useGlobalTravelers(): UseGlobalTravelersReturn {
  const { user } = useAuth();
  const [travelers, setTravelers] = useState<GlobalTraveler[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setTravelers([]);
      setLoading(false);
      return;
    }

    const db = getClientDb();
    const travelersRef = collection(db, 'users', user.uid, 'travelers');
    const q = query(travelersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: GlobalTraveler[] = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as GlobalTraveler[];
        setTravelers(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error al escuchar viajeros globales:', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const addTraveler = useCallback(
    async (data: Omit<GlobalTraveler, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      if (!user) throw new Error('Usuario no autenticado');

      const db = getClientDb();
      const now = nowISO();
      const travelersRef = collection(db, 'users', user.uid, 'travelers');

      const travelerData = {
        ...data,
        avatarColor: data.avatarColor || pickAvatarColor(),
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(travelersRef, travelerData);
      return docRef.id;
    },
    [user],
  );

  const updateTraveler = useCallback(
    async (id: string, data: Partial<Omit<GlobalTraveler, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');

      const db = getClientDb();
      const travelerRef = doc(db, 'users', user.uid, 'travelers', id);

      await updateDoc(travelerRef, {
        ...data,
        updatedAt: nowISO(),
      });
    },
    [user],
  );

  const deleteTraveler = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');

      const db = getClientDb();
      const travelerRef = doc(db, 'users', user.uid, 'travelers', id);
      await deleteDoc(travelerRef);
    },
    [user],
  );

  return { travelers, loading, addTraveler, updateTraveler, deleteTraveler };
}
