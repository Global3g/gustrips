'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, CalendarDays, Plane, List, CalendarRange } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/context/ToastContext';
import EventCard from '@/components/trips/EventCard';
import EventForm from '@/components/trips/EventForm';
import AgendaView from '@/components/trips/AgendaView';
import Button from '@/components/ui/Button';
import { classNames, getTimezoneAbbr, getTimezoneOffset } from '@/lib/utils/helpers';
import { ROUTES } from '@/config/constants';
import type { TripEvent } from '@/types';

/* ─── Obtener la zona de "salida" de un evento ─── */
function getEffectiveOutgoingTimezone(event: TripEvent): string | undefined {
  // Para vuelos, la zona de salida es la arrivalTimezone (donde llegas)
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
  const router = useRouter();
  const tripId = params.tripId as string;

  const { events, loading, createEvent, updateEvent, deleteEvent } = useEvents(tripId);
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TripEvent | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'agenda'>('list');

  /* ─── Agrupar eventos por fecha ───────────────── */

  const groupedByDate = events.reduce(
    (groups, event) => {
      const key = event.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
      return groups;
    },
    {} as Record<string, TripEvent[]>
  );

  const sortedDates = Object.keys(groupedByDate).sort();

  /* ─── Handlers ────────────────────────────────── */

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
      await deleteEvent(eventId);
      toast('Evento eliminado', 'success');
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      toast('Error al eliminar el evento', 'error');
    }
  };

  const handleEdit = (event: TripEvent) => {
    setEditingEvent(event);
  };

  const handleDragUpdate = async (eventId: string, data: Partial<TripEvent>) => {
    try {
      await updateEvent(eventId, data);
      toast('Evento movido', 'success');
    } catch (error) {
      console.error('Error al mover evento:', error);
      toast('Error al mover el evento', 'error');
    }
  };

  /* ─── Formatear encabezado de fecha ───────────── */

  const formatDateHeader = (dateStr: string): string => {
    try {
      const date = parseISO(dateStr);
      return format(date, "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  /* ─── Render ──────────────────────────────────── */

  return (
    <div className={classNames(
      'mx-auto px-4 py-6',
      viewMode === 'agenda' ? 'max-w-6xl' : 'max-w-2xl'
    )}>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(ROUTES.app.trip(tripId))}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Itinerario</h1>
            <p className="text-white/40 text-sm">Planifica tus actividades dia a dia</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle de vista */}
          <div className="flex items-center bg-white/10 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={classNames(
                'p-2 rounded-lg transition-colors',
                viewMode === 'list'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              )}
              title="Vista lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={classNames(
                'p-2 rounded-lg transition-colors',
                viewMode === 'agenda'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              )}
              title="Vista agenda"
            >
              <CalendarRange className="w-4 h-4" />
            </button>
          </div>

          <Button
            icon={Plus}
            onClick={() => setShowForm(true)}
            size="sm"
          >
            Evento
          </Button>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : sortedDates.length === 0 ? (
        /* Estado vacio */
        <div className="text-center py-16 animate-empty-state-in">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute w-24 h-24 bg-blue-500/10 rounded-full animate-empty-glow" />
            <div className="relative w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center animate-empty-icon-in">
              <Plane className="w-10 h-10 text-white/20" />
            </div>
          </div>
          <h3 className="text-white/70 text-lg font-semibold mb-2">Sin eventos aun</h3>
          <p className="text-white/40 text-sm max-w-xs mx-auto mb-6">
            Agrega vuelos, hoteles, actividades y mas para organizar tu viaje
          </p>
          <Button icon={Plus} onClick={() => setShowForm(true)}>
            Crear primer evento
          </Button>
        </div>
      ) : viewMode === 'agenda' ? (
        /* Vista agenda (calendario) */
        <AgendaView events={events} onEdit={handleEdit} onUpdate={handleDragUpdate} />
      ) : (
        /* Vista lista de eventos agrupados por fecha */
        <div className="space-y-6">
          {sortedDates.map((dateKey, index) => {
            const dayEvents = groupedByDate[dateKey];

            // Buscar la zona anterior: último evento del día anterior
            let prevOutgoingTz: string | undefined;
            if (index > 0) {
              const prevDayEvents = groupedByDate[sortedDates[index - 1]];
              const lastPrevEvent = prevDayEvents[prevDayEvents.length - 1];
              prevOutgoingTz = getEffectiveOutgoingTimezone(lastPrevEvent);
            }

            return (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
              >
                {/* Encabezado del dia */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <CalendarDays className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2 className="text-white font-semibold text-sm capitalize">
                    {formatDateHeader(dateKey)}
                  </h2>
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-xs">
                    {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                  </span>
                </div>

                {/* Tarjetas de eventos con pills de timezone */}
                <div className="space-y-2 pl-4 border-l-2 border-white/10 ml-4">
                  <AnimatePresence>
                    {dayEvents.map((event, evIdx) => {
                      // Determinar si mostrar pill de cambio de zona antes de este evento
                      let fromTz: string | undefined;
                      let toTz: string | undefined;

                      if (evIdx === 0 && prevOutgoingTz) {
                        fromTz = prevOutgoingTz;
                        toTz = getEffectiveIncomingTimezone(event);
                      } else if (evIdx > 0) {
                        fromTz = getEffectiveOutgoingTimezone(dayEvents[evIdx - 1]);
                        toTz = getEffectiveIncomingTimezone(event);
                      }

                      return (
                        <motion.div
                          key={event.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                        >
                          {fromTz && toTz && fromTz !== toTz && (
                            <div className="flex items-center gap-2 py-1.5 my-1">
                              <div className="flex-1 h-px bg-amber-500/30" />
                              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                🌐 {getTimezoneAbbr(fromTz, dateKey)} → {getTimezoneAbbr(toTz, dateKey)}
                                <span className="text-amber-400/60">
                                  ({getTimezoneOffset(fromTz, toTz, dateKey)})
                                </span>
                              </span>
                              <div className="flex-1 h-px bg-amber-500/30" />
                            </div>
                          )}
                          <EventCard
                            event={event}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                          {/* Pill después de evento con cambio de zona */}
                          {event.timezone && event.details?.arrivalTimezone && event.timezone !== event.details.arrivalTimezone && (
                            <div className="flex items-center gap-2 py-1.5 my-1">
                              <div className="flex-1 h-px bg-amber-500/30" />
                              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                🌐 {getTimezoneAbbr(event.timezone, dateKey)} → {getTimezoneAbbr(event.details.arrivalTimezone, dateKey)}
                                <span className="text-amber-400/60">
                                  ({getTimezoneOffset(event.timezone, event.details.arrivalTimezone, dateKey)})
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
              </motion.div>
            );
          })}
        </div>
      )}

      {/* FAB para movil */}
      {!showForm && !editingEvent && sortedDates.length > 0 && (
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

      {/* Modal de formulario - Crear */}
      {showForm && (
        <EventForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={formLoading}
        />
      )}

      {/* Modal de formulario - Editar */}
      {editingEvent && (
        <EventForm
          initialData={editingEvent}
          onSubmit={handleUpdate}
          onCancel={() => setEditingEvent(null)}
          loading={formLoading}
        />
      )}
    </div>
  );
}
