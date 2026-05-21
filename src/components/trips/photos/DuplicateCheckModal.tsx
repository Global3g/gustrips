'use client';

/**
 * DuplicateCheckModal — shown when the user picks files that fingerprint
 * the same as photos already in the album.
 *
 * Three exit paths:
 *   - Cancelar         — abort the whole pick
 *   - Subir solo nuevas — drop duplicates from the queue
 *   - Subir todas      — let duplicates through (override; user knows best)
 */

import Image from 'next/image';
import { AlertTriangle, X } from 'lucide-react';
import type { AlbumPhoto } from '@/types';

export interface DuplicateMatch {
  /** File the user just picked. */
  file: File;
  /** Photo already in the album that has the same contentHash. */
  existing: AlbumPhoto;
}

interface DuplicateCheckModalProps {
  open: boolean;
  duplicates: DuplicateMatch[];
  /** How many files in total the user picked (incl. non-duplicates). */
  totalPicked: number;
  onCancel: () => void;
  onUploadUniqueOnly: () => void;
  onUploadAll: () => void;
}

export default function DuplicateCheckModal({
  open,
  duplicates,
  totalPicked,
  onCancel,
  onUploadUniqueOnly,
  onUploadAll,
}: DuplicateCheckModalProps) {
  if (!open) return null;

  const dupCount = duplicates.length;
  const newCount = totalPicked - dupCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-gray-900 text-base font-semibold">
              {dupCount === 1
                ? 'Esta foto ya está en el álbum'
                : `${dupCount} fotos ya están en el álbum`}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {newCount === 0
                ? 'Todas las fotos que elegiste son duplicadas.'
                : `${newCount} son nuevas y ${dupCount} ya las tienes.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Duplicate list */}
        <div className="max-h-72 overflow-y-auto px-5 py-4">
          <ul className="space-y-2">
            {duplicates.slice(0, 8).map((d, i) => (
              <li key={`${d.existing.url}-${i}`} className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <Image
                    src={d.existing.url}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate font-medium">
                    {d.file.name || 'foto sin nombre'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {d.existing.caption || d.existing.date || 'ya en tu álbum'}
                  </p>
                </div>
              </li>
            ))}
            {duplicates.length > 8 && (
              <li className="text-xs text-gray-400 px-1 pt-1">
                …y {duplicates.length - 8} más.
              </li>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium transition-colors order-3 sm:order-1"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onUploadAll}
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-100 text-sm font-medium transition-colors order-2"
          >
            Subir todas igual
          </button>
          {newCount > 0 && (
            <button
              type="button"
              onClick={onUploadUniqueOnly}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors order-1 sm:order-3"
            >
              Subir solo las {newCount === 1 ? 'nueva' : `${newCount} nuevas`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
