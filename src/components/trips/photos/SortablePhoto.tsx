'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';

interface SortablePhotoProps {
  id: string;
  enabled: boolean;
  children: React.ReactNode;
}

/** Wraps a photo card in a sortable handle for drag-and-drop reordering.
 *  When `enabled` is false, no drag listeners are attached. */
export default function SortablePhoto({ id, enabled, children }: SortablePhotoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !enabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      {/* Drag handle — only visible when enabled */}
      {enabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reordenar foto"
          className={classNames(
            'absolute top-2 left-2 z-20 w-7 h-7 rounded-full bg-black/55 backdrop-blur-md',
            'flex items-center justify-center text-white/85 cursor-grab active:cursor-grabbing',
            'opacity-0 group-hover/sortable:opacity-100 md:transition-opacity',
            'border border-white/15 hover:bg-black/75 touch-none',
            isDragging && 'opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      {children}
    </div>
  );
}
