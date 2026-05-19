'use client';

/**
 * PhotoFilterPicker — applies a filter to the photo in a SELECTED slot.
 *
 * Shows a small thumbnail preview for each filter so users can pick by
 * eye, not by name. If no photo is in the slot, the swatch falls back to
 * a flat colour bar (we still let the user pick — they may add the photo
 * afterwards).
 */

import { memo } from 'react';
import { FILTER_LIST, PHOTO_FILTERS } from '@/lib/photobook/filters';
import type { PhotoFilter } from '@/lib/photobook/types';

interface PhotoFilterPickerProps {
  /** Photo URL for the selected slot (null if empty). */
  photoUrl: string | null;
  value: PhotoFilter | null;
  onChange: (id: PhotoFilter | null) => void;
}

function PhotoFilterPickerImpl({ photoUrl, value, onChange }: PhotoFilterPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {FILTER_LIST.map((f) => {
        const active = (value ?? 'none') === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id === 'none' ? null : f.id)}
            aria-pressed={active}
            className={
              'group flex flex-col items-center gap-1 p-1 rounded-md border transition-colors ' +
              (active
                ? 'bg-amber-300/15 border-amber-300/60'
                : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]')
            }
            title={f.label}
          >
            <div
              className="w-full aspect-square rounded overflow-hidden border border-white/10"
              style={{
                background: photoUrl ? undefined : '#3b3b40',
              }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-cover"
                  style={{
                    filter: PHOTO_FILTERS[f.id].css || undefined,
                  }}
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background:
                      'linear-gradient(135deg, #6b7280 0%, #d1d5db 50%, #f9fafb 100%)',
                    filter: PHOTO_FILTERS[f.id].css || undefined,
                  }}
                />
              )}
            </div>
            <span
              className={
                'text-[9px] leading-tight text-center ' +
                (active ? 'text-amber-100' : 'text-white/65')
              }
            >
              {f.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(PhotoFilterPickerImpl);
