'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, List, BarChart3, Scale, CalendarDays } from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';
import { CaptureTab } from '@/components/expenses/CaptureTab';
import { HistoryTab } from '@/components/expenses/HistoryTab';
import { BudgetComparisonTab } from '@/components/expenses/BudgetComparisonTab';
import { BalanceTab } from '@/components/expenses/BalanceTab';
import { DailyBudgetTab } from '@/components/expenses/DailyBudgetTab';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gastos</h1>
        <p className="text-gray-500 text-sm">Captura, divide y controla gastos del viaje</p>
      </div>

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
