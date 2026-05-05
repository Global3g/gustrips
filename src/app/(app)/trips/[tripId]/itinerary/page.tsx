'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { format, parseISO, eachDayOfInterval, addDays, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, Plane, List, Clock, Layers, FileSearch, MapPin, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';

const AgendaView = dynamic(() => import('@/components/trips/AgendaView'), { ssr: false });
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getClientStorage } from '@/lib/firebase/client';
import { useEvents } from '@/hooks/useEvents';
import { useTrip } from '@/hooks/useTrip';
import { useDocuments } from '@/hooks/useDocuments';
import { useToast } from '@/context/ToastContext';
import EventCard from '@/components/trips/EventCard';
import EventForm from '@/components/trips/EventForm';
import ScanDocumentModal from '@/components/trips/ScanDocumentModal';
import AutoGenerateModal from '@/components/trips/AutoGenerateModal';
import Button from '@/components/ui/Button';
import { classNames, getTimezoneAbbr, getTimezoneOffset, formatDateHeaderES } from '@/lib/utils/helpers';
import { ROUTES, EVENT_TYPE_TO_DOC_CATEGORY } from '@/config/constants';
import type { ScannedEvent } from '@/lib/utils/aiScanner';
import type { TripEvent, DocumentCategory } from '@/types';

/* ---- Timezone helpers ---- */
function getEffectiveOutgoingTimezone(event: TripEvent): string | undefined {
  if (event.type === 'flight' && event.details?.arrivalTimezone) {
    return event.details.arrivalTimezone;
  }
  return event.timezone;
}

function getEffectiveIncomingTimezone(event: TripEvent): string | undefined {
  return event.timezone;
}

export default function ItineraryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { trip, updateTrip } = useTrip(tripId);
  const { events, loading, createEvent, updateEvent, deleteEvent } = useEvents(tripId);
  const {
    documents,
    uploadDocument,
    deleteDocument,
    getDocumentsByEvent,
  } = useDocuments(tripId);
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TripEvent | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'agenda' | 'all'>('timeline');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'full'>('full');
  const [defaultFormDate, setDefaultFormDate] = useState('');
  const [defaultFormTime, setDefaultFormTime] = useState('');

  /* ---- Compute all trip days ---- */

  const tripDays = useMemo(() => {
    if (!trip) return [];
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      return eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
  }, [trip]);

  /* ---- Selected day from URL ---- */

  const selectedDay = useMemo(() => {
    const dayParam = searchParams.get('day');
    if (dayParam) {
      try {
        return parseISO(dayParam);
      } catch {
        // fallback
      }
    }
    // Default to first day of trip
    if (tripDays.length > 0) return tripDays[0];
    return new Date();
  }, [searchParams, tripDays]);

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');

  /* ---- Day number (1-indexed) ---- */

  const dayNumber = useMemo(() => {
    const idx = tripDays.findIndex((d) => isSameDay(d, selectedDay));
    return idx >= 0 ? idx + 1 : 1;
  }, [tripDays, selectedDay]);

  const totalDays = tripDays.length;

  /* ---- Day navigation ---- */

  const canGoPrev = dayNumber > 1;
  const canGoNext = dayNumber < totalDays;

  const navigateToDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    router.push(`${ROUTES.app.trip(tripId)}/itinerary?day=${dateStr}`);
  };

  const goPrevDay = () => {
    if (canGoPrev) navigateToDay(subDays(selectedDay, 1));
  };

  const goNextDay = () => {
    if (canGoNext) navigateToDay(addDays(selectedDay, 1));
  };

  /* ---- Events for selected day, sorted by startTime ---- */

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => e.date === selectedDayStr)
      .sort((a, b) => {
        if (!a.startTime && !b.startTime) return 0;
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [events, selectedDayStr]);

  /* ---- Document handlers ---- */

  const makeUploadHandler = useCallback(
    (eventId: string, eventType: string) => {
      const category: DocumentCategory = EVENT_TYPE_TO_DOC_CATEGORY[eventType as keyof typeof EVENT_TYPE_TO_DOC_CATEGORY] || 'other';
      return async (file: File): Promise<string> => {
        try {
          const url = await uploadDocument(file, { eventId, category });
          toast('Documento adjuntado', 'success');
          return url;
        } catch (error) {
          console.error('Error al adjuntar documento:', error);
          toast('Error al adjuntar documento', 'error');
          throw error;
        }
      };
    },
    [uploadDocument, toast]
  );

  const handleDeleteDocument = useCallback(
    async (docId: string, url: string) => {
      try {
        await deleteDocument(docId, url);
        toast('Documento eliminado', 'success');
      } catch (error) {
        console.error('Error al eliminar documento:', error);
        toast('Error al eliminar documento', 'error');
      }
    },
    [deleteDocument, toast]
  );

  /* ---- Photo handlers ---- */

  const handleAddPhoto = useCallback(
    async (eventId: string, file: File) => {
      try {
        const storage = getClientStorage();
        const timestamp = Date.now();
        const storageRef = ref(storage, `trips/${tripId}/photos/${eventId}/${timestamp}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        const event = events.find((e) => e.id === eventId);
        const currentPhotos = event?.photos ?? [];
        await updateEvent(eventId, { photos: [...currentPhotos, url] });

        // Sync to gallery: also add to trip.albumPhotos[]
        if (trip) {
          const { arrayUnion: arrUnion } = await import('firebase/firestore');
          const { doc: fbDoc, updateDoc: fbUpdateDoc } = await import('firebase/firestore');
          const { nowISO } = await import('@/lib/utils/helpers');
          const db = (await import('@/lib/firebase/client')).getClientDb();
          const tripRef = fbDoc(db, 'trips', tripId);
          const albumPhoto = {
            url,
            date: event?.date || format(new Date(), 'yyyy-MM-dd'),
            caption: event?.title || undefined,
            eventId,
            uploadedAt: nowISO(),
          };
          await fbUpdateDoc(tripRef, {
            albumPhotos: arrUnion(albumPhoto),
            updatedAt: nowISO(),
          });
        }

        toast('Foto agregada', 'success');
      } catch (error) {
        console.error('Error al subir foto:', error);
        toast('Error al subir la foto', 'error');
      }
    },
    [tripId, events, updateEvent, toast, trip],
  );

  const handleDeletePhoto = useCallback(
    async (eventId: string, url: string) => {
      try {
        const storage = getClientStorage();
        const storageRef = ref(storage, url);
        try {
          await deleteObject(storageRef);
        } catch {
          // File may have already been deleted from storage
        }

        const event = events.find((e) => e.id === eventId);
        const currentPhotos = event?.photos ?? [];
        const updatedPhotos = currentPhotos.filter((p) => p !== url);
        await updateEvent(eventId, { photos: updatedPhotos });

        // Sync: also remove from trip.albumPhotos[] if present
        if (trip?.albumPhotos) {
          const matchingPhoto = trip.albumPhotos.find((p) => p.url === url);
          if (matchingPhoto) {
            const { arrayRemove: arrRemove } = await import('firebase/firestore');
            const { doc: fbDoc, updateDoc: fbUpdateDoc } = await import('firebase/firestore');
            const { nowISO } = await import('@/lib/utils/helpers');
            const db = (await import('@/lib/firebase/client')).getClientDb();
            const tripRef = fbDoc(db, 'trips', tripId);
            await fbUpdateDoc(tripRef, {
              albumPhotos: arrRemove(matchingPhoto),
              updatedAt: nowISO(),
            });
          }
        }

        toast('Foto eliminada', 'success');
      } catch (error) {
        console.error('Error al eliminar foto:', error);
        toast('Error al eliminar la foto', 'error');
      }
    },
    [events, updateEvent, toast, trip, tripId],
  );

  /* ---- CRUD Handlers ---- */

  const handleCreate = async (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => {
    setFormLoading(true);
    try {
      await createEvent(data);
      setShowForm(false);
      toast('Evento creado correctamente', 'success');
    } catch (error) {
      console.error('Error al crear evento:', error);
      toast('Error al crear el evento', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>) => {
    if (!editingEvent) return;
    setFormLoading(true);
    try {
      await updateEvent(editingEvent.id, data);
      setEditingEvent(null);
      toast('Evento actualizado', 'success');
    } catch (error) {
      console.error('Error al actualizar evento:', error);
      toast('Error al actualizar el evento', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      const { undo } = await deleteEvent(eventId);
      toast('Evento eliminado', 'info', {
        label: 'Deshacer',
        onClick: () => {
          undo();
          toast('Evento restaurado', 'success');
        },
      });
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      toast('Error al eliminar el evento', 'error');
    }
  };

  const handleEdit = (event: TripEvent) => {
    setEditingEvent(event);
  };

  const handleDuplicate = async (event: TripEvent) => {
    try {
      const { id, createdBy, createdAt, ...rest } = event;
      await createEvent({
        ...rest,
        title: `(copia) ${event.title}`,
      });
      toast('Evento duplicado', 'success');
    } catch (error) {
      console.error('Error al duplicar evento:', error);
      toast('Error al duplicar el evento', 'error');
    }
  };

  /* ---- Scan confirm handler (supports single and bulk) ---- */

  const handleScanConfirm = async (scannedEvents: ScannedEvent[], file: File) => {
    try {
      let firstEventId: string | null = null;

      // Helper: extract HH:MM from various formats
      const cleanTime = (t?: string | null): string => {
        if (!t) return '';
        // If it's a full ISO datetime, extract just HH:MM
        const isoMatch = t.match(/T(\d{2}:\d{2})/);
        if (isoMatch) return isoMatch[1];
        // If it's already HH:MM or HH:MM:SS, take first 5 chars
        const timeMatch = t.match(/^(\d{2}:\d{2})/);
        if (timeMatch) return timeMatch[1];
        return '';
      };

      for (const scannedEvent of scannedEvents) {
        // Build details, include arrivalTimezone if present
        const details = { ...scannedEvent.details };
        if (scannedEvent.arrivalTimezone) {
          details.arrivalTimezone = scannedEvent.arrivalTimezone;
        }

        const eventData: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'> = {
          title: scannedEvent.title,
          type: scannedEvent.type,
          date: scannedEvent.date,
          startTime: cleanTime(scannedEvent.startTime),
          endTime: cleanTime(scannedEvent.endTime),
          location: scannedEvent.location || '',
          notes: scannedEvent.notes || '',
          cost: scannedEvent.cost || 0,
          currency: scannedEvent.currency || 'MXN',
          details,
          attachments: [],
          ...(scannedEvent.timezone ? { timezone: scannedEvent.timezone } : {}),
        };

        const eventId = await createEvent(eventData);
        if (!firstEventId) firstEventId = eventId;
      }

      // Upload the original file as attachment to the FIRST event
      if (firstEventId) {
        const firstType = scannedEvents[0].type;
        const category: DocumentCategory =
          EVENT_TYPE_TO_DOC_CATEGORY[firstType as keyof typeof EVENT_TYPE_TO_DOC_CATEGORY] || 'other';
        try {
          await uploadDocument(file, { eventId: firstEventId, category });
        } catch (uploadError) {
          console.error('Error uploading scanned document:', uploadError);
        }
      }

      setShowScanModal(false);
      const count = scannedEvents.length;
      toast(
        count === 1
          ? 'Evento creado desde documento escaneado'
          : `${count} eventos creados exitosamente`,
        'success'
      );
    } catch (error) {
      console.error('Error creating event(s) from scan:', error);
      toast('Error al crear los eventos', 'error');
      throw error;
    }
  };

  /* ---- Format day header ---- */

  const dayHeaderFormatted = useMemo(() => {
    return formatDateHeaderES(selectedDayStr);
  }, [selectedDayStr]);

  /* ---- Location-based background image ---- */

  /* ---- Day location (manual or auto) ---- */

  const dayLocationName = useMemo(() => {
    // 1. Check manual dayLocations from trip
    if (trip?.dayLocations?.[selectedDayStr]) {
      return trip.dayLocations[selectedDayStr];
    }
    // 2. Auto-detect from events
    for (const e of dayEvents) {
      const loc = e.location || e.details?.portName || '';
      if (loc.trim().length > 2) {
        let place = loc;
        if (place.includes('→')) place = place.split('→').pop()?.trim() || place;
        if (place.includes(',')) place = place.split(',')[0].trim();
        return place.trim();
      }
      const title = e.title || '';
      const titleMatch = title.match(/(?:en|in|→)\s+(.+)/i);
      if (titleMatch) return titleMatch[1].trim();
    }
    return '';
  }, [trip, dayEvents, selectedDayStr]);

  const [dayLocationBg, setDayLocationBg] = useState<string | null>(null);

  useEffect(() => {
    if (!dayLocationName || dayLocationName.length < 2) {
      setDayLocationBg(null);
      return;
    }
    // Extract just the city name
    let city = dayLocationName;
    if (city.includes(',')) city = city.split(',')[0].trim();
    city = city.replace(/[()]/g, '').trim();
    if (city.length < 2) { setDayLocationBg(null); return; }

    // Use Wikipedia API to get city image — try multiple variations
    const fullPlace = dayLocationName.trim().replace(/\s+/g, '_');
    const variations = [
      city,
      `${city}_(city)`,
      city.replace(/\s+/g, '_'),
      fullPlace,
      fullPlace.replace(',_', ',_'),
    ];

    const tryFetch = async () => {
      for (const variant of variations) {
        try {
          const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const img = data?.originalimage?.source || data?.thumbnail?.source;
          // Skip flags, coats of arms, SVGs — we want landscape photos
          if (img && !img.includes('.svg') && !img.toLowerCase().includes('flag') && !img.toLowerCase().includes('coat_of_arms') && !img.toLowerCase().includes('escudo')) {
            setDayLocationBg(img);
            return;
          }
        } catch { /* try next */ }
      }
      setDayLocationBg(null);
    };
    tryFetch();
  }, [dayLocationName]);

  const handleSetDayLocation = async (location: string) => {
    if (!trip) return;
    const dayLocations = { ...(trip.dayLocations || {}), [selectedDayStr]: location };
    try {
      await updateTrip({ dayLocations });
    } catch (err) {
      console.error('Error saving day location:', err);
    }
  };

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Agenda mode: fill all available space (respecting sidebar via negative margins)
  if (viewMode === 'agenda') {
    return (
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-extrabold text-gray-950">Calendario</h1>
            {/* Color legend */}
            <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(236,72,153,0.5)' }} />Vuelo</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(139,92,246,0.5)' }} />Hotel</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(234,179,8,0.5)' }} />Auto</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(34,197,94,0.5)' }} />Actividad</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(249,115,22,0.5)' }} />Restaurante</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(59,130,246,0.5)' }} />Transporte</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(125,211,252,0.5)' }} />Crucero</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(107,114,128,0.5)' }} />Otro</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowForm(false); setDefaultFormDate(''); setDefaultFormTime(''); setViewMode('timeline'); }}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-xs font-medium flex items-center gap-1.5"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Día</span>
            </button>
            <button
              className="p-2 rounded-lg bg-red-100 text-red-800 font-bold text-xs font-medium flex items-center gap-1.5"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Calendario</span>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-xs font-medium flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Todo</span>
            </button>
          </div>
        </div>
        {/* Agenda with padding on all sides */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-auto shadow-sm">
          <AgendaView
            events={events}
            onEdit={handleEdit}
            onCreateAt={(date, time) => {
              setDefaultFormDate(date);
              setDefaultFormTime(time);
              setShowForm(true);
            }}
            tripStartDate={trip?.startDate}
            tripEndDate={trip?.endDate}
            selectedDate={selectedDayStr}
            onSelectedDateChange={(dateStr) => navigateToDay(parseISO(dateStr))}
            calendarView={calendarView}
            onCalendarViewChange={setCalendarView}
          />
        </div>

        {/* Create form (inside agenda view) */}
        {showForm && (
          <EventForm
            defaultDate={defaultFormDate || selectedDayStr}
            defaultTime={defaultFormTime}
            tripStartDate={trip?.startDate}
            tripEndDate={trip?.endDate}
            onSubmit={handleCreate}
            onCancel={() => { setShowForm(false); setDefaultFormDate(''); setDefaultFormTime(''); }}
            loading={formLoading}
          />
        )}

        {/* Edit form (inside agenda view) */}
        {editingEvent && (
          <EventForm
            initialData={editingEvent}
            tripStartDate={trip?.startDate}
            tripEndDate={trip?.endDate}
            onSubmit={handleUpdate}
            onCancel={() => setEditingEvent(null)}
            loading={formLoading}
          />
        )}
      </div>
    );
  }

  return (
    <>
    {/* Location-based background photo — OUTSIDE main content stacking context */}
    {dayLocationBg && viewMode === 'timeline' && (
      <div
        className="pointer-events-none left-0 lg:left-[280px]"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        <img
          src={dayLocationBg}
          alt=""
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.45,
            filter: 'saturate(0.4)',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(240,244,255,0.5) 0%, rgba(232,238,255,0.4) 50%, rgba(237,233,254,0.5) 100%)',
          }}
        />
      </div>
    )}
    <div className="space-y-0 max-w-3xl mx-auto relative" style={{ zIndex: 1 }}>
      {/* View toggle */}
      <div className="flex items-center justify-end gap-1 mb-3">
        <button
          onClick={() => setShowAutoGenModal(true)}
          className="p-2 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 mr-auto"
          aria-label="Auto-generar eventos recurrentes"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Auto-generar</span>
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={classNames(
            'p-2 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5',
            viewMode === 'timeline' ? 'bg-red-100 text-red-800 font-bold' : 'text-gray-600 hover:bg-white/50 hover:text-black'
          )}
          aria-label="Vista por dia"
        >
          <List className="w-4 h-4" />
          <span className="hidden sm:inline">Día</span>
        </button>
        <button
          onClick={() => setViewMode('agenda')}
          className={classNames(
            'p-2 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5',
            (viewMode as string) === 'agenda' ? 'bg-red-100 text-red-800 font-bold' : 'text-gray-600 hover:bg-white/50 hover:text-black'
          )}
          aria-label="Vista calendario"
        >
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">Calendario</span>
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={classNames(
            'p-2 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5',
            viewMode === 'all' ? 'bg-red-100 text-red-800 font-bold' : 'text-gray-600 hover:bg-white/50 hover:text-black'
          )}
          aria-label="Vista completa del viaje"
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">Todo</span>
        </button>
      </div>

      {viewMode !== 'all' && (
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goPrevDay}
          disabled={!canGoPrev}
          className={classNames(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
            canGoPrev
              ? 'text-gray-900 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed',
          )}
          aria-label="Dia anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center" style={{ textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>
          <h1 className="text-xl font-extrabold text-black">
            Dia {dayNumber} <span className="text-gray-600 font-normal">de {totalDays}</span>
          </h1>
          <p className="text-gray-800 text-sm font-semibold">{dayHeaderFormatted}</p>
          {/* Editable day location */}
          <div className="mt-1 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              defaultValue={dayLocationName}
              key={selectedDayStr}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val !== dayLocationName) handleSetDayLocation(val);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="¿Dónde estás este día?"
              className="text-center text-xs font-semibold text-gray-700 bg-transparent border-none outline-none placeholder:text-gray-300 hover:text-black focus:text-black w-48 transition-colors"
            />
          </div>
        </div>

        <button
          onClick={goNextDay}
          disabled={!canGoNext}
          className={classNames(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
            canGoNext
              ? 'text-gray-900 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed',
          )}
          aria-label="Dia siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      )}

      {/* ─── VIEW: ALL (complete trip) ─── */}
      {viewMode === 'all' ? (
        <div className="space-y-6">
          {tripDays.map((day, dayIdx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayEvts = events
              .filter((e) => e.date === dayStr)
              .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            const dayStr2 = format(day, 'yyyy-MM-dd');
            const capitalizedLabel = formatDateHeaderES(dayStr2);

            return (
              <div key={dayStr}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {dayIdx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">{capitalizedLabel}</h3>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{dayEvts.length} eventos</span>
                </div>
                {dayEvts.length === 0 ? (
                  <p className="text-gray-300 text-sm pl-11 py-2">Sin eventos</p>
                ) : (
                  <div className="space-y-2 pl-11">
                    {dayEvts.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onEdit={() => handleEdit(event)}
                        onDelete={() => handleDelete(event.id)}
                        onDuplicate={() => handleDuplicate(event)}
                        eventDocuments={getDocumentsByEvent(event.id)}
                        onUploadDocument={makeUploadHandler(event.id, event.type)}
                        onDeleteDocument={handleDeleteDocument}
                        onAddPhoto={handleAddPhoto}
                        onDeletePhoto={handleDeletePhoto}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      ) : dayEvents.length === 0 ? (
        /* Empty state for the day */
        <div className="text-center py-16">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute w-24 h-24 bg-gray-50 rounded-full" />
            <div className="relative w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
              <CalendarDays className="w-10 h-10 text-blue-300" />
            </div>
          </div>
          <h3 className="text-gray-500 text-base font-medium mb-2">Sin eventos para este dia</h3>
          <p className="text-gray-300 text-sm max-w-xs mx-auto mb-6">
            Agrega vuelos, hoteles, actividades y mas
          </p>
          <div className="flex items-center gap-3 justify-center">
            <Button
              icon={Plus}
              onClick={() => setShowForm(true)}
            >
              Agregar evento
            </Button>
            <Button
              variant="secondary"
              icon={FileSearch}
              onClick={() => setShowScanModal(true)}
            >
              Escanear documento
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-5 top-4 bottom-16 w-[3px] rounded-full" style={{ backgroundColor: '#1e3a5f' }} />

          <div className="space-y-0">
            <AnimatePresence>
              {dayEvents.map((event, evIdx) => {
                // Timezone change pills
                let fromTz: string | undefined;
                let toTz: string | undefined;

                if (evIdx > 0) {
                  fromTz = getEffectiveOutgoingTimezone(dayEvents[evIdx - 1]);
                  toTz = getEffectiveIncomingTimezone(event);
                }

                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: evIdx * 0.05, duration: 0.3 }}
                  >
                    {/* Timezone change pill */}
                    {fromTz && toTz && fromTz !== toTz && (
                      <div className="flex items-center gap-2 py-2 pl-10 my-1">
                        <div className="flex-1 h-px bg-amber-500/30" />
                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-500/20">
                          {getTimezoneAbbr(fromTz, selectedDayStr)} {'→'} {getTimezoneAbbr(toTz, selectedDayStr)}
                          <span className="text-amber-700/60">
                            ({getTimezoneOffset(fromTz, toTz, selectedDayStr)})
                          </span>
                        </span>
                        <div className="flex-1 h-px bg-amber-500/30" />
                      </div>
                    )}

                    {/* Timeline dot + event card */}
                    <div className="relative flex items-start gap-3 py-2">
                      {/* Timeline dot */}
                      <div className="relative z-10 flex-shrink-0 w-10 flex justify-center pt-4">
                        <div className="w-3 h-3 rounded-full bg-white border-[3px]" style={{ borderColor: '#1e3a5f' }} />
                      </div>

                      {/* Event card */}
                      <div className="flex-1 min-w-0">
                        <EventCard
                          event={event}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          eventDocuments={getDocumentsByEvent(event.id)}
                          onUploadDocument={makeUploadHandler(event.id, event.type)}
                          onDeleteDocument={handleDeleteDocument}
                          onAddPhoto={handleAddPhoto}
                          onDeletePhoto={handleDeletePhoto}
                        />
                      </div>
                    </div>

                    {/* Post-event timezone pill (for flights) */}
                    {event.timezone && event.details?.arrivalTimezone && event.timezone !== event.details.arrivalTimezone && (
                      <div className="flex items-center gap-2 py-1.5 pl-10 my-1">
                        <div className="flex-1 h-px bg-amber-500/30" />
                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-500/20">
                          {getTimezoneAbbr(event.timezone, selectedDayStr)} {'→'} {getTimezoneAbbr(event.details.arrivalTimezone, selectedDayStr)}
                          <span className="text-amber-700/60">
                            ({getTimezoneOffset(event.timezone, event.details.arrivalTimezone, selectedDayStr)})
                          </span>
                        </span>
                        <div className="flex-1 h-px bg-amber-500/30" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Inline "Add event" button at the bottom of the timeline */}
          <div className="relative flex items-start gap-3 py-3 mt-1">
            <div className="relative z-10 flex-shrink-0 w-10 flex justify-center pt-2">
              <div className="w-3 h-3 rounded-full bg-white border-[3px]" style={{ borderColor: '#1e3a5f' }} />
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-black hover:bg-white/60 px-3 py-2 rounded-xl transition-colors group"
            >
              <Plus className="w-4 h-4 text-gray-500 group-hover:text-black transition-colors" />
              Agregar evento
            </button>
            <button
              onClick={() => setShowScanModal(true)}
              className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-black hover:bg-white/60 px-3 py-2 rounded-xl transition-colors group"
            >
              <FileSearch className="w-4 h-4 text-gray-500 group-hover:text-black transition-colors" />
              Escanear documento
            </button>
          </div>
        </div>
      )}

      {/* FAB for mobile */}
      {!showForm && !editingEvent && dayEvents.length > 0 && (
        <button
          onClick={() => setShowForm(true)}
          className={classNames(
            'fixed bottom-24 right-6 lg:bottom-8 lg:right-8',
            'w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl',
            'flex items-center justify-center shadow-lg shadow-blue-500/30',
            'hover:from-blue-400 hover:to-blue-500 active:scale-95 transition-all',
            'lg:hidden'
          )}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Modal - Create (pre-fill date with selected day) */}
      {showForm && (
        <EventForm
          defaultDate={defaultFormDate || selectedDayStr}
          defaultTime={defaultFormTime}
          tripStartDate={trip?.startDate}
          tripEndDate={trip?.endDate}
          onSubmit={handleCreate}
          onCancel={() => { setShowForm(false); setDefaultFormDate(''); setDefaultFormTime(''); }}
          loading={formLoading}
        />
      )}

      {/* Modal - Edit */}
      {editingEvent && (
        <EventForm
          initialData={editingEvent}
          tripStartDate={trip?.startDate}
          tripEndDate={trip?.endDate}
          onSubmit={handleUpdate}
          onCancel={() => setEditingEvent(null)}
          loading={formLoading}
        />
      )}

      {/* Modal - Scan Document */}
      <ScanDocumentModal
        open={showScanModal}
        onClose={() => setShowScanModal(false)}
        onConfirm={handleScanConfirm}
        defaultDate={selectedDayStr}
        tripYear={trip?.startDate ? parseInt(trip.startDate.substring(0, 4)) : undefined}
        travelerCount={trip?.travelerIds?.length || 1}
        tripStartDate={trip?.startDate}
        tripEndDate={trip?.endDate}
      />

      {/* Modal - Auto Generate */}
      <AutoGenerateModal
        open={showAutoGenModal}
        onClose={() => setShowAutoGenModal(false)}
        tripId={tripId}
      />
    </div>
    </>
  );
}
