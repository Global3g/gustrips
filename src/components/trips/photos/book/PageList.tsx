'use client';

/**
 * PageList — sortable left rail showing the cover (pinned) plus all
 * editable pages. Click selects, drag reorders.
 *
 * The cover is intentionally NOT included in the sortable container: it
 * always lives at position 0 and shouldn't be draggable.
 */

import { useState } from 'react';
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
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical, Plus, Copy, Trash2 } from 'lucide-react';
import PagePreview from './PagePreview';
import type { BookPage, BookState, ThemeId } from '@/lib/photobook/types';

interface PageListProps {
  state: BookState;
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onReorder: (orderedPageIds: string[]) => void;
  onDuplicate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onAdd: () => void;
}

interface RowProps {
  page: BookPage;
  index: number;
  theme: ThemeId;
  size: BookState['size'];
  isActive: boolean;
  isCover: boolean;
  onSelect: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function PageRow({
  page,
  index,
  theme,
  size,
  isActive,
  isCover,
  onSelect,
  onDuplicate,
  onDelete,
}: RowProps) {
  const sortable = useSortable({ id: page.id, disabled: isCover });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={
        'group relative rounded-xl border transition-colors ' +
        (isActive
          ? 'bg-amber-300/10 border-amber-300/50 ring-1 ring-amber-300/40'
          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]')
      }
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-2 p-2 text-left"
      >
        {/* Drag handle (cover has no handle since it's pinned). */}
        {!isCover ? (
          <span
            {...sortable.attributes}
            {...sortable.listeners}
            className="flex-shrink-0 w-5 h-12 flex items-center justify-center text-white/40 hover:text-white/70 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        ) : (
          <span className="flex-shrink-0 w-5 h-12" />
        )}

        {/* Thumbnail. 90px wide is enough to be readable, small enough to
            keep the sidebar narrow. */}
        <div className="flex-shrink-0">
          <PagePreview
            page={page}
            theme={theme}
            size={size}
            width={90}
            thumbnail
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">
            {isCover ? 'Tapa' : `Página ${index}`}
          </div>
          <div className="text-xs font-semibold text-white truncate mt-0.5">
            {page.title || (isCover ? 'Mi viaje' : 'Sin título')}
          </div>
        </div>
      </button>

      {/* Per-page menu — duplicate/delete (cover excluded). */}
      {!isCover && (onDuplicate || onDelete) && (
        <div className="absolute top-1.5 right-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label="Más opciones"
            className="w-6 h-6 rounded-md bg-black/30 border border-white/10 flex items-center justify-center text-white/70 hover:bg-black/50"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-32 rounded-lg border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl z-50"
              onMouseLeave={() => setMenuOpen(false)}
            >
              {onDuplicate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDuplicate();
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-white/85 hover:bg-white/[0.08] flex items-center gap-1.5"
                >
                  <Copy className="w-3 h-3" />
                  Duplicar
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-red-300 hover:bg-red-500/10 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PageList({
  state,
  activePageId,
  onSelectPage,
  onReorder,
  onDuplicate,
  onDelete,
  onAdd,
}: PageListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pageIds = state.pages.map((p) => p.id);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = pageIds.indexOf(active.id as string);
    const newIndex = pageIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(pageIds, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Cover row (pinned, non-sortable). */}
      <PageRow
        page={state.cover}
        index={0}
        theme={state.theme}
        size={state.size}
        isActive={state.cover.id === activePageId}
        isCover
        onSelect={() => onSelectPage(state.cover.id)}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
          {state.pages.map((page, i) => (
            <PageRow
              key={page.id}
              page={page}
              index={i + 1}
              theme={state.theme}
              size={state.size}
              isActive={page.id === activePageId}
              isCover={false}
              onSelect={() => onSelectPage(page.id)}
              onDuplicate={() => onDuplicate(page.id)}
              onDelete={() => onDelete(page.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-dashed border-white/15 text-white/65 hover:text-white hover:border-white/30 text-xs font-semibold transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Agregar página
      </button>
    </div>
  );
}
