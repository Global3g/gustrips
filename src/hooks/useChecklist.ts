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
import type { ChecklistItem, ChecklistPhase } from '@/types';

const UNDO_DELAY_MS = 8000;

export function useChecklist(tripId: string) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    clearOldDeletedItems();
  }, []);

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
        })) as (ChecklistItem & { deletedAt?: string })[];
        // Filter out soft-deleted items
        setItems(data.filter((item) => !item.deletedAt));
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

  /**
   * Soft-deletes a checklist item. Returns an object with an `undo` function.
   */
  const deleteItem = useCallback(
    async (
      itemId: string,
      options?: { onUndo?: () => void; onConfirm?: () => void },
    ) => {
      const db = getClientDb();
      const itemRef = doc(db, `trips/${tripId}/checklist`, itemId);

      // Save to localStorage for recovery
      const itemData = items.find((i) => i.id === itemId);
      if (itemData) {
        saveDeletedItem('checklist', itemId, tripId, itemData as unknown as Record<string, unknown>);
      }

      // Soft delete
      await updateDoc(itemRef, { deletedAt: nowISO() });

      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }

      const undo = async () => {
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current);
          undoTimerRef.current = null;
        }
        await updateDoc(itemRef, { deletedAt: null });
        options?.onUndo?.();
      };

      undoTimerRef.current = setTimeout(async () => {
        try {
          await deleteDoc(itemRef);
          options?.onConfirm?.();
        } catch (err) {
          console.error('Error al eliminar item permanentemente:', err);
        }
        undoTimerRef.current = null;
      }, UNDO_DELAY_MS);

      return { undo };
    },
    [tripId, items],
  );

  return { items, loading, addItem, toggleItem, deleteItem };
}
