'use client';

import { useState } from 'react';
import { Plane, Loader2, Search, TrendingDown } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { searchFlights, type FlightResult } from '@/lib/api/flights';

interface FlightSearchModalProps {
  onClose: () => void;
  onSelectFlight: (flight: FlightResult) => void;
  initialOrigin?: string;
  initialDestination?: string;
  initialDate?: string;
}

const CABIN_CLASSES = [
  { value: 'ECONOMY', label: 'Económica' },
  { value: 'PREMIUM_ECONOMY', label: 'Económica Premium' },
  { value: 'BUSINESS', label: 'Ejecutiva' },
  { value: 'FIRST', label: 'Primera Clase' },
];

const STOPS_OPTIONS = [
  { value: 'ANY', label: 'Cualquiera' },
  { value: 'NON_STOP', label: 'Directo' },
  { value: 'ONE_STOP', label: 'Máx. 1 escala' },
  { value: 'TWO_PLUS_STOPS', label: '2+ escalas' },
];

const SORT_OPTIONS = [
  { value: 'CHEAPEST', label: 'Más barato' },
  { value: 'DURATION', label: 'Menor duración' },
  { value: 'DEPARTURE_TIME', label: 'Hora de salida' },
  { value: 'ARRIVAL_TIME', label: 'Hora de llegada' },
];

export default function FlightSearchModal({
  onClose,
  onSelectFlight,
  initialOrigin = '',
  initialDestination = '',
  initialDate = '',
}: FlightSearchModalProps) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [departureDate, setDepartureDate] = useState(initialDate);
  const [returnDate, setReturnDate] = useState('');
  const [cabinClass, setCabinClass] = useState('ECONOMY');
  const [maxStops, setMaxStops] = useState('ANY');
  const [sortBy, setSortBy] = useState('CHEAPEST');
  const [passengers, setPassengers] = useState('1');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<FlightResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!origin || !destination || !departureDate) {
      setError('Completa origen, destino y fecha de salida');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(false);

    try {
      const response = await searchFlights({
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departureDate,
        returnDate: returnDate || undefined,
        cabinClass: cabinClass as any,
        maxStops: maxStops as any,
        sortBy: sortBy as any,
        passengers: parseInt(passengers) || 1,
      });

      setResults(response.flights || []);
      setSearched(true);

      if (response.flights.length === 0) {
        setError('No se encontraron vuelos para esta búsqueda');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar vuelos');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

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
    <Modal open onClose={onClose} title="Buscar Vuelos" size="large">
      <div className="space-y-4">
        {/* Formulario de búsqueda */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Origen (IATA)"
              placeholder="GDL"
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              maxLength={3}
              required
            />
            <Input
              label="Destino (IATA)"
              placeholder="CUN"
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
              maxLength={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fecha de salida"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              required
            />
            <Input
              label="Fecha de regreso (opcional)"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Clase"
              options={CABIN_CLASSES}
              value={cabinClass}
              onChange={(e) => setCabinClass(e.target.value)}
            />
            <Select
              label="Escalas"
              options={STOPS_OPTIONS}
              value={maxStops}
              onChange={(e) => setMaxStops(e.target.value)}
            />
            <Input
              label="Pasajeros"
              type="number"
              min="1"
              max="9"
              value={passengers}
              onChange={(e) => setPassengers(e.target.value)}
            />
          </div>

          <Select
            label="Ordenar por"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />

          <Button
            onClick={handleSearch}
            loading={loading}
            className="w-full"
            icon={Search}
          >
            {loading ? 'Buscando...' : 'Buscar Vuelos'}
          </Button>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Resultados */}
        {searched && results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">
                {results.length} vuelo{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
              {results.map((flight, index) => (
                <button
                  key={index}
                  onClick={() => onSelectFlight(flight)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-cyan-500/50 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4 text-cyan-400" />
                        <p className="font-medium text-white">
                          {flight.airline} {flight.flight_number}
                        </p>
                      </div>

                      <div className="text-sm text-white/60">
                        {flight.origin} → {flight.destination}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-white/50">
                        <span>{flight.departure_time} - {flight.arrival_time}</span>
                        <span>•</span>
                        <span>{flight.duration}</span>
                        <span>•</span>
                        <span>{getStopsLabel(flight.stops)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-semibold text-cyan-400">
                        {formatPrice(flight.price, flight.currency)}
                      </p>
                      <p className="text-xs text-white/50">{flight.currency}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {searched && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-white/5 p-4 mb-3">
              <Plane className="h-8 w-8 text-white/40" />
            </div>
            <p className="text-white/60">No se encontraron vuelos</p>
            <p className="text-sm text-white/40 mt-1">
              Intenta ajustar los filtros de búsqueda
            </p>
          </div>
        )}

        {/* Estado inicial */}
        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-cyan-500/10 p-4 mb-3">
              <Search className="h-8 w-8 text-cyan-400" />
            </div>
            <p className="text-white/60">Busca vuelos disponibles</p>
            <p className="text-sm text-white/40 mt-1">
              Completa el formulario y presiona Buscar
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
