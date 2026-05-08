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
  Eye,
  ChevronDown,
} from 'lucide-react';
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES, DOCUMENT_CATEGORIES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import DocumentUploadModal from '@/components/trips/DocumentUploadModal';
import type { TripAttachment, DocumentCategory } from '@/types';

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
  /** Receives the file plus optional metadata overrides (name, category) when set via modal. */
  onUpload: (file: File, options?: { name?: string; category?: DocumentCategory }) => Promise<string>;
  onDelete: (docId: string, url: string) => Promise<void>;
  loading?: boolean;
  /** Pre-set eventId for all uploads from this instance */
  eventId?: string;
  /** Pre-set category for all uploads from this instance */
  category?: DocumentCategory;
  /** Hide category selector (when pre-set from event) */
  hideCategorySelector?: boolean;
  /** Compact mode for inline use inside EventCard */
  compact?: boolean;
}

/* ─── Componente ────────────────────────────────── */

export default function DocumentUpload({
  documents,
  onUpload,
  onDelete,
  loading,
  eventId,
  category: presetCategory,
  hideCategorySelector = false,
  compact = false,
}: DocumentUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>(presetCategory || 'other');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const useModal = !compact && !hideCategorySelector;

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return `Tipo de archivo no permitido. Acepta: JPG, PNG, WebP, PDF`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `El archivo excede el limite de ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  };

  const performUpload = useCallback(
    async (file: File, options?: { name?: string; category?: DocumentCategory }) => {
      setError('');
      setUploading(true);
      setUploadProgress(0);

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
        await onUpload(file, options);
        setUploadProgress(100);
      } catch (err) {
        console.error('Error al subir archivo:', err);
        setError('Error al subir el archivo. Intenta de nuevo.');
        throw err;
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

  const handleUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      // In modal mode, open the modal to ask for name + category before uploading.
      if (useModal) {
        setPendingFile(file);
        return;
      }

      // Compact / pre-configured mode: upload directly.
      try {
        await performUpload(file);
      } catch {
        /* error already set */
      }
    },
    [useModal, performUpload]
  );

  const handleModalConfirm = useCallback(
    async ({ name, category }: { name: string; category: DocumentCategory }) => {
      if (!pendingFile) return;
      try {
        await performUpload(pendingFile, { name, category });
        setPendingFile(null);
      } catch {
        /* keep modal open so the user can retry */
      }
    },
    [pendingFile, performUpload]
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const categoryConfig = selectedCategory ? DOCUMENT_CATEGORIES[selectedCategory] : null;

  return (
    <div className={classNames('space-y-4', compact ? 'space-y-3' : 'space-y-6')}>
      {/* Category selector */}
      {!hideCategorySelector && (
        <div className="relative">
          <label className="text-gray-400 text-xs mb-1.5 block">Categoria del documento</label>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
              className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm pr-10 focus:outline-none focus:border-gray-400 transition-colors"
            >
              {Object.entries(DOCUMENT_CATEGORIES).map(([key, val]) => (
                <option key={key} value={key} className="bg-white text-gray-900">
                  {val.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
          </div>
          {categoryConfig && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: categoryConfig.color }}
              />
              <span className="text-gray-300 text-xs">{categoryConfig.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Zona de arrastrar y soltar */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={classNames(
          'relative border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-200',
          compact ? 'p-4' : 'p-8',
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <div
            className={classNames(
              'rounded-2xl flex items-center justify-center transition-colors',
              compact ? 'w-10 h-10' : 'w-14 h-14',
              dragging ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'
            )}
          >
            <CloudUpload className={compact ? 'w-5 h-5' : 'w-7 h-7'} />
          </div>
          <div>
            <p className={classNames('text-gray-700 font-medium', compact ? 'text-xs' : 'text-sm')}>
              {dragging ? 'Suelta el archivo aqui' : compact ? 'Arrastra o haz clic' : 'Arrastra un archivo o haz clic para seleccionar'}
            </p>
            <p className="text-gray-300 text-xs mt-0.5">
              JPG, PNG, WebP, PDF - Max {formatFileSize(MAX_FILE_SIZE)}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <AnimatePresence>
          {uploading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-4 bottom-3"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-blue-600 animate-pulse" />
                <div className="flex-1 h-2 bg-gray-50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-gray-500 text-xs">{uploadProgress}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <X className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-600 text-sm flex-1">{error}</p>
          <button onClick={() => setError('')} aria-label="Cerrar error" className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid de documentos */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        !compact && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-300 text-sm">No hay documentos subidos</p>
          </div>
        )
      ) : (
        <div className={classNames('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
          {documents.map((doc) => {
            const DocIcon = getFileIcon(doc.type);
            const isImage = isImageType(doc.type);
            const isPdf = doc.type === 'application/pdf';
            const catConfig = doc.category ? DOCUMENT_CATEGORIES[doc.category] : null;

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
                {!compact && (
                  <div className="relative aspect-square bg-gray-50 flex items-center justify-center">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={doc.url}
                        alt={doc.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <DocIcon className="w-12 h-12 text-gray-200" />
                    )}

                    {/* Overlay con acciones */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {isImage && (
                        <button
                          onClick={() => setLightboxUrl(doc.url)}
                          className="p-2 bg-white/80 rounded-full text-gray-700 hover:bg-white transition-colors"
                          aria-label="Ver imagen"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {isPdf && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 bg-white/80 rounded-full text-gray-700 hover:bg-white transition-colors"
                          aria-label="Ver PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`Eliminar "${doc.name}"?`)) {
                            onDelete(doc.id, doc.url);
                          }
                        }}
                        aria-label={`Eliminar documento ${doc.name}`}
                        className="p-2 bg-red-500/80 rounded-full text-white hover:bg-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Category badge (top-right corner) */}
                    {catConfig && (
                      <div
                        className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${catConfig.color}25`,
                          color: catConfig.color,
                        }}
                      >
                        {catConfig.label}
                      </div>
                    )}
                  </div>
                )}

                {/* Info del archivo */}
                <div className={classNames('px-3 py-2', compact && 'flex items-center gap-2')}>
                  {compact && (
                    <DocIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-xs font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 text-xs">{formatFileSize(doc.size)}</span>
                      {compact && catConfig && (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${catConfig.color}25`,
                            color: catConfig.color,
                          }}
                        >
                          {catConfig.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {compact && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(isImage || isPdf) && (
                        isImage ? (
                          <button
                            onClick={() => setLightboxUrl(doc.url)}
                            className="p-1 text-gray-300 hover:text-gray-700 transition-colors"
                            aria-label="Ver"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-300 hover:text-gray-700 transition-colors"
                            aria-label="Ver PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        )
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`Eliminar "${doc.name}"?`)) {
                            onDelete(doc.id, doc.url);
                          }
                        }}
                        className="p-1 text-red-400 hover:text-red-600 transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Lightbox modal for images */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-6 h-6" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt="Vista previa"
                className="w-full h-full object-contain rounded-xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload metadata modal — asks for name + category before uploading */}
      <DocumentUploadModal
        open={!!pendingFile}
        file={pendingFile}
        defaultCategory={selectedCategory}
        onConfirm={handleModalConfirm}
        onCancel={() => setPendingFile(null)}
      />
    </div>
  );
}
