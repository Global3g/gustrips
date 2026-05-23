'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CheckSquare, Sparkles } from 'lucide-react';
import { useChecklistFromContext as useChecklist } from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import ChecklistSection from '@/components/trips/ChecklistSection';
import TemplateSelector from '@/components/trips/TemplateSelector';
import { EmptyState } from '@/components/EmptyState';
// config/constants not needed after removing back button
import type { ChecklistTemplate } from '@/config/checklistTemplates';
import type { ChecklistPhase } from '@/types';

export default function ChecklistPage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const { items, loading, addItem, toggleItem, deleteItem } = useChecklist();
  const { toast } = useToast();
  const [templateOpen, setTemplateOpen] = useState(false);

  /* ─── Progreso general ────────────────────────── */

  const totalItems = items.length;
  const checkedItems = items.filter((i) => i.checked).length;
  const overallProgress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  /* ─── Handlers ────────────────────────────────── */

  const handleAdd = async (text: string, phase: ChecklistPhase) => {
    try {
      await addItem(text, phase);
      toast('Elemento agregado', 'success');
    } catch (error) {
      console.error('Error al agregar elemento:', error);
      toast('Error al agregar el elemento', 'error');
    }
  };

  const handleToggle = async (itemId: string, checked: boolean) => {
    try {
      await toggleItem(itemId, checked);
    } catch (error) {
      console.error('Error al actualizar elemento:', error);
      toast('Error al actualizar el elemento', 'error');
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const { undo } = await deleteItem(itemId);
      toast('Elemento eliminado', 'info', {
        label: 'Deshacer',
        onClick: () => {
          undo();
          toast('Elemento restaurado', 'success');
        },
      });
    } catch (error) {
      console.error('Error al eliminar elemento:', error);
      toast('Error al eliminar el elemento', 'error');
    }
  };

  const handleApplyTemplates = useCallback(
    async (templates: ChecklistTemplate[]) => {
      let totalAdded = 0;
      const templateNames: string[] = [];

      for (const template of templates) {
        templateNames.push(template.label);
        for (const item of template.items) {
          try {
            await addItem(item.text, item.phase);
            totalAdded++;
          } catch (error) {
            console.error('Error al agregar item de template:', error);
          }
        }
      }

      const nameList = templateNames.join(', ');
      toast(`${totalAdded} items agregados del template ${nameList}`, 'success');
    },
    [addItem, toast]
  );

  /* ─── Render ──────────────────────────────────── */

  const isEmpty = !loading && totalItems === 0;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Checklist</h1>
          <p className="text-gray-400 text-sm">Prep\u00e1rate paso a paso para tu viaje</p>
        </div>
        {/* Template button in header (always visible) */}
        <button
          onClick={() => setTemplateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition-all duration-200"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Template
        </button>
      </div>

      {/* Barra de progreso general */}
      {totalItems > 0 && (
        <div className="glass rounded-xl px-4 py-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700 text-sm font-medium">Progreso general</span>
            </div>
            <span className="text-gray-900 font-bold text-sm">{overallProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-gray-400 text-xs mt-2">
            {checkedItems} de {totalItems} {totalItems === 1 ? 'tarea completada' : 'tareas completadas'}
          </p>
        </div>
      )}

      {/* Empty state with prominent template CTA */}
      {isEmpty && (
        <div className="glass rounded-2xl mb-6">
          <EmptyState
            variant="checklist"
            title="Comienza con un template"
            description="Elige un template predefinido para agregar rápidamente los elementos esenciales a tu checklist."
            action={{
              label: 'Explorar templates',
              onClick: () => setTemplateOpen(true),
            }}
          />
        </div>
      )}

      {/* Secciones del checklist */}
      <ChecklistSection
        items={items}
        onAdd={handleAdd}
        onToggle={handleToggle}
        onDelete={handleDelete}
        loading={loading}
      />

      {/* Template selector modal */}
      <TemplateSelector
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onApply={handleApplyTemplates}
      />
    </div>
  );
}
