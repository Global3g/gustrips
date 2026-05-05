'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/context/ToastContext';
import DocumentUpload from '@/components/trips/DocumentUpload';
import { DOCUMENT_CATEGORIES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import type { DocumentCategory, TripAttachment } from '@/types';

/* ─── Filter tab config ─────────────────────────── */

const FILTER_TABS: { key: DocumentCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'flight', label: 'Vuelos' },
  { key: 'hotel', label: 'Hoteles' },
  { key: 'car_rental', label: 'Autos' },
  { key: 'restaurant', label: 'Restaurantes' },
  { key: 'activity', label: 'Tours' },
  { key: 'insurance', label: 'Seguros' },
  { key: 'passport', label: 'Pasaportes' },
  { key: 'visa', label: 'Visas' },
  { key: 'other', label: 'Otros' },
];

export default function DocumentsPage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    categoryCounts,
  } = useDocuments(tripId);
  const { events } = useEvents(tripId);
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState<DocumentCategory | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('other');

  /* ─── Events map for name lookup ─────────────── */

  const eventsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) {
      map.set(ev.id, ev.title);
    }
    return map;
  }, [events]);

  /* ─── Filtered + grouped documents ───────────── */

  const filteredDocuments = useMemo(() => {
    if (activeFilter === 'all') return documents;
    return documents.filter((d) => (d.category || 'other') === activeFilter);
  }, [documents, activeFilter]);

  const groupedDocuments = useMemo(() => {
    const groups: Record<string, TripAttachment[]> = {};
    for (const d of filteredDocuments) {
      const cat = d.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    }
    return groups;
  }, [filteredDocuments]);

  /* ─── Handlers ────────────────────────────────── */

  const handleUpload = async (file: File): Promise<string> => {
    try {
      const url = await uploadDocument(file, { category: selectedCategory });
      toast('Documento subido correctamente', 'success');
      return url;
    } catch (error) {
      console.error('Error al subir documento:', error);
      toast('Error al subir el documento', 'error');
      throw error;
    }
  };

  const handleDelete = async (docId: string, url: string) => {
    try {
      await deleteDocument(docId, url);
      toast('Documento eliminado', 'success');
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      toast('Error al eliminar el documento', 'error');
    }
  };

  /* ─── Render ──────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
        <p className="text-gray-400 text-sm">
          Sube boletos, reservaciones y documentos importantes
        </p>
      </div>

      {/* Info rapida */}
      {documents.length > 0 && (
        <div className="glass rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-gray-600 text-sm">
            {documents.length} {documents.length === 1 ? 'documento' : 'documentos'} subidos
          </span>
        </div>
      )}

      {/* Filter tabs */}
      {documents.length > 0 && (
        <div className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-none scroll-fade-right">
          <div className="flex items-center gap-1.5 min-w-max pb-2">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? documents.length
                  : categoryCounts[tab.key] || 0;
              const isActive = activeFilter === tab.key;
              const catConfig =
                tab.key !== 'all' ? DOCUMENT_CATEGORIES[tab.key] : null;

              if (tab.key !== 'all' && count === 0) return null;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={classNames(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-red-100 text-red-700 shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-700'
                  )}
                >
                  {catConfig && (
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: catConfig.color,
                      }}
                    />
                  )}
                  {tab.label}
                  <span
                    className={classNames(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      isActive
                        ? 'bg-red-200 text-red-700'
                        : 'bg-gray-200 text-gray-400'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload component */}
      <div className="mb-8">
        <DocumentUpload
          documents={[]}
          onUpload={handleUpload}
          onDelete={handleDelete}
          loading={false}
          category={selectedCategory}
          hideCategorySelector={false}
        />
      </div>

      {/* Documents grouped by category */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-blue-300 mx-auto mb-3" />
          <p className="text-gray-300 text-sm">Sube tus confirmaciones, boletos y documentos importantes</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([catKey, docs]) => {
            const catConfig = DOCUMENT_CATEGORIES[catKey as DocumentCategory];
            if (!catConfig) return null;

            return (
              <motion.div
                key={catKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Section header */}
                {activeFilter === 'all' && (
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: catConfig.color }}
                    />
                    <h3 className="text-gray-700 text-sm font-semibold">
                      {catConfig.label}
                    </h3>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-gray-300 text-xs">{docs.length}</span>
                  </div>
                )}

                {/* Documents grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docs.map((d) => {
                    const isImage = d.type.startsWith('image/');
                    const isPdf = d.type === 'application/pdf';
                    const eventName = d.eventId
                      ? eventsMap.get(d.eventId)
                      : null;

                    return (
                      <div
                        key={d.id}
                        className="glass rounded-xl p-3 flex items-center gap-3 group"
                      >
                        {/* Thumbnail / icon */}
                        <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={d.url}
                              alt={d.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText
                              className="w-6 h-6"
                              style={{ color: catConfig.color }}
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-700 text-sm font-medium truncate">
                            {d.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-gray-300 text-xs">
                              {formatFileSize(d.size)}
                            </span>
                            {eventName && (
                              <span className="text-gray-400 text-xs truncate">
                                {eventName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                          {(isImage || isPdf) && (
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-300 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                              aria-label="Ver"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Eliminar "${d.name}"?`
                                )
                              ) {
                                handleDelete(d.id, d.url);
                              }
                            }}
                            className="p-1.5 text-red-400/50 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                            aria-label="Eliminar"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
