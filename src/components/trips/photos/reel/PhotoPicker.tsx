'use client';

/**
 * PhotoPicker — clickable thumbnail grid used by the reel builder.
 *
 * Mirrors the manual-mode selector in the collage builder: every
 * available photo shows up as a tile, clicking toggles selection,
 * and selection is capped at `maxPhotos`. Selected tiles get a number
 * badge in their click order so the user can preview the eventual
 * timeline sequence at a glance.
 */

import { useCallback } from 'react';
import { Check } from 'lucide-react';
import type { AlbumPhoto } from '@/types';
import { classNames } from '@/lib/utils/helpers';

interface PhotoPickerProps {
  /** Full pool of candidate photos. */
  pool: AlbumPhoto[];
  /** URLs currently selected, in user-chosen order. */
  selected: string[];
  /** Toggle handler — receives the photo URL. */
  onToggle: (url: string) => void;
  /** Hard cap on selections. Tiles beyond the cap render disabled. */
  maxPhotos: number;
}

export default function PhotoPicker({
  pool,
  selected,
  onToggle,
  maxPhotos,
}: PhotoPickerProps) {
  const isSelected = useCallback(
    (url: string) => selected.includes(url),
    [selected],
  );
  const orderOf = useCallback(
    (url: string) => {
      const idx = selected.indexOf(url);
      return idx === -1 ? null : idx + 1;
    },
    [selected],
  );

  if (pool.length === 0) {
    return (
      <p className="text-white/55 text-sm py-6 text-center">
        No hay fotos en este viaje todavía.
      </p>
    );
  }

  const atCap = selected.length >= maxPhotos;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-white/70 text-xs font-medium">
          {selected.length} / {maxPhotos} fotos seleccionadas
        </p>
        <p className="text-white/45 text-[11px]">
          Click para agregar o quitar
        </p>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        {pool.map((photo) => {
          const sel = isSelected(photo.url);
          const order = orderOf(photo.url);
          const disabled = atCap && !sel;
          return (
            <button
              key={photo.url}
              type="button"
              onClick={() => onToggle(photo.url)}
              disabled={disabled}
              className={classNames(
                'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                sel
                  ? 'border-amber-300 ring-2 ring-amber-300/40 shadow-lg scale-[0.96]'
                  : 'border-white/10 hover:border-white/30',
                disabled && 'opacity-30 cursor-not-allowed',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || ''}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {sel && order !== null && (
                <div className="absolute top-1 left-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-300 flex items-center justify-center shadow-md">
                  <span className="text-[11px] font-black text-amber-950">{order}</span>
                </div>
              )}
              {sel && (
                <div className="absolute top-1 right-1 w-[22px] h-[22px] rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-[10px] text-white/95 truncate font-medium">
                    {photo.caption}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
