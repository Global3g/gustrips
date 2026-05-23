'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plane,
  Hotel,
  CarFront,
  UtensilsCrossed,
  MapPin,
  Car,
  Ship,
  Shield,
  BookOpen,
  Stamp,
  MoreHorizontal,
  Eye,
  Trash2,
  X,
  Search,
} from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
// Events come from the layout-level TripDataProvider — calling
// `useEvents(tripId)` here would open a second onSnapshot subscription.
import { useEventsFromContext as useEvents } from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import DocumentUpload from '@/components/trips/DocumentUpload';
import BiometricGate from '@/components/BiometricGate';
import Particles from '@/components/ui/Particles';
import { DOCUMENT_CATEGORIES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import { EmptyState } from '@/components/EmptyState';
import type { DocumentCategory, TripAttachment } from '@/types';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<DocumentCategory, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: CarFront,
  restaurant: UtensilsCrossed,
  activity: MapPin,
  transport: Car,
  cruise: Ship,
  insurance: Shield,
  passport: BookOpen,
  visa: Stamp,
  other: MoreHorizontal,
};

const FILTER_TABS: { key: DocumentCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'flight', label: 'Vuelos' },
  { key: 'hotel', label: 'Hoteles' },
  { key: 'car_rental', label: 'Autos' },
  { key: 'restaurant', label: 'Restaurantes' },
  { key: 'activity', label: 'Tours' },
  { key: 'transport', label: 'Transporte' },
  { key: 'cruise', label: 'Crucero' },
  { key: 'insurance', label: 'Seguros' },
  { key: 'passport', label: 'Pasaportes' },
  { key: 'visa', label: 'Visas' },
  { key: 'other', label: 'Otros' },
];

/**
 * Wrap the documents view in a biometric gate. The gate's check is fast
 * (WebAuthn assertion via Face ID / Touch ID / Windows Hello) and stays
 * unlocked for the rest of the session — but the user opts in. If they
 * never enable it, the gate is transparent.
 */
export default function DocumentsPage() {
  return (
    <BiometricGate sectionLabel="Documentos del viaje">
      <DocumentsPageContent />
    </BiometricGate>
  );
}

function DocumentsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params.tripId as string;

  const {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    categoryCounts,
  } = useDocuments(tripId);
  const { events } = useEvents();
  const { toast } = useToast();

  // Sidebar reservation pills pass ?type=flight etc — initialize filter from URL
  const initialType = (searchParams.get('type') || 'all') as DocumentCategory | 'all';
  const [activeFilter, setActiveFilter] = useState<DocumentCategory | 'all'>(initialType);
  const [selectedCategory] = useState<DocumentCategory>('other');
  const [search, setSearch] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get('type');
    if (t && Object.keys(DOCUMENT_CATEGORIES).includes(t)) {
      setActiveFilter(t as DocumentCategory);
    }
  }, [searchParams]);

  const eventsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) map.set(ev.id, ev.title);
    return map;
  }, [events]);

  const filteredDocuments = useMemo(() => {
    let out = activeFilter === 'all' ? documents : documents.filter((d) => (d.category || 'other') === activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((d) => d.name.toLowerCase().includes(q));
    }
    return out;
  }, [documents, activeFilter, search]);

  const groupedDocuments = useMemo(() => {
    const groups: Record<string, TripAttachment[]> = {};
    for (const d of filteredDocuments) {
      const cat = d.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    }
    return groups;
  }, [filteredDocuments]);

  const totalSize = useMemo(() => documents.reduce((sum, d) => sum + (d.size || 0), 0), [documents]);
  const categoriesUsed = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) set.add(d.category || 'other');
    return set.size;
  }, [documents]);

  const handleUpload = async (
    file: File,
    options?: { name?: string; category?: DocumentCategory },
  ): Promise<string> => {
    try {
      const url = await uploadDocument(file, {
        category: options?.category ?? selectedCategory,
        name: options?.name,
      });
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
      setConfirmingDelete(null);
      toast('Documento eliminado', 'success');
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      toast('Error al eliminar el documento', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30"
      style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
    >
      {/* Visual layer */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        <Particles count={28} />
        <div
          className="absolute -top-12 left-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.20), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)' }}
        />
        <div
          className="absolute bottom-12 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* ─── Hero ─── */}
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-violet-300/30"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.06))',
              boxShadow: '0 0 20px rgba(139,92,246,0.2)',
            }}
          >
            <FileText className="w-6 h-6 text-violet-200" />
          </div>
          <div>
            <h1
              className="text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #d6c5ff 60%, #c4b5fd 100%)' }}
            >
              Reservas y documentos
            </h1>
            <p className="text-white/55 text-[12px] mt-0.5">
              Boletos, reservaciones y documentos importantes del viaje
            </p>
          </div>
        </div>

        {/* ─── Stats ─── */}
        {documents.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3">
              <div className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1">Total</div>
              <div className="text-white text-xl font-black tabular-nums">{documents.length}</div>
              <div className="text-white/40 text-[10px] mt-0.5">documento{documents.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3">
              <div className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1">Categorías</div>
              <div className="text-white text-xl font-black tabular-nums">{categoriesUsed}</div>
              <div className="text-white/40 text-[10px] mt-0.5">en uso</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3">
              <div className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1">Espacio</div>
              <div className="text-white text-xl font-black tabular-nums">{formatFileSize(totalSize)}</div>
              <div className="text-white/40 text-[10px] mt-0.5">subidos</div>
            </div>
          </div>
        )}

        {/* ─── Search ─── */}
        {documents.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documento…"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder:text-white/35 outline-none focus:border-violet-300/60 focus:bg-white/[0.08] backdrop-blur-sm transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* ─── Filter chips ─── */}
        {documents.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {FILTER_TABS.map((tab) => {
              const count = tab.key === 'all' ? documents.length : categoryCounts[tab.key] || 0;
              const isActive = activeFilter === tab.key;
              const catConfig = tab.key !== 'all' ? DOCUMENT_CATEGORIES[tab.key] : null;
              if (tab.key !== 'all' && count === 0) return null;
              const Icon = tab.key !== 'all' ? CATEGORY_ICONS[tab.key as DocumentCategory] : null;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={classNames(
                    'flex-shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium transition-all border whitespace-nowrap',
                    isActive
                      ? 'border-white/30 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/55 hover:text-white/85 hover:border-white/20',
                  )}
                  style={
                    isActive && catConfig
                      ? { background: `${catConfig.color}22`, boxShadow: `0 0 14px ${catConfig.color}44` }
                      : isActive
                      ? { background: 'rgba(255,255,255,0.08)' }
                      : undefined
                  }
                >
                  {Icon && catConfig ? (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${catConfig.color}33` }}
                    >
                      <Icon className="w-3 h-3" style={{ color: catConfig.color }} />
                    </span>
                  ) : (
                    <span className="w-1 h-1 ml-1" />
                  )}
                  {tab.label}
                  <span
                    className={classNames(
                      'text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular-nums',
                      isActive ? 'bg-white/15 text-white' : 'bg-white/[0.06] text-white/55',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Upload (delegates to existing component) ─── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
          <div className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-3">Subir documento</div>
          <DocumentUpload
            documents={[]}
            onUpload={handleUpload}
            onDelete={handleDelete}
            loading={false}
            category={selectedCategory}
            hideCategorySelector={false}
          />
        </div>

        {/* ─── List ─── */}
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3 flex items-center gap-3 animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 bg-white/[0.06] rounded" />
                    <div className="h-2 w-1/3 bg-white/[0.04] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm">
            <EmptyState
              variant="documents"
              title={documents.length === 0 ? 'Sin documentos aún' : 'Nada coincide con los filtros'}
              description={
                documents.length === 0
                  ? 'Sube boletos, reservaciones y documentos importantes para tenerlos a la mano'
                  : 'Prueba con otros filtros o limpia la búsqueda'
              }
            />
          </div>
        ) : (
          <div className="space-y-5">
            <AnimatePresence initial={false} mode="popLayout">
              {Object.entries(groupedDocuments).map(([catKey, docs]) => {
                const catConfig = DOCUMENT_CATEGORIES[catKey as DocumentCategory];
                if (!catConfig) return null;
                const Icon = CATEGORY_ICONS[catKey as DocumentCategory] || MoreHorizontal;

                return (
                  <motion.div
                    key={catKey}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* Section header */}
                    {activeFilter === 'all' && (
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: `${catConfig.color}22`,
                            boxShadow: `0 0 12px ${catConfig.color}33`,
                          }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: catConfig.color }} />
                        </span>
                        <h3 className="text-white text-sm font-bold">{catConfig.label}</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                        <span className="text-white/40 text-[11px] tabular-nums">{docs.length}</span>
                      </div>
                    )}

                    {/* Documents grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {docs.map((d) => {
                        const isImage = d.type.startsWith('image/');
                        const isPdf = d.type === 'application/pdf';
                        const eventName = d.eventId ? eventsMap.get(d.eventId) : null;
                        const isConfirming = confirmingDelete === d.id;

                        return (
                          <motion.div
                            key={d.id}
                            layout
                            whileHover={{ y: -1 }}
                            transition={{ duration: 0.2 }}
                            className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3 flex items-center gap-3 group hover:border-white/20 hover:bg-white/[0.06] transition-all"
                          >
                            {/* Thumbnail / icon */}
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10"
                              style={{ background: isImage ? 'transparent' : `${catConfig.color}18` }}
                            >
                              {isImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={d.url} alt={d.name} className="w-full h-full object-cover" />
                              ) : (
                                <Icon className="w-5 h-5" style={{ color: catConfig.color }} />
                              )}
                            </a>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{d.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                                <span className="text-white/40 tabular-nums">{formatFileSize(d.size)}</span>
                                {eventName && (
                                  <>
                                    <span className="text-white/20">·</span>
                                    <span className="text-white/55 truncate">{eventName}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            {isConfirming ? (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-white/55 text-[11px] mr-1">¿Borrar?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(d.id, d.url)}
                                  className="px-2 py-1 text-[11px] font-bold rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingDelete(null)}
                                  className="px-2 py-1 text-[11px] font-bold rounded-md bg-white/10 text-white/70 hover:bg-white/15 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                {(isImage || isPdf) && (
                                  <a
                                    href={d.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-all"
                                    aria-label="Ver"
                                    title="Ver"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setConfirmingDelete(d.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-red-300 hover:bg-red-400/10 transition-all"
                                  aria-label="Eliminar"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
