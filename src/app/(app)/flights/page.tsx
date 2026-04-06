'use client';

import { useState } from 'react';
import { Plane, Search, TrendingDown, Calendar, Sparkles } from 'lucide-react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import AirportAutocomplete from '@/components/ui/AirportAutocomplete';
import { searchFlights, searchDates, type FlightResult, type DateResult } from '@/lib/api/flights';
import FlightResultCard from '@/components/flights/FlightResultCard';
import CheapDatesView from '@/components/flights/CheapDatesView';
import AddToTripModal from '@/components/flights/AddToTripModal';
import CreateAlertModal from '@/components/alerts/CreateAlertModal';
import { useTrips } from '@/hooks/useTrips';
import { useAuth } from '@/hooks/useAuth';

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

type ViewMode = 'flights' | 'dates';

export default function FlightsPage() {
  const { trips } = useTrips();
  const { user } = useAuth();

  // Search params
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [cabinClass, setCabinClass] = useState('ECONOMY');
  const [maxStops, setMaxStops] = useState('ANY');
  const [sortBy, setSortBy] = useState('CHEAPEST');
  const [passengers, setPassengers] = useState('1');

  // Date search params
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripDuration, setTripDuration] = useState('7');

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('flights');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [flightResults, setFlightResults] = useState<FlightResult[]>([]);
  const [dateResults, setDateResults] = useState<DateResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightResult | null>(null);
  const [showAddToTrip, setShowAddToTrip] = useState(false);
  const [selectedFlightForAlert, setSelectedFlightForAlert] = useState<FlightResult | null>(null);
  const [showCreateAlert, setShowCreateAlert] = useState(false);

  const handleFlightSearch = async () => {
    if (!origin || !destination || !departureDate) {
      setError('Completa origen, destino y fecha de salida');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(false);
    setFlightResults([]);

    try {
      const response = await searchFlights({
        origin,
        destination,
        departureDate,
        returnDate: returnDate || undefined,
        cabinClass: cabinClass as any,
        maxStops: maxStops as any,
        sortBy: sortBy as any,
        passengers: parseInt(passengers) || 1,
      });

      setFlightResults(response.flights || []);
      setSearched(true);

      if (response.flights.length === 0) {
        setError('No se encontraron vuelos para esta búsqueda');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar vuelos');
      setFlightResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSearch = async () => {
    if (!origin || !destination || !startDate || !endDate) {
      setError('Completa todos los campos para buscar fechas baratas');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(false);
    setDateResults([]);

    try {
      const response = await searchDates({
        origin,
        destination,
        startDate,
        endDate,
        tripDuration: parseInt(tripDuration) || 7,
        isRoundTrip: true,
        cabinClass,
      });

      setDateResults(response.dates || []);
      setSearched(true);

      if (response.dates.length === 0) {
        setError('No se encontraron fechas en este rango');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar fechas');
      setDateResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToTrip = (flight: FlightResult) => {
    setSelectedFlight(flight);
    setShowAddToTrip(true);
  };

  const handleCreateAlert = (flight: FlightResult) => {
    setSelectedFlightForAlert(flight);
    setShowCreateAlert(true);
  };

  const handleSelectDate = (date: DateResult) => {
    setDepartureDate(date.departure_date);
    setReturnDate(date.return_date);
    setViewMode('flights');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-3">
            <Plane className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Buscar Vuelos</h1>
            <p className="text-sm text-white/60">
              Encuentra las mejores opciones para tu próximo viaje
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('flights')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              viewMode === 'flights'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Search className="h-4 w-4" />
            Buscar Vuelos
          </button>
          <button
            onClick={() => setViewMode('dates')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              viewMode === 'dates'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            Fechas Más Baratas
          </button>
        </div>

        {/* Search Form */}
        <Card>
          <div className="space-y-4">
            {/* Origin & Destination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AirportAutocomplete
                label="Origen"
                placeholder="Buscar ciudad o aeropuerto..."
                value={origin}
                onChange={setOrigin}
              />
              <AirportAutocomplete
                label="Destino"
                placeholder="Buscar ciudad o aeropuerto..."
                value={destination}
                onChange={setDestination}
              />
            </div>

            {/* Conditional Date Inputs */}
            {viewMode === 'flights' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Fecha de salida"
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                />
                <Input
                  label="Fecha de regreso (opcional)"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Fecha inicio"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label="Fecha fin"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <Input
                  label="Duración del viaje (días)"
                  type="number"
                  min="1"
                  max="30"
                  value={tripDuration}
                  onChange={(e) => setTripDuration(e.target.value)}
                />
              </div>
            )}

            {/* Filters (only for flight search) */}
            {viewMode === 'flights' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <Select
                  label="Ordenar por"
                  options={SORT_OPTIONS}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
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
            )}

            {/* Search Button */}
            <Button
              onClick={viewMode === 'flights' ? handleFlightSearch : handleDateSearch}
              loading={loading}
              className="w-full"
              icon={viewMode === 'flights' ? Search : Sparkles}
            >
              {loading
                ? 'Buscando...'
                : viewMode === 'flights'
                ? 'Buscar Vuelos'
                : 'Encontrar Fechas Baratas'}
            </Button>
          </div>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {searched && viewMode === 'flights' && flightResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {flightResults.length} vuelo{flightResults.length !== 1 ? 's' : ''} encontrado
                {flightResults.length !== 1 ? 's' : ''}
              </h2>
            </div>

            <div className="grid gap-4">
              {flightResults.map((flight, index) => (
                <FlightResultCard
                  key={index}
                  flight={flight}
                  onAddToTrip={handleAddToTrip}
                  onCreateAlert={handleCreateAlert}
                />
              ))}
            </div>
          </div>
        )}

        {searched && viewMode === 'dates' && dateResults.length > 0 && (
          <CheapDatesView dates={dateResults} onSelectDate={handleSelectDate} />
        )}

        {/* Empty State */}
        {!searched && !loading && (
          <EmptyState
            icon={viewMode === 'flights' ? Search : TrendingDown}
            title={
              viewMode === 'flights'
                ? 'Busca vuelos disponibles'
                : 'Encuentra las mejores fechas'
            }
            description={
              viewMode === 'flights'
                ? 'Ingresa origen, destino y fecha para comenzar'
                : 'Busca en un rango de fechas para encontrar los precios más bajos'
            }
          />
        )}

        {searched && !loading && flightResults.length === 0 && dateResults.length === 0 && !error && (
          <EmptyState
            icon={Plane}
            title="No se encontraron resultados"
            description="Intenta ajustar los filtros de búsqueda o las fechas"
          />
        )}
      </div>

      {/* Add to Trip Modal */}
      {showAddToTrip && selectedFlight && (
        <AddToTripModal
          flight={selectedFlight}
          trips={trips}
          onClose={() => {
            setShowAddToTrip(false);
            setSelectedFlight(null);
          }}
        />
      )}

      {/* Create Alert Modal */}
      {showCreateAlert && selectedFlightForAlert && user && (
        <CreateAlertModal
          userId={user.uid}
          userEmail={user.email || ''}
          defaultOrigin={selectedFlightForAlert.origin}
          defaultDestination={selectedFlightForAlert.destination}
          defaultPrice={selectedFlightForAlert.price}
          onClose={() => {
            setShowCreateAlert(false);
            setSelectedFlightForAlert(null);
          }}
          onSuccess={() => {
            setShowCreateAlert(false);
            setSelectedFlightForAlert(null);
          }}
        />
      )}
    </div>
  );
}
