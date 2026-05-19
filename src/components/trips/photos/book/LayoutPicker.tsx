'use client';

/**
 * LayoutPicker — grid of tiny layout previews. Click to switch the active
 * page to that layout.
 *
 * The mini previews render the layout's slot rectangles in greyscale so the
 * structure is visible at a glance without needing real photos.
 */

import { memo } from 'react';
import { LAYOUT_LIST, LAYOUTS } from '@/lib/photobook/layouts';
import type { LayoutDefinition, LayoutId } from '@/lib/photobook/types';

interface LayoutPickerProps {
  value: LayoutId;
  onChange: (id: LayoutId) => void;
  /** If true, includes the cover layout in the grid. Defaults to false. */
  includeCover?: boolean;
}

interface MiniProps {
  layout: LayoutDefinition;
  active: boolean;
}

function MiniLayout({ layout, active }: MiniProps) {
  // 52×76 thumbnail. The shape doesn't depend on the page size since this
  // is about layout *structure*, not aspect ratio.
  const W = 52;
  const H = 76;
  return (
    <div
      style={{
        position: 'relative',
        width: W,
        height: H,
        background: active ? '#fef3c7' : '#1c1c20',
        border: `1px solid ${active ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {layout.slots.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x * W,
            top: s.y * H,
            width: s.w * W,
            height: s.h * H,
            background: active ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255,255,255,0.55)',
            borderRadius: layout.id === 'polaroid-grid' ? 1 : 0,
            transform: layout.id === 'polaroid-grid'
              ? `rotate(${(i % 2 === 0 ? -1 : 1) * 5}deg)`
              : undefined,
          }}
        />
      ))}
      {/* Hint lines for text zones */}
      {layout.textZones.map((z, i) => (
        <div
          key={`z-${i}`}
          style={{
            position: 'absolute',
            left: z.x * W + 2,
            top: z.y * H + (z.h * H) / 2,
            width: z.w * W - 4,
            height: 1,
            background: active ? '#92400e' : 'rgba(255,255,255,0.3)',
          }}
        />
      ))}
    </div>
  );
}

const MemoMini = memo(MiniLayout);

function LayoutPickerImpl({ value, onChange, includeCover = false }: LayoutPickerProps) {
  const list = includeCover ? [LAYOUTS.cover, ...LAYOUT_LIST] : LAYOUT_LIST;
  return (
    <div className="grid grid-cols-4 gap-2">
      {list.map((layout) => {
        const active = layout.id === value;
        return (
          <button
            key={layout.id}
            type="button"
            onClick={() => onChange(layout.id)}
            className={
              'flex flex-col items-center gap-1.5 p-1.5 rounded-lg border transition-colors ' +
              (active
                ? 'bg-amber-300/10 border-amber-300/50'
                : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]')
            }
            aria-pressed={active}
          >
            <MemoMini layout={layout} active={active} />
            <span
              className={
                'text-[10px] leading-tight text-center ' +
                (active ? 'text-amber-100' : 'text-white/65')
              }
            >
              {layout.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(LayoutPickerImpl);
