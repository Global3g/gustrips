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
import type { ChecklistItem, ChecklistPhase } from '@/types';

export function useChecklist(tripId: string) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!tripId) return;

    const db = getClientDb();
    const checklistRef = collection(db, `trips/${tripId}/checklist`);
    const q = query(checklistRef, orderBy('phase', 'asc'), orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ChecklistItem[];
        setItems(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error al escuchar checklist:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  const addItem = async (text: string, phase: ChecklistPhase) => {
    if (!user) throw new Error('Usuario no autenticado');
    const db = getClientDb();
    const checklistRef = collection(db, `trips/${tripId}/checklist`);
    await addDoc(checklistRef, {
      text,
      checked: false,
      phase,
      createdBy: user.uid,
      createdAt: nowISO(),
    });
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    const db = getClientDb();
    const itemRef = doc(db, `trips/${tripId}/checklist`, itemId);
    await updateDoc(itemRef, { checked });
  };

  const deleteItem = async (itemId: string) => {
    const db = getClientDb();
    const itemRef = doc(db, `trips/${tripId}/checklist`, itemId);
    await deleteDoc(itemRef);
  };

  return { items, loading, addItem, toggleItem, deleteItem };
}
