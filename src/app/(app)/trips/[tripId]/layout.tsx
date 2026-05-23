'use client';

import { useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import TripSidebar from '@/components/trips/TripSidebar';
import TripBottomNav from '@/components/trips/TripBottomNav';
import ScanDocumentModal from '@/components/trips/ScanDocumentModal';
import NotificationBanner from '@/components/NotificationBanner';
import FastExpenseFAB from '@/components/expenses/FastExpenseFAB';
import { useUploadDocument } from '@/hooks/useDocuments';
import { TripDataProvider, useTripData } from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { useTripMode } from '@/hooks/useTripMode';
import { EVENT_TYPE_TO_DOC_CATEGORY } from '@/config/constants';
import type { ScannedEvent } from '@/lib/utils/aiScanner';
import type { DocumentCategory } from '@/types';

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tripId = params.tripId as string;

  // TripDataProvider owns the single set of `useTrip` / `useEvents` /
  // `useAlbum` Firestore subscriptions for the whole `/trips/[tripId]`
  // subtree. The inner shell consumes them via context — no extra listeners.
  return (
    <TripDataProvider tripId={tripId}>
      <TripLayoutInner>{children}</TripLayoutInner>
    </TripDataProvider>
  );
}

function TripLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const tripId = params.tripId as string;
  const { trip, updateTrip, events, createEvent } = useTripData();
  // Derive the three-pillar palette from the trip's dates. The CSS vars
  // it sets (--pillar-bg, --pillar-ink, --pillar-accent…) cascade to any
  // child component that uses them, so newer pages (TripHeroCard, Today,
  // Documents shell) automatically pick the right tone.
  const tripMode = useTripMode(trip);

  // The layout only needs the upload action — not the live documents list —
  // so we use the write-only variant. Otherwise we'd pay for a permanent
  // onSnapshot listener on the attachments subcollection on every trip page.
  const { uploadDocument } = useUploadDocument(tripId);
  const { toast } = useToast();

  const [showSidebarScan, setShowSidebarScan] = useState(false);

  // Always send the user to the trips dashboard. The previous heuristic
  // (router.back() if same-origin referrer) silently did nothing when the
  // page was refreshed, opened from a share link, or installed as a PWA —
  // those cases produce no usable history entry. A predictable "go home"
  // beats a clever "maybe go back". The browser's native back arrow still
  // covers the literal previous-page case.
  const handleBack = () => {
    router.push('/dashboard');
  };

  const handleSidebarScanConfirm = async (scannedEvents: ScannedEvent[], file: File) => {
    try {
      let firstEventId: string | null = null;

      for (const scannedEvent of scannedEvents) {
        const eventData = {
          title: scannedEvent.title,
          type: scannedEvent.type,
          date: scannedEvent.date,
          startTime: scannedEvent.startTime || '',
          endTime: scannedEvent.endTime || '',
          location: scannedEvent.location || '',
          notes: scannedEvent.notes || '',
          cost: scannedEvent.cost || 0,
          currency: scannedEvent.currency || 'MXN',
          details: scannedEvent.details,
          attachments: [] as string[],
        };

        const eventId = await createEvent(eventData);
        if (!firstEventId) firstEventId = eventId;
      }

      // Upload file as attachment to the first event
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

      setShowSidebarScan(false);
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

  return (
    <div className={`flex h-[calc(100vh-5rem)] lg:h-screen ${tripMode.modeClass}`}>
      {/* Trip Sidebar - desktop */}
      <div className="hidden lg:block w-[280px] border-r border-white/[0.04] bg-[#1e3a5f] overflow-y-auto flex-shrink-0">
        <TripSidebar
          tripId={tripId}
          trip={trip}
          events={events}
          currentPath={pathname}
          onScanDocument={() => setShowSidebarScan(true)}
          travelerCount={trip?.travelerIds?.length}
          updateTrip={updateTrip}
        />
      </div>

      {/* Main content - scrollable, full width */}
      <div className="flex-1 overflow-y-auto relative" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 30%, #dbeafe 60%, #ede9fe 100%)' }}>
        {/* Background cover image — only on non-itinerary pages.
            `loading="lazy"` + `decoding="async"` so the decorative image
            doesn't block the initial paint of the page content. The image
            is heavily faded (0.15 opacity, desaturated) so showing it a few
            frames later than the chrome is not user-visible. */}
        {trip?.coverImage && !pathname.includes('/itinerary') && !pathname.includes('/photos') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.coverImage}
              alt=""
              className="w-full h-full object-cover opacity-[0.15]"
              style={{ filter: 'saturate(0.4)' }}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(240,244,255,0.5) 0%, rgba(232,238,255,0.4) 50%, rgba(237,233,254,0.5) 100%)' }} />
          </div>
        )}
        {/* Decorative gradient orbs.
            blur-3xl (96px) is expensive on the GPU when stacked — the photos
            page already paints its own orb layer inside the dark glass stage.
            Cut from 3 to 2 and step the blur radius down to keep the
            overall composite cheap. */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-1/3 left-0 w-80 h-80 bg-violet-200/15 rounded-full blur-2xl pointer-events-none" />
        <NotificationBanner />
        {/* Back to dashboard — mobile only */}
        <div className="lg:hidden sticky top-0 z-40 backdrop-blur-md bg-white/75 border-b border-gray-200/40 px-4 py-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver"
            className="w-10 h-10 rounded-full bg-white shadow-md ring-1 ring-gray-200/60 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-gray-700 truncate flex-1">
            {trip?.title || 'Volver'}
          </span>
        </div>
        <div className="relative p-5 sm:p-8 lg:p-12 pb-24 lg:pb-12">
          {children}
        </div>
      </div>

      {/* Mobile-only bottom navigation. Desktop already has the sidebar.
          The pb-24 above keeps content from being hidden under it. */}
      <TripBottomNav tripId={tripId} />

      {/* Scan modal from sidebar */}
      <ScanDocumentModal
        open={showSidebarScan}
        onClose={() => setShowSidebarScan(false)}
        onConfirm={handleSidebarScanConfirm}
      />

      {/* Floating "Gasto" FAB — present on every trip page so the user
          can capture an expense without navigating to /expenses. */}
      <FastExpenseFAB tripId={tripId} />
    </div>
  );
}
