'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Receipt, CalendarPlus, Camera } from 'lucide-react';
import EventForm from '@/components/trips/EventForm';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/context/ToastContext';
import type { Trip } from '@/types';

interface QuickActionsRowProps {
  tripId: string;
  trip: Trip | null;
}

interface ActionConfig {
  key: 'expense' | 'photo' | 'event';
  label: string;
  Icon: typeof Receipt;
  gradient: string;
  shadow: string;
  hoverShadow: string;
}

const ACTIONS: ActionConfig[] = [
  {
    key: 'expense',
    label: 'Gasto',
    Icon: Receipt,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%)',
    shadow: '0 8px 24px -6px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
    hoverShadow: '0 14px 32px -6px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  {
    key: 'photo',
    label: 'Foto',
    Icon: Camera,
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 60%, #9d174d 100%)',
    shadow: '0 8px 24px -6px rgba(236,72,153,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
    hoverShadow: '0 14px 32px -6px rgba(236,72,153,0.7), inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  {
    key: 'event',
    label: 'Evento',
    Icon: CalendarPlus,
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 60%, #4338ca 100%)',
    shadow: '0 8px 24px -6px rgba(59,130,246,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
    hoverShadow: '0 14px 32px -6px rgba(59,130,246,0.7), inset 0 1px 0 rgba(255,255,255,0.3)',
  },
];

export default function QuickActionsRow({ tripId, trip }: QuickActionsRowProps) {
  const router = useRouter();
  const { createEvent } = useEvents(tripId);
  const { toast } = useToast();

  const [showEventForm, setShowEventForm] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

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

  const handleClick = (key: ActionConfig['key']) => {
    if (key === 'expense') router.push(`/trips/${tripId}/expenses?capture=1`);
    else if (key === 'event') setShowEventForm(true);
    else if (key === 'photo') router.push(`/trips/${tripId}/photos?upload=1`);
  };

  return (
    <>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-2 px-1">
          Accesos rápidos
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {ACTIONS.map((action, idx) => {
            const Icon = action.Icon;
            const isHovered = hovered === action.key;
            return (
              <motion.button
                key={action.key}
                type="button"
                onClick={() => handleClick(action.key)}
                onMouseEnter={() => setHovered(action.key)}
                onMouseLeave={() => setHovered(null)}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.06 }}
                className="relative rounded-2xl overflow-hidden p-3.5 flex flex-col items-center gap-1.5 transition-all duration-200 active:scale-95"
                style={{
                  background: action.gradient,
                  boxShadow: isHovered ? action.hoverShadow : action.shadow,
                  transform: isHovered ? 'translateY(-2px)' : undefined,
                }}
              >
                {/* Subtle radial highlight */}
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.32), transparent 60%)',
                  }}
                />

                <span className="relative w-10 h-10 rounded-xl bg-white/22 backdrop-blur-sm flex items-center justify-center border border-white/25 shadow-inner">
                  <Icon className="w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
                </span>
                <span
                  className="relative text-white text-[12px] sm:text-[13px] font-bold leading-tight tracking-tight"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
                >
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Event form modal — EventForm renders its own Modal wrapper */}
      {showEventForm && (
        <EventForm
          tripId={tripId}
          tripStartDate={trip?.startDate}
          tripEndDate={trip?.endDate}
          defaultDate={(() => {
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
