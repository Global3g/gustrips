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
import type { ChecklistItem, ChecklistPhase } from '@/types';

const UNDO_DELAY_MS = 8000;

export function useChecklist(tripId: string) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // One timer per deleted item id. Sharing a single ref let rapid
  // successive deletes cancel each other and leave zombies in Firestore.
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    const db = getClientDb();
    const itemRef = doc(db, `trips/${tripId}/checklist`, itemId);
    await updateDoc(itemRef, { checked });
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
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
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      const timers = undoTimersRef.current;
      const previous = timers.get(itemId);
      if (previous) clearTimeout(previous);

      const undo = async () => {
        const t = timers.get(itemId);
        if (t) {
          clearTimeout(t);
          timers.delete(itemId);
        }
        await updateDoc(itemRef, { deletedAt: null });
        try { markMutation(); } catch { /* localStorage may be unavailable */ }
        options?.onUndo?.();
      };

      const timer = setTimeout(async () => {
        try {
          await deleteDoc(itemRef);
          try { markMutation(); } catch { /* localStorage may be unavailable */ }
          options?.onConfirm?.();
        } catch (err) {
          console.error('Error al eliminar item permanentemente:', err);
        }
        timers.delete(itemId);
      }, UNDO_DELAY_MS);
      timers.set(itemId, timer);

      return { undo };
    },
    [tripId, items],
  );

  return { items, loading, addItem, toggleItem, deleteItem };
}
