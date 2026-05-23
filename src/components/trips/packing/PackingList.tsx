'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { classNames } from '@/lib/utils/helpers';
import {
  PACKING_CATEGORIES,
  PACKING_CATEGORY_LABEL,
  type PackingCategory,
} from '@/lib/packingTemplates';
import type { PackingItem } from '@/hooks/usePacking';

interface PackingListProps {
  items: PackingItem[];
  loading?: boolean;
  onTogglePacked: (id: string, packed: boolean) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onReorder: (idsInOrder: string[]) => Promise<void> | void;
}

interface SortableRowProps {
  item: PackingItem;
  onToggle: (id: string, packed: boolean) => void;
  onDelete: (id: string) => void;
}

/**
 * A single sortable row in the packing list. Drag is initiated from the
 * left grip badge so the whole row stays tap-friendly (the checkbox and
 * delete buttons must remain clickable on mobile).
 */
function SortableRow({ item, onToggle, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : 'auto',
    opacity: isDragging ? 0.92 : 1,
    boxShadow: isDragging ? '0 12px 30px rgba(0,0,0,0.18)' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors',
        item.packed ? 'bg-emerald-50/50' : 'bg-white hover:bg-gray-50',
        'border border-gray-200/70',
      )}
    >
      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Reordenar elemento"
        className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
        style={{ touchAction: 'none' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(item.id, !item.packed)}
        aria-label={item.packed ? `Desmarcar: ${item.name}` : `Marcar como empacado: ${item.name}`}
        className={classNames(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200',
          item.packed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-gray-500',
        )}
      >
        {item.packed && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Label + quantity / optional badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={classNames(
              'text-sm transition-colors',
              item.packed ? 'text-gray-400 line-through' : 'text-gray-800',
            )}
          >
            {item.name}
          </span>
          {item.quantity > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium">
              x{item.quantity}
            </span>
          )}
          {item.optional && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-100">
              opcional
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`¿Eliminar "${item.name}" de la maleta?`)) {
            onDelete(item.id);
          }
        }}
        aria-label={`Eliminar ${item.name}`}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1 rounded"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function PackingList({
  items,
  loading,
  onTogglePacked,
  onDelete,
  onReorder,
}: PackingListProps) {
  // Local optimistic reordering — without it, the drag-end animates from
  // the old position back to itself for a frame until Firestore round-trips.
  const [optimistic, setOptimistic] = useState<PackingItem[] | null>(null);
  const effective = optimistic ?? items;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  /** Group items by category preserving the per-category order. */
  const grouped = useMemo(() => {
    const out = new Map<PackingCategory, PackingItem[]>();
    for (const cat of PACKING_CATEGORIES) out.set(cat, []);
    for (const item of effective) {
      const list = out.get(item.category) ?? out.set(item.category, []).get(item.category)!;
      list.push(item);
    }
    return out;
  }, [effective]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = effective.findIndex((i) => i.id === active.id);
    const toIdx = effective.findIndex((i) => i.id === over.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = arrayMove(effective, fromIdx, toIdx);
    setOptimistic(next);
    try {
      await onReorder(next.map((i) => i.id));
    } finally {
      // Drop the optimistic copy on the next snapshot — easy way: clear
      // it now and let the live list take over. If the write failed the
      // snapshot will show the old order.
      setOptimistic(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/40 backdrop-blur-sm border border-gray-200/60 p-5 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3 py-2">
                <div className="w-5 h-5 rounded bg-gray-200" />
                <div className="h-3 flex-1 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (effective.length === 0) {
    return null;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={effective.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {PACKING_CATEGORIES.map((cat) => {
            const list = grouped.get(cat) ?? [];
            if (list.length === 0) return null;
            const totalCount = list.length;
            const packedCount = list.filter((i) => i.packed).length;
            const allPacked = totalCount > 0 && packedCount === totalCount;
            return (
              <motion.section
                key={cat}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl bg-white/85 backdrop-blur-sm border border-gray-200 p-4"
                style={{ borderColor: 'var(--pillar-rule)' }}
              >
                <header className="flex items-center justify-between mb-3">
                  <h3
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--pillar-ink-soft)' }}
                  >
                    {PACKING_CATEGORY_LABEL[cat]}
                  </h3>
                  <span
                    className={classNames(
                      'text-xs font-medium rounded-full px-2 py-0.5',
                      allPacked ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {packedCount}/{totalCount}
                  </span>
                </header>
                <div className="space-y-1.5">
                  {list.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      onToggle={onTogglePacked}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </motion.section>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
