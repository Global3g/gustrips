'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Wallet, Users, Sparkles } from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { useMembers } from '@/hooks/useMembers';
// Trip from layout-level TripDataProvider — this tab only renders in
// `/trips/[tripId]/expenses`.
import { useTripFromContext as useTrip } from '@/context/TripDataContext';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import Particles from '@/components/ui/Particles';
import { classNames, formatCurrency, getInitials } from '@/lib/utils/helpers';
import { EmptyState } from '@/components/EmptyState';

interface BalanceTabProps {
  tripId: string;
}

export function BalanceTab({ tripId }: BalanceTabProps) {
  const { expenses, loading, getBalances } = useExpenses(tripId);
  const { members } = useMembers(tripId);
  const { trip } = useTrip();
  const { user } = useAuth();
  const { travelers } = useGlobalTravelers();

  const currency = trip?.budgetCurrency ?? 'MXN';
  // Wrap in useMemo so the array identity is stable across renders —
  // otherwise downstream useMemos depending on `tripTravelerIds` run every
  // render even when the underlying list hasn't changed.
  const tripTravelerIds = useMemo(
    () => trip?.travelerIds || [],
    [trip?.travelerIds],
  );
  const tripTravelers = useMemo(
    () => travelers.filter((t) => tripTravelerIds.includes(t.id)),
    [travelers, tripTravelerIds],
  );

  const allBalances = useMemo(() => getBalances(), [getBalances]);
  const balances = useMemo(
    () =>
      allBalances.filter(
        (debt) => tripTravelerIds.includes(debt.from) && tripTravelerIds.includes(debt.to),
      ),
    [allBalances, tripTravelerIds],
  );

  const getMemberName = (uid: string): string => {
    const t = travelers.find((tr) => tr.id === uid);
    if (t?.fullName) return t.fullName;
    const m = members.find((member) => member.uid === uid);
    if (m?.displayName) return m.displayName;
    if (m?.email) return m.email.split('@')[0];
    if (user && uid === user.uid && tripTravelers.length > 0) {
      const myTraveler = tripTravelers.find((tr) =>
        tr.fullName.toLowerCase().includes((user.displayName || user.email?.split('@')[0] || '').toLowerCase()),
      );
      if (myTraveler) return myTraveler.fullName;
      return user.displayName || user.email?.split('@')[0] || 'Yo';
    }
    if (uid.length > 10) {
      const member = members.find((mm) => mm.uid === uid);
      if (member?.displayName) return member.displayName;
      if (member?.email) return member.email.split('@')[0];
    }
    return uid.slice(0, 8);
  };

  /* ─── Net balance per person ─── */
  const netBalances = useMemo(() => {
    const net = new Map<string, number>();
    let totalMoved = 0;
    let countedExpenses = 0;
    for (const expense of expenses) {
      if (expense.paymentMethod === 'points') continue;
      countedExpenses++;
      totalMoved += expense.amount;
      const share = expense.amount / Math.max(expense.splitBetween.length, 1);
      net.set(expense.paidBy, (net.get(expense.paidBy) ?? 0) + expense.amount);
      for (const uid of expense.splitBetween) {
        net.set(uid, (net.get(uid) ?? 0) - share);
      }
    }

    const entries = [...net.entries()]
      .filter(([uid]) => tripTravelerIds.includes(uid))
      .map(([uid, amount]) => ({
        uid,
        name: getMemberName(uid),
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { entries, totalMoved, countedExpenses };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, tripTravelerIds]);

  const myUid = user?.uid || '';
  const myEntry = netBalances.entries.find(
    (e) => e.uid === myUid || tripTravelers.find((t) => t.id === e.uid && t.fullName.toLowerCase().includes((user?.displayName || user?.email?.split('@')[0] || '').toLowerCase())),
  );

  const maxAbsBalance = useMemo(
    () => Math.max(1, ...netBalances.entries.map((e) => Math.abs(e.amount))),
    [netBalances.entries],
  );

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-amber-300 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  /* ─── Empty state ─── */
  const hasBalances = balances.length > 0;
  const hasNet = netBalances.entries.some((e) => Math.abs(e.amount) > 0.01);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30"
      style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
    >
      {/* Visual layer */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        <Particles count={28} />
        <div
          className="absolute -top-12 left-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: hasBalances
            ? 'radial-gradient(circle, rgba(245,158,11,0.22), transparent 70%)'
            : 'radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }}
        />
        <div
          className="absolute bottom-12 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* ─── Hero summary ─── */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
            <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
              <Wallet className="w-3 h-3" />
              Total movido
            </div>
            <div className="text-white text-2xl font-black tabular-nums" style={{ textShadow: '0 0 22px rgba(255,255,255,0.12)' }}>
              {formatCurrency(netBalances.totalMoved, currency)}
            </div>
            <div className="text-white/40 text-[11px] mt-0.5">
              {netBalances.countedExpenses} gasto{netBalances.countedExpenses !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
            <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
              <Users className="w-3 h-3" />
              Personas
            </div>
            <div className="text-white text-2xl font-black tabular-nums">{tripTravelers.length}</div>
            <div className="text-white/40 text-[11px] mt-0.5">en este viaje</div>
          </div>

          <div
            className={classNames(
              'rounded-2xl border backdrop-blur-sm p-4',
              hasBalances
                ? 'border-amber-300/30 bg-amber-400/10'
                : 'border-emerald-300/30 bg-emerald-400/10',
            )}
          >
            <div
              className={classNames(
                'flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5',
                hasBalances ? 'text-amber-200/80' : 'text-emerald-200/80',
              )}
            >
              {hasBalances ? <ArrowRight className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              Para saldar
            </div>
            <div
              className={classNames('text-2xl font-black tabular-nums', hasBalances ? 'text-amber-100' : 'text-emerald-100')}
            >
              {balances.length}
            </div>
            <div className={classNames('text-[11px] mt-0.5', hasBalances ? 'text-amber-200/60' : 'text-emerald-200/60')}>
              {hasBalances
                ? `transferencia${balances.length !== 1 ? 's' : ''} pendiente${balances.length !== 1 ? 's' : ''}`
                : 'Todo saldado ✓'}
            </div>
          </div>
        </div>

        {/* ─── Net balance bars ─── */}
        {hasNet ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white/85 text-sm font-bold">Balance neto por persona</div>
              <div className="text-white/40 text-[11px]">
                <span className="text-emerald-300">+ recibirá</span>
                {' · '}
                <span className="text-red-300">− debe</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {netBalances.entries.map((entry, idx) => {
                const isPositive = entry.amount > 0;
                const widthPct = (Math.abs(entry.amount) / maxAbsBalance) * 50; // each side max 50%
                const isMine = entry.uid === myUid || (myEntry && myEntry.uid === entry.uid);
                return (
                  <motion.div
                    key={entry.uid}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={classNames(
                      'rounded-xl border px-3 py-2.5 transition-all',
                      isMine ? 'bg-white/[0.06] border-white/20' : 'bg-white/[0.02] border-white/[0.06]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={classNames(
                          'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                          isPositive
                            ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-emerald-950'
                            : 'bg-gradient-to-br from-red-300 to-red-500 text-red-950',
                        )}
                      >
                        {getInitials(entry.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-white text-sm font-semibold truncate">
                            {entry.name.split(' ')[0]}
                            {isMine && <span className="text-amber-200 text-[11px] ml-1">(tú)</span>}
                          </span>
                          <span
                            className={classNames(
                              'text-sm font-black tabular-nums whitespace-nowrap',
                              isPositive ? 'text-emerald-300' : 'text-red-300',
                            )}
                          >
                            {isPositive ? '+' : '−'}
                            {formatCurrency(Math.abs(entry.amount), currency)}
                          </span>
                        </div>
                        {/* Center-anchored bar */}
                        <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                          <motion.div
                            className={classNames(
                              'absolute top-0 bottom-0 rounded-full',
                              isPositive ? 'left-1/2' : 'right-1/2',
                            )}
                            style={{
                              background: isPositive ? '#34d399' : '#f87171',
                              boxShadow: `0 0 8px ${isPositive ? '#34d39966' : '#f8717166'}`,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + idx * 0.05 }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm">
            <EmptyState
              variant="balance"
              title="Sin movimientos aún"
              description="Captura gastos compartidos para calcular el balance entre viajeros"
              compact
            />
          </div>
        )}

        {/* ─── Settlements ─── */}
        {hasBalances ? (
          <div>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <h3 className="text-white/85 text-sm font-bold">Para saldar</h3>
              <span className="text-white/40 text-[11px]">{balances.length} transferencia{balances.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {balances.map((debt, idx) => {
                const fromName = getMemberName(debt.from);
                const toName = getMemberName(debt.to);
                return (
                  <motion.div
                    key={`${debt.from}-${debt.to}-${idx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.06 }}
                    className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3.5 overflow-hidden"
                  >
                    {/* Subtle flow gradient line */}
                    <div
                      className="absolute inset-x-0 top-1/2 h-px pointer-events-none"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.35), transparent)' }}
                    />
                    <div className="relative flex items-center gap-3">
                      {/* From */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-300 to-red-500 flex items-center justify-center text-red-950 text-xs font-black flex-shrink-0 shadow-lg shadow-red-500/20">
                          {getInitials(fromName)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{fromName.split(' ')[0]}</div>
                          <div className="text-red-300/80 text-[10px] uppercase tracking-wider font-bold">debe</div>
                        </div>
                      </div>

                      {/* Amount in middle */}
                      <div className="text-center px-2">
                        <div className="text-white text-base sm:text-lg font-black tabular-nums" style={{ textShadow: '0 0 16px rgba(255,255,255,0.12)' }}>
                          {formatCurrency(debt.amount, currency)}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-300/70 mx-auto mt-0.5" />
                      </div>

                      {/* To */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end text-right">
                        <div className="min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{toName.split(' ')[0]}</div>
                          <div className="text-emerald-300/80 text-[10px] uppercase tracking-wider font-bold">recibe</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 flex items-center justify-center text-emerald-950 text-xs font-black flex-shrink-0 shadow-lg shadow-emerald-500/20">
                          {getInitials(toName)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : hasNet ? null : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-emerald-400/10 border border-emerald-300/30">
              <Sparkles className="w-6 h-6 text-emerald-300" />
            </div>
            <h3 className="text-white/85 font-semibold mb-1">Cuentas saldadas</h3>
            <p className="text-white/45 text-xs">No hay deudas pendientes entre los viajeros</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
