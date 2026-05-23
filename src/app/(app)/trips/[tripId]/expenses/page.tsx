'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, List, BarChart3, Scale, CalendarDays, Sparkles } from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';
import { CaptureTab } from '@/components/expenses/CaptureTab';
import { useExpensesFromContext } from '@/context/TripDataContext';
// Only the default "Capturar" tab ships in the initial chunk. The other tabs
// load on tap — each pulls its own chart/aggregate code.
const HistoryTab = dynamic(
  () => import('@/components/expenses/HistoryTab').then((m) => ({ default: m.HistoryTab })),
  { ssr: false, loading: () => null },
);
const BudgetComparisonTab = dynamic(
  () => import('@/components/expenses/BudgetComparisonTab').then((m) => ({ default: m.BudgetComparisonTab })),
  { ssr: false, loading: () => null },
);
const BalanceTab = dynamic(
  () => import('@/components/expenses/BalanceTab').then((m) => ({ default: m.BalanceTab })),
  { ssr: false, loading: () => null },
);
const DailyBudgetTab = dynamic(
  () => import('@/components/expenses/DailyBudgetTab').then((m) => ({ default: m.DailyBudgetTab })),
  { ssr: false, loading: () => null },
);

type Tab = 'capture' | 'history' | 'budget' | 'balance' | 'daily';

interface TabConfig {
  id: Tab;
  label: string;
  icon: typeof Plus;
}

const TABS: TabConfig[] = [
  { id: 'capture', label: 'Capturar', icon: Plus },
  { id: 'history', label: 'Historial', icon: List },
  { id: 'budget', label: 'vs Presupuesto', icon: BarChart3 },
  { id: 'balance', label: 'Balance', icon: Scale },
  { id: 'daily', label: 'Diario', icon: CalendarDays },
];

export default function ExpensesPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const [activeTab, setActiveTab] = useState<Tab>('capture');
  // Pendientes-de-revisar count, surfaced as a banner. Drains from the
  // shared context (zero extra Firestore listeners) so opening this page
  // is essentially free in subscription terms.
  const { expenses } = useExpensesFromContext();
  const pendingReviewCount = expenses.filter((e) => e.needsReview).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gastos</h1>
        <p className="text-gray-500 text-sm">Captura, divide y controla gastos del viaje</p>
      </div>

      {/* Pendientes-de-revisar banner — only when there's anything to nudge.
          Clicking jumps to the History tab where each row carries a visible
          marker so the user can edit them one-by-one. */}
      {pendingReviewCount > 0 && (
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-900">
              {pendingReviewCount === 1
                ? 'Tenés 1 gasto por revisar'
                : `Tenés ${pendingReviewCount} gastos por revisar`}
            </div>
            <div className="text-xs text-amber-800/80 mt-0.5">
              Los marcaste rápido en el viaje. Confirmá pagador, split o descripción.
            </div>
          </div>
          <span className="text-amber-700 text-xs font-bold flex-shrink-0">
            Revisar →
          </span>
        </button>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative',
                isActive
                  ? 'text-amber-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="expense-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {activeTab === 'capture' && <CaptureTab tripId={tripId} />}
        {activeTab === 'history' && <HistoryTab tripId={tripId} />}
        {activeTab === 'budget' && <BudgetComparisonTab tripId={tripId} />}
        {activeTab === 'balance' && <BalanceTab tripId={tripId} />}
        {activeTab === 'daily' && <DailyBudgetTab tripId={tripId} />}
      </motion.div>
    </div>
  );
}
