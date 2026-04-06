'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, MapPin, Calendar, Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import type { FlightResult } from '@/lib/api/flights';
import type { Trip } from '@/types';
import { addDoc, collection } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

interface AddToTripModalProps {
  flight: FlightResult;
  trips: Trip[];
  onClose: () => void;
}

export default function AddToTripModal({ flight, trips, onClose }: AddToTripModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedTripId, setSelectedTripId] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const tripOptions = [
    { value: '', label: 'Selecciona un viaje...' },
    ...trips.map((trip) => ({
      value: trip.id,
      label: trip.title,
    })),
  ];

  const handleAddToTrip = async () => {
    if (!selectedTripId || !departureDate || !user) {
      return;
    }

    setLoading(true);

    try {
      // Crear evento de vuelo en Firestore
      const db = getClientDb();
      await addDoc(collection(db, 'trips', selectedTripId, 'events'), {
        title: `Vuelo ${flight.origin} → ${flight.destination}`,
        type: 'flight',
        date: departureDate,
        startTime: flight.departure_time,
        endTime: flight.arrival_time,
        location: `${flight.origin} → ${flight.destination}`,
        notes: `${flight.airline} ${flight.flight_number}`,
        cost: flight.price,
        currency: flight.currency,
        attachments: [],
        details: {
          airline: flight.airline,
          flightNumber: flight.flight_number,
          origin: flight.origin,
          destination: flight.destination,
          duration: flight.duration,
          stops: flight.stops.toString(),
        },
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });

      setSuccess(true);

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push(`/trips/${selectedTripId}/itinerary`);
      }, 2000);
    } catch (error) {
      console.error('Error al agregar vuelo:', error);
      alert('Error al agregar el vuelo al viaje');
      setLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency === 'MXN' ? 'MXN' : 'USD',
    }).format(price);
  };

  if (success) {
    return (
      <Modal open onClose={onClose} title="Vuelo agregado">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-green-500/20 p-4 mb-4">
            <Check className="h-12 w-12 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            ¡Vuelo agregado exitosamente!
          </h3>
          <p className="text-white/60 mb-4">
            Redirigiendo al itinerario del viaje...
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Agregar vuelo a viaje">
      <div className="space-y-4">
        {/* Flight Summary */}
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-cyan-400" />
              <p className="font-semibold text-white">
                {flight.airline} {flight.flight_number}
              </p>
            </div>

            <div className="flex items-center gap-3 text-white/80">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-cyan-400" />
                <span className="font-medium">{flight.origin}</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/50 to-blue-500/50" />
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400" />
                <span className="font-medium">{flight.destination}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">{flight.duration}</span>
              <span className="text-2xl font-bold text-cyan-400">
                {formatPrice(flight.price, flight.currency)}
              </span>
            </div>
          </div>
        </Card>

        {/* Form */}
        <div className="space-y-3">
          <Select
            label="Viaje"
            options={tripOptions}
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            required
          />

          <Input
            label="Fecha de salida"
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            required
          />
        </div>

        {trips.length === 0 && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-400">
            No tienes viajes creados. Crea un viaje primero para agregar este vuelo.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleAddToTrip}
            disabled={!selectedTripId || !departureDate || trips.length === 0}
            loading={loading}
            className="flex-1"
          >
            Agregar al viaje
          </Button>
        </div>
      </div>
    </Modal>
  );
}
