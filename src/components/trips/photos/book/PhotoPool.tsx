'use client';

/**
 * PhotoPool — bottom-of-panel grid of trip photos. Each thumbnail is a
 * dnd-kit draggable. Dropping onto a Slot inside PagePreview will assign
 * that photo to the slot.
 *
 * Photos can also be tapped — that fills the currently-selected slot of
 * the active page. This keeps the editor usable on touch devices where
 * dragging across panels is awkward.
 */

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search } from 'lucide-react';
import type { AlbumPhoto } from '@/types';

interface PhotoPoolProps {
  photos: AlbumPhoto[];
  onTapPhoto?: (url: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

interface DragChipProps {
  url: string;
  onTap?: () => void;
}

function DragChip({ url, onTap }: DragChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `photo:${url}`,
    data: { kind: 'photo', url },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onTap}
      className="relative aspect-square rounded-md overflow-hidden bg-black/40 border border-white/[0.06] hover:border-amber-300/50 transition-colors"
    >
      <img
        src={url}
        alt=""
        draggable={false}
        loading="lazy"
        className="w-full h-full object-cover pointer-events-none"
      />
    </button>
  );
}

const MemoChip = memo(DragChip);

function PhotoPoolImpl({ photos, onTapPhoto, query, onQueryChange }: PhotoPoolProps) {
  const filtered = query.trim()
    ? photos.filter((p) =>
      (p.caption ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (p.date ?? '').toLowerCase().includes(query.toLowerCase()),
    )
    : photos;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar foto…"
          className="w-full pl-7 pr-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-amber-300/40"
        />
      </div>
      <div className="text-[10px] uppercase font-bold tracking-wider text-white/45">
        {filtered.length} fotos · arrastrá o tocá
      </div>
      <div
        className="grid gap-1.5 overflow-y-auto pr-1"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', maxHeight: 340 }}
      >
        {filtered.map((p) => {
          const url = p.fullUrl || p.url;
          return (
            <MemoChip
              key={url + (p.uploadedAt ?? '')}
              url={url}
              onTap={onTapPhoto ? () => onTapPhoto(url) : undefined}
            />
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 py-6 text-center text-white/45 text-xs italic">
            No hay fotos
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PhotoPoolImpl);
