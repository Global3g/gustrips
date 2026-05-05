'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { useMembers } from '@/hooks/useMembers';
import { useTrip } from '@/hooks/useTrip';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { Card, CardBody } from '@/components/ui/Card';
import { classNames, formatCurrency, getInitials } from '@/lib/utils/helpers';

interface BalanceTabProps {
  tripId: string;
}

export function BalanceTab({ tripId }: BalanceTabProps) {
  const { expenses, loading, getBalances } = useExpenses(tripId);
  const { members } = useMembers(tripId);
  const { trip } = useTrip(tripId);
  const { user } = useAuth();
  const { travelers } = useGlobalTravelers();

  const currency = trip?.budgetCurrency ?? 'MXN';
  const balances = useMemo(() => getBalances(), [getBalances]);

  // Map trip traveler IDs for quick lookup
  const tripTravelerIds = trip?.travelerIds || [];
  const tripTravelers = travelers.filter((t) => tripTravelerIds.includes(t.id));

  const getMemberName = (uid: string): string => {
    // Check global travelers by ID
    const t = travelers.find((tr) => tr.id === uid);
    if (t?.fullName) return t.fullName;
    // Check trip members
    const m = members.find((member) => member.uid === uid);
    if (m?.displayName) return m.displayName;
    if (m?.email) return m.email.split('@')[0];
    // Check current user — match first trip traveler as fallback
    if (user && uid === user.uid && tripTravelers.length > 0) {
      // Find traveler matching user email
      const myTraveler = tripTravelers.find((tr) =>
        tr.fullName.toLowerCase().includes((user.displayName || user.email?.split('@')[0] || '').toLowerCase())
      );
      if (myTraveler) return myTraveler.fullName;
      return user.displayName || user.email?.split('@')[0] || 'Yo';
    }
    // For old/unknown UIDs, try to find in trip members collection
    if (uid.length > 10) {
      // Likely a Firebase Auth UID — try matching member by email prefix
      const member = members.find((mm) => mm.uid === uid);
      if (member?.displayName) return member.displayName;
      if (member?.email) return member.email.split('@')[0];
    }
    return uid.slice(0, 8);
  };

  // Net balance per person (exclude points payments — no real money exchanged)
  const netBalances = useMemo(() => {
    const net = new Map<string, number>();

    for (const expense of expenses) {
      // Skip points payments — they don't affect who owes whom
      if (expense.paymentMethod === 'points') continue;

      const share = expense.amount / expense.splitBetween.length;

      // Payer gets credited
      const payerBalance = net.get(expense.paidBy) ?? 0;
      net.set(expense.paidBy, payerBalance + expense.amount);

      // Each person owes their share
      for (const uid of expense.splitBetween) {
        const current = net.get(uid) ?? 0;
        net.set(uid, current - share);
      }
    }

    return [...net.entries()]
      .map(([uid, amount]) => ({
        uid,
        name: getMemberName(uid),
        amount: Math.round(amount * 100) / 100,
      }))
      .filter((entry) => Math.abs(entry.amount) > 0.01)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, members]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-gray-700 font-semibold mb-1">Todas las cuentas estan saldadas</h3>
        <p className="text-gray-400 text-sm">
          No hay deudas pendientes entre los viajeros
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Net balance summary */}
      {netBalances.length > 0 && (
        <Card>
          <CardBody className="space-y-3">
            <h3 className="text-gray-900 font-semibold text-sm">Balance neto por persona</h3>
            <div className="space-y-2">
              {netBalances.map((entry) => (
                <div
                  key={entry.uid}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold">
                      {getInitials(entry.name)}
                    </div>
                    <span className="text-gray-700 text-sm">{entry.name.split(' ')[0]}</span>
                  </div>
                  <span
                    className={classNames(
                      'text-sm font-semibold',
                      entry.amount > 0 ? 'text-emerald-600' : 'text-red-600',
                    )}
                  >
                    {entry.amount > 0 ? '+' : ''}
                    {formatCurrency(entry.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Debt cards */}
      <div className="space-y-3">
        <h3 className="text-gray-900 font-semibold text-sm px-1">
          Transacciones para saldar ({balances.length})
        </h3>

        {balances.map((debt, idx) => {
          const fromName = getMemberName(debt.from);
          const toName = getMemberName(debt.to);

          return (
            <motion.div
              key={`${debt.from}-${debt.to}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.3 }}
            >
              <Card>
                <CardBody className="flex items-center gap-3">
                  {/* From person */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {getInitials(fromName)}
                    </div>
                    <span className="text-gray-700 text-sm font-medium truncate">
                      {fromName.split(' ')[0]}
                    </span>
                  </div>

                  {/* Arrow + amount */}
                  <div className="flex items-center gap-2 flex-1 justify-center">
                    <span className="text-red-600 text-xs font-medium">debe</span>
                    <span className="text-gray-900 font-bold text-base">
                      {formatCurrency(debt.amount, currency)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-300" />
                  </div>

                  {/* To person */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {getInitials(toName)}
                    </div>
                    <span className="text-gray-700 text-sm font-medium truncate">
                      {toName.split(' ')[0]}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
