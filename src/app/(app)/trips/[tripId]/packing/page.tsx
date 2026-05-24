'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Backpack,
  Plus,
  Sparkles,
  Loader2,
  X,
  Wand2,
} from 'lucide-react';
import { useTripFromContext } from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { usePacking } from '@/hooks/usePacking';
import PackingList from '@/components/trips/packing/PackingList';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { classNames } from '@/lib/utils/helpers';
import {
  PACKING_CATEGORIES,
  PACKING_CATEGORY_LABEL,
  PACKING_TEMPLATE_LIST,
  PACKING_TEMPLATES,
  type PackingCategory,
  type PackingTemplateId,
} from '@/lib/packingTemplates';

export default function PackingPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trip } = useTripFromContext();
  const { toast } = useToast();

  const {
    items,
    loading,
    addItem,
    addItems,
    togglePacked,
    deleteItem,
    reorderItems,
  } = usePacking(tripId);

  // ── Quick-add form state ───────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<PackingCategory>('ropa');
  const [newOptional, setNewOptional] = useState(false);
  const [newQuantity, setNewQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  // ── Template picker ────────────────────────────────────────────────
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<PackingTemplateId | null>(null);

  // ── AI suggestions state ───────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // ── Derived progress numbers ───────────────────────────────────────
  const total = items.length;
  const packed = items.filter((i) => i.packed).length;
  const progress = total > 0 ? Math.round((packed / total) * 100) : 0;

  // For the AI request we send a flat string list of what they already have,
  // so duplicates are easier to detect inside the prompt.
  const currentItemNames = useMemo(() => items.map((i) => i.name), [items]);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await addItem({
        name,
        category: newCategory,
        quantity: Math.max(1, Math.floor(newQuantity)),
        optional: newOptional,
      });
      setNewName('');
      setNewOptional(false);
      setNewQuantity(1);
      toast('Item agregado a la maleta', 'success');
    } catch (err) {
      console.error('Error al agregar item de maleta:', err);
      toast('Error al agregar el item', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleApplyTemplate = async (templateId: PackingTemplateId) => {
    const template = PACKING_TEMPLATES[templateId];
    if (!template) return;
    setApplyingTemplateId(templateId);
    try {
      const added = await addItems(
        template.items.map((it) => ({
          name: it.name,
          category: it.category,
          quantity: it.quantity,
          optional: it.optional,
        })),
      );
      toast(`${added} items agregados del template ${template.label}`, 'success');
      setTemplatePickerOpen(false);
    } catch (err) {
      console.error('Error al aplicar template de maleta:', err);
      toast('Error al aplicar el template', 'error');
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const handleSuggestWithAI = async () => {
    if (!trip) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions([]);
    try {
      const res = await fetch('/api/packing-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          currentItems: currentItemNames,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setSuggestError(data?.error || 'No pudimos generar sugerencias.');
        return;
      }
      const list = Array.isArray(data.suggestions) ? (data.suggestions as string[]) : [];
      if (list.length === 0) {
        setSuggestError('El asistente no devolvió sugerencias nuevas.');
        return;
      }
      setSuggestions(list);
    } catch (err) {
      console.error('Error sugiriendo con AI:', err);
      setSuggestError('Error al contactar al asistente.');
    } finally {
      setSuggesting(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: string) => {
    try {
      await addItem({
        name: suggestion,
        category: 'otros',
        quantity: 1,
        optional: false,
      });
      // Drop the accepted suggestion from the panel so it stops feeling stale.
      setSuggestions((prev) => prev.filter((s) => s !== suggestion));
    } catch (err) {
      console.error('Error agregando sugerencia AI:', err);
      toast('Error al agregar la sugerencia', 'error');
    }
  };

  const handleAddAllSuggestions = async () => {
    if (suggestions.length === 0) return;
    try {
      const added = await addItems(
        suggestions.map((s) => ({ name: s, category: 'otros', quantity: 1, optional: false })),
      );
      toast(`${added} sugerencias agregadas a la maleta`, 'success');
      setSuggestions([]);
    } catch (err) {
      console.error('Error agregando todas las sugerencias:', err);
      toast('Error al agregar las sugerencias', 'error');
    }
  };

  const isEmpty = !loading && items.length === 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <header className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--pillar-surface)', border: '1px solid var(--pillar-rule)' }}
        >
          <Backpack className="w-5 h-5" style={{ color: 'var(--pillar-accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold" style={{ color: 'var(--pillar-ink)' }}>
            Maleta inteligente
          </h1>
          <p className="text-sm" style={{ color: 'var(--pillar-ink-soft)' }}>
            Llevá el control de lo que ya empacaste y dejate ayudar por la IA.
          </p>
        </div>
      </header>

      {/* Progress card */}
      {total > 0 && (
        <div
          className="rounded-2xl px-4 py-4"
          style={{ background: 'var(--pillar-surface)', border: '1px solid var(--pillar-rule)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--pillar-ink)' }}>
              Progreso de empaque
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--pillar-accent)' }}>
              {progress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--pillar-rule)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'var(--pillar-accent)',
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--pillar-ink-soft)' }}>
            {packed} de {total} {total === 1 ? 'item empacado' : 'items empacados'}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={Sparkles}
          onClick={() => setTemplatePickerOpen(true)}
        >
          Aplicar template
        </Button>
        <Button
          variant="primary"
          icon={Wand2}
          loading={suggesting}
          onClick={handleSuggestWithAI}
          disabled={!trip}
        >
          Sugerir con AI
        </Button>
      </div>

      {/* AI suggestions panel */}
      <AnimatePresence>
        {(suggestions.length > 0 || suggestError) && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl p-4"
            style={{
              background: 'var(--pillar-surface)',
              border: '1px solid var(--pillar-accent)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--pillar-accent)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--pillar-ink)' }}>
                  Sugerencias del asistente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSuggestions([]);
                  setSuggestError(null);
                }}
                className="p-1 rounded-md hover:bg-black/5"
                aria-label="Cerrar sugerencias"
              >
                <X className="w-4 h-4" style={{ color: 'var(--pillar-ink-soft)' }} />
              </button>
            </div>

            {suggestError ? (
              <p className="text-sm" style={{ color: 'var(--pillar-ink-soft)' }}>
                {suggestError}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAcceptSuggestion(s)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                      style={{
                        background: 'var(--pillar-bg)',
                        border: '1px solid var(--pillar-rule)',
                        color: 'var(--pillar-ink)',
                      }}
                    >
                      <Plus className="w-3 h-3" style={{ color: 'var(--pillar-accent)' }} />
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddAllSuggestions}
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  style={{ color: 'var(--pillar-accent)' }}
                >
                  Agregar todas
                </button>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Quick-add form */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--pillar-surface)', border: '1px solid var(--pillar-rule)' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pillar-ink)' }}>
          Agregar manualmente
        </h3>
        <div className="space-y-2 sm:space-y-0 sm:flex sm:items-end sm:gap-2">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--pillar-ink-soft)' }}>
              ¿Qué llevás?
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Ej: Cargador USB-C"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--pillar-ink-soft)' }}>
              Categoría
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as PackingCategory)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              {PACKING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PACKING_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label className="block text-xs mb-1" style={{ color: 'var(--pillar-ink-soft)' }}>
              Cantidad
            </label>
            <input
              type="number"
              min={1}
              value={newQuantity}
              onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div className="flex items-center gap-2 pt-1 sm:pt-0 sm:pb-2">
            <label
              className={classNames(
                'inline-flex items-center gap-1.5 text-xs cursor-pointer select-none',
              )}
              style={{ color: 'var(--pillar-ink-soft)' }}
            >
              <input
                type="checkbox"
                checked={newOptional}
                onChange={(e) => setNewOptional(e.target.checked)}
                className="rounded"
              />
              opcional
            </label>
          </div>
          <Button
            type="button"
            variant="primary"
            icon={adding ? Loader2 : Plus}
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
          >
            Agregar
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div
          className="rounded-2xl"
          style={{ background: 'var(--pillar-surface)', border: '1px solid var(--pillar-rule)' }}
        >
          <EmptyState
            variant="checklist"
            title="Tu maleta está vacía"
            description="Empezá con un template predefinido o pedile al asistente que te sugiera qué llevar."
            action={{
              label: 'Aplicar template',
              onClick: () => setTemplatePickerOpen(true),
            }}
          />
        </div>
      )}

      {/* Packing list */}
      <PackingList
        items={items}
        loading={loading}
        onTogglePacked={togglePacked}
        onDelete={deleteItem}
        onReorder={reorderItems}
      />

      {/* Template picker modal */}
      <AnimatePresence>
        {templatePickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setTemplatePickerOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Elegí un template</h3>
                <button
                  type="button"
                  onClick={() => setTemplatePickerOpen(false)}
                  className="p-1 rounded-md hover:bg-gray-100"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="space-y-2">
                {PACKING_TEMPLATE_LIST.map((tpl) => {
                  const applying = applyingTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={applying || !!applyingTemplateId}
                      onClick={() => handleApplyTemplate(tpl.id)}
                      className={classNames(
                        'w-full text-left p-3 rounded-xl border transition-colors',
                        'hover:bg-gray-50 border-gray-200',
                        applying && 'opacity-60 cursor-wait',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900">{tpl.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{tpl.description}</div>
                          <div className="text-[10px] text-gray-400 mt-1">
                            {tpl.items.length} items
                          </div>
                        </div>
                        {applying && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
