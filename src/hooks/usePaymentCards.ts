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
import type { PaymentCard } from '@/types';

// A spread of distinguishable card colors.
const CARD_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#d97706',
  '#059669', '#0891b2', '#dc2626', '#4f46e5',
  '#0f766e', '#ea580c', '#475569', '#1e293b',
];

function pickCardColor(): string {
  return CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
}

interface UsePaymentCardsReturn {
  cards: PaymentCard[];
  loading: boolean;
  addCard: (data: Omit<PaymentCard, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  updateCard: (id: string, data: Partial<Omit<PaymentCard, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
}

/**
 * Global wallet of the user's payment cards, stored at `users/{uid}/cards`
 * (mirrors useGlobalTravelers). Reused across every trip — register once,
 * pick when logging a credit/debit expense, reconcile later by card.
 */
export function usePaymentCards(): UsePaymentCardsReturn {
  const { user } = useAuth();
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setCards([]);
      setLoading(false);
      return;
    }
    const db = getClientDb();
    const cardsRef = collection(db, 'users', user.uid, 'cards');
    const q = query(cardsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCards(
          snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as PaymentCard[],
        );
        setLoading(false);
      },
      (err) => {
        console.error('Error al escuchar tarjetas:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user?.uid]);

  const addCard = useCallback(
    async (data: Omit<PaymentCard, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
      if (!user) throw new Error('Usuario no autenticado');
      const db = getClientDb();
      const now = nowISO();
      const cardsRef = collection(db, 'users', user.uid, 'cards');
      // Strip undefined fields — Firestore rejects them.
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== '') clean[k] = v;
      }
      const docRef = await addDoc(cardsRef, {
        ...clean,
        color: data.color || pickCardColor(),
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    },
    [user],
  );

  const updateCard = useCallback(
    async (id: string, data: Partial<Omit<PaymentCard, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');
      const db = getClientDb();
      await updateDoc(doc(db, 'users', user.uid, 'cards', id), {
        ...data,
        updatedAt: nowISO(),
      });
    },
    [user],
  );

  const deleteCard = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');
      const db = getClientDb();
      await deleteDoc(doc(db, 'users', user.uid, 'cards', id));
    },
    [user],
  );

  return { cards, loading, addCard, updateCard, deleteCard };
}
