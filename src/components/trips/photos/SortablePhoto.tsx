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

/** Wraps a photo card to make the WHOLE card draggable via @dnd-kit.
 *  Clicks still work because the parent DndContext uses an activation
 *  distance / delay before turning a press into a drag. A visible grip
 *  badge tells users the card is reorderable. */
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
    opacity: isDragging ? 0.92 : 1,
    boxShadow: isDragging ? '0 18px 50px rgba(0,0,0,0.45)' : undefined,
    touchAction: enabled ? 'none' : undefined,
  };

  // Spread drag listeners on the WHOLE wrapper so dragging starts from anywhere on the card.
  const dragProps = enabled ? { ...attributes, ...listeners } : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames(
        'relative group/sortable',
        enabled && 'cursor-grab active:cursor-grabbing',
      )}
      {...dragProps}
    >
      {enabled && (
        <div
          aria-hidden
          className={classNames(
            'absolute top-2 left-2 z-20 w-6 h-6 rounded-full bg-black/55 backdrop-blur-md',
            'flex items-center justify-center text-white/90 border border-white/20',
            'shadow-md pointer-events-none transition-transform',
            isDragging && 'scale-110',
          )}
        >
          <GripVertical className="w-3 h-3" />
        </div>
      )}
      {children}
    </div>
  );
}
