// ─── Tipos ─────────────────────────────────────────────

export interface FlightResult {
  airline: string;
  flight_number: string;
  price: number;
  currency: string;
  duration: string;
  departure_time: string;
  arrival_time: string;
  stops: number;
  origin: string;
  destination: string;
  booking_link: string;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  maxStops?: 'ANY' | 'NON_STOP' | 'ONE_STOP' | 'TWO_PLUS_STOPS';
  sortBy?: 'CHEAPEST' | 'DURATION' | 'DEPARTURE_TIME' | 'ARRIVAL_TIME';
  passengers?: number;
}

export interface FlightSearchResponse {
  cached: boolean;
  count: number;
  flights: FlightResult[];
}

export interface DateResult {
  departure_date: string;
  return_date: string;
  price: number;
  currency: string;
}

export interface DateSearchParams {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripDuration?: number;
  isRoundTrip?: boolean;
  cabinClass?: string;
}

export interface DateSearchResponse {
  cached: boolean;
  count: number;
  dates: DateResult[];
}

// ─── Configuración ─────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_FLIGHT_API_URL || 'http://localhost:8000';

// ─── Funciones auxiliares ─────────────────────────────

function buildQueryParams(params: Record<string, any>): string {
  const cleanParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = String(value);
    }
  }

  return new URLSearchParams(cleanParams).toString();
}

// ─── API Functions ─────────────────────────────────────

/**
 * Busca vuelos usando la API de Google Flights
 */
export async function searchFlights(
  params: FlightSearchParams
): Promise<FlightSearchResponse> {
  const queryParams = buildQueryParams({
    origin: params.origin,
    destination: params.destination,
    departure_date: params.departureDate,
    return_date: params.returnDate,
    cabin_class: params.cabinClass || 'ECONOMY',
    max_stops: params.maxStops || 'ANY',
    sort_by: params.sortBy || 'CHEAPEST',
    passengers: params.passengers || 1,
  });

  const response = await fetch(`${API_BASE_URL}/api/flights/search?${queryParams}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

/**
 * Busca las fechas más baratas en un rango
 */
export async function searchDates(
  params: DateSearchParams
): Promise<DateSearchResponse> {
  const queryParams = buildQueryParams({
    origin: params.origin,
    destination: params.destination,
    start_date: params.startDate,
    end_date: params.endDate,
    trip_duration: params.tripDuration || 7,
    is_round_trip: params.isRoundTrip !== false,
    cabin_class: params.cabinClass || 'ECONOMY',
  });

  const response = await fetch(`${API_BASE_URL}/api/flights/dates?${queryParams}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

/**
 * Verifica el estado de la API
 */
export async function checkHealth(): Promise<{ status: string; fli_available: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return response.json();
}
