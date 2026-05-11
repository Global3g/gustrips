'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, UploadCloud, X } from 'lucide-react';

interface PhotoSelectorProps {
  onSelect: (files: File[]) => void;
  disabled?: boolean;
  minPhotos?: number;
  maxPhotos?: number;
}

/**
 * File picker + drag-drop surface for picking photos to feed into a story.
 * Stub: it surfaces selected files via `onSelect`. Real upload (Storage,
 * EXIF, pHash) is handled downstream.
 */
export default function PhotoSelector({
  onSelect,
  disabled = false,
  minPhotos = 10,
  maxPhotos = 500,
}: PhotoSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [picked, setPicked] = useState<File[]>([]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      const next = [...picked, ...arr].slice(0, maxPhotos);
      setPicked(next);
      onSelect(next);
    },
    [picked, maxPhotos, onSelect],
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files.length === 0) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    handleFiles(e.target.files);
    // Reset so the same file can be re-picked.
    e.target.value = '';
  };

  const removeOne = (idx: number) => {
    const next = picked.filter((_, i) => i !== idx);
    setPicked(next);
    onSelect(next);
  };

  return (
    <div className="space-y-3">
      <motion.div
        whileHover={disabled ? undefined : { scale: 1.005 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative rounded-3xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200 ${
          disabled
            ? 'border-white/10 bg-white/[0.02] cursor-not-allowed opacity-60'
            : isDragging
              ? 'border-amber-400/60 bg-amber-500/10'
              : 'border-white/15 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 flex items-center justify-center">
            <UploadCloud className="w-7 h-7 text-amber-200" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              Arrastrá tus fotos o tocá para elegir
            </p>
            <p className="text-sm text-white/60 mt-1">
              Subí al menos {minPhotos} fotos del viaje. Cuantas más, mejor.
            </p>
          </div>
        </div>
      </motion.div>

      {picked.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              {picked.length} {picked.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Agregar más
            </button>
          </div>
          <ul className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {picked.slice(0, 24).map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="group inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-white/85"
              >
                <span className="truncate max-w-[140px]">{f.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeOne(i);
                  }}
                  className="opacity-60 hover:opacity-100 hover:text-rose-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
            {picked.length > 24 && (
              <li className="text-xs text-white/50 self-center">
                + {picked.length - 24} más
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
