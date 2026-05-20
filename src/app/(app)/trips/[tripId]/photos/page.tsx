'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Camera,
  Upload,
  X,
  Trash2,
  Loader2,
  ImagePlus,
  Pencil,
  Check,
  Download,
  Share2,
  MapPin,
  Sparkles,
  CheckSquare,
  ArrowUpDown,
  LayoutGrid,
  Play,
  Film,
  BookOpen,
  Eye,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
// Trip/events/album come from the shared TripDataProvider mounted in the
// layout. Subscribing here would double-open the onSnapshot listeners.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
  useAlbumFromContext as useAlbum,
} from '@/context/TripDataContext';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/context/ToastContext';
const TripInsights = dynamic(() => import('@/components/trips/TripInsights'), { ssr: false, loading: () => null });
const PhotoLightbox = dynamic(() => import('@/components/trips/photos/PhotoLightbox'), { ssr: false });
const ScrollScrubber = dynamic(() => import('@/components/trips/photos/ScrollScrubber'), { ssr: false, loading: () => null });
const SortablePhoto = dynamic(() => import('@/components/trips/photos/SortablePhoto'), { ssr: false });
const MobileScrollHelper = dynamic(
  () => import('@/components/trips/photos/MobileScrollHelper'),
  { ssr: false },
);
import LazySection from '@/components/trips/photos/LazySection';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { EmptyState } from '@/components/EmptyState';
import { formatDateES, classNames } from '@/lib/utils/helpers';
import { sharePhoto } from '@/lib/sharePhoto';
import { EVENT_TYPES } from '@/config/constants';
import type { AlbumPhoto } from '@/types';

/* ─── Helpers for event name fields ─────────────── */
function getEventNameFieldKey(eventType: string): string | null {
  switch (eventType) {
    case 'restaurant': return 'restaurantName';
    case 'hotel': return 'hotelName';
    case 'activity': return 'activityName';
    case 'car_rental': return 'rentalCompany';
    case 'cruise': return 'portName';
    case 'flight': return 'airline';
    case 'transport': return 'transportMode';
    default: return null;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function getEventName(event: any): string | undefined {
  if (!event || !event.details) return undefined;
  switch (event.type) {
    case 'restaurant': return event.details.restaurantName;
    case 'hotel': return event.details.hotelName;
    case 'activity': return event.details.activityName;
    case 'car_rental': return event.details.rentalCompany;
    case 'cruise': return event.details.portName;
    case 'flight':
      if (event.details.airline) return event.details.airline;
      if (event.details.origin && event.details.destination)
        return `${event.details.origin} → ${event.details.destination}`;
      return undefined;
    case 'transport': return event.details.transportMode;
    default: return undefined;
  }
}

export default function PhotosPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip } = useTrip();
  const { events, updateEvent, loading: eventsLoading } = useEvents();
  const { albumPhotos: rawAlbumPhotos, addPhoto, deletePhoto, updateCaption, updatePhoto, migrateThumbnails, markAllOptimized } = useAlbum();
  const albumPhotos = useMemo(
    () => rawAlbumPhotos.filter((p) => !p.deletedAt),
    [rawAlbumPhotos],
  );
  const { toast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateProgress, setMigrateProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Order in which the day → event groups render. Persisted per-trip in
  // localStorage so the user's preference survives reloads.
  type SortMode = 'chronological' | 'reverse' | 'most-photos' | 'unassigned-first';
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'chronological';
    try {
      const stored = window.localStorage.getItem(`gustrips:photos:sort:${tripId}`);
      if (
        stored === 'chronological' ||
        stored === 'reverse' ||
        stored === 'most-photos' ||
        stored === 'unassigned-first'
      ) {
        return stored;
      }
    } catch {/* ignore */}
    return 'chronological';
  });
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`gustrips:photos:sort:${tripId}`, sortMode);
    } catch {/* ignore */}
  }, [sortMode, tripId]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [modalCity, setModalCity] = useState('');
  const [modalCountry, setModalCountry] = useState('');
  const [modalEventName, setModalEventName] = useState('');
  const [modalEventType, setModalEventType] = useState('');
  const [editingPhoto, setEditingPhoto] = useState<AlbumPhoto | null>(null);
  const [editPhotoCaption, setEditPhotoCaption] = useState('');
  const [editPhotoDate, setEditPhotoDate] = useState('');
  const [editPhotoEventId, setEditPhotoEventId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Pull-to-refresh ──
     v1: brief delay then full reload. TODO: replace with hook re-fetch. */
  const { pullDistance, isRefreshing } = usePullToRefresh(async () => {
    await new Promise((r) => setTimeout(r, 600));
    window.location.reload();
  });

  /* ── Feature-detect Web Share API once on mount ── */
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  /* ── Pre-fill event fields ── */
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

  // Build a fast O(1) lookup from eventId → event once. Declared BEFORE
  // allPhotos so the merge below can use it instead of events.find() inside
  // a loop. With 300 photos × 50 events that previously cost ~15k array
  // scans per render.
  const eventsById = useMemo(() => {
    const m = new Map<string, typeof events[number]>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  /* ── All photos: album + event photos deduplicated ── */
  const allPhotos = useMemo(() => {
    const photos: (AlbumPhoto & { source: 'album' | 'event'; eventTitle?: string })[] = [];
    const albumUrls = new Set<string>();
    for (const p of albumPhotos) {
      albumUrls.add(p.url);
      const linkedEvent = p.eventId ? eventsById.get(p.eventId) : undefined;
      photos.push({ ...p, source: 'album', eventTitle: linkedEvent?.title });
    }
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
    return photos.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.uploadedAt.localeCompare(b.uploadedAt);
    });
  }, [albumPhotos, events, eventsById]);

  /* ── Group photos by day → event ── */
  const photoGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      date: string;
      eventName?: string;
      eventType?: string;
      eventCity?: string;
      eventCountry?: string;
      eventId?: string;
      eventColor?: string;
      eventStartTime?: string;
      photos: typeof allPhotos;
    }> = [];

    const byDate: Record<string, typeof allPhotos> = {};
    for (const photo of allPhotos) {
      if (!byDate[photo.date]) byDate[photo.date] = [];
      byDate[photo.date].push(photo);
    }

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
      for (const [eventId, eventPhotos] of Object.entries(byEvent)) {
        const event = eventsById.get(eventId);
        const cfg = event ? EVENT_TYPES[event.type] : undefined;
        // Sort photos by their position in event.photos[] (drag-and-drop ordering source of truth)
        const orderMap = new Map<string, number>();
        (event?.photos ?? []).forEach((url, idx) => orderMap.set(url, idx));
        const sortedEventPhotos = [...eventPhotos].sort((a, b) => {
          const ai = orderMap.has(a.url) ? (orderMap.get(a.url) as number) : Number.MAX_SAFE_INTEGER;
          const bi = orderMap.has(b.url) ? (orderMap.get(b.url) as number) : Number.MAX_SAFE_INTEGER;
          if (ai !== bi) return ai - bi;
          return a.uploadedAt.localeCompare(b.uploadedAt);
        });
        groups.push({
          key: `${date}-${eventId}`,
          date,
          eventName: getEventName(event),
          eventType: event?.type,
          eventCity: event?.city,
          eventCountry: event?.country,
          eventId,
          eventColor: cfg?.color,
          eventStartTime: event?.startTime,
          photos: sortedEventPhotos,
        });
      }
      if (noEvent.length > 0) {
        groups.push({ key: `${date}-no-event`, date, photos: noEvent });
      }
    }
    // User-chosen ordering. Default is chronological (oldest → newest)
    // following the itinerary; reverse flips dates and event times; the
    // photo-count and unassigned-first modes are aliases over the same
    // group set with a different primary key.
    const byChronological = (a: typeof groups[number], b: typeof groups[number]): number => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const aHasEvent = !!a.eventId;
      const bHasEvent = !!b.eventId;
      if (aHasEvent && !bHasEvent) return -1;
      if (!aHasEvent && bHasEvent) return 1;
      const aTime = a.eventStartTime || '99:99';
      const bTime = b.eventStartTime || '99:99';
      return aTime.localeCompare(bTime);
    };
    if (sortMode === 'reverse') {
      return groups.sort((a, b) => -byChronological(a, b));
    }
    if (sortMode === 'most-photos') {
      return groups.sort((a, b) => {
        if (b.photos.length !== a.photos.length) {
          return b.photos.length - a.photos.length;
        }
        return byChronological(a, b);
      });
    }
    if (sortMode === 'unassigned-first') {
      return groups.sort((a, b) => {
        const aUn = !a.eventId ? 0 : 1;
        const bUn = !b.eventId ? 0 : 1;
        if (aUn !== bUn) return aUn - bUn;
        return byChronological(a, b);
      });
    }
    return groups.sort(byChronological);
  }, [allPhotos, eventsById, sortMode]);

  /* ── Trip days for numbering ── */
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

  const allTripDays = useMemo(() => {
    if (!trip) return [];
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
    } catch {
      return [];
    }
  }, [trip]);

  /* ── Stats ──
     Use the eventsById map (already built once above) so this is O(N)
     instead of O(N×E). With 300 photos × 50 events that's ~15k array
     scans on the previous shape — each render. */
  const stats = useMemo(() => {
    const dates = new Set<string>();
    const cities = new Set<string>();
    for (const p of allPhotos) {
      if (p.date) dates.add(p.date);
      if (p.eventId) {
        const ev = eventsById.get(p.eventId);
        if (ev?.city) cities.add(ev.city);
      }
    }
    return { total: allPhotos.length, days: dates.size, cities: cities.size };
  }, [allPhotos, eventsById]);

  /* ── Per-day photo counts for distribution chart ── */
  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPhotos) {
      counts.set(p.date, (counts.get(p.date) || 0) + 1);
    }
    return allTripDays.map((d) => ({ date: d, count: counts.get(d) || 0 }));
  }, [allPhotos, allTripDays]);

  const maxDayCount = useMemo(() => Math.max(1, ...dayCounts.map((d) => d.count)), [dayCounts]);

  /* ── Flat photo list for lightbox ──
     Alias for clarity; no transformation needed so we avoid the useMemo
     overhead. allPhotos is already stable across renders thanks to its
     own memo. */
  const flatPhotos = allPhotos;

  /* ── Auto-open the file picker when navigated with ?upload=1 ── */
  useEffect(() => {
    if (searchParams.get('upload') !== '1') return;
    const t = setTimeout(() => fileInputRef.current?.click(), 220);
    // Strip the param so re-renders / back nav don't re-trigger
    router.replace(`/trips/${tripId}/photos`, { scroll: false });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Upload handlers ── */
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;
    setPendingFiles(fileArray);
    setSelectedEventId('');
    setModalCity('');
    setModalCountry('');
    setModalEventName('');
    setModalEventType('');
    setShowLinkModal(true);
  }, []);

  const uploadFiles = useCallback(
    async (
      fileArray: File[],
      eventId: string,
      city?: string,
      country?: string,
      eventName?: string,
      eventType?: string,
    ) => {
      setUploading(true);
      const today = selectedDate;
      let successCount = 0;
      const newUrls: string[] = [];
      try {
        // Upload each photo to the album, track URLs
        for (const file of fileArray) {
          try {
            const photo = await addPhoto(file, today, undefined, eventId || undefined);
            if (eventId) newUrls.push(photo.url);
            successCount++;
          } catch (err) {
            console.error('Error uploading photo:', err);
            toast('Error al subir foto', 'error');
          }
        }

        // Batch update the event ONCE with all new photo URLs + meta.
        // Previously this ran inside the upload loop, where the stale
        // event.photos closure caused every iteration to overwrite the
        // last — only the final photo survived.
        if (eventId && newUrls.length > 0) {
          try {
            const event = events.find((e) => e.id === eventId);
            const currentPhotos = event?.photos ?? [];
            const updates: any = { photos: [...currentPhotos, ...newUrls] };
            if (city && city !== event?.city) updates.city = city;
            if (country && country !== event?.country) updates.country = country;
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
            console.error('Error vinculando fotos al evento:', linkErr);
          }
        }

        if (successCount > 0) {
          const linkedNote = eventId ? ' y vinculada' + (successCount === 1 ? '' : 's') + ' al evento' : '';
          toast(
            successCount === 1
              ? `Foto agregada al álbum${linkedNote}`
              : `${successCount} fotos agregadas al álbum${linkedNote}`,
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

  /* ── Drag & drop ── */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
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

  /* ── Delete ── */
  const handleDelete = useCallback(
    async (photo: typeof flatPhotos[number]) => {
      setDeleting(photo.url);
      try {
        const linkedEvents = events.filter((e) => e.photos?.includes(photo.url));
        for (const event of linkedEvents) {
          try {
            const updatedPhotos = (event.photos ?? []).filter((p) => p !== photo.url);
            await updateEvent(event.id, { photos: updatedPhotos });
          } catch {
            // Non-critical
          }
        }
        if (photo.source === 'album') await deletePhoto(photo);
        toast('Foto eliminada', 'success');
        if (lightboxIndex !== null && flatPhotos[lightboxIndex]?.url === photo.url) {
          const newLen = flatPhotos.length - 1;
          if (newLen <= 0) setLightboxIndex(null);
          else if (lightboxIndex >= newLen) setLightboxIndex(newLen - 1);
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

  /* ── Bulk selection ── */
  const togglePhotoSelection = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedUrls(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedUrls(new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUrls(new Set());
  }, []);

  const handleBulkDownload = useCallback(async () => {
    if (selectedUrls.size === 0) return;
    setBulkBusy(true);
    try {
      const urls = [...selectedUrls];
      const photos = urls
        .map((u) => allPhotos.find((p) => p.url === u))
        .filter((p): p is (typeof allPhotos)[number] => Boolean(p));
      toast(`Descargando ${photos.length} foto${photos.length !== 1 ? 's' : ''}…`, 'success');
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        try {
          const w = window.open(p.fullUrl || p.url, '_blank', 'noopener,noreferrer');
          // Some browsers may block — best effort
          if (!w) {
            const link = document.createElement('a');
            link.href = p.fullUrl || p.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        } catch (err) {
          console.error('Error opening photo:', err);
        }
        if (i < photos.length - 1) {
          await new Promise((res) => setTimeout(res, 350));
        }
      }
    } finally {
      setBulkBusy(false);
    }
  }, [selectedUrls, allPhotos, toast]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedUrls.size === 0) return;
    if (!confirm(`¿Borrar ${selectedUrls.size} foto${selectedUrls.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
    setBulkBusy(true);
    const urls = [...selectedUrls];
    let okCount = 0;
    let failCount = 0;
    try {
      for (const url of urls) {
        const photo = allPhotos.find((p) => p.url === url);
        if (!photo) {
          failCount++;
          continue;
        }
        try {
          await handleDelete(photo);
          okCount++;
        } catch {
          failCount++;
        }
      }
      if (failCount === 0) {
        toast(`${okCount} foto${okCount !== 1 ? 's eliminadas' : ' eliminada'}`, 'success');
      } else {
        toast(`${okCount} eliminadas, ${failCount} fallaron`, 'error');
      }
    } finally {
      setBulkBusy(false);
      setSelectionMode(false);
      setSelectedUrls(new Set());
    }
  }, [selectedUrls, allPhotos, handleDelete, toast]);

  /* ── Caption ── */
  const saveCaption = useCallback(
    async (photo: typeof flatPhotos[number]) => {
      if (photo.source !== 'album') return;
      try {
        await updateCaption(photo, captionText);
        toast('Leyenda actualizada', 'success');
      } catch (err) {
        console.error('Error updating caption:', err);
        toast('No se pudo actualizar la leyenda', 'error');
      }
      setEditingCaption(null);
      setCaptionText('');
    },
    [updateCaption, captionText, toast],
  );

  /* ── Download ── */
  const downloadPhoto = useCallback(
    (photo: typeof flatPhotos[number]) => {
      try {
        const link = document.createElement('a');
        // Prefer the full-quality URL when available so downloads keep original resolution
        link.href = photo.fullUrl || photo.url;
        link.download = `gustrips_${photo.date || 'photo'}_${Date.now()}.jpg`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('Descargando foto…', 'success');
      } catch (err) {
        console.error('Error downloading photo:', err);
        toast('Error al descargar foto', 'error');
      }
    },
    [toast],
  );

  /* ── Edit photo modal ── */
  const openEditPhotoModal = useCallback((photo: typeof flatPhotos[number]) => {
    if (photo.source !== 'album') return;
    setEditingPhoto(photo);
    setEditPhotoCaption(photo.caption || '');
    setEditPhotoDate(photo.date || '');
    setEditPhotoEventId(photo.eventId || '');
  }, []);

  const savePhotoEdits = useCallback(async () => {
    if (!editingPhoto) return;
    try {
      const updates: Partial<AlbumPhoto> = {
        caption: editPhotoCaption,
        date: editPhotoDate,
        eventId: editPhotoEventId || undefined,
      };
      await updatePhoto(editingPhoto, updates);
      toast('Foto actualizada', 'success');
      setEditingPhoto(null);
      setEditPhotoCaption('');
      setEditPhotoDate('');
      setEditPhotoEventId('');
    } catch (err) {
      console.error('Error updating photo:', err);
      toast('Error al actualizar foto', 'error');
    }
  }, [editingPhoto, editPhotoCaption, editPhotoDate, editPhotoEventId, updatePhoto, toast]);

  /* ── Drag-and-drop reorder within an event group ──
     - PointerSensor distance:8 → click within 8px = open lightbox,
       beyond that = start drag.
     - TouchSensor delay:250 → tap = open, long-press = drag. */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleReorder = useCallback(
    async (eventId: string, currentUrls: string[], activeUrl: string, overUrl: string) => {
      if (activeUrl === overUrl) return;
      const oldIndex = currentUrls.indexOf(activeUrl);
      const newIndex = currentUrls.indexOf(overUrl);
      if (oldIndex < 0 || newIndex < 0) return;
      const newUrls = arrayMove(currentUrls, oldIndex, newIndex);
      try {
        await updateEvent(eventId, { photos: newUrls });
      } catch (err) {
        console.error('Error reordering photos:', err);
        toast('Error al reordenar', 'error');
      }
    },
    [updateEvent, toast],
  );

  /* ── Migrate legacy thumbnails (1200px → 600px) for the gallery ── */
  const handleMigrate = useCallback(async () => {
    if (migrating) return;
    setMigrating(true);
    setMigrateProgress({ done: 0, total: albumPhotos.filter((p) => !p.optimized).length });
    try {
      const result = await migrateThumbnails((done, total) => setMigrateProgress({ done, total }));

      // Apply the URL remapping to event.photos[] arrays so the linked events
      // keep referencing valid (optimized) thumbnails.
      if (Object.keys(result.urlMap).length > 0) {
        for (const ev of events) {
          if (!ev.photos || ev.photos.length === 0) continue;
          const newPhotos = ev.photos.map((u) => result.urlMap[u] || u);
          if (newPhotos.some((p, i) => p !== ev.photos![i])) {
            try {
              await updateEvent(ev.id, { photos: newPhotos });
            } catch (err) {
              console.error('Could not update event photos URLs:', err);
            }
          }
        }
      }

      const summary =
        result.failed > 0
          ? `Optimizadas ${result.migrated} fotos · ${result.failed} fallaron`
          : `Optimizadas ${result.migrated} fotos`;
      toast(summary, result.failed > 0 ? 'error' : 'success');
    } catch (err) {
      console.error('Migration error:', err);
      toast('Error al optimizar fotos', 'error');
    } finally {
      setMigrating(false);
      setMigrateProgress(null);
    }
  }, [migrating, migrateThumbnails, events, updateEvent, toast, albumPhotos]);

  const handleMarkAllOptimized = useCallback(async () => {
    if (migrating) return;
    setMigrating(true);
    try {
      const n = await markAllOptimized();
      toast(`${n} fotos marcadas como optimizadas`, 'success');
    } catch (err) {
      console.error('markAllOptimized failed:', err);
      toast('No pude marcar las fotos. Intenta otra vez.', 'error');
    } finally {
      setMigrating(false);
    }
  }, [migrating, markAllOptimized, toast]);

  const photosToOptimize = useMemo(
    () => albumPhotos.filter((p) => !p.optimized).length,
    [albumPhotos],
  );

  /* ── Lightbox nav ── */
  const openLightbox = useCallback(
    (photo: typeof flatPhotos[number]) => {
      const idx = flatPhotos.findIndex((p) => p.url === photo.url);
      if (idx >= 0) setLightboxIndex(idx);
    },
    [flatPhotos],
  );
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  return (
    <div className="max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <MobileScrollHelper />
      {/* ─── Dark glass stage ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
        {/* Visual layer.
            Heavy decoration kept to ~2 blur layers + a low-count particle
            canvas. Earlier this had 4× blur-3xl orbs stacked behind a
            32-particle animated canvas — 7 blur layers when you counted the
            trip layout's 3 background orbs, all repainting during the photo
            grid mount/scroll. Cut to the essentials so the GPU has budget
            for thumbnail decoding. */}
        {/* Decoración eliminada — el canvas Particles + orbs blur eran el
            cuello de scroll. El stage queda en el degradado dark del
            container y suficiente. */}

        {/* Content */}
        <div className="relative z-10 p-5 sm:p-7 space-y-5">
          {/* ─── Hero ─── */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-amber-300/30"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))',
                  boxShadow: '0 0 20px rgba(245,158,11,0.2)',
                }}
              >
                <Camera className="w-6 h-6 text-amber-200" />
              </div>
              <div>
                <h1 className="text-white text-xl sm:text-2xl font-black tracking-tight" style={{ textShadow: '0 0 24px rgba(255,255,255,0.12)' }}>
                  Álbum de fotos
                </h1>
                <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 text-white/55 text-[12px] flex-wrap">
                  <span>
                    <span className="text-white font-bold tabular-nums">{stats.total}</span> foto{stats.total !== 1 ? 's' : ''}
                  </span>
                  {stats.days > 0 && (
                    <>
                      <span className="text-white/25">·</span>
                      <span>
                        <span className="text-white font-bold tabular-nums">{stats.days}</span> día{stats.days !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  {stats.cities > 0 && (
                    <>
                      <span className="text-white/25">·</span>
                      <span>
                        <span className="text-white font-bold tabular-nums">{stats.cities}</span> {stats.cities !== 1 ? 'lugares' : 'lugar'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {stats.total > 0 && (
                <button
                  type="button"
                  onClick={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
                  className={classNames(
                    'inline-flex items-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all',
                    selectionMode
                      ? 'bg-amber-300/15 border-amber-300/40 text-amber-100 hover:bg-amber-300/20'
                      : 'bg-white/[0.05] border-white/[0.12] text-white/80 hover:text-white hover:border-white/25 hover:bg-white/[0.1]',
                  )}
                >
                  {selectionMode ? (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cancelar</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Seleccionar</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed group flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                <span className="hidden sm:inline">Agregar fotos</span>
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
                />
                <span className="relative z-10 sm:hidden">Subir</span>
              </button>
            </div>
          </div>

          {/* ─── Optimize legacy thumbnails ─── */}
          {photosToOptimize > 0 && (
            <div className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.08] backdrop-blur-sm px-4 py-3 flex items-center gap-3">
              <span className="text-base leading-none">⚡</span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-100 text-sm font-bold">
                  {migrating
                    ? `Optimizando ${migrateProgress?.done ?? 0} de ${migrateProgress?.total ?? photosToOptimize}…`
                    : `Acelera la galería: ${photosToOptimize} foto${photosToOptimize !== 1 ? 's' : ''} por optimizar`}
                </p>
                <p className="text-amber-200/75 text-[11px] mt-0.5">
                  Re-comprime los thumbnails antiguos a 600px (la versión completa para el lightbox no cambia).
                </p>
                {migrating && migrateProgress && (
                  <div className="mt-2 h-1.5 rounded-full bg-amber-100/15 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-amber-300"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(migrateProgress.done / Math.max(migrateProgress.total, 1)) * 100}%`,
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={migrating}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-300 hover:bg-amber-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {migrating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>⚡ Optimizar</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleMarkAllOptimized}
                  disabled={migrating}
                  className="text-[10px] font-semibold text-amber-200/80 hover:text-amber-100 underline-offset-2 hover:underline disabled:opacity-50"
                  title="Si las fotos ya se ven bien, marca todas como listas sin re-procesar"
                >
                  Solo marcar como listas
                </button>
              </div>
            </div>
          )}

          {/* ─── Day distribution mini chart ─── */}
          {allTripDays.length > 1 && stats.total > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
              <div className="flex items-baseline justify-between mb-2.5">
                <div className="text-white/85 text-sm font-bold">Fotos por día</div>
                <div className="text-white/40 text-[11px]">tap día para enfocar</div>
              </div>
              <div className="flex items-end gap-1 h-16">
                {dayCounts.map((d, i) => {
                  const heightPct = (d.count / maxDayCount) * 100;
                  const dayNum = tripDays[d.date] || i + 1;
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center gap-1 group"
                      title={`Día ${dayNum} · ${d.count} foto${d.count !== 1 ? 's' : ''}`}
                    >
                      <div className="flex-1 w-full flex items-end">
                        <motion.div
                          className="w-full rounded-t-md"
                          style={{
                            background:
                              d.count > 0
                                ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
                                : 'rgba(255,255,255,0.06)',
                            minHeight: d.count > 0 ? '3px' : '2px',
                            boxShadow: d.count > 0 ? '0 0 6px rgba(245,158,11,0.3)' : 'none',
                          }}
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct || 4}%` }}
                          transition={{ duration: 0.6, delay: i * 0.02 }}
                        />
                      </div>
                      <div className="text-[9px] font-bold tabular-nums leading-none text-white/35 group-hover:text-white/65">
                        {dayNum}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Drop zone (compact) ─── */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={classNames(
              'relative rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all backdrop-blur-sm',
              dragOver
                ? 'border-amber-300/70 bg-amber-300/10 scale-[1.01] shadow-[0_0_32px_rgba(245,158,11,0.25)]'
                : 'border-white/15 bg-white/[0.03] hover:border-amber-300/40 hover:bg-white/[0.05]',
            )}
          >
            <div className="flex items-center justify-center gap-3">
              <div
                className={classNames(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                  dragOver ? 'bg-amber-300/25 text-amber-100' : 'bg-white/[0.06] text-white/55',
                )}
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <p className={classNames('text-sm font-bold', dragOver ? 'text-amber-100' : 'text-white/85')}>
                  {uploading ? 'Subiendo…' : dragOver ? '¡Suéltalas!' : 'Arrastra fotos o tap para seleccionar'}
                </p>
                <p className="text-white/40 text-[11px] mt-0.5">
                  Se comprimen automáticamente (max 1200px, JPEG 80%)
                </p>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />

          {/* ─── Photo grid ─── */}
          {eventsLoading && stats.total === 0 ? (
            <div className="space-y-6">
              {[0, 1].map((groupIdx) => (
                <div key={groupIdx}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] animate-pulse" />
                    <div className="h-4 w-44 bg-white/[0.06] rounded-lg animate-pulse" />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="aspect-square bg-white/[0.04] rounded-2xl animate-pulse"
                        style={{ animationDelay: `${groupIdx * 120 + i * 60}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : stats.total === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm">
              <EmptyState
                variant="photos"
                title="Aún no hay fotos"
                description="Sube fotos para documentar los mejores momentos de tu viaje"
                action={{
                  label: 'Subir primera foto',
                  onClick: () => fileInputRef.current?.click(),
                }}
              />
            </div>
          ) : (
            <div className="space-y-7">
              {/* Sort filter — sticky at the top of the photo content so the
                  4 outputs (Slideshow / Collage / Reel / Photo book) stay
                  reachable while the user scrolls through long photo lists. */}
              <div className="sticky top-0 z-30 -mx-5 sm:-mx-7 px-5 sm:px-7 py-3 border-b border-white/[0.08] flex items-center justify-between gap-3 flex-wrap" style={{ background: '#0d1b2e' }}>
                <p className="text-white/55 text-xs font-medium">
                  {photoGroups.length} {photoGroups.length === 1 ? 'grupo' : 'grupos'} · {stats.total} {stats.total === 1 ? 'foto' : 'fotos'}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => router.push(`/trips/${tripId}/photos/review`)}
                    disabled={allPhotos.length < 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-400/15 to-fuchsia-500/15 hover:from-violet-400/25 hover:to-fuchsia-500/25 border border-violet-300/30 text-violet-100 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Revisar
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/trips/${tripId}/photos/show`)}
                    disabled={allPhotos.length < 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-400/15 to-teal-500/15 hover:from-emerald-400/25 hover:to-teal-500/25 border border-emerald-300/30 text-emerald-100 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Slideshow
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/trips/${tripId}/photos/collage`)}
                    disabled={allPhotos.length < 2}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400/15 to-rose-500/15 hover:from-amber-400/25 hover:to-rose-500/25 border border-amber-300/30 text-amber-100 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Collage
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/trips/${tripId}/photos/reel`)}
                    disabled={allPhotos.length < 4}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-400/15 to-purple-500/15 hover:from-indigo-400/25 hover:to-purple-500/25 border border-indigo-300/30 text-indigo-100 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    <Film className="w-3.5 h-3.5" />
                    Reel video
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/trips/${tripId}/photos/book`)}
                    disabled={allPhotos.length < 2}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-400/15 to-blue-500/15 hover:from-sky-400/25 hover:to-blue-500/25 border border-sky-300/30 text-sky-100 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Photo book
                  </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSortMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/85 hover:text-white text-xs font-semibold transition-colors"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {sortMode === 'chronological' && 'Más antiguo primero'}
                    {sortMode === 'reverse' && 'Más reciente primero'}
                    {sortMode === 'most-photos' && 'Más fotos primero'}
                    {sortMode === 'unassigned-first' && 'Sin evento primero'}
                  </button>
                  {sortMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setSortMenuOpen(false)}
                        aria-hidden
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl border border-white/15 bg-[#0d1b2e] shadow-2xl shadow-black/60 overflow-hidden"
                      >
                        {([
                          ['chronological', 'Más antiguo primero', 'Como el itinerario'],
                          ['reverse', 'Más reciente primero', 'Lo último arriba'],
                          ['most-photos', 'Más fotos primero', 'Los días con más material'],
                          ['unassigned-first', 'Sin evento primero', 'Para vincularlas'],
                        ] as const).map(([value, label, hint]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setSortMode(value);
                              setSortMenuOpen(false);
                            }}
                            className={`w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-white/[0.06] transition-colors ${sortMode === value ? 'bg-amber-400/10' : ''}`}
                            role="menuitem"
                          >
                            <span className={`text-[13px] font-semibold ${sortMode === value ? 'text-amber-200' : 'text-white'}`}>
                              {label}
                            </span>
                            <span className="text-[11px] text-white/55">{hint}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                </div>
              </div>

              {photoGroups.map((group, groupIdx) => {
                const dayNum = tripDays[group.date];
                let dayLabel: string;
                try {
                  const d = parseISO(group.date);
                  const weekday = format(d, 'EEEE', { locale: es });
                  const capitalWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
                  const dateFormatted = format(d, "d 'de' MMMM", { locale: es });
                  dayLabel = `${capitalWeekday} ${dateFormatted}`;
                } catch {
                  dayLabel = group.date;
                }

                const accent = group.eventColor || '#f59e0b';

                // Reserve roughly the right amount of vertical space while
                // the section is off-screen so the scrollbar doesn't jump
                // when it mounts. The estimate is intentionally a bit tall
                // (assumes 4-col layout averaged across breakpoints) — being
                // slightly too tall is fine, the section just absorbs the
                // slack when it mounts.
                const estimatedRows = Math.max(1, Math.ceil(group.photos.length / 4));
                const placeholderHeight = 110 + estimatedRows * 168;

                // Render the first section eagerly so it paints without
                // waiting for the IntersectionObserver tick (avoids a flash
                // of empty placeholders on initial load). The rest mount
                // when scrolled near — keeping initial render cheap.
                const eager = groupIdx === 0;

                return (
                  <LazySection
                    key={group.key}
                    placeholderHeight={placeholderHeight}
                    forceRender={eager}
                  >
                  <div>
                    {/* Group header */}
                    <div className="mb-3 flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex flex-col items-center justify-center flex-shrink-0 leading-none border"
                        style={{
                          background: `linear-gradient(135deg, ${accent}24, ${accent}10)`,
                          borderColor: `${accent}55`,
                          boxShadow: `0 0 14px ${accent}33`,
                        }}
                      >
                        <span className="text-[8px] uppercase tracking-wider font-bold" style={{ color: accent }}>
                          Día
                        </span>
                        <span className="text-sm font-black" style={{ color: accent }}>
                          {dayNum || '—'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h2 className="text-white text-base font-bold capitalize">{dayLabel}</h2>
                          <span className="text-white/40 text-[11px] font-medium tabular-nums">
                            {group.photos.length} foto{group.photos.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {(group.eventType || group.eventName || group.eventCity || group.eventCountry) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {group.eventType && (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{
                                  background: `${accent}22`,
                                  color: accent,
                                  border: `1px solid ${accent}44`,
                                }}
                              >
                                {(EVENT_TYPES as any)[group.eventType]?.label || group.eventType}
                              </span>
                            )}
                            {group.eventName && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/[0.06] text-white/85 border border-white/10">
                                {group.eventName}
                              </span>
                            )}
                            {(group.eventCity || group.eventCountry) && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-400/10 text-emerald-200 border border-emerald-300/30">
                                <MapPin className="w-3 h-3" />
                                {[group.eventCity, group.eventCountry].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Edit event — only when the group is bound to a real
                          event. Takes the user to the itinerary view scrolled
                          to that event so they can change date / time / type
                          or unlink photos. */}
                      {group.eventId && (
                        <button
                          type="button"
                          onClick={() => {
                            router.push(
                              `/trips/${tripId}/itinerary?day=${group.date}&edit=${group.eventId}`,
                            );
                          }}
                          aria-label="Editar evento"
                          title="Editar evento"
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-white/75 hover:text-white text-[11px] font-semibold transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </button>
                      )}
                    </div>

                    {/* Photo grid (sortable when photos belong to an event) */}
                    {(() => {
                      const reorderable = !selectionMode && !!group.eventId && group.photos.length > 1;
                      const photoIds = group.photos.map((p) => p.url);
                      const photoCards = group.photos.map((photo, photoIdx) => {
                        const isSelected = selectedUrls.has(photo.url);
                        // First ~8 photos of the first group are likely above
                        // the fold on a desktop 6-col grid (2 rows). Hint the
                        // browser to fetch them eagerly with high priority,
                        // and lazy/auto for the rest. Without this the first
                        // group's images all compete equally and the visible
                        // ones aren't prioritized.
                        const isAboveFold = eager && photoIdx < 8;
                        // Plain card body shared by both render paths. Hover
                        // uses CSS-only transforms (no framer-motion
                        // subscriptions per photo) and dnd-kit only wraps
                        // the card when the group is actually reorderable —
                        // useSortable is otherwise wasted state per item.
                        const cardBody = (
                          <div className="space-y-1.5 transition-transform duration-200 hover:-translate-y-0.5">
                            <div
                              className={classNames(
                                'relative group rounded-2xl overflow-hidden bg-black/40 aspect-square cursor-pointer border transition-all',
                                selectionMode && isSelected
                                  ? 'border-amber-300 ring-2 ring-amber-300/60 shadow-[0_8px_30px_rgba(245,158,11,0.45)]'
                                  : 'border-white/10 hover:border-amber-300/50 hover:shadow-[0_8px_30px_rgba(245,158,11,0.18)]',
                              )}
                              onClick={() => {
                                if (selectionMode) togglePhotoSelection(photo.url);
                                else openLightbox(photo);
                              }}
                            >
                              {/* width/height hint the browser to reserve a
                                  square box for the thumbnail before the bytes
                                  arrive. Combined with the aspect-square
                                  container above, layout shift is ~0. The
                                  600 figure mirrors the optimized thumbnail
                                  size produced by useAlbum.migrateThumbnails. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt={photo.caption || 'Foto del viaje'}
                                width={600}
                                height={600}
                                className={classNames(
                                  'w-full h-full object-cover transition-transform duration-500',
                                  selectionMode && isSelected
                                    ? 'scale-95 brightness-75'
                                    : 'group-hover:scale-110',
                                )}
                                loading={isAboveFold ? 'eager' : 'lazy'}
                                fetchPriority={isAboveFold ? 'high' : 'low'}
                                decoding="async"
                              />
                              {/* Gradient overlay on hover */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                              {/* Selection check badge */}
                              {selectionMode && (
                                <div className="absolute top-2 left-2 z-10">
                                  <div
                                    className={classNames(
                                      'w-7 h-7 rounded-full flex items-center justify-center border-2 backdrop-blur-md transition-all',
                                      isSelected
                                        ? 'bg-amber-300 border-amber-200 text-amber-950 shadow-[0_0_14px_rgba(245,158,11,0.55)]'
                                        : 'bg-black/40 border-white/50 text-transparent',
                                    )}
                                  >
                                    <Check className="w-4 h-4" strokeWidth={3} />
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              {!selectionMode && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  {photo.source === 'album' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditPhotoModal(photo);
                                      }}
                                      className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center text-white transition-all border border-white/20 shadow-lg"
                                      title="Editar foto"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canShare && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sharePhoto({
                                          url: photo.fullUrl || photo.url,
                                          caption: photo.caption,
                                          tripTitle: trip?.title,
                                          destination: trip?.destination,
                                          date: photo.date,
                                        }).then((result) => {
                                          if (!result.ok) {
                                            if (result.reason === 'unsupported') {
                                              alert('Tu navegador no soporta compartir directo — descarga la foto y compártela manualmente.');
                                            } else if (result.reason === 'failed') {
                                              console.error('[PhotosPage] share failed:', result.error);
                                            }
                                          }
                                        });
                                      }}
                                      className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center text-white transition-all border border-white/20 shadow-lg"
                                      title="Compartir foto"
                                    >
                                      <Share2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadPhoto(photo);
                                    }}
                                    className="w-7 h-7 rounded-full bg-sky-500/40 backdrop-blur-md hover:bg-sky-500/60 flex items-center justify-center text-white transition-all border border-sky-300/40 shadow-lg"
                                    title="Descargar foto"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(photo);
                                    }}
                                    disabled={deleting === photo.url}
                                    className="w-7 h-7 rounded-full bg-red-500/40 backdrop-blur-md hover:bg-red-500/60 flex items-center justify-center text-white transition-all border border-red-300/40 shadow-lg disabled:opacity-50"
                                    title="Eliminar foto"
                                  >
                                    {deleting === photo.url ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}

                              {/* Source pill (event vs album) */}
                              {photo.source === 'event' && (
                                <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white/85 text-[9px] font-bold uppercase tracking-wider border border-white/10">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                  evento
                                </div>
                              )}
                            </div>
                            {photo.caption && (
                              <p className="text-white/65 text-[11px] font-medium px-1 line-clamp-2 leading-snug">
                                {photo.caption}
                              </p>
                            )}
                          </div>
                        );
                        return reorderable ? (
                          <SortablePhoto key={photo.url} id={photo.url} enabled={true}>
                            {cardBody}
                          </SortablePhoto>
                        ) : (
                          <div key={photo.url}>{cardBody}</div>
                        );
                      });

                      const grid = (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">{photoCards}</div>
                      );

                      if (!reorderable || !group.eventId) return grid;
                      return (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e: DragEndEvent) => {
                            if (!e.over || e.active.id === e.over.id) return;
                            handleReorder(
                              group.eventId as string,
                              photoIds,
                              String(e.active.id),
                              String(e.over.id),
                            );
                          }}
                        >
                          <SortableContext items={photoIds} strategy={rectSortingStrategy}>
                            {grid}
                          </SortableContext>
                        </DndContext>
                      );
                    })()}
                  </div>
                  </LazySection>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Floating bulk action bar ─────────────── */}
        <AnimatePresence>
          {selectionMode && selectedUrls.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50"
            >
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/[0.1] backdrop-blur-xl shadow-2xl shadow-black/50"
                style={{ background: 'rgba(15,23,42,0.85)' }}
              >
                <span className="text-white text-xs font-bold whitespace-nowrap pl-2 pr-1 tabular-nums">
                  {selectedUrls.size} foto{selectedUrls.size !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={handleBulkDownload}
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-sky-500/90 text-white hover:bg-sky-500 transition-colors shadow-[0_0_16px_rgba(56,189,248,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Descargar todas</span>
                  <span className="sm:hidden">Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/90 text-white hover:bg-red-500 transition-colors shadow-[0_0_16px_rgba(239,68,68,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/80 hover:bg-white/15 hover:text-white transition-colors disabled:opacity-60"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Trip insights (relocated from overview) ──
          Always lives below all photo groups. Wrap in a LazySection so the
          dynamic chunk only fetches/mounts when the user actually scrolls
          near it — otherwise it competed with the first photo paint for
          parse time on slower devices. */}
      {trip && (
        <div className="mt-5">
          <LazySection placeholderHeight={420}>
            <TripInsights trip={trip} events={events} albumPhotos={albumPhotos} />
          </LazySection>
        </div>
      )}

      {/* ── Link to event modal (dark glass) ── */}
      <AnimatePresence>
        {showLinkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl shadow-black/50"
              style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div
                  className="absolute -top-12 -right-12 w-72 h-72 rounded-full blur-3xl"
                  style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)' }}
                />
              </div>
              <div className="relative p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="text-white text-lg font-black">Subir fotos</h3>
                  <span className="text-white/55 text-xs">
                    {pendingFiles.length} {pendingFiles.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </div>

                {pendingFiles.length > 1 && (
                  <div className="mb-4 rounded-xl border border-amber-300/30 bg-amber-400/[0.08] backdrop-blur-sm px-3 py-2 text-[11px] text-amber-100/90 flex items-start gap-2">
                    <span className="text-base leading-none">📸</span>
                    <span>
                      Las <span className="font-bold">{pendingFiles.length} fotos</span> se tratarán como un grupo y se vincularán al
                      mismo evento que selecciones abajo.
                    </span>
                  </div>
                )}

                {/* Date */}
                <label className="block text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
                  Fecha
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={trip?.startDate}
                  max={trip?.endDate}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors mb-4 [color-scheme:dark]"
                />

                {/* Event link */}
                <label className="block text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">
                  Vincular a evento (opcional)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors mb-4 [color-scheme:dark]"
                >
                  <option value="">Sin vincular</option>
                  {(() => {
                    // Sort by date then by startTime so the picker mirrors the
                    // itinerary order. Events without a time go to the bottom
                    // of their day.
                    const sorted = [...events].sort((a, b) => {
                      const dateCmp = a.date.localeCompare(b.date);
                      if (dateCmp !== 0) return dateCmp;
                      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
                    });
                    const grouped = new Map<string, typeof events>();
                    for (const ev of sorted) {
                      const list = grouped.get(ev.date) || [];
                      list.push(ev);
                      grouped.set(ev.date, list);
                    }
                    // Surface the active date's group first so the picker
                    // opens on "today" (or whatever selectedDate is) instead
                    // of forcing a scroll down from day 1.
                    const entries = [...grouped.entries()];
                    const ordered = entries.sort(([a], [b]) => {
                      if (a === selectedDate && b !== selectedDate) return -1;
                      if (b === selectedDate && a !== selectedDate) return 1;
                      return a.localeCompare(b);
                    });
                    return ordered.map(([dateStr, evts]) => (
                      <optgroup
                        key={dateStr}
                        label={
                          dateStr === selectedDate
                            ? `${formatDateES(dateStr)} · seleccionado`
                            : formatDateES(dateStr)
                        }
                      >
                        {evts.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.startTime ? `${ev.startTime} - ` : ''}
                            {ev.title}
                          </option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>

                {/* Event details */}
                {selectedEventId && (
                  <div className="mb-4 space-y-3">
                    <div className="rounded-2xl border border-purple-300/30 bg-purple-400/[0.05] backdrop-blur-sm p-3">
                      <p className="text-purple-200/80 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
                        Información del evento
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-white/45 text-[10px] font-bold mb-1">Tipo</label>
                          <input
                            type="text"
                            value={
                              modalEventType
                                ? EVENT_TYPES[modalEventType as keyof typeof EVENT_TYPES]?.label || modalEventType
                                : ''
                            }
                            disabled
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/55 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-white/45 text-[10px] font-bold mb-1">
                            Nombre {modalEventType && `(${EVENT_TYPES[modalEventType as keyof typeof EVENT_TYPES]?.label})`}
                          </label>
                          <input
                            type="text"
                            value={modalEventName}
                            onChange={(e) => setModalEventName(e.target.value)}
                            placeholder={
                              modalEventType === 'restaurant'
                                ? 'Ej. Azia'
                                : modalEventType === 'hotel'
                                ? 'Ej. Hotel Playa'
                                : modalEventType === 'activity'
                                ? 'Ej. Snorkel'
                                : 'Nombre del lugar'
                            }
                            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 outline-none focus:border-purple-300/60"
                          />
                        </div>
                      </div>
                      {!modalEventName && (
                        <p className="text-purple-200/70 text-[10px] mt-2">
                          💡 Agrega el nombre para identificar este lugar
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.05] backdrop-blur-sm p-3">
                      <p className="text-emerald-200/80 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">Ubicación</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-white/45 text-[10px] font-bold mb-1">Ciudad</label>
                          <input
                            type="text"
                            value={modalCity}
                            onChange={(e) => setModalCity(e.target.value)}
                            placeholder="Ej. Mazatlán"
                            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 outline-none focus:border-emerald-300/60"
                          />
                        </div>
                        <div>
                          <label className="block text-white/45 text-[10px] font-bold mb-1">País</label>
                          <input
                            type="text"
                            value={modalCountry}
                            onChange={(e) => setModalCountry(e.target.value)}
                            placeholder="Ej. México"
                            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 outline-none focus:border-emerald-300/60"
                          />
                        </div>
                      </div>
                      {(!modalCity || !modalCountry) && (
                        <p className="text-emerald-200/70 text-[10px] mt-2">
                          💡 Agrega ciudad y país para recordar mejor este momento
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
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
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
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
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    Subir {pendingFiles.length === 1 ? 'foto' : 'fotos'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Caption edit modal ── */}
      <AnimatePresence>
        {editingCaption !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingCaption(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-3xl border border-white/10 shadow-2xl shadow-black/50 p-6"
              style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 100%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-white text-lg font-black mb-3">Editar leyenda</h3>
              <input
                type="text"
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                placeholder="Escribe una leyenda…"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60"
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
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const photo = flatPhotos.find((p) => p.url === editingCaption);
                    if (photo) saveCaption(photo);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  <Check className="w-4 h-4 inline mr-1" />
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Photo edit modal ── */}
      <AnimatePresence>
        {editingPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingPhoto(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl shadow-black/50"
              style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 100%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-white text-lg font-black mb-4">Editar foto</h3>

                <div className="mb-4 rounded-2xl overflow-hidden border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingPhoto.url}
                    alt="Preview"
                    width={600}
                    height={192}
                    className="w-full h-48 object-cover"
                    decoding="async"
                  />
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">Leyenda</label>
                    <input
                      type="text"
                      value={editPhotoCaption}
                      onChange={(e) => setEditPhotoCaption(e.target.value)}
                      placeholder="Escribe una leyenda…"
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60"
                    />
                  </div>

                  <div>
                    <label className="block text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">Fecha</label>
                    <input
                      type="date"
                      value={editPhotoDate}
                      onChange={(e) => setEditPhotoDate(e.target.value)}
                      min={trip?.startDate}
                      max={trip?.endDate}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-300/60 [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5">Evento asociado</label>
                    <select
                      value={editPhotoEventId}
                      onChange={(e) => setEditPhotoEventId(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-300/60 [color-scheme:dark]"
                    >
                      <option value="">Sin evento</option>
                      {events
                        .filter((e) => e.date === editPhotoDate)
                        .map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.title} ({EVENT_TYPES[event.type]?.label || event.type})
                          </option>
                        ))}
                    </select>
                    {editPhotoDate && events.filter((e) => e.date === editPhotoDate).length === 0 && (
                      <p className="text-white/35 text-[11px] mt-1">No hay eventos en esta fecha</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[0.08]">
                  <button
                    onClick={() => {
                      setEditingPhoto(null);
                      setEditPhotoCaption('');
                      setEditPhotoDate('');
                      setEditPhotoEventId('');
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={savePhotoEdits}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white inline-flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    <Check className="w-4 h-4" />
                    Guardar cambios
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll scrubber — Apple-style vertical bar with a draggable
          thumb. Lives on the right edge of the viewport but flush
          enough that the chatbot's FAB (right-6/right-8) sits beside
          it without overlap. */}
      {allPhotos.length > 6 && (
        <ScrollScrubber />
      )}

      {/* ── Lightbox (zoom + pan + rotate via react-zoom-pan-pinch) ── */}
      <PhotoLightbox
        open={lightboxIndex !== null && !!flatPhotos[lightboxIndex ?? 0]}
        photos={flatPhotos}
        index={lightboxIndex ?? 0}
        onClose={closeLightbox}
        onChangeIndex={(i) => setLightboxIndex(i)}
        onDelete={(p) => handleDelete(p)}
        onDownload={(p) => downloadPhoto(p)}
        deleting={deleting}
      />

    </div>
  );
}
