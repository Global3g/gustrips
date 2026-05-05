'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Camera,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  ImagePlus,
  Pencil,
  Check,
} from 'lucide-react';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useAlbum } from '@/hooks/useAlbum';
import { useToast } from '@/context/ToastContext';
import type { AlbumPhoto } from '@/types';

/* ─── Photo Album Page ──────────────────────────── */

export default function PhotosPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trip } = useTrip(tripId);
  const { events } = useEvents(tripId);
  const { albumPhotos, addPhoto, deletePhoto, updateCaption } = useAlbum(tripId, trip);
  const { toast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── All photos: album + event photos, sorted by date ── */

  const allPhotos = useMemo(() => {
    const photos: (AlbumPhoto & { source: 'album' | 'event'; eventTitle?: string })[] = [];

    // Album photos
    for (const p of albumPhotos) {
      photos.push({ ...p, source: 'album' });
    }

    // Event photos
    for (const event of events) {
      if (event.photos && event.photos.length > 0) {
        for (const url of event.photos) {
          photos.push({
            url,
            date: event.date,
            uploadedAt: event.createdAt,
            source: 'event',
            eventTitle: event.title,
          });
        }
      }
    }

    // Sort by date, then uploadedAt
    return photos.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.uploadedAt.localeCompare(b.uploadedAt);
    });
  }, [albumPhotos, events]);

  /* ── Group photos by day ── */

  const photosByDay = useMemo(() => {
    const groups: Record<string, typeof allPhotos> = {};
    for (const photo of allPhotos) {
      if (!groups[photo.date]) groups[photo.date] = [];
      groups[photo.date].push(photo);
    }
    return groups;
  }, [allPhotos]);

  /* ── Trip days for day numbering ── */

  const tripDays = useMemo(() => {
    if (!trip) return {};
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const days = eachDayOfInterval({ start, end });
      const map: Record<string, number> = {};
      days.forEach((d, i) => {
        map[format(d, 'yyyy-MM-dd')] = i + 1;
      });
      return map;
    } catch {
      return {};
    }
  }, [trip]);

  /* ── Flat list for lightbox navigation ── */

  const flatPhotos = useMemo(() => allPhotos, [allPhotos]);

  /* ── Upload handler ── */

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (fileArray.length === 0) return;

      setUploading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      let successCount = 0;

      for (const file of fileArray) {
        try {
          await addPhoto(file, today);
          successCount++;
        } catch (err) {
          console.error('Error uploading photo:', err);
        }
      }

      setUploading(false);
      if (successCount > 0) {
        toast(
          successCount === 1
            ? 'Foto agregada al album'
            : `${successCount} fotos agregadas al album`,
          'success',
        );
      }
    },
    [addPhoto, toast],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    },
    [handleFiles],
  );

  /* ── Drag and drop ── */

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  /* ── Delete handler ── */

  const handleDelete = useCallback(
    async (photo: typeof flatPhotos[number]) => {
      if (photo.source !== 'album') return; // Only album photos can be deleted here
      setDeleting(photo.url);
      try {
        await deletePhoto(photo);
        toast('Foto eliminada', 'success');
        // Close lightbox if viewing deleted photo
        if (lightboxIndex !== null && flatPhotos[lightboxIndex]?.url === photo.url) {
          const newLen = flatPhotos.length - 1;
          if (newLen <= 0) {
            setLightboxIndex(null);
          } else if (lightboxIndex >= newLen) {
            setLightboxIndex(newLen - 1);
          }
        }
      } catch (err) {
        console.error('Error deleting photo:', err);
        toast('Error al eliminar foto', 'error');
      } finally {
        setDeleting(null);
      }
    },
    [deletePhoto, toast, lightboxIndex, flatPhotos],
  );

  /* ── Caption edit ── */

  const startEditCaption = useCallback((photo: typeof flatPhotos[number]) => {
    if (photo.source !== 'album') return;
    setEditingCaption(photo.url);
    setCaptionText(photo.caption || '');
  }, []);

  const saveCaption = useCallback(
    async (photo: typeof flatPhotos[number]) => {
      if (photo.source !== 'album') return;
      try {
        await updateCaption(photo, captionText);
        toast('Leyenda actualizada', 'success');
      } catch (err) {
        console.error('Error updating caption:', err);
      }
      setEditingCaption(null);
      setCaptionText('');
    },
    [updateCaption, captionText, toast],
  );

  /* ── Lightbox navigation ── */

  const openLightbox = useCallback(
    (photo: typeof flatPhotos[number]) => {
      const idx = flatPhotos.findIndex((p) => p.url === photo.url);
      if (idx >= 0) setLightboxIndex(idx);
    },
    [flatPhotos],
  );

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goNext = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null && prev < flatPhotos.length - 1 ? prev + 1 : prev));
  }, [flatPhotos.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  /* ── Sorted day keys ── */

  const sortedDays = useMemo(
    () => Object.keys(photosByDay).sort(),
    [photosByDay],
  );

  const totalPhotos = flatPhotos.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Camera className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Album de Fotos</h1>
            <p className="text-sm text-gray-500">
              {totalPhotos === 0
                ? 'Agrega fotos de tu viaje'
                : `${totalPhotos} foto${totalPhotos !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Agregar fotos</span>
        </button>
      </div>

      {/* ── Upload drop zone ── */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200
          ${dragOver
            ? 'border-amber-400 bg-amber-50 scale-[1.01]'
            : 'border-gray-200 bg-white/60 hover:border-amber-300 hover:bg-amber-50/50'
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-100/80 flex items-center justify-center">
            <Upload className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {uploading ? 'Subiendo...' : 'Arrastra fotos aqui o haz clic para seleccionar'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Las imagenes se comprimen automaticamente (max 1200px, JPEG 80%)
            </p>
          </div>
          {uploading && (
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* ── Photo grid by day ── */}
      {totalPhotos === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-10 h-10 text-gray-200" />
          </div>
          <p className="text-gray-400 text-sm">
            Aun no hay fotos en el album. Sube fotos para documentar tu viaje.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDays.map((dateStr) => {
            const dayNum = tripDays[dateStr];
            let dayLabel: string;
            try {
              const d = parseISO(dateStr);
              const weekday = format(d, 'EEEE', { locale: es });
              const capitalWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
              const dateFormatted = format(d, "d 'de' MMMM", { locale: es });
              dayLabel = dayNum
                ? `Dia ${dayNum} — ${capitalWeekday} ${dateFormatted}`
                : `${capitalWeekday} ${dateFormatted}`;
            } catch {
              dayLabel = dateStr;
            }

            const dayPhotos = photosByDay[dateStr];

            return (
              <div key={dateStr}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                    {dayNum || '#'}
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">{dayLabel}</h2>
                  <span className="text-xs text-gray-400 font-medium">
                    {dayPhotos.length} foto{dayPhotos.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Photo grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {dayPhotos.map((photo) => (
                    <div
                      key={photo.url}
                      className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-square cursor-pointer"
                      onClick={() => openLightbox(photo)}
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Foto del viaje'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                      {/* Caption */}
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                        </div>
                      )}

                      {/* Event badge */}
                      {photo.source === 'event' && photo.eventTitle && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-blue-500/80 backdrop-blur-sm text-[10px] text-white font-semibold">
                          {photo.eventTitle}
                        </div>
                      )}

                      {/* Action buttons on hover */}
                      {photo.source === 'album' && (
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditCaption(photo);
                            }}
                            className="w-7 h-7 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-gray-600 transition-colors shadow-sm"
                            title="Editar leyenda"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(photo);
                            }}
                            disabled={deleting === photo.url}
                            className="w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white transition-colors shadow-sm"
                            title="Eliminar foto"
                          >
                            {deleting === photo.url ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Caption edit modal ── */}
      <AnimatePresence>
        {editingCaption !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setEditingCaption(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-3">Editar leyenda</h3>
              <input
                type="text"
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                placeholder="Escribe una leyenda..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const photo = flatPhotos.find((p) => p.url === editingCaption);
                    if (photo) saveCaption(photo);
                  }
                }}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setEditingCaption(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const photo = flatPhotos.find((p) => p.url === editingCaption);
                    if (photo) saveCaption(photo);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                >
                  <Check className="w-4 h-4 inline mr-1" />
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxIndex !== null && flatPhotos[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={closeLightbox}
          >
            <motion.img
              key={flatPhotos[lightboxIndex].url}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              src={flatPhotos[lightboxIndex].url}
              alt={flatPhotos[lightboxIndex].caption || 'Foto'}
              className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Caption display */}
            {flatPhotos[lightboxIndex].caption && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/50 backdrop-blur-sm text-white text-sm font-medium max-w-md text-center">
                {flatPhotos[lightboxIndex].caption}
              </div>
            )}

            {/* Close */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Delete */}
            {flatPhotos[lightboxIndex].source === 'album' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(flatPhotos[lightboxIndex!]);
                }}
                disabled={deleting !== null}
                className="absolute top-4 left-4 w-10 h-10 rounded-full bg-red-500/60 hover:bg-red-500/80 flex items-center justify-center text-white transition-colors"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Nav arrows */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {lightboxIndex < flatPhotos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium">
              {lightboxIndex + 1} / {flatPhotos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
