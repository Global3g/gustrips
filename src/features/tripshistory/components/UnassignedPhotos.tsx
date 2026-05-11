'use client';

import { motion } from 'framer-motion';
import { ImageOff } from 'lucide-react';

interface UnassignedPhotosProps {
  count: number;
  /** Optional thumbnails to preview a few of the unassigned photos. */
  previewThumbnails?: string[];
  onReview?: () => void;
}

/**
 * Card that surfaces photos the engine couldn't slot into a day/event.
 * They become the seed for follow-up questions or manual assignment.
 */
export default function UnassignedPhotos({
  count,
  previewThumbnails = [],
  onReview,
}: UnassignedPhotosProps) {
  if (count <= 0) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
          <ImageOff className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Fotos sin ubicar
          </p>
          <p className="text-lg font-bold text-white">
            {count} {count === 1 ? 'foto' : 'fotos'} sin día asignado
          </p>
        </div>
      </div>

      {previewThumbnails.length > 0 && (
        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {previewThumbnails.slice(0, 12).map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.06] bg-white/[0.03]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-white/70">
        El motor no encontró suficiente contexto para acomodarlas. Respondé las
        preguntas pendientes o asignalas manualmente.
      </p>

      {onReview && (
        <button
          type="button"
          onClick={onReview}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-sm font-semibold text-amber-100 transition-colors"
        >
          Revisar fotos
        </button>
      )}
    </motion.aside>
  );
}
