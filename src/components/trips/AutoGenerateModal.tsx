'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
// Trip + events from the layout-level TripDataProvider — modal only opens
// inside `/trips/[tripId]/itinerary`.
import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
} from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { generateRecurringEvents } from '@/lib/utils/autoGenerateEvents';
import type { MealPreferences } from '@/types';

interface AutoGenerateModalProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
}

export default function AutoGenerateModal({ open, onClose, tripId: _tripId }: AutoGenerateModalProps) {
  const { trip, updateTrip } = useTrip();
  const { events, createEvent } = useEvents();
  const { toast } = useToast();

  const existing = trip?.mealPreferences;

  const [breakfast, setBreakfast] = useState(existing?.breakfast || '08:00');
  const [lunch, setLunch] = useState(existing?.lunch || '13:00');
  const [dinner, setDinner] = useState(existing?.dinner || '19:00');
  const [mealCost, setMealCost] = useState(existing?.defaultMealCost ?? 0);
  const [hotelCost, setHotelCost] = useState(existing?.defaultHotelCost ?? 0);
  const [transferCost, setTransferCost] = useState(existing?.defaultTransferCost ?? 0);
  const [loading, setLoading] = useState(false);

  const currency = trip?.budgetCurrency || 'MXN';

  const handleSubmit = async () => {
    if (!trip) return;
    setLoading(true);

    try {
      const preferences: MealPreferences = {
        breakfast,
        lunch,
        dinner,
        defaultMealCost: mealCost,
        defaultHotelCost: hotelCost,
        defaultTransferCost: transferCost,
      };

      // Save preferences to trip
      await updateTrip({ mealPreferences: preferences });

      // Generate events
      const eventsToCreate = generateRecurringEvents(trip, preferences, events);

      // Create events in batches
      let count = 0;
      for (const eventData of eventsToCreate) {
        await createEvent(eventData);
        count++;
      }

      toast(`${count} eventos generados automaticamente`, 'success');
      onClose();
    } catch {
      toast('Error al generar eventos', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Auto-generar Eventos Recurrentes"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button icon={Sparkles} onClick={handleSubmit} loading={loading}>
            Generar Eventos
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Meal times */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Horarios de comidas</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desayuno</label>
              <input
                type="time"
                value={breakfast}
                onChange={(e) => setBreakfast(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Comida</label>
              <input
                type="time"
                value={lunch}
                onChange={(e) => setLunch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cena</label>
              <input
                type="time"
                value={dinner}
                onChange={(e) => setDinner(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Default costs */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Costos por defecto ({currency})</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 w-24">Comida</label>
              <input
                type="number"
                min={0}
                value={mealCost}
                onChange={(e) => setMealCost(Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 w-24">Hotel/noche</label>
              <input
                type="number"
                min={0}
                value={hotelCost}
                onChange={(e) => setHotelCost(Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 w-24">Traslado</label>
              <input
                type="number"
                min={0}
                value={transferCost}
                onChange={(e) => setTransferCost(Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-gray-400">
          Se generaran comidas diarias, hotel por noche (excepto ultimo dia y dias de crucero),
          y traslados aeropuerto basados en vuelos existentes. No se duplicaran eventos ya existentes.
        </p>
      </div>
    </Modal>
  );
}
