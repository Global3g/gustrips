'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Image,
  Trash2,
  X,
  CloudUpload,
  File as FileIcon,
} from 'lucide-react';
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import type { TripAttachment } from '@/types';

/* ─── Helpers ───────────────────────────────────── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type === 'application/pdf') return FileText;
  if (type.startsWith('image/')) return Image;
  return FileIcon;
}

function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

/* ─── Props ─────────────────────────────────────── */

interface DocumentUploadProps {
  documents: TripAttachment[];
  onUpload: (file: File) => Promise<string>;
  onDelete: (docId: string, url: string) => Promise<void>;
  loading?: boolean;
}

/* ─── Componente ────────────────────────────────── */

export default function DocumentUpload({
  documents,
  onUpload,
  onDelete,
  loading,
}: DocumentUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return `Tipo de archivo no permitido. Acepta: JPG, PNG, WebP, PDF`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `El archivo excede el limite de ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  };

  const handleUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError('');
      setUploading(true);
      setUploadProgress(0);

      // Simular progreso visual
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      try {
        await onUpload(file);
        setUploadProgress(100);
      } catch (err) {
        console.error('Error al subir archivo:', err);
        setError('Error al subir el archivo. Intenta de nuevo.');
      } finally {
        clearInterval(interval);
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      }
    },
    [onUpload]
  );

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input para permitir subir el mismo archivo
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Zona de arrastrar y soltar */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={classNames(
          'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200',
          dragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-white/20 hover:border-white/40 hover:bg-white/5'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={classNames(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
              dragging ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/40'
            )}
          >
            <CloudUpload className="w-7 h-7" />
          </div>
          <div>
            <p className="text-white/70 text-sm font-medium">
              {dragging ? 'Suelta el archivo aqui' : 'Arrastra un archivo o haz clic para seleccionar'}
            </p>
            <p className="text-white/30 text-xs mt-1">
              JPG, PNG, WebP, PDF - Max {formatFileSize(MAX_FILE_SIZE)}
            </p>
          </div>
        </div>

        {/* Barra de progreso de subida */}
        <AnimatePresence>
          {uploading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-4 bottom-4"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-blue-400 animate-pulse" />
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-white/50 text-xs">{uploadProgress}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3">
          <X className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid de documentos */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-white/15 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No hay documentos subidos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {documents.map((doc) => {
            const DocIcon = getFileIcon(doc.type);
            const isImage = isImageType(doc.type);

            return (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass rounded-xl overflow-hidden group"
              >
                {/* Vista previa / Icono */}
                <div className="relative aspect-square bg-white/5 flex items-center justify-center">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.url}
                      alt={doc.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <DocIcon className="w-12 h-12 text-white/20" />
                  )}

                  {/* Overlay con boton eliminar */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => onDelete(doc.id, doc.url)}
                      className="p-2 bg-red-500/80 rounded-full text-white hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Info del archivo */}
                <div className="px-3 py-2">
                  <p className="text-white/80 text-xs font-medium truncate">{doc.name}</p>
                  <p className="text-white/30 text-xs">{formatFileSize(doc.size)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
