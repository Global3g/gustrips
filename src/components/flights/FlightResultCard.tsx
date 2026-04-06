'use client';

import { Plane, Clock, MapPin, Plus, ExternalLink, Bell } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { FlightResult } from '@/lib/api/flights';

interface FlightResultCardProps {
  flight: FlightResult;
  onAddToTrip?: (flight: FlightResult) => void;
  onCreateAlert?: (flight: FlightResult) => void;
}

export default function FlightResultCard({ flight, onAddToTrip, onCreateAlert }: FlightResultCardProps) {
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency === 'MXN' ? 'MXN' : 'USD',
    }).format(price);
  };

  const getStopsLabel = (stops: number) => {
    if (stops === 0) return 'Directo';
    if (stops === 1) return '1 escala';
    return `${stops} escalas`;
  };

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Flight Info */}
        <div className="flex-1 space-y-3">
          {/* Airline & Flight Number */}
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-500/10 p-2">
              <Plane className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="font-semibold text-white">
                {flight.airline}
              </p>
              <p className="text-sm text-white/60">
                Vuelo {flight.flight_number}
              </p>
            </div>
          </div>

          {/* Route */}
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

          {/* Times & Duration */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-white/60">
              <Clock className="h-4 w-4" />
              <span>
                {flight.departure_time} - {flight.arrival_time}
              </span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-white/60">{flight.duration}</span>
            <div className="h-4 w-px bg-white/10" />
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                flight.stops === 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {getStopsLabel(flight.stops)}
            </span>
          </div>
        </div>

        {/* Price & Action */}
        <div className="flex items-center gap-4 md:flex-col md:items-end">
          <div className="flex-1 md:flex-none text-right">
            <p className="text-2xl font-bold text-cyan-400">
              {formatPrice(flight.price, flight.currency)}
            </p>
            <p className="text-xs text-white/50">{flight.currency}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => window.open(flight.booking_link, '_blank')}
              icon={ExternalLink}
              className="whitespace-nowrap"
            >
              Ver en Google Flights
            </Button>

            {onCreateAlert && (
              <Button
                onClick={() => onCreateAlert(flight)}
                icon={Bell}
                variant="ghost"
                className="whitespace-nowrap text-purple-400 hover:bg-purple-500/10"
              >
                Crear alerta
              </Button>
            )}

            {onAddToTrip && (
              <Button
                onClick={() => onAddToTrip(flight)}
                icon={Plus}
                variant="ghost"
                className="whitespace-nowrap"
              >
                Agregar a viaje
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
