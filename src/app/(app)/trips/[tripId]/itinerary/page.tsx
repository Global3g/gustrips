'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format, parseISO, eachDayOfInterval, addDays, subDays, isSameDay, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, Plane, List, Clock, Layers, FileSearch, MapPin, Sparkles, Footprints, AlertTriangle, StickyNote, Search, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const AgendaView = dynamic(() => import('@/components/trips/AgendaView'), { ssr: false });
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getClientStorage } from '@/lib/firebase/client';
import { useEvents } from '@/hooks/useEvents';
import { useTrip } from '@/hooks/useTrip';
import { useDocuments } from '@/hooks/useDocuments';
import { useExpenses } from '@/hooks/useExpenses';
import { useToast } from '@/context/ToastContext';
import EventCard from '@/components/trips/EventCard';
// Modal forms — only load on tap. Each pulls form helpers + framer-motion.
const EventForm = dynamic(() => import('@/components/trips/EventForm'), { ssr: false, loading: () => null });
const ScanDocumentModal = dynamic(() => import('@/components/trips/ScanDocumentModal'), { ssr: false, loading: () => null });
const AutoGenerateModal = dynamic(() => import('@/components/trips/AutoGenerateModal'), { ssr: false, loading: () => null });
import Button from '@/components/ui/Button';
import { classNames, getTimezoneAbbr, getTimezoneOffset, formatDateHeaderES } from '@/lib/utils/helpers';
import { ROUTES, EVENT_TYPE_TO_DOC_CATEGORY, EVENT_TYPES } from '@/config/constants';
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

/* ---- Event status (past / live / future) ---- */
type EventStatus = 'past' | 'live' | 'future';

function getEventStatus(event: TripEvent): EventStatus {
  if (!event.startTime || !event.date) return 'future';
  try {
    const now = new Date();
    const start = new Date(`${event.date}T${event.startTime}`);
    const end = event.endTime ? new Date(`${event.date}T${event.endTime}`) : start;
    if (Number.isNaN(start.getTime())) return 'future';
    if (now > end) return 'past';
    if (differenceInMinutes(start, now) <= 0) return 'live';
    return 'future';
  } catch {
    return 'future';
  }
}

function buildThreadGradient(events: TripEvent[]): string {
  if (events.length === 0) return '#1e3a5f';
  if (events.length === 1) return EVENT_TYPES[events[0].type].color;
  const stops = events.map((e, i) => {
    const pct = Math.round((i / (events.length - 1)) * 100);
    return `${EVENT_TYPES[e.type].color} ${pct}%`;
  });
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

/* ---- Travel time hint between consecutive events ---- */
type TravelHint = {
  gapMinutes: number;
  fromLocation: string;
  toLocation: string;
  tone: 'tight' | 'short' | 'comfortable';
};

function calculateTravelHint(prev: TripEvent, next: TripEvent): TravelHint | null {
  const skipTypes = new Set(['flight', 'transport', 'car_rental']);
  if (skipTypes.has(prev.type) || skipTypes.has(next.type)) return null;
  if (!prev.endTime || !next.startTime || !prev.date || !next.date) return null;
  if (!prev.location?.trim() || !next.location?.trim()) return null;

  const norm = (s: string) => s.trim().toLowerCase();
  if (norm(prev.location) === norm(next.location)) return null;

  try {
    const end = new Date(`${prev.date}T${prev.endTime}`);
    const start = new Date(`${next.date}T${next.startTime}`);
    const gap = Math.round((start.getTime() - end.getTime()) / 60000);
    if (gap < 5) return null;

    const tone: TravelHint['tone'] = gap < 15 ? 'tight' : gap < 60 ? 'short' : 'comfortable';
    return { gapMinutes: gap, fromLocation: prev.location.trim(), toLocation: next.location.trim(), tone };
  } catch {
    return null;
  }
}

function formatGap(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function eventMatchesSearch(ev: TripEvent, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (ev.title?.toLowerCase().includes(q)) return true;
  if (ev.location?.toLowerCase().includes(q)) return true;
  if (ev.notes?.toLowerCase().includes(q)) return true;
  if (ev.details) {
    for (const v of Object.values(ev.details)) {
      if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

function getWeatherInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Despejado' };
  if (code <= 3) return { emoji: '⛅', label: 'Parcialmente nublado' };
  if (code <= 48) return { emoji: '🌫️', label: 'Niebla' };
  if (code <= 57) return { emoji: '🌦️', label: 'Llovizna' };
  if (code <= 67) return { emoji: '🌧️', label: 'Lluvia' };
  if (code <= 77) return { emoji: '🌨️', label: 'Nieve' };
  if (code <= 82) return { emoji: '🌧️', label: 'Aguaceros' };
  if (code <= 86) return { emoji: '🌨️', label: 'Tormentas de nieve' };
  if (code <= 99) return { emoji: '⛈️', label: 'Tormenta' };
  return { emoji: '🌤️', label: 'Variable' };
}

type WeatherInfo = {
  code: number;
  tempMax: number;
  tempMin: number;
  emoji: string;
  label: string;
};

export default function ItineraryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tripId = params.tripId as string;

  const { trip, updateTrip } = useTrip(tripId);
  const { events, loading, createEvent, updateEvent, deleteEvent } = useEvents(tripId);

  const { expenses } = useExpenses(tripId);
  const expensesByEvent = useMemo(() => {
    const map: Record<string, typeof expenses> = {};
    for (const exp of expenses) {
      if (!exp.eventId) continue;
      (map[exp.eventId] ||= []).push(exp);
    }
    return map;
  }, [expenses]);
  const getExpensesByEvent = useCallback((eventId: string) => expensesByEvent[eventId] || [], [expensesByEvent]);
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
  const [viewMode, setViewMode] = useState<'timeline' | 'agenda' | 'all'>(() => {
    const v = searchParams.get('view');
    return v === 'timeline' || v === 'agenda' || v === 'all' ? v : 'timeline';
  });
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'full'>(() => {
    const c = searchParams.get('calView');
    return c === 'day' || c === 'week' || c === 'full' ? c : 'full';
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', viewMode);
    if (viewMode === 'agenda') {
      params.set('calView', calendarView);
    } else {
      params.delete('calView');
    }
    const next = `${pathname}?${params.toString()}`;
    const current = `${pathname}?${searchParams.toString()}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [viewMode, calendarView, pathname, router, searchParams]);
  const [defaultFormDate, setDefaultFormDate] = useState('');
  const [defaultFormTime, setDefaultFormTime] = useState('');

  /* ---- Day notes state ---- */
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  /* ---- Search state ---- */
  const [searchQuery, setSearchQuery] = useState('');

  /* ---- Keyboard shortcuts ---- */
  const viewModeRef = useRef(viewMode);
  const goPrevDayRef = useRef<() => void>(() => {});
  const goNextDayRef = useRef<() => void>(() => {});
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

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
    // Default to today if it falls within the trip range
    if (tripDays.length > 0) {
      const todayMatch = tripDays.find((d) => isSameDay(d, new Date()));
      if (todayMatch) return todayMatch;
      return tripDays[0];
    }
    return new Date();
  }, [searchParams, tripDays]);

  // Deep-link from /photos: when the URL has ?edit=<eventId>, open the
  // event editor for that event once its data is available, and clean the
  // query param so a refresh doesn't keep re-opening it.
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    if (events.length === 0) return;
    const target = events.find((e) => e.id === editId);
    if (!target) return;
    setEditingEvent(target);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, events]);

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

  useEffect(() => { goPrevDayRef.current = goPrevDay; });
  useEffect(() => { goNextDayRef.current = goNextDay; });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((active as HTMLElement)?.isContentEditable) return;

      switch (e.key) {
        case 'ArrowLeft':
          if (viewModeRef.current === 'timeline') {
            e.preventDefault();
            goPrevDayRef.current();
          }
          break;
        case 'ArrowRight':
          if (viewModeRef.current === 'timeline') {
            e.preventDefault();
            goNextDayRef.current();
          }
          break;
        case '1':
          e.preventDefault();
          setViewMode('timeline');
          break;
        case '2':
          e.preventDefault();
          setViewMode('agenda');
          break;
        case '3':
          e.preventDefault();
          setViewMode('all');
          break;
        case 'Escape':
          e.preventDefault();
          setShowForm(false);
          setShowScanModal(false);
          setShowAutoGenModal(false);
          break;
        case 'n':
          e.preventDefault();
          setShowForm(true);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ---- Trip completed/over flag — disables past-event mute on cards ---- */
  const tripCompleted = useMemo(() => {
    if (!trip) return false;
    if (trip.status === 'completed') return true;
    try {
      const end = parseISO(trip.endDate);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return end < todayStart;
    } catch {
      return false;
    }
  }, [trip]);

  /* ---- Events for selected day, sorted by startTime ---- */

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => e.date === selectedDayStr)
      .filter((e) => eventMatchesSearch(e, searchQuery))
      .sort((a, b) => {
        if (!a.startTime && !b.startTime) return 0;
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [events, selectedDayStr, searchQuery]);

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

  /* ---- Reorder handler (timeline drag-to-reorder) ---- */

  const handleReorderDay = useCallback(async (newOrder: TripEvent[]) => {
    // Strategy: collect all start/end times of the original order, then reassign them in the new order.
    // This preserves the ORIGINAL time slots but switches WHICH event is in each slot.
    if (newOrder.length !== dayEvents.length) return;
    if (newOrder.every((e, i) => e.id === dayEvents[i].id)) return; // no change

    const slots = dayEvents.map((e) => ({ startTime: e.startTime, endTime: e.endTime }));

    for (let i = 0; i < newOrder.length; i++) {
      const target = slots[i];
      const ev = newOrder[i];
      if (ev.startTime !== target.startTime || ev.endTime !== target.endTime) {
        try {
          await updateEvent(ev.id, { startTime: target.startTime, endTime: target.endTime });
        } catch (err) {
          console.error('Error reordenando evento', err);
          toast('Error al reordenar', 'error');
          return;
        }
      }
    }
    toast('Eventos reordenados', 'success');
  }, [dayEvents, updateEvent, toast]);

  /* ---- CRUD Handlers ---- */

  const handleCreate = async (data: Omit<TripEvent, 'id' | 'createdBy' | 'createdAt'>): Promise<string> => {
    setFormLoading(true);
    try {
      const eventId = await createEvent(data);
      setShowForm(false);
      toast('Evento creado correctamente', 'success');
      return eventId;
    } catch (error) {
      console.error('Error al crear evento:', error);
      toast('Error al crear el evento', 'error');
      throw error;
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

  /* ---- Weather for the selected day ---- */

  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWeather(null);

    (async () => {
      // Source 1: first event with coords
      let lat: number | null = null;
      let lon: number | null = null;
      const first = dayEvents.find(e => e.latitude !== undefined && e.longitude !== undefined);
      if (first) {
        lat = first.latitude!;
        lon = first.longitude!;
      } else {
        // Source 2: dayLocationName -> geocode (Source 3: trip.destination as fallback)
        const cityQuery = (dayLocationName || trip?.destination || '').trim();
        if (!cityQuery) return;
        try {
          const cacheKey = `geo:${cityQuery.toLowerCase()}`;
          const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
          if (cached) {
            const parsed = JSON.parse(cached);
            lat = parsed.lat;
            lon = parsed.lon;
          } else {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1`);
            if (!geoRes.ok) return;
            const geoData = await geoRes.json();
            const r = geoData?.results?.[0];
            if (!r) return;
            lat = r.latitude;
            lon = r.longitude;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(cacheKey, JSON.stringify({ lat, lon }));
            }
          }
        } catch {
          return;
        }
      }

      if (lat == null || lon == null) return;
      if (cancelled) return;

      // Fetch weather
      try {
        const cacheKey = `weather:${lat},${lon}:${selectedDayStr}`;
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
        let payload;
        if (cached) {
          payload = JSON.parse(cached);
        } else {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${selectedDayStr}&end_date=${selectedDayStr}`;
          const res = await fetch(url);
          if (!res.ok) return;
          payload = await res.json();
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(cacheKey, JSON.stringify(payload));
          }
        }

        if (cancelled) return;

        const code = payload?.daily?.weather_code?.[0];
        const tempMax = Math.round(payload?.daily?.temperature_2m_max?.[0]);
        const tempMin = Math.round(payload?.daily?.temperature_2m_min?.[0]);
        if (code === undefined || Number.isNaN(tempMax) || Number.isNaN(tempMin)) return;

        const { emoji, label } = getWeatherInfo(code);
        setWeather({ code, tempMax, tempMin, emoji, label });
      } catch {
        /* ignore */
      }
    })();

    return () => { cancelled = true; };
  }, [selectedDayStr, dayLocationName, trip?.destination, dayEvents]);

  const handleSetDayLocation = async (location: string) => {
    if (!trip) return;
    const dayLocations = { ...(trip.dayLocations || {}), [selectedDayStr]: location };
    try {
      await updateTrip({ dayLocations });
    } catch (err) {
      console.error('Error saving day location:', err);
    }
  };

  /* ---- Day notes (per-day text saved to trip.dayNotes) ---- */
  const dayNotes = (trip as any)?.dayNotes as Record<string, string> | undefined;

  useEffect(() => {
    setDraftNote(dayNotes?.[selectedDayStr] ?? '');
  }, [selectedDayStr, dayNotes]);

  const handleSaveNote = async () => {
    if (!trip) return;
    const trimmed = draftNote.trim();
    const next = { ...(dayNotes ?? {}) };
    if (trimmed) next[selectedDayStr] = trimmed;
    else delete next[selectedDayStr];
    setSavingNote(true);
    try {
      await updateTrip({ dayNotes: next } as any);
    } catch (err) {
      console.error('Error guardando nota del día:', err);
    } finally {
      setSavingNote(false);
    }
  };

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-6 space-y-3">
        <div className="space-y-2 mb-2">
          <div className="h-7 w-48 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/40 backdrop-blur-sm border border-gray-200/60 p-5 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-start gap-5">
              <div className="space-y-2">
                <div className="h-7 w-14 bg-gray-200 rounded" />
                <div className="h-4 w-10 bg-gray-100 rounded" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-5 w-2/3 bg-gray-200 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
              <div className="w-9 h-9 rounded-xl bg-gray-100" />
            </div>
          </div>
        ))}
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
        {/* Agenda with ambient decoration */}
        <div className="flex-1 relative overflow-auto p-2">
          {/* Ambient orbs behind the calendar card */}
          <div className="absolute top-12 -left-8 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }} />
          <div className="absolute top-1/2 -right-12 w-80 h-80 rounded-full blur-3xl pointer-events-none -translate-y-1/2" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)' }} />
          <div className="absolute bottom-8 left-1/4 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12), transparent 70%)' }} />
          <div className="relative">
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
        </div>

        {/* Create form (inside agenda view) */}
        {showForm && (
          <EventForm
            tripId={tripId}
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
            tripId={tripId}
            initialData={editingEvent}
            tripStartDate={trip?.startDate}
            tripEndDate={trip?.endDate}
            onSubmit={handleUpdate}
            onCancel={() => setEditingEvent(null)}
            onDelete={(eventId) => { handleDelete(eventId); setEditingEvent(null); }}
            onDuplicate={(ev) => { handleDuplicate(ev); setEditingEvent(null); }}
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
            opacity: 0.64,
            filter: 'saturate(1) brightness(1.1)',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(240,244,255,0.3) 0%, rgba(232,238,255,0.22) 50%, rgba(237,233,254,0.3) 100%)',
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
          {/* Weather chip */}
          {weather && (
            <div className="mt-2 flex items-center justify-center">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-700 shadow-sm"
                title={weather.label}
              >
                <span className="text-base leading-none">{weather.emoji}</span>
                <span className="tabular-nums">{weather.tempMin}°/{weather.tempMax}°</span>
              </span>
            </div>
          )}
          {/* Day notes (timeline only) */}
          {viewMode === 'timeline' && (
            <details className="mt-3 group">
              <summary className="text-[11px] text-gray-500 hover:text-gray-700 cursor-pointer flex items-center justify-center gap-1 select-none">
                <StickyNote className="w-3 h-3" />
                <span>Notas del día</span>
                {dayNotes?.[selectedDayStr] && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </summary>
              <div className="mt-2 max-w-xl mx-auto">
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  onBlur={handleSaveNote}
                  placeholder="Recordatorios, ideas, lo que pasó..."
                  rows={3}
                  className="w-full text-sm text-gray-700 bg-amber-50/60 border border-amber-200/40 rounded-xl px-3 py-2 placeholder:text-amber-700/40 outline-none focus:bg-amber-50 focus:border-amber-300 transition-colors resize-none"
                />
                {savingNote && (
                  <p className="text-[10px] text-gray-400 mt-1">Guardando...</p>
                )}
              </div>
            </details>
          )}
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

      {/* Search bar (timeline only) */}
      {viewMode === 'timeline' && (
        <div className="flex items-center gap-2 mb-4 max-w-3xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar eventos..."
              className="w-full pl-9 pr-9 py-2 text-sm bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-xl outline-none focus:border-blue-300 focus:bg-white transition-colors placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Limpiar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {dayEvents.length} encontrado{dayEvents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ─── VIEW: ALL (complete trip) ─── */}
      {viewMode === 'all' ? (
        <div className="relative">
          {/* Ambient decorative orbs */}
          <div className="absolute top-12 -left-16 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22), transparent 70%)' }} />
          <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.20), transparent 70%)' }} />
          <div className="absolute top-2/3 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.16), transparent 70%)' }} />
          <div className="absolute bottom-12 right-1/4 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.18), transparent 70%)' }} />
          <div className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.14), transparent 70%)' }} />

          {/* Subtle dot pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative space-y-6">
          {tripDays.map((day, dayIdx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayEvts = events
              .filter((e) => e.date === dayStr)
              .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            const dayStr2 = format(day, 'yyyy-MM-dd');
            const capitalizedLabel = formatDateHeaderES(dayStr2);
            const threadGradient = buildThreadGradient(dayEvts);

            return (
              <div key={dayStr} className="relative">
                <div className="flex items-center gap-3 mb-3 relative z-10">
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
                  <div className="relative">
                    {/* Vertical thread — gradient through event colors */}
                    <div
                      className="absolute left-[15px] top-2 bottom-2 w-[3px] rounded-full pointer-events-none"
                      style={{
                        background: threadGradient,
                        opacity: 0.55,
                        boxShadow: '0 0 14px rgba(255,255,255,0.4)',
                      }}
                    />
                    {/* Glow trail */}
                    <div
                      className="absolute left-[13px] top-2 bottom-2 w-[7px] rounded-full pointer-events-none blur-md"
                      style={{ background: threadGradient, opacity: 0.25 }}
                    />
                    <div className="space-y-2 pl-11 relative">
                      {dayEvts.map((event) => {
                        const dotColor = EVENT_TYPES[event.type].color;
                        const status = getEventStatus(event);
                        return (
                          <div key={event.id} className="relative">
                            {/* Timeline dot — colored by event type, status-aware */}
                            <div className="absolute left-[-29px] top-4 z-10 flex items-center justify-center w-3.5 h-3.5">
                              {status === 'live' && (
                                <span
                                  className="absolute inset-0 rounded-full animate-ping"
                                  style={{ background: dotColor, opacity: 0.55 }}
                                />
                              )}
                              <div
                                className={`relative rounded-full ${status === 'live' ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}
                                style={{
                                  background: status === 'future' ? 'white' : dotColor,
                                  border: `3px solid ${dotColor}`,
                                  boxShadow:
                                    status === 'live'
                                      ? `0 0 0 3px white, 0 0 16px ${dotColor}`
                                      : status === 'past'
                                      ? `0 0 0 2px white, 0 1px 4px rgba(0,0,0,0.08)`
                                      : `0 0 0 2px white, 0 0 8px ${dotColor}66`,
                                }}
                              />
                            </div>
                            <EventCard
                              event={event}
                              onEdit={() => handleEdit(event)}
                              onDelete={() => handleDelete(event.id)}
                              onDuplicate={() => handleDuplicate(event)}
                              eventDocuments={getDocumentsByEvent(event.id)}
                              eventExpenses={getExpensesByEvent(event.id)}
                              onUploadDocument={makeUploadHandler(event.id, event.type)}
                              onDeleteDocument={handleDeleteDocument}
                              onAddPhoto={handleAddPhoto}
                              onDeletePhoto={handleDeletePhoto}
                              tripCompleted={tripCompleted}
                              tripId={tripId}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
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
          {/* Timeline thread — gradient through event colors */}
          <div
            className="absolute left-[21px] top-4 bottom-16 w-[3px] rounded-full pointer-events-none"
            style={{
              background: buildThreadGradient(dayEvents),
              opacity: 0.55,
              boxShadow: '0 0 14px rgba(255,255,255,0.4)',
            }}
          />
          {/* Glow trail */}
          <div
            className="absolute left-[19px] top-4 bottom-16 w-[7px] rounded-full pointer-events-none blur-md"
            style={{
              background: buildThreadGradient(dayEvents),
              opacity: 0.25,
            }}
          />

          <Reorder.Group
            axis="y"
            values={dayEvents}
            onReorder={handleReorderDay}
            className="space-y-3"
          >
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
                  <Reorder.Item
                    key={event.id}
                    value={event}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: evIdx * 0.05, duration: 0.3 }}
                    whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', zIndex: 20 }}
                    className="relative"
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

                    {/* Travel time hint pill */}
                    {evIdx > 0 && (() => {
                      const hint = calculateTravelHint(dayEvents[evIdx - 1], event);
                      if (!hint) return null;
                      const HintIcon = hint.tone === 'tight' ? AlertTriangle : (hint.tone === 'short' ? Footprints : Clock);
                      const colorClass = hint.tone === 'tight'
                        ? 'text-red-700 bg-red-50 border-red-500/20'
                        : hint.tone === 'short'
                        ? 'text-blue-700 bg-blue-50 border-blue-500/20'
                        : 'text-gray-600 bg-gray-50 border-gray-300/30';
                      const lineClass = hint.tone === 'tight' ? 'bg-red-500/30' : hint.tone === 'short' ? 'bg-blue-500/30' : 'bg-gray-300/30';
                      const message = hint.tone === 'tight'
                        ? `Solo ${formatGap(hint.gapMinutes)} para ir a ${hint.toLocation}`
                        : hint.tone === 'short'
                        ? `${formatGap(hint.gapMinutes)} para llegar a ${hint.toLocation}`
                        : `${formatGap(hint.gapMinutes)} hasta ${hint.toLocation}`;
                      return (
                        <div className="flex items-center gap-2 py-1.5 pl-10 my-0.5">
                          <div className={classNames('flex-1 h-px', lineClass)} />
                          <span className={classNames('flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border', colorClass)} title={`Desde: ${hint.fromLocation}`}>
                            <HintIcon className="w-3 h-3" />
                            {message}
                          </span>
                          <div className={classNames('flex-1 h-px', lineClass)} />
                        </div>
                      );
                    })()}

                    {/* Timeline dot + event card */}
                    <div className="relative flex items-start gap-3 py-2">
                      {/* Timeline node — colored by event type, status-aware */}
                      <div className="relative z-10 flex-shrink-0 w-10 flex justify-center pt-4">
                        {(() => {
                          const dotColor = EVENT_TYPES[event.type].color;
                          const status = getEventStatus(event);
                          return (
                            <div className="relative">
                              {status === 'live' && (
                                <span
                                  className="absolute inset-0 rounded-full animate-ping"
                                  style={{ background: dotColor, opacity: 0.55 }}
                                />
                              )}
                              <div
                                className={classNames(
                                  'relative rounded-full transition-all duration-300',
                                  status === 'live' ? 'w-4 h-4' : 'w-3.5 h-3.5'
                                )}
                                style={{
                                  background:
                                    status === 'future' ? 'white' : dotColor,
                                  border: `3px solid ${dotColor}`,
                                  boxShadow:
                                    status === 'live'
                                      ? `0 0 0 3px white, 0 0 16px ${dotColor}`
                                      : status === 'past'
                                      ? `0 0 0 2px white, 0 1px 4px rgba(0,0,0,0.08)`
                                      : `0 0 0 2px white, 0 0 8px ${dotColor}66`,
                                }}
                              />
                            </div>
                          );
                        })()}
                      </div>

                      {/* Event card */}
                      <div className="flex-1 min-w-0">
                        <EventCard
                          event={event}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          eventDocuments={getDocumentsByEvent(event.id)}
                          eventExpenses={getExpensesByEvent(event.id)}
                          onUploadDocument={makeUploadHandler(event.id, event.type)}
                          onDeleteDocument={handleDeleteDocument}
                          onAddPhoto={handleAddPhoto}
                          onDeletePhoto={handleDeletePhoto}
                          tripCompleted={tripCompleted}
                          tripId={tripId}
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
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>

          {/* Inline "Add event" button at the bottom of the timeline */}
          <div className="relative flex items-start gap-3 py-3 mt-1">
            <div className="relative z-10 flex-shrink-0 w-10 flex justify-center pt-2">
              <div
                className="w-4 h-4 rounded-full bg-white border-[2px] border-dashed flex items-center justify-center text-gray-400"
                style={{ borderColor: '#9ca3af' }}
              >
                <Plus className="w-2.5 h-2.5" />
              </div>
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
          tripId={tripId}
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
          tripId={tripId}
          initialData={editingEvent}
          tripStartDate={trip?.startDate}
          tripEndDate={trip?.endDate}
          onSubmit={handleUpdate}
          onCancel={() => setEditingEvent(null)}
          onDelete={(eventId) => { handleDelete(eventId); setEditingEvent(null); }}
          onDuplicate={(ev) => { handleDuplicate(ev); setEditingEvent(null); }}
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
