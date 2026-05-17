'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Shuffle, Sparkles, X, ImageIcon, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import EditorialTemplate from './EditorialTemplate';
import PolaroidWallTemplate from './PolaroidWallTemplate';
import ScrapbookTemplate from './ScrapbookTemplate';
import PostcardTemplate from './PostcardTemplate';
import { useToast } from '@/context/ToastContext';
import type { AlbumPhoto, Trip } from '@/types';

type TemplateId = 'editorial' | 'polaroid' | 'scrapbook' | 'postcard';

interface Props {
  open: boolean;
  onClose: () => void;
  photos: AlbumPhoto[];
  trip: Trip | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function slugify(s: string): string {
  return (s || 'viaje')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}

function formatDateRange(trip: Trip | null): string | undefined {
  if (!trip?.startDate) return undefined;
  try {
    const start = new Date(trip.startDate);
    const end = trip.endDate ? new Date(trip.endDate) : null;
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const startStr = start.toLocaleDateString('es', opts);
    if (!end) return startStr;
    return `${start.toLocaleDateString('es', { day: 'numeric', month: 'long' })} — ${end.toLocaleDateString('es', opts)}`;
  } catch {
    return undefined;
  }
}

export default function CollageBuilder({ open, onClose, photos, trip }: Props) {
  const [template, setTemplate] = useState<TemplateId>('editorial');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  // Resize observer: keep the on-screen preview scaled to the modal width
  // while the off-screen export stays a clean 1080×1080.
  useEffect(() => {
    if (!open) return;
    const node = wrapperRef.current;
    if (!node) return;
    const update = () => {
      const w = node.clientWidth;
      if (w > 0) setPreviewScale(w / 1080);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [open]);

  // Pick a deterministic-per-seed sample of up to 8 photos, biasing toward
  // ones with captions (= the user cared about them).
  const sample = useMemo(() => {
    if (photos.length === 0) return [] as AlbumPhoto[];
    const withCaption = photos.filter((p) => !!p.caption?.trim());
    const others = photos.filter((p) => !p.caption?.trim());
    // void the seed dep so eslint sees it as used
    void shuffleSeed;
    const ranked = [...shuffle(withCaption), ...shuffle(others)];
    return ranked.slice(0, 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, shuffleSeed]);

  const dateRange = useMemo(() => formatDateRange(trip), [trip]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDownload = async () => {
    if (!stageRef.current) return;
    setDownloading(true);
    try {
      // Wait for any pending Google Fonts to finish loading. Without this
      // the first export sometimes renders titles in the fallback system
      // font.
      try {
        if (typeof document !== 'undefined' && 'fonts' in document) {
          await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
        }
      } catch {
        /* ignore — non-blocking */
      }
      const dataUrl = await toPng(stageRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#0a1628',
      });
      const link = document.createElement('a');
      const slug = slugify(trip?.title || 'viaje');
      link.download = `gustrips-${slug}-${template}.png`;
      link.href = dataUrl;
      link.click();
      toast('Collage descargado', 'success');
    } catch (err) {
      console.error('Collage export failed:', err);
      toast('No pudimos exportar el collage. Reintentá.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative w-full max-w-3xl bg-[#0d1b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <ImageIcon className="w-5 h-5 text-amber-300" />
                <h2 className="text-base font-bold">Crear collage</h2>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template selector — horizontal scroll on mobile if many */}
            <div className="px-5 pt-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              {([
                ['editorial', 'Editorial'],
                ['polaroid', 'Polaroid Wall'],
                ['scrapbook', 'Scrapbook'],
                ['postcard', 'Postal'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTemplate(id)}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    template === id
                      ? 'bg-amber-400/15 border-amber-300/60 text-amber-100'
                      : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Preview — render the template at native 1080×1080 inside a
                scaled wrapper so the export size is exact while the on-screen
                size fits the modal. */}
            <div className="px-5 py-5">
              <div
                ref={wrapperRef}
                className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 mx-auto"
                style={{
                  aspectRatio: '1 / 1',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transformOrigin: 'top left',
                    transform: `scale(${previewScale})`,
                    width: 1080,
                    height: 1080,
                  }}
                >
                  {sample.length > 0 ? (
                    (() => {
                      const common = {
                        ref: stageRef,
                        photos: sample,
                        tripTitle: trip?.title || 'Mi viaje',
                        destination: trip?.destination,
                        dateRange,
                      };
                      switch (template) {
                        case 'editorial':
                          return <EditorialTemplate {...common} />;
                        case 'polaroid':
                          return <PolaroidWallTemplate {...common} />;
                        case 'scrapbook':
                          return <ScrapbookTemplate {...common} />;
                        case 'postcard':
                          return <PostcardTemplate {...common} />;
                      }
                    })()
                  ) : (
                    <div className="flex items-center justify-center text-white/40 text-sm" style={{ width: 1080, height: 1080 }}>
                      No hay fotos suficientes
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/10 bg-black/30">
              <button
                type="button"
                onClick={() => setShuffleSeed((s) => s + 1)}
                disabled={photos.length < 2}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition-colors disabled:opacity-40"
              >
                <Shuffle className="w-4 h-4" />
                Mezclar fotos
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading || sample.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-white text-sm font-bold shadow-[0_8px_30px_rgba(245,158,11,0.35)] disabled:opacity-60 transition-all"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exportando…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Descargar PNG
                  </>
                )}
              </button>
            </div>

            {/* Hint */}
            <div className="px-5 pb-5 -mt-2 flex items-start gap-2 text-[11px] text-white/45">
              <Sparkles className="w-3.5 h-3.5 text-amber-300/70 mt-0.5 flex-shrink-0" />
              Las fotos con caption aparecen primero. Tocá "Mezclar" para cambiar la selección.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
