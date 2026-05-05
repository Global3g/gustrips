'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Sun,
  Briefcase,
  Car,
  Heart,
  Check,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CHECKLIST_TEMPLATES } from '@/config/checklistTemplates';
import type { ChecklistTemplate } from '@/config/checklistTemplates';
import { CHECKLIST_PHASES } from '@/config/constants';
import type { ChecklistPhase } from '@/types';
import { classNames } from '@/lib/utils/helpers';

/* ─── Icon map ──────────────────────────────────── */

const TEMPLATE_ICON_MAP: Record<string, LucideIcon> = {
  Globe,
  Sun,
  Briefcase,
  Car,
  Heart,
};

const TEMPLATE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  international: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    glow: 'shadow-blue-100',
  },
  beach: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    glow: 'shadow-amber-100',
  },
  business: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-600',
    glow: 'shadow-violet-100',
  },
  roadtrip: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-600',
    glow: 'shadow-green-100',
  },
  family: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-600',
    glow: 'shadow-rose-100',
  },
};

const PHASE_DOT_COLOR: Record<ChecklistPhase, string> = {
  'pre-7d': 'bg-blue-400',
  'pre-1d': 'bg-amber-400',
  airport: 'bg-cyan-400',
  hotel: 'bg-violet-400',
  return: 'bg-green-400',
};

/* ─── Props ─────────────────────────────────────── */

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onApply: (templates: ChecklistTemplate[]) => void;
}

/* ─── Component ─────────────────────────────────── */

export default function TemplateSelector({ open, onClose, onApply }: TemplateSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ChecklistTemplate | null>(null);

  const toggleSelection = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    const chosen = CHECKLIST_TEMPLATES.filter((t) => selected.has(t.id));
    if (chosen.length > 0) {
      onApply(chosen);
    }
    setSelected(new Set());
    setPreview(null);
    onClose();
  }, [selected, onApply, onClose]);

  const handleClose = useCallback(() => {
    setSelected(new Set());
    setPreview(null);
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 400, damping: 30 },
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 10,
              transition: { duration: 0.15 },
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                {preview ? (
                  <button
                    onClick={() => setPreview(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="p-1.5 rounded-lg bg-blue-50">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                )}
                <div>
                  <h3 className="text-gray-900 font-semibold text-lg">
                    {preview ? preview.label : 'Templates de Checklist'}
                  </h3>
                  <p className="text-gray-400 text-xs">
                    {preview
                      ? `${preview.items.length} elementos`
                      : 'Selecciona uno o mas templates para agregar'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
              <AnimatePresence mode="wait">
                {preview ? (
                  <PreviewView key="preview" template={preview} />
                ) : (
                  <GridView
                    key="grid"
                    selected={selected}
                    onToggle={toggleSelection}
                    onPreview={setPreview}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {!preview && (
              <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
                <span className="text-gray-400 text-sm">
                  {selected.size > 0
                    ? `${selected.size} template${selected.size > 1 ? 's' : ''} seleccionado${selected.size > 1 ? 's' : ''}`
                    : 'Selecciona al menos un template'}
                </span>
                <button
                  onClick={handleApply}
                  disabled={selected.size === 0}
                  className={classNames(
                    'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 active:scale-[0.97]',
                    selected.size > 0
                      ? 'bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/15 border border-red-400/20'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  Usar template{selected.size > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Grid View ─────────────────────────────────── */

function GridView({
  selected,
  onToggle,
  onPreview,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onPreview: (t: ChecklistTemplate) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {CHECKLIST_TEMPLATES.map((template) => {
        const Icon = TEMPLATE_ICON_MAP[template.icon] || Globe;
        const colors = TEMPLATE_COLORS[template.id] || TEMPLATE_COLORS.international;
        const isSelected = selected.has(template.id);

        return (
          <motion.div
            key={template.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={classNames(
              'relative rounded-xl border p-4 cursor-pointer transition-all duration-200',
              isSelected
                ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
            )}
            onClick={() => onToggle(template.id)}
          >
            {/* Selection indicator */}
            <div
              className={classNames(
                'absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200',
                isSelected
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-gray-300'
              )}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>

            {/* Icon */}
            <div
              className={classNames(
                'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                colors.bg
              )}
            >
              <Icon className={classNames('w-5 h-5', colors.text)} />
            </div>

            {/* Content */}
            <h4 className="text-gray-900 font-semibold text-sm mb-1">{template.label}</h4>
            <p className="text-gray-400 text-xs mb-3 line-clamp-2">{template.description}</p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-xs">
                {template.items.length} elementos
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(template);
                }}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Ver detalle
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/* ─── Preview View ──────────────────────────────── */

function PreviewView({ template }: { template: ChecklistTemplate }) {
  const Icon = TEMPLATE_ICON_MAP[template.icon] || Globe;
  const colors = TEMPLATE_COLORS[template.id] || TEMPLATE_COLORS.international;

  // Group items by phase
  const phases = ['pre-7d', 'pre-1d', 'airport', 'hotel', 'return'] as ChecklistPhase[];
  const grouped = phases.reduce(
    (acc, phase) => {
      const phaseItems = template.items.filter((i) => i.phase === phase);
      if (phaseItems.length > 0) {
        acc[phase] = phaseItems;
      }
      return acc;
    },
    {} as Record<ChecklistPhase, typeof template.items>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Template header card */}
      <div
        className={classNames(
          'rounded-xl border p-4 flex items-center gap-3',
          colors.bg,
          colors.border
        )}
      >
        <div
          className={classNames(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            colors.bg
          )}
        >
          <Icon className={classNames('w-5 h-5', colors.text)} />
        </div>
        <div>
          <h4 className="text-gray-900 font-semibold text-sm">{template.label}</h4>
          <p className="text-gray-400 text-xs">{template.description}</p>
        </div>
      </div>

      {/* Items grouped by phase */}
      {phases.map((phase) => {
        const phaseItems = grouped[phase];
        if (!phaseItems) return null;

        const phaseConfig = CHECKLIST_PHASES[phase];

        return (
          <div key={phase}>
            <div className="flex items-center gap-2 mb-2">
              <div className={classNames('w-2 h-2 rounded-full', PHASE_DOT_COLOR[phase])} />
              <span className="text-gray-600 text-xs font-medium">{phaseConfig.label}</span>
              <span className="text-gray-300 text-xs">({phaseItems.length})</span>
            </div>
            <div className="space-y-1 ml-4">
              {phaseItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-50"
                >
                  <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
