'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { SlideshowPhoto } from '@/lib/slideshow/types';

interface PhotoSelectorProps {
  /** All photos available in the trip — the pool. */
  pool: SlideshowPhoto[];
  /** URLs the user currently has selected. Lookup is O(1) via Set. */
  selected: Set<string>;
  onToggle: (url: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

/**
 * Grid of trip photos with multi-select checkbox semantics.
 *
 * Performance note: this grid intentionally caps its height with
 * `max-h-[...] overflow-y-auto`. Inside, native `<img loading="lazy">`
 * means the browser only paints visible tiles even if the pool has 300+
 * items. That avoids react-window's complexity while staying fast.
 */
export default function PhotoSelector({
  pool,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: PhotoSelectorProps) {
  const counter = useMemo(
    () => `${selected.size} de ${pool.length} fotos seleccionadas`,
    [selected.size, pool.length],
  );

  if (pool.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 text-center text-white/55 text-sm">
        Este viaje todavía no tiene fotos.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider">
          Fotos del viaje
        </p>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-white/60 hover:text-white"
          >
            Seleccionar todas
          </button>
          <span className="text-white/20">·</span>
          <button
            type="button"
            onClick={onClear}
            className="text-white/60 hover:text-white"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div
        className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-[420px] overflow-y-auto pr-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {pool.map((p) => {
          const isSelected = selected.has(p.url);
          return (
            <button
              key={p.url}
              type="button"
              onClick={() => onToggle(p.url)}
              className={
                'relative aspect-square rounded-lg overflow-hidden border-2 transition-all ' +
                (isSelected
                  ? 'border-emerald-300 ring-2 ring-emerald-300/50 shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
                  : 'border-white/10 hover:border-white/30')
              }
              aria-pressed={isSelected}
              aria-label={isSelected ? 'Quitar foto' : 'Agregar foto'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                loading="lazy"
                decoding="async"
                className={
                  'w-full h-full object-cover ' +
                  (isSelected ? '' : 'opacity-85')
                }
              />
              {isSelected && (
                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center shadow-md">
                  <Check className="w-3 h-3 text-emerald-950" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-white/45 text-[10px] mt-3 text-center">{counter}</p>
    </div>
  );
}
