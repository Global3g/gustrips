'use client';

import { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, File as FileIcon, Loader2, Upload } from 'lucide-react';
import { DOCUMENT_CATEGORIES } from '@/config/constants';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { classNames } from '@/lib/utils/helpers';
import type { DocumentCategory } from '@/types';

interface DocumentUploadModalProps {
  open: boolean;
  file: File | null;
  defaultCategory?: DocumentCategory;
  onConfirm: (data: { name: string; category: DocumentCategory }) => Promise<void>;
  onCancel: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type === 'application/pdf') return FileText;
  if (type.startsWith('image/')) return ImageIcon;
  return FileIcon;
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.substring(0, dot) : filename;
}

export default function DocumentUploadModal({
  open,
  file,
  defaultCategory = 'other',
  onConfirm,
  onCancel,
}: DocumentUploadModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Initialize when modal opens with a new file
  useEffect(() => {
    if (open && file) {
      setName(stripExtension(file.name));
      setCategory(defaultCategory);
      setSubmitting(false);
    }
  }, [open, file, defaultCategory]);

  // Generate object URL for preview when file changes
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;

  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  const FileTypeIcon = getFileIcon(file.type);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onConfirm({ name: trimmed, category });
    } finally {
      setSubmitting(false);
    }
  };

  const titleSlot = (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#1d4ed8', boxShadow: '0 0 0 1px rgba(59,130,246,0.3)' }}
      >
        <Upload className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-gray-900 font-semibold text-base sm:text-lg leading-tight truncate">
          Subir documento
        </h3>
        <p className="text-[11px] text-gray-500 mt-0.5 truncate">
          {file.name} · {formatFileSize(file.size)}
        </p>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={submitting ? () => {} : onCancel} titleSlot={titleSlot} size="md">
      <div className="space-y-4">
        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          {isImage && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="w-full h-44 object-contain bg-gray-100" />
          ) : (
            <div className="h-32 flex flex-col items-center justify-center">
              <FileTypeIcon className="w-12 h-12 text-gray-400 mb-2" />
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                {isPdf ? 'PDF' : file.type.split('/')[1] || 'Archivo'}
              </span>
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
            Titulo del documento
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim() && !submitting) handleSubmit();
            }}
            autoFocus
            placeholder="Ej. Boleto vuelo MEX-MAD"
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 outline-none"
          />
        </div>

        {/* Category — chip grid */}
        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
            Categoria
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Object.entries(DOCUMENT_CATEGORIES).map(([key, cfg]) => {
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key as DocumentCategory)}
                  className={classNames(
                    'relative flex flex-col items-center gap-1 rounded-xl py-2.5 px-2 transition-all border',
                    active
                      ? 'border-transparent shadow-md scale-[1.02]'
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-600',
                  )}
                  style={
                    active
                      ? {
                          backgroundColor: `${cfg.color}1c`,
                          color: cfg.color,
                          boxShadow: `0 0 0 1.5px ${cfg.color}, 0 6px 14px -8px ${cfg.color}66`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mb-0.5"
                    style={{ backgroundColor: active ? cfg.color : '#d1d5db' }}
                  />
                  <span className="text-[10px] font-semibold leading-tight text-center">
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            icon={submitting ? Loader2 : Upload}
          >
            {submitting ? 'Subiendo...' : 'Subir documento'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
