'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Loader2, Camera } from 'lucide-react';

interface PhotoGalleryProps {
  photos: string[];
  onAddPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (url: string) => Promise<void>;
}

export default function PhotoGallery({ photos, onAddPhoto, onDeletePhoto }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        await onAddPhoto(file);
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onAddPhoto],
  );

  const handleDelete = useCallback(
    async (url: string) => {
      setDeleting(url);
      try {
        await onDeletePhoto(url);
        if (lightboxIndex !== null) {
          const newLength = photos.length - 1;
          if (newLength <= 0) {
            setLightboxIndex(null);
          } else if (lightboxIndex >= newLength) {
            setLightboxIndex(newLength - 1);
          }
        }
      } finally {
        setDeleting(null);
      }
    },
    [onDeletePhoto, lightboxIndex, photos.length],
  );

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxIndex(null);

  const goNext = () => {
    if (lightboxIndex !== null && lightboxIndex < photos.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const goPrev = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {photos.map((url, idx) => (
          <div
            key={url}
            className="relative flex-shrink-0 group/photo cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              openLightbox(idx);
            }}
          >
            <img
              src={url}
              alt={`Foto ${idx + 1}`}
              className="w-20 h-20 rounded-lg object-cover border border-gray-200 hover:border-blue-300 transition-colors"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(url);
              }}
              disabled={deleting === url}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
              aria-label="Eliminar foto"
            >
              {deleting === url ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </button>
          </div>
        ))}

        {/* Add photo button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 flex flex-col items-center justify-center gap-1 text-gray-300 hover:text-blue-400 transition-colors"
          aria-label="Agregar foto"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span className="text-[9px] font-medium">Foto</span>
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && photos[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
          >
            <motion.img
              key={photos[lightboxIndex]}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              src={photos[lightboxIndex]}
              alt={`Foto ${lightboxIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Close */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Delete in lightbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(photos[lightboxIndex]);
              }}
              disabled={deleting !== null}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-red-500/60 hover:bg-red-500/80 flex items-center justify-center text-white transition-colors"
              aria-label="Eliminar foto"
            >
              {deleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </button>

            {/* Navigation arrows */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {lightboxIndex < photos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium">
              {lightboxIndex + 1} / {photos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
