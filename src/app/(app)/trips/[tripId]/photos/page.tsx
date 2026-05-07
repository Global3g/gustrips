'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import { formatDateES } from '@/lib/utils/helpers';
import { EVENT_TYPES } from '@/config/constants';
import type { AlbumPhoto } from '@/types';

/* ─── Photo Album Page ──────────────────────────── */

/* Helper to get the detail field key for event name based on type */
function getEventNameFieldKey(eventType: string): string | null {
  switch (eventType) {
    case 'restaurant':
      return 'restaurantName';
    case 'hotel':
      return 'hotelName';
    case 'activity':
      return 'activityName';
    case 'car_rental':
      return 'rentalCompany';
    case 'cruise':
      return 'portName';
    case 'flight':
      return 'airline';
    case 'transport':
      return 'transportMode';
    default:
      return null;
  }
}

/* Helper to extract event name from details */
function getEventName(event: any): string | undefined {
  if (!event || !event.details) return undefined;

  switch (event.type) {
    case 'restaurant':
      return event.details.restaurantName;
    case 'hotel':
      return event.details.hotelName;
    case 'activity':
      return event.details.activityName;
    case 'car_rental':
      return event.details.rentalCompany;
    case 'cruise':
      return event.details.portName;
    case 'flight':
      if (event.details.airline) return event.details.airline;
      if (event.details.origin && event.details.destination) {
        return `${event.details.origin} → ${event.details.destination}`;
      }
      return undefined;
    case 'transport':
      return event.details.transportMode;
    default:
      return undefined;
  }
}

export default function PhotosPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trip } = useTrip(tripId);
  const { events, updateEvent } = useEvents(tripId);
  const { albumPhotos, addPhoto, deletePhoto, updateCaption } = useAlbum(tripId, trip);
  const { toast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [modalCity, setModalCity] = useState('');
  const [modalCountry, setModalCountry] = useState('');
  const [modalEventName, setModalEventName] = useState('');
  const [modalEventType, setModalEventType] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Pre-fill fields when event is selected ── */
  useEffect(() => {
    if (selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId);
      if (event) {
        setModalCity(event.city || '');
        setModalCountry(event.country || '');
        setModalEventType(event.type || '');
        setModalEventName(getEventName(event) || '');
      }
    } else {
      setModalCity('');
      setModalCountry('');
      setModalEventType('');
      setModalEventName('');
    }
  }, [selectedEventId, events]);

  /* ── All photos: album + event photos (deduplicated), sorted by date ── */

  const allPhotos = useMemo(() => {
    const photos: (AlbumPhoto & { source: 'album' | 'event'; eventTitle?: string })[] = [];
    const albumUrls = new Set<string>();

    // Album photos (include eventTitle if linked)
    for (const p of albumPhotos) {
      albumUrls.add(p.url);
      const linkedEvent = p.eventId ? events.find((e) => e.id === p.eventId) : undefined;
      photos.push({ ...p, source: 'album', eventTitle: linkedEvent?.title });
    }

    // Event photos — only add if NOT already in album (avoid duplicates from sync)
    for (const event of events) {
      if (event.photos && event.photos.length > 0) {
        for (const url of event.photos) {
          if (!albumUrls.has(url)) {
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
    }

    // Sort by date, then uploadedAt
    return photos.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.uploadedAt.localeCompare(b.uploadedAt);
    });
  }, [albumPhotos, events]);

  /* ── Group photos by day and event ── */

  const photoGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      date: string;
      eventName?: string;
      eventType?: string;
      eventCity?: string;
      eventCountry?: string;
      eventId?: string;
      photos: typeof allPhotos;
    }> = [];

    // Group by date first
    const byDate: Record<string, typeof allPhotos> = {};
    for (const photo of allPhotos) {
      if (!byDate[photo.date]) byDate[photo.date] = [];
      byDate[photo.date].push(photo);
    }

    // For each date, subgroup by event
    for (const [date, photos] of Object.entries(byDate)) {
      const byEvent: Record<string, typeof allPhotos> = {};
      const noEvent: typeof allPhotos = [];

      for (const photo of photos) {
        if (photo.eventId) {
          const key = photo.eventId;
          if (!byEvent[key]) byEvent[key] = [];
          byEvent[key].push(photo);
        } else {
          noEvent.push(photo);
        }
      }

      // Add event groups
      for (const [eventId, eventPhotos] of Object.entries(byEvent)) {
        const event = events.find((e) => e.id === eventId);
        groups.push({
          key: `${date}-${eventId}`,
          date,
          eventName: getEventName(event),
          eventType: event?.type,
          eventCity: event?.city,
          eventCountry: event?.country,
          eventId,
          photos: eventPhotos,
        });
      }

      // Add non-event photos
      if (noEvent.length > 0) {
        groups.push({
          key: `${date}-no-event`,
          date,
          photos: noEvent,
        });
      }
    }

    // Sort by date
    return groups.sort((a, b) => a.date.localeCompare(b.date));
  }, [allPhotos, events]);

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

  /* ── Events for today (for linking dropdown) ── */

  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const eventsForSelectedDate = useMemo(() => {
    return events.filter((e) => e.date === selectedDate);
  }, [events, selectedDate]);

  /* ── Upload handler ── */

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (fileArray.length === 0) return;

      // Always show linking modal to pick date and optionally link to event
      setPendingFiles(fileArray);
      setSelectedEventId('');
      setModalCity('');
      setModalCountry('');
      setModalEventName('');
      setModalEventType('');
      setShowLinkModal(true);
    },
    [],
  );

  const uploadFiles = useCallback(
    async (fileArray: File[], eventId: string, city?: string, country?: string, eventName?: string, eventType?: string) => {
      setUploading(true);
      const today = selectedDate;
      let successCount = 0;

      try {
        for (const file of fileArray) {
          try {
            const photo = await addPhoto(file, today, undefined, eventId || undefined);

            // If linked to an event, also add photo URL to event.photos[]
            if (eventId) {
              try {
                const event = events.find((e) => e.id === eventId);
                const currentPhotos = event?.photos ?? [];
                const updates: any = { photos: [...currentPhotos, photo.url] };

                // Update city/country if provided and different from event
                if (city && city !== event?.city) updates.city = city;
                if (country && country !== event?.country) updates.country = country;

                // Update event name in details if provided
                if (eventName && eventType) {
                  const detailKey = getEventNameFieldKey(eventType);
                  if (detailKey) {
                    const currentDetails = event?.details || {};
                    if (currentDetails[detailKey] !== eventName) {
                      updates.details = { ...currentDetails, [detailKey]: eventName };
                    }
                  }
                }

                await updateEvent(eventId, updates);
              } catch (linkErr) {
                console.error('Error vinculando foto al evento:', linkErr);
              }
            }

            successCount++;
          } catch (err) {
            console.error('Error uploading photo:', err);
            toast('Error al subir foto', 'error');
          }
        }

        if (successCount > 0) {
          toast(
            successCount === 1
              ? 'Foto agregada al album'
              : `${successCount} fotos agregadas al album`,
            'success',
          );
        }
      } finally {
        setUploading(false);
      }
    },
    [addPhoto, toast, events, updateEvent, selectedDate],
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
      setDeleting(photo.url);
      try {
        // Remove photo URL from ALL events that reference it
        const linkedEvents = events.filter((e) => e.photos?.includes(photo.url));
        for (const event of linkedEvents) {
          try {
            const updatedPhotos = (event.photos ?? []).filter((p) => p !== photo.url);
            await updateEvent(event.id, { photos: updatedPhotos });
          } catch {
            // Non-critical — continue
          }
        }

        // Remove from album if it's there
        if (photo.source === 'album') {
          await deletePhoto(photo);
        }

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
    [deletePhoto, toast, lightboxIndex, flatPhotos, events, updateEvent],
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

      {/* ── Link to event modal ── */}
      <AnimatePresence>
        {showLinkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowLinkModal(false);
              setPendingFiles([]);
              setSelectedEventId('');
              setModalCity('');
              setModalCountry('');
              setModalEventName('');
              setModalEventType('');
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">Subir fotos</h3>
              <p className="text-sm text-gray-500 mb-4">
                {pendingFiles.length === 1 ? '1 foto' : `${pendingFiles.length} fotos`} seleccionadas.
              </p>
              {/* Date picker */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={trip?.startDate}
                max={trip?.endDate}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mb-4"
              />
              {/* Event linking */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a evento (opcional)</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mb-4"
              >
                <option value="">Sin vincular</option>
                {(() => {
                  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
                  const grouped = new Map<string, typeof events>();
                  for (const ev of sorted) {
                    const list = grouped.get(ev.date) || [];
                    list.push(ev);
                    grouped.set(ev.date, list);
                  }
                  return [...grouped.entries()].map(([dateStr, evts]) => (
                    <optgroup key={dateStr} label={formatDateES(dateStr)}>
                      {evts.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.startTime ? `${ev.startTime} - ` : ''}{ev.title}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
              {/* Event details fields (shown if event selected) */}
              {selectedEventId && (
                <div className="mb-4 space-y-3">
                  {/* Event type and name */}
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <p className="text-xs font-medium text-purple-700 mb-2">Información del evento</p>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={modalEventType ? EVENT_TYPES[modalEventType as keyof typeof EVENT_TYPES]?.label || modalEventType : ''}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 bg-gray-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Nombre {modalEventType && `(${EVENT_TYPES[modalEventType as keyof typeof EVENT_TYPES]?.label})`}
                        </label>
                        <input
                          type="text"
                          value={modalEventName}
                          onChange={(e) => setModalEventName(e.target.value)}
                          placeholder={
                            modalEventType === 'restaurant' ? 'Ej. Azia' :
                            modalEventType === 'hotel' ? 'Ej. Hotel Playa' :
                            modalEventType === 'activity' ? 'Ej. Snorkel' :
                            'Nombre del lugar'
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                    {!modalEventName && (
                      <p className="text-xs text-purple-600 mt-2">
                        💡 Agrega el nombre para identificar mejor este lugar
                      </p>
                    )}
                  </div>

                  {/* City and country */}
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-2">Ubicación</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad</label>
                        <input
                          type="text"
                          value={modalCity}
                          onChange={(e) => setModalCity(e.target.value)}
                          placeholder="Ej. Mazatlán"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">País</label>
                        <input
                          type="text"
                          value={modalCountry}
                          onChange={(e) => setModalCountry(e.target.value)}
                          placeholder="Ej. México"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                    {(!modalCity || !modalCountry) && (
                      <p className="text-xs text-green-600 mt-2">
                        💡 Agrega ciudad y país para recordar mejor este momento
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setPendingFiles([]);
                    setSelectedEventId('');
                    setModalCity('');
                    setModalCountry('');
                    setModalEventName('');
                    setModalEventType('');
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    uploadFiles(pendingFiles, selectedEventId, modalCity, modalCountry, modalEventName, modalEventType);
                    setPendingFiles([]);
                    setSelectedEventId('');
                    setModalCity('');
                    setModalCountry('');
                    setModalEventName('');
                    setModalEventType('');
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                >
                  Subir {pendingFiles.length === 1 ? 'foto' : 'fotos'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Photo grid by day and event ── */}
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
          {photoGroups.map((group) => {
            const dayNum = tripDays[group.date];
            let dayLabel: string;
            try {
              const d = parseISO(group.date);
              const weekday = format(d, 'EEEE', { locale: es });
              const capitalWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
              const dateFormatted = format(d, "d 'de' MMMM", { locale: es });
              dayLabel = dayNum
                ? `Dia ${dayNum} — ${capitalWeekday} ${dateFormatted}`
                : `${capitalWeekday} ${dateFormatted}`;
            } catch {
              dayLabel = group.date;
            }

            return (
              <div key={group.key}>
                {/* Group header with event info */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                      {dayNum || '#'}
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">{dayLabel}</h2>
                    <span className="text-xs text-gray-400 font-medium">
                      {group.photos.length} foto{group.photos.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Event and location info */}
                  {(group.eventType || group.eventName) && (
                    <div className="ml-11 flex flex-wrap items-center gap-2">
                      {/* Event type badge */}
                      {group.eventType && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                          <span>{(EVENT_TYPES as any)[group.eventType]?.label || group.eventType}</span>
                        </div>
                      )}
                      {/* Event name badge (from details) */}
                      {group.eventName && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                          <span>{group.eventName}</span>
                        </div>
                      )}
                      {/* City and country badge */}
                      {(group.eventCity || group.eventCountry) && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                          <span>
                            {[group.eventCity, group.eventCountry].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Photo grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {group.photos.map((photo) => (
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

                      {/* Action buttons on hover */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {photo.source === 'album' && (
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
                        )}
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
