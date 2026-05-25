'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Share2,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
} from 'lucide-react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { AlbumPhoto } from '@/types';
import { sharePhoto } from '@/lib/sharePhoto';

export interface LightboxPhoto extends AlbumPhoto {
  source: 'album' | 'event';
  eventTitle?: string;
}

interface PhotoLightboxProps {
  open: boolean;
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onChangeIndex: (idx: number) => void;
  onDelete: (photo: LightboxPhoto) => void;
  onDownload: (photo: LightboxPhoto) => void;
  deleting?: string | null;
}

/** Progressive load: shows the thumbnail (photo.url) instantly so the
 *  lightbox opens with zero delay, then upgrades to the full-quality
 *  3000px JPEG (photo.fullUrl) once it has finished downloading in the
 *  background. Neighbors are prefetched so arrow-key nav feels instant.
 *
 *  Caches loaded full-URLs in a module-scoped Set so re-opening a recently
 *  viewed photo skips the upgrade flicker. */
const loadedFullUrls = new Set<string>();

function prefetchFullUrl(url: string | undefined) {
  if (!url || loadedFullUrls.has(url)) return;
  if (typeof window === 'undefined') return;
  const img = new Image();
  img.onload = () => loadedFullUrls.add(url);
  // No onerror handling — failed prefetch will just retry naturally if
  // the user navigates to that photo.
  img.src = url;
}

export default function PhotoLightbox({
  open,
  photos,
  index,
  onClose,
  onChangeIndex,
  onDelete,
  onDownload,
  deleting,
}: PhotoLightboxProps) {
  const photo = photos[index];
  const [rotation, setRotation] = useState(0);
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Tracks whether the full-quality URL for the CURRENT photo is loaded.
  // Until true, we display the thumbnail (photo.url) so the lightbox
  // opens instantly; once true we swap to photo.fullUrl.
  const [fullLoaded, setFullLoaded] = useState(false);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const prevIndex = useRef(index);

  // Feature-detect navigator.share once on mount (avoids SSR mismatch).
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Reset rotation + zoom only when navigating to a DIFFERENT photo,
  // not on first mount — fighting centerOnInit on mount made the photo
  // briefly appear and then disappear.
  useEffect(() => {
    if (prevIndex.current === index) return;
    prevIndex.current = index;
    setRotation(0);
    transformRef.current?.resetTransform(180);
  }, [index]);

  // Reset / re-evaluate the progressive load whenever we land on a new photo.
  // If the full URL was already fetched (cache hit) skip the swap state.
  useEffect(() => {
    if (!photo) return;
    // Prefer the light 1280px WebP for the full view; fall back to the
    // legacy full-quality URL for photos that predate the extension.
    const fullUrl = photo.viewUrl || photo.fullUrl;
    if (!fullUrl || fullUrl === photo.url) {
      // No separate full-quality version — the thumbnail IS the source.
      setFullLoaded(true);
      return;
    }
    if (loadedFullUrls.has(fullUrl)) {
      setFullLoaded(true);
      return;
    }
    setFullLoaded(false);
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      loadedFullUrls.add(fullUrl);
      setFullLoaded(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      // Full failed — stick with the thumbnail rather than show a broken state.
      setFullLoaded(false);
    };
    img.src = fullUrl;
    return () => {
      cancelled = true;
    };
  }, [photo]);

  // Prefetch the neighbors' full-quality versions so arrow-key nav is instant.
  useEffect(() => {
    if (!open) return;
    prefetchFullUrl(photos[index + 1]?.viewUrl || photos[index + 1]?.fullUrl);
    prefetchFullUrl(photos[index - 1]?.viewUrl || photos[index - 1]?.fullUrl);
  }, [open, index, photos]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChangeIndex(Math.min(index + 1, photos.length - 1));
      if (e.key === 'ArrowLeft') onChangeIndex(Math.max(index - 1, 0));
      if (e.key.toLowerCase() === 'r') setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, photos.length, onClose, onChangeIndex]);

  if (!open || !photo) return null;

  // Render whichever source is currently best: full quality once ready,
  // otherwise the thumbnail so the user sees something immediately.
  const fullSrc = photo.viewUrl || photo.fullUrl;
  const displaySrc = fullLoaded && fullSrc ? fullSrc : photo.url;
  const upgrading = !!fullSrc && fullSrc !== photo.url && !fullLoaded;

  const rotateRight = () => setRotation((r) => (r + 90) % 360);
  const rotateLeft = () => setRotation((r) => (r + 270) % 360);
  const zoomIn = () => transformRef.current?.zoomIn(0.4);
  const zoomOut = () => transformRef.current?.zoomOut(0.4);
  const resetView = () => transformRef.current?.resetTransform(220);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await sharePhoto({
        // Share/save the full-resolution original, not the light view WebP.
        url: photo.originalUrl || photo.fullUrl || photo.url,
        caption: photo.caption,
        tripTitle: photo.eventTitle,
      });
      if (!result.ok) {
        if (result.reason === 'unsupported') {
          alert('Tu navegador no soporta compartir directo — descarga la foto y compártela manualmente.');
        } else if (result.reason === 'failed') {
          console.error('[PhotoLightbox] share failed:', result.error);
        }
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-md"
        onClick={onClose}
      >
        <div className="relative w-full h-full" onClick={(e) => e.stopPropagation()}>
          <TransformWrapper
            ref={transformRef}
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            wheel={{ step: 0.18 }}
            doubleClick={{ mode: 'toggle', step: 1.6 }}
            pinch={{ step: 5 }}
            limitToBounds={false}
            centerOnInit
          >
            <TransformComponent
              wrapperStyle={{ width: '100vw', height: '100vh' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={photo.url}
                src={displaySrc}
                alt={photo.caption || 'Foto'}
                draggable={false}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.25s ease',
                  maxWidth: '92vw',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                  userSelect: 'none',
                  display: 'block',
                }}
              />
            </TransformComponent>
          </TransformWrapper>

          {/* Subtle "loading full quality" indicator while the 3000px JPEG
              streams in behind the displayed thumbnail. */}
          {upgrading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white/85 text-[11px] font-semibold pointer-events-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Cargando calidad completa…
            </div>
          )}

          {/* Caption */}
          {photo.caption && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md text-white text-sm font-medium max-w-md text-center border border-white/10 pointer-events-none">
              {photo.caption}
            </div>
          )}

          {/* Top-right controls */}
          <div className="absolute top-4 right-4 flex gap-1.5 z-10">
            {canShare && (
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center text-white transition-all border border-white/20 disabled:opacity-60"
                title="Compartir"
              >
                {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDownload(photo)}
              className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center text-white transition-all border border-white/20"
              title="Descargar (calidad completa)"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center text-white transition-all border border-white/20"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Top-left delete */}
          <button
            type="button"
            onClick={() => onDelete(photo)}
            disabled={!!deleting}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-red-500/30 backdrop-blur-md hover:bg-red-500/50 flex items-center justify-center text-white transition-all border border-red-300/30 z-10"
            title="Eliminar"
          >
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          </button>

          {/* Side navigation */}
          {index > 0 && (
            <button
              type="button"
              onClick={() => onChangeIndex(index - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center text-white transition-all border border-white/20 z-10"
              title="Anterior (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {index < photos.length - 1 && (
            <button
              type="button"
              onClick={() => onChangeIndex(index + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center text-white transition-all border border-white/20 z-10"
              title="Siguiente (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Bottom toolbar (zoom + rotate) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 z-10">
            <button
              type="button"
              onClick={zoomOut}
              className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-white transition-all"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-white transition-all"
              title="Ajustar a pantalla"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-white transition-all"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="w-px h-5 bg-white/15 mx-1" />
            <button
              type="button"
              onClick={rotateLeft}
              className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-white transition-all"
              title="Rotar 90° izquierda"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={rotateRight}
              className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-white transition-all"
              title="Rotar 90° derecha (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <span className="w-px h-5 bg-white/15 mx-1" />
            <span className="px-2 text-[11px] font-bold tabular-nums text-white/85 whitespace-nowrap">
              {index + 1} / {photos.length}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
