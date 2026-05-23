'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import type { PackingCategory } from '@/lib/packingTemplates';

/**
 * A single item in the trip's smart packing list (maleta inteligente).
 * Lives in `trips/<tripId>/packing/<itemId>` and is shared by every
 * traveler in the trip. `order` controls drag-to-reorder; lower values
 * render first.
 */
export interface PackingItem {
  id: string;
  name: string;
  category: PackingCategory;
  packed: boolean;
  quantity: number;
  addedBy: string;
  optional: boolean;
  /** Stable sort key; lower values render first. */
  order?: number;
  createdAt: string;
}

export interface PackingItemDraft {
  name: string;
  category: PackingCategory;
  quantity?: number;
  optional?: boolean;
}

export function usePacking(tripId: string) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!tripId) return;
    const db = getClientDb();
    const ref = collection(db, `trips/${tripId}/packing`);
    // We order client-side on `order` (falling back to createdAt) so we
    // don't need a composite index just for this small subcollection.
    const q = query(ref, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PackingItem, 'id'>),
        })) as PackingItem[];
        data.sort((a, b) => {
          const ao = a.order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
        });
        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error al escuchar packing list:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [tripId]);

  const addItem = useCallback(
    async (draft: PackingItemDraft) => {
      if (!user) throw new Error('Usuario no autenticado');
      const db = getClientDb();
      const ref = collection(db, `trips/${tripId}/packing`);
      // New items go to the end of the list. We don't recount everything
      // on every add — using items.length keeps it O(1) and a future
      // normalize pass can rebalance if needed.
      const order = items.length;
      await addDoc(ref, {
        name: draft.name.trim(),
        category: draft.category,
        quantity: Math.max(1, Math.floor(draft.quantity ?? 1)),
        optional: !!draft.optional,
        packed: false,
        addedBy: user.uid,
        order,
        createdAt: nowISO(),
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId, user, items.length],
  );

  /**
   * Bulk-add items, e.g. when applying a template. Uses a batched write
   * so the UI sees the whole list arrive in one snapshot update instead
   * of N flashes.
   */
  const addItems = useCallback(
    async (drafts: PackingItemDraft[]) => {
      if (!user) throw new Error('Usuario no autenticado');
      if (drafts.length === 0) return 0;
      const db = getClientDb();
      const colRef = collection(db, `trips/${tripId}/packing`);
      const baseOrder = items.length;
      const batch = writeBatch(db);
      drafts.forEach((draft, i) => {
        const docRef = doc(colRef);
        batch.set(docRef, {
          name: draft.name.trim(),
          category: draft.category,
          quantity: Math.max(1, Math.floor(draft.quantity ?? 1)),
          optional: !!draft.optional,
          packed: false,
          addedBy: user.uid,
          order: baseOrder + i,
          createdAt: nowISO(),
        });
      });
      await batch.commit();
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
      return drafts.length;
    },
    [tripId, user, items.length],
  );

  const togglePacked = useCallback(
    async (itemId: string, packed: boolean) => {
      const db = getClientDb();
      const ref = doc(db, `trips/${tripId}/packing`, itemId);
      await updateDoc(ref, { packed });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId],
  );

  const updateItem = useCallback(
    async (itemId: string, patch: Partial<Omit<PackingItem, 'id' | 'createdAt' | 'addedBy'>>) => {
      const db = getClientDb();
      const ref = doc(db, `trips/${tripId}/packing`, itemId);
      await updateDoc(ref, patch);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      const db = getClientDb();
      const ref = doc(db, `trips/${tripId}/packing`, itemId);
      await deleteDoc(ref);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId],
  );

  /**
   * Persist a new ordering of items. The drag-to-reorder UI passes the
   * full id list after a drop; we batch-update the `order` field on
   * every item so the next snapshot reflects the new order. We always
   * rewrite every order — partial writes would create gaps that later
   * inserts would have to fight.
   */
  const reorderItems = useCallback(
    async (idsInOrder: string[]) => {
      const db = getClientDb();
      const batch = writeBatch(db);
      idsInOrder.forEach((id, idx) => {
        const ref = doc(db, `trips/${tripId}/packing`, id);
        batch.update(ref, { order: idx });
      });
      await batch.commit();
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId],
  );

  return {
    items,
    loading,
    addItem,
    addItems,
    togglePacked,
    updateItem,
    deleteItem,
    reorderItems,
  };
}
