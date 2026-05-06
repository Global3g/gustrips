'use client';

import { useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TripSidebar from '@/components/trips/TripSidebar';
import ScanDocumentModal from '@/components/trips/ScanDocumentModal';
import NotificationBanner from '@/components/NotificationBanner';
import { useEvents } from '@/hooks/useEvents';
import { useDocuments } from '@/hooks/useDocuments';
import { useTrip } from '@/hooks/useTrip';
import { useToast } from '@/context/ToastContext';
import { EVENT_TYPE_TO_DOC_CATEGORY } from '@/config/constants';
import type { ScannedEvent } from '@/lib/utils/aiScanner';
import type { DocumentCategory } from '@/types';

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const tripId = params.tripId as string;
  const { trip } = useTrip(tripId);
  const { events, createEvent } = useEvents(tripId);
  const { uploadDocument } = useDocuments(tripId);
  const { toast } = useToast();
  const [showSidebarScan, setShowSidebarScan] = useState(false);

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
    <div className="flex h-[calc(100vh-5rem)] lg:h-screen">
      {/* Trip Sidebar - desktop */}
      <div className="hidden lg:block w-[280px] border-r border-white/[0.04] bg-[#1e3a5f] overflow-y-auto flex-shrink-0">
        <TripSidebar
          tripId={tripId}
          trip={trip}
          events={events}
          currentPath={pathname}
          onScanDocument={() => setShowSidebarScan(true)}
          travelerCount={trip?.travelerIds?.length}
        />
      </div>

      {/* Main content - scrollable, full width */}
      <div className="flex-1 overflow-y-auto relative" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 30%, #dbeafe 60%, #ede9fe 100%)' }}>
        {/* Background cover image — only on non-itinerary pages */}
        {trip?.coverImage && !pathname.includes('/itinerary') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <img
              src={trip.coverImage}
              alt=""
              className="w-full h-full object-cover opacity-[0.15]"
              style={{ filter: 'saturate(0.4)' }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(240,244,255,0.5) 0%, rgba(232,238,255,0.4) 50%, rgba(237,233,254,0.5) 100%)' }} />
          </div>
        )}
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-0 w-80 h-80 bg-violet-200/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-rose-200/10 rounded-full blur-3xl pointer-events-none" />
        <NotificationBanner />
        {/* Back to dashboard — mobile only */}
        <div className="lg:hidden relative px-5 pt-4 pb-0">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Inicio
          </Link>
        </div>
        <div className="relative p-5 sm:p-8 lg:p-12">
          {children}
        </div>
      </div>

      {/* Scan modal from sidebar */}
      <ScanDocumentModal
        open={showSidebarScan}
        onClose={() => setShowSidebarScan(false)}
        onConfirm={handleSidebarScanConfirm}
      />
    </div>
  );
}
