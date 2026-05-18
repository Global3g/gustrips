'use client';

import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

interface CustomOrderStripProps {
  /** URLs in the user's desired play order. */
  order: string[];
  /** All photos available so we can resolve URL → preview image. */
  poolByUrl: Map<string, string>;
  onChange: (order: string[]) => void;
  onRemove: (url: string) => void;
}

/** Single draggable thumb in the strip. Lifted out of the parent so each
 *  sortable's hook usage is per-item — that's what dnd-kit expects. */
function SortableThumb({
  id,
  index,
  imgUrl,
  onRemove,
}: {
  id: string;
  index: number;
  imgUrl: string;
  onRemove: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-emerald-300/60 ring-1 ring-emerald-300/30 shadow-md cursor-grab active:cursor-grabbing"
    >
      {/* draggable=false stops the browser's native image-drag from
          intercepting pointer events that dnd-kit needs. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgUrl}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <div className="absolute top-0.5 left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-300 flex items-center justify-center shadow">
        <span className="text-[10px] font-black text-emerald-950">{index + 1}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove(id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Quitar de la lista"
        className="absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-rose-500/95 hover:bg-rose-400 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
      </button>
      <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-black/55 backdrop-blur-sm flex items-center justify-center pointer-events-none">
        <GripVertical className="w-2.5 h-2.5 text-white/85" />
      </div>
    </div>
  );
}

/**
 * Horizontal strip of selected photos in the user's chosen play order.
 * Wrap to multiple rows on small screens. Drag any thumb to reorder.
 *
 * Only rendered when the editor is in `order === 'custom'`.
 */
export default function CustomOrderStrip({
  order,
  poolByUrl,
  onChange,
  onRemove,
}: CustomOrderStripProps) {
  const sensors = useSensors(
    // Small activation distance so taps on the X button don't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      if (!e.over || e.active.id === e.over.id) return;
      const oldIdx = order.indexOf(String(e.active.id));
      const newIdx = order.indexOf(String(e.over.id));
      if (oldIdx < 0 || newIdx < 0) return;
      onChange(arrayMove(order, oldIdx, newIdx));
    },
    [order, onChange],
  );

  if (order.length < 2) {
    return (
      <p className="text-white/45 text-[11px] leading-snug">
        Elegí al menos 2 fotos para poder reordenarlas.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-1.5">
          {order.map((url, i) => {
            const imgUrl = poolByUrl.get(url) ?? url;
            return (
              <SortableThumb
                key={url}
                id={url}
                index={i}
                imgUrl={imgUrl}
                onRemove={onRemove}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
