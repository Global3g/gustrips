'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, CalendarPlus, Camera } from 'lucide-react';
import EventForm from '@/components/trips/EventForm';
import ScanDocumentModal from '@/components/trips/ScanDocumentModal';
import { useEvents } from '@/hooks/useEvents';
import { useDocuments } from '@/hooks/useDocuments';
import { useToast } from '@/context/ToastContext';
import { EVENT_TYPE_TO_DOC_CATEGORY } from '@/config/constants';
import type { ScannedEvent } from '@/lib/utils/aiScanner';
import type { DocumentCategory, Trip } from '@/types';

interface QuickActionsRowProps {
  tripId: string;
  trip: Trip | null;
}

interface ActionConfig {
  key: 'scan' | 'event' | 'photo';
  label: string;
  Icon: typeof Sparkles;
  glow: string;
  iconBg: string;
  iconColor: string;
}

const ACTIONS: ActionConfig[] = [
  {
    key: 'scan',
    label: 'Escanear ticket',
    Icon: Sparkles,
    glow: 'rgba(245,158,11,0.35)',
    iconBg: 'rgba(245,158,11,0.18)',
    iconColor: '#fcd34d',
  },
  {
    key: 'event',
    label: 'Evento nuevo',
    Icon: CalendarPlus,
    glow: 'rgba(59,130,246,0.35)',
    iconBg: 'rgba(59,130,246,0.18)',
    iconColor: '#93c5fd',
  },
  {
    key: 'photo',
    label: 'Subir foto',
    Icon: Camera,
    glow: 'rgba(236,72,153,0.35)',
    iconBg: 'rgba(236,72,153,0.18)',
    iconColor: '#f9a8d4',
  },
];

export default function QuickActionsRow({ tripId, trip }: QuickActionsRowProps) {
  const router = useRouter();
  const { events, createEvent } = useEvents(tripId);
  const { uploadDocument } = useDocuments(tripId);
  const { toast } = useToast();

  const [showScan, setShowScan] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);

  /* eslint-disable @typescript-eslint/no-explicit-any */

  const handleEventSubmit = async (data: any) => {
    setSubmittingEvent(true);
    try {
      await createEvent(data);
      toast('Evento creado', 'success');
      setShowEventForm(false);
    } catch (err) {
      console.error('Error creating event:', err);
      toast('Error al crear evento', 'error');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const handleScanConfirm = async (scannedEvents: ScannedEvent[], file: File) => {
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

      if (firstEventId) {
        const firstType = scannedEvents[0].type;
        const category: DocumentCategory =
          EVENT_TYPE_TO_DOC_CATEGORY[firstType as keyof typeof EVENT_TYPE_TO_DOC_CATEGORY] || 'other';
        try {
          await uploadDocument(file, { eventId: firstEventId, category });
        } catch (err) {
          console.error('Error uploading scanned doc:', err);
        }
      }

      setShowScan(false);
      const count = scannedEvents.length;
      toast(
        count === 1 ? 'Evento creado desde documento' : `${count} eventos creados`,
        'success',
      );
    } catch (err) {
      console.error('Error from scan confirm:', err);
      toast('Error al crear los eventos', 'error');
      throw err;
    }
  };

  const handleClick = (key: ActionConfig['key']) => {
    if (key === 'scan') setShowScan(true);
    else if (key === 'event') setShowEventForm(true);
    else if (key === 'photo') router.push(`/trips/${tripId}/photos?upload=1`);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-3 gap-2"
      >
        {ACTIONS.map((action, idx) => {
          const Icon = action.Icon;
          return (
            <motion.button
              key={action.key}
              type="button"
              onClick={() => handleClick(action.key)}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              transition={{ duration: 0.18, delay: idx * 0.04 }}
              className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3 flex flex-col items-center gap-1.5 hover:border-white/20 hover:bg-white/[0.06] transition-all"
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: action.iconBg,
                  boxShadow: `0 0 18px ${action.glow}`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
              </span>
              <span className="text-white text-[11px] sm:text-xs font-semibold leading-tight text-center">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Scan modal */}
      <ScanDocumentModal
        open={showScan}
        onClose={() => setShowScan(false)}
        onConfirm={handleScanConfirm}
        defaultDate={trip?.startDate}
        travelerCount={trip?.travelerIds?.length ?? 1}
        tripStartDate={trip?.startDate}
        tripEndDate={trip?.endDate}
      />

      {/* Event form modal — EventForm renders its own Modal wrapper */}
      {showEventForm && (
        <EventForm
          tripId={tripId}
          tripStartDate={trip?.startDate}
          tripEndDate={trip?.endDate}
          defaultDate={(() => {
            // Prefer today if it falls inside the trip, else trip start
            try {
              if (!trip) return undefined;
              const today = new Date().toISOString().split('T')[0];
              if (today >= trip.startDate && today <= trip.endDate) return today;
              return trip.startDate;
            } catch {
              return undefined;
            }
          })()}
          onSubmit={handleEventSubmit}
          onCancel={() => setShowEventForm(false)}
          loading={submittingEvent}
        />
      )}
    </>
  );
}
