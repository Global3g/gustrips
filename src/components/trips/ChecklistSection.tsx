'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  CalendarCheck,
  PlaneTakeoff,
  Hotel,
  RotateCcw,
  ChevronDown,
  Trash2,
  Plus,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CHECKLIST_PHASES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import type { ChecklistItem, ChecklistPhase } from '@/types';

/* ─── Mapa de iconos ────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  Calendar,
  CalendarCheck,
  PlaneTakeoff,
  Hotel,
  RotateCcw,
};

/* ─── Colores de fondo por fase ─────────────────── */

const PHASE_BG: Record<ChecklistPhase, string> = {
  'pre-7d': 'bg-blue-50 border-blue-200',
  'pre-1d': 'bg-amber-50 border-amber-200',
  airport: 'bg-cyan-50 border-cyan-200',
  hotel: 'bg-violet-50 border-violet-200',
  return: 'bg-green-50 border-green-200',
};

const PHASE_ICON_BG: Record<ChecklistPhase, string> = {
  'pre-7d': 'bg-blue-50 text-blue-600',
  'pre-1d': 'bg-amber-50 text-amber-600',
  airport: 'bg-cyan-50 text-cyan-600',
  hotel: 'bg-violet-50 text-violet-600',
  return: 'bg-green-50 text-green-600',
};

const PHASE_PROGRESS: Record<ChecklistPhase, string> = {
  'pre-7d': 'bg-blue-400',
  'pre-1d': 'bg-amber-400',
  airport: 'bg-cyan-400',
  hotel: 'bg-violet-400',
  return: 'bg-green-400',
};

/* ─── Props ─────────────────────────────────────── */

interface ChecklistSectionProps {
  items: ChecklistItem[];
  onAdd: (text: string, phase: ChecklistPhase) => Promise<void>;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  loading?: boolean;
}

/* ─── Seccion de una fase ───────────────────────── */

function PhaseSection({
  phase,
  items,
  onAdd,
  onToggle,
  onDelete,
}: {
  phase: ChecklistPhase;
  items: ChecklistItem[];
  onAdd: (text: string, phase: ChecklistPhase) => Promise<void>;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevCheckedRef = React.useRef<number | null>(null);

  const config = CHECKLIST_PHASES[phase];
  const Icon = ICON_MAP[config.icon] || Calendar;

  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const progress = total > 0 ? (checked / total) * 100 : 0;

  // Detect when all items become checked (phase complete)
  React.useEffect(() => {
    if (prevCheckedRef.current !== null && total > 0 && checked === total && prevCheckedRef.current < total) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
    prevCheckedRef.current = checked;
  }, [checked, total]);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    try {
      await onAdd(newText.trim(), phase);
      setNewText('');
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={classNames('rounded-xl border overflow-hidden', PHASE_BG[phase])}>
      {/* Encabezado de fase */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className={classNames(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            PHASE_ICON_BG[phase]
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 font-semibold text-sm">{config.label}</span>
            <span className="text-gray-400 text-xs">
              {checked}/{total}
            </span>
          </div>
          {/* Barra de progreso */}
          <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1.5">
            <div
              className={classNames('h-full rounded-full transition-all duration-500', PHASE_PROGRESS[phase])}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-300 flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* Phase complete celebration */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center justify-center gap-2">
              <div className="confetti-container inline-flex items-center justify-center">
                <span className="confetti-dot" />
                <span className="confetti-dot" />
                <span className="confetti-dot" />
                <span className="confetti-dot" />
                <span className="confetti-dot" />
                <span className="confetti-dot" />
              </div>
              <span className="animate-celebrate text-emerald-600 text-sm font-semibold">
                {'\u2713'} {'\u00a1'}Fase completada!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenido colapsable */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1">
              {/* Items del checklist */}
              {items.length === 0 && (
                <p className="text-gray-300 text-xs py-2 text-center">
                  Sin elementos en esta fase
                </p>
              )}

              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 group py-1.5 rounded-lg hover:bg-gray-50 px-2 -mx-2 transition-colors"
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggle(item.id, !item.checked)}
                    aria-label={item.checked ? `Desmarcar: ${item.text}` : `Marcar: ${item.text}`}
                    className={classNames(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200',
                      item.checked
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-300 hover:border-gray-500'
                    )}
                  >
                    {item.checked && <Check className="w-3 h-3 text-white" />}
                  </button>

                  {/* Texto */}
                  <span
                    className={classNames(
                      'flex-1 text-sm transition-all duration-200',
                      item.checked ? 'text-gray-300 line-through' : 'text-gray-800'
                    )}
                  >
                    {item.text}
                  </span>

                  {/* Boton eliminar */}
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Eliminar "${item.text}"?`)) {
                        onDelete(item.id);
                      }
                    }}
                    aria-label={`Eliminar elemento: ${item.text}`}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Input para agregar nuevo */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  placeholder="Agregar elemento..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={adding}
                  className="flex-1 bg-transparent text-gray-800 text-sm placeholder:text-gray-300 outline-none py-1.5"
                />
                <button
                  onClick={handleAdd}
                  disabled={!newText.trim() || adding}
                  aria-label="Agregar elemento al checklist"
                  className={classNames(
                    'p-1.5 rounded-lg transition-colors',
                    newText.trim()
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-gray-200 cursor-not-allowed'
                  )}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Componente principal ──────────────────────── */

export default function ChecklistSection({
  items,
  onAdd,
  onToggle,
  onDelete,
  loading,
}: ChecklistSectionProps) {
  // Agrupar items por fase
  const phases = Object.keys(CHECKLIST_PHASES) as ChecklistPhase[];

  const groupedItems = phases.reduce(
    (acc, phase) => {
      acc[phase] = items.filter((item) => item.phase === phase);
      return acc;
    },
    {} as Record<ChecklistPhase, ChecklistItem[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {phases.map((phase) => (
        <PhaseSection
          key={phase}
          phase={phase}
          items={groupedItems[phase]}
          onAdd={onAdd}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
