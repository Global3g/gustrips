'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import type { SharedExpense, TripExpense } from '@/types';

export interface Debt {
  from: string; // uid
  to: string; // uid
  amount: number;
}

interface UseExpensesReturn {
  expenses: TripExpense[];
  loading: boolean;
  addExpense: (data: Omit<SharedExpense, 'id' | 'createdAt'>) => Promise<void>;
  addTripExpense: (data: Omit<TripExpense, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (expenseId: string, data: Partial<TripExpense>) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  getBalances: () => Debt[];
  getExpensesByCategory: () => Record<string, number>;
}

export function useExpenses(tripId: string): UseExpensesReturn {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!tripId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const db = getClientDb();
    const expensesRef = collection(db, `trips/${tripId}/expenses`);
    const q = query(expensesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            tripId: raw.tripId ?? tripId,
            eventId: raw.eventId,
            description: raw.description ?? '',
            amount: raw.amount ?? 0,
            currency: raw.currency ?? 'MXN',
            category: raw.category ?? 'misc',
            paidBy: raw.paidBy ?? '',
            splitBetween: raw.splitBetween ?? [],
            receiptUrl: raw.receiptUrl,
            date: raw.date ?? '',
            notes: raw.notes ?? '',
            paymentMethod: raw.paymentMethod,
            pointsUsed: raw.pointsUsed,
            equivalentValue: raw.equivalentValue,
            realValueCurrency: raw.realValueCurrency,
            settled: raw.settled ?? false,
            createdAt: raw.createdAt ?? '',
            createdBy: raw.createdBy ?? raw.paidBy ?? '',
          } as TripExpense;
        });
        setExpenses(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error al escuchar gastos:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  // Legacy method for backward compatibility (budget page)
  const addExpense = useCallback(
    async (data: Omit<SharedExpense, 'id' | 'createdAt'>): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');

      const db = getClientDb();
      const expensesRef = collection(db, `trips/${tripId}/expenses`);

      await addDoc(expensesRef, {
        ...data,
        tripId,
        category: 'misc' as const,
        settled: false,
        createdBy: user.uid,
        notes: '',
        createdAt: nowISO(),
      });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [user, tripId],
  );

  const addTripExpense = useCallback(
    async (data: Omit<TripExpense, 'id' | 'createdAt'>): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');

      const db = getClientDb();
      const expensesRef = collection(db, `trips/${tripId}/expenses`);

      // Remove undefined values — Firestore rejects them
      const cleanData: Record<string, unknown> = { createdAt: nowISO() };
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) cleanData[key] = value;
      }
      await addDoc(expensesRef, cleanData);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [user, tripId],
  );

  const updateExpense = useCallback(
    async (expenseId: string, data: Partial<TripExpense>): Promise<void> => {
      const db = getClientDb();
      const expenseRef = doc(db, `trips/${tripId}/expenses`, expenseId);
      // Remove id from partial to avoid writing it as a field
      const { id: _id, ...updateData } = data as Partial<TripExpense> & { id?: string };
      await updateDoc(expenseRef, updateData);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId],
  );

  const deleteExpense = useCallback(
    async (expenseId: string): Promise<void> => {
      const db = getClientDb();
      const expenseRef = doc(db, `trips/${tripId}/expenses`, expenseId);
      await deleteDoc(expenseRef);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId],
  );

  const getBalances = useCallback((): Debt[] => {
    // Filter out settled expenses for balance calculation
    const unsettledExpenses = expenses.filter((e) => !e.settled);

    // Build a net balance map: positive = owed money, negative = owes money
    const netBalance = new Map<string, number>();

    for (const expense of unsettledExpenses) {
      const share = expense.amount / expense.splitBetween.length;

      // Payer gets credited the full amount
      const payerBalance = netBalance.get(expense.paidBy) ?? 0;
      netBalance.set(expense.paidBy, payerBalance + expense.amount);

      // Each person in the split owes their share
      for (const uid of expense.splitBetween) {
        const currentBalance = netBalance.get(uid) ?? 0;
        netBalance.set(uid, currentBalance - share);
      }
    }

    // Simplify debts: separate into creditors (+) and debtors (-)
    const creditors: { uid: string; amount: number }[] = [];
    const debtors: { uid: string; amount: number }[] = [];

    for (const [uid, balance] of netBalance.entries()) {
      const rounded = Math.round(balance * 100) / 100;
      if (rounded > 0.01) {
        creditors.push({ uid, amount: rounded });
      } else if (rounded < -0.01) {
        debtors.push({ uid, amount: Math.abs(rounded) });
      }
    }

    // Sort descending to minimize transactions
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const debts: Debt[] = [];
    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
      if (transfer > 0.01) {
        debts.push({
          from: debtors[di].uid,
          to: creditors[ci].uid,
          amount: Math.round(transfer * 100) / 100,
        });
      }

      creditors[ci].amount -= transfer;
      debtors[di].amount -= transfer;

      if (creditors[ci].amount < 0.01) ci++;
      if (debtors[di].amount < 0.01) di++;
    }

    return debts;
  }, [expenses]);

  const getExpensesByCategory = useCallback((): Record<string, number> => {
    const totals: Record<string, number> = {};

    for (const expense of expenses) {
      const category = expense.category ?? 'misc';
      totals[category] = (totals[category] ?? 0) + expense.amount;
    }

    return totals;
  }, [expenses]);

  return {
    expenses,
    loading,
    addExpense,
    addTripExpense,
    updateExpense,
    deleteExpense,
    getBalances,
    getExpensesByCategory,
  };
}
