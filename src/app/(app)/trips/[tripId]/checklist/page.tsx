'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import { useChecklist } from '@/hooks/useChecklist';
import { useToast } from '@/context/ToastContext';
import ChecklistSection from '@/components/trips/ChecklistSection';
import { ROUTES } from '@/config/constants';
import type { ChecklistPhase } from '@/types';

export default function ChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { items, loading, addItem, toggleItem, deleteItem } = useChecklist(tripId);
  const { toast } = useToast();

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
      await deleteItem(itemId);
      toast('Elemento eliminado', 'success');
    } catch (error) {
      console.error('Error al eliminar elemento:', error);
      toast('Error al eliminar el elemento', 'error');
    }
  };

  /* ─── Render ──────────────────────────────────── */

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(ROUTES.app.trip(tripId))}
          className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Checklist</h1>
          <p className="text-white/40 text-sm">Organiza tus tareas por fase del viaje</p>
        </div>
      </div>

      {/* Barra de progreso general */}
      {totalItems > 0 && (
        <div className="glass rounded-xl px-4 py-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-400" />
              <span className="text-white/70 text-sm font-medium">Progreso general</span>
            </div>
            <span className="text-white font-bold text-sm">{overallProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-white/40 text-xs mt-2">
            {checkedItems} de {totalItems} {totalItems === 1 ? 'tarea completada' : 'tareas completadas'}
          </p>
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
    </div>
  );
}
