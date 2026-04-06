export interface Airport {
  code: string;
  city: string;
  country: string;
  name: string;
}

export const AIRPORTS: Airport[] = [
  // México
  { code: 'GDL', city: 'Guadalajara', country: 'México', name: 'Aeropuerto Internacional de Guadalajara' },
  { code: 'MEX', city: 'Ciudad de México', country: 'México', name: 'Aeropuerto Internacional Benito Juárez' },
  { code: 'CUN', city: 'Cancún', country: 'México', name: 'Aeropuerto Internacional de Cancún' },
  { code: 'MTY', city: 'Monterrey', country: 'México', name: 'Aeropuerto Internacional de Monterrey' },
  { code: 'TIJ', city: 'Tijuana', country: 'México', name: 'Aeropuerto Internacional de Tijuana' },
  { code: 'BJX', city: 'León/Bajío', country: 'México', name: 'Aeropuerto Internacional del Bajío' },
  { code: 'PVR', city: 'Puerto Vallarta', country: 'México', name: 'Aeropuerto Internacional de Puerto Vallarta' },
  { code: 'SJD', city: 'Los Cabos', country: 'México', name: 'Aeropuerto Internacional de Los Cabos' },
  { code: 'MZT', city: 'Mazatlán', country: 'México', name: 'Aeropuerto Internacional de Mazatlán' },
  { code: 'CUL', city: 'Culiacán', country: 'México', name: 'Aeropuerto Internacional de Culiacán' },
  { code: 'HMO', city: 'Hermosillo', country: 'México', name: 'Aeropuerto Internacional de Hermosillo' },
  { code: 'CUU', city: 'Chihuahua', country: 'México', name: 'Aeropuerto Internacional de Chihuahua' },
  { code: 'QRO', city: 'Querétaro', country: 'México', name: 'Aeropuerto Internacional de Querétaro' },
  { code: 'AGU', city: 'Aguascalientes', country: 'México', name: 'Aeropuerto Internacional de Aguascalientes' },
  { code: 'ZCL', city: 'Zacatecas', country: 'México', name: 'Aeropuerto Internacional de Zacatecas' },
  { code: 'OAX', city: 'Oaxaca', country: 'México', name: 'Aeropuerto Internacional de Oaxaca' },
  { code: 'MID', city: 'Mérida', country: 'México', name: 'Aeropuerto Internacional de Mérida' },
  { code: 'VSA', city: 'Villahermosa', country: 'México', name: 'Aeropuerto Internacional de Villahermosa' },
  { code: 'VER', city: 'Veracruz', country: 'México', name: 'Aeropuerto Internacional de Veracruz' },
  { code: 'TAP', city: 'Tapachula', country: 'México', name: 'Aeropuerto Internacional de Tapachula' },
  { code: 'CEN', city: 'Ciudad Obregón', country: 'México', name: 'Aeropuerto Internacional de Ciudad Obregón' },
  { code: 'CTM', city: 'Chetumal', country: 'México', name: 'Aeropuerto Internacional de Chetumal' },
  { code: 'ZIH', city: 'Ixtapa', country: 'México', name: 'Aeropuerto Internacional de Ixtapa' },
  { code: 'HUX', city: 'Huatulco', country: 'México', name: 'Aeropuerto Internacional de Huatulco' },
  { code: 'ACA', city: 'Acapulco', country: 'México', name: 'Aeropuerto Internacional de Acapulco' },
  { code: 'ZLO', city: 'Manzanillo', country: 'México', name: 'Aeropuerto Internacional de Manzanillo' },

  // Estados Unidos
  { code: 'LAX', city: 'Los Ángeles', country: 'Estados Unidos', name: 'Los Angeles International Airport' },
  { code: 'JFK', city: 'Nueva York', country: 'Estados Unidos', name: 'John F. Kennedy International Airport' },
  { code: 'MIA', city: 'Miami', country: 'Estados Unidos', name: 'Miami International Airport' },
  { code: 'ORD', city: 'Chicago', country: 'Estados Unidos', name: "O'Hare International Airport" },
  { code: 'SFO', city: 'San Francisco', country: 'Estados Unidos', name: 'San Francisco International Airport' },
  { code: 'LAS', city: 'Las Vegas', country: 'Estados Unidos', name: 'Harry Reid International Airport' },
  { code: 'DFW', city: 'Dallas', country: 'Estados Unidos', name: 'Dallas/Fort Worth International Airport' },
  { code: 'IAH', city: 'Houston', country: 'Estados Unidos', name: 'George Bush Intercontinental Airport' },
  { code: 'PHX', city: 'Phoenix', country: 'Estados Unidos', name: 'Phoenix Sky Harbor International Airport' },
  { code: 'SAN', city: 'San Diego', country: 'Estados Unidos', name: 'San Diego International Airport' },
  { code: 'SEA', city: 'Seattle', country: 'Estados Unidos', name: 'Seattle-Tacoma International Airport' },
  { code: 'BOS', city: 'Boston', country: 'Estados Unidos', name: 'Boston Logan International Airport' },
  { code: 'ATL', city: 'Atlanta', country: 'Estados Unidos', name: 'Hartsfield-Jackson Atlanta International Airport' },
  { code: 'MCO', city: 'Orlando', country: 'Estados Unidos', name: 'Orlando International Airport' },
  { code: 'DEN', city: 'Denver', country: 'Estados Unidos', name: 'Denver International Airport' },
  { code: 'MSP', city: 'Minneapolis', country: 'Estados Unidos', name: 'Minneapolis-St Paul International Airport' },
  { code: 'DTW', city: 'Detroit', country: 'Estados Unidos', name: 'Detroit Metropolitan Airport' },
  { code: 'EWR', city: 'Newark', country: 'Estados Unidos', name: 'Newark Liberty International Airport' },
  { code: 'LGA', city: 'Nueva York (LaGuardia)', country: 'Estados Unidos', name: 'LaGuardia Airport' },

  // Canadá
  { code: 'YVR', city: 'Vancouver', country: 'Canadá', name: 'Vancouver International Airport' },
  { code: 'YYZ', city: 'Toronto', country: 'Canadá', name: 'Toronto Pearson International Airport' },
  { code: 'YUL', city: 'Montreal', country: 'Canadá', name: 'Montreal-Pierre Elliott Trudeau International Airport' },

  // Latinoamérica
  { code: 'BOG', city: 'Bogotá', country: 'Colombia', name: 'El Dorado International Airport' },
  { code: 'MDE', city: 'Medellín', country: 'Colombia', name: 'José María Córdova International Airport' },
  { code: 'CTG', city: 'Cartagena', country: 'Colombia', name: 'Rafael Núñez International Airport' },
  { code: 'LIM', city: 'Lima', country: 'Perú', name: 'Jorge Chávez International Airport' },
  { code: 'CUZ', city: 'Cusco', country: 'Perú', name: 'Alejandro Velasco Astete International Airport' },
  { code: 'GRU', city: 'São Paulo', country: 'Brasil', name: 'São Paulo-Guarulhos International Airport' },
  { code: 'GIG', city: 'Rio de Janeiro', country: 'Brasil', name: 'Rio de Janeiro-Galeão International Airport' },
  { code: 'EZE', city: 'Buenos Aires', country: 'Argentina', name: 'Ministro Pistarini International Airport' },
  { code: 'SCL', city: 'Santiago', country: 'Chile', name: 'Arturo Merino Benítez International Airport' },
  { code: 'UIO', city: 'Quito', country: 'Ecuador', name: 'Mariscal Sucre International Airport' },
  { code: 'PTY', city: 'Ciudad de Panamá', country: 'Panamá', name: 'Tocumen International Airport' },
  { code: 'SJO', city: 'San José', country: 'Costa Rica', name: 'Juan Santamaría International Airport' },
  { code: 'LIR', city: 'Liberia', country: 'Costa Rica', name: 'Daniel Oduber Quirós International Airport' },
  { code: 'SAL', city: 'San Salvador', country: 'El Salvador', name: 'Monseñor Óscar Arnulfo Romero International Airport' },
  { code: 'GUA', city: 'Ciudad de Guatemala', country: 'Guatemala', name: 'La Aurora International Airport' },
  { code: 'HAV', city: 'La Habana', country: 'Cuba', name: 'José Martí International Airport' },
  { code: 'PUJ', city: 'Punta Cana', country: 'República Dominicana', name: 'Punta Cana International Airport' },
  { code: 'SDQ', city: 'Santo Domingo', country: 'República Dominicana', name: 'Las Américas International Airport' },

  // Europa
  { code: 'MAD', city: 'Madrid', country: 'España', name: 'Adolfo Suárez Madrid-Barajas Airport' },
  { code: 'BCN', city: 'Barcelona', country: 'España', name: 'Barcelona-El Prat Airport' },
  { code: 'LHR', city: 'Londres', country: 'Reino Unido', name: 'London Heathrow Airport' },
  { code: 'CDG', city: 'París', country: 'Francia', name: 'Charles de Gaulle Airport' },
  { code: 'FCO', city: 'Roma', country: 'Italia', name: 'Leonardo da Vinci-Fiumicino Airport' },
  { code: 'AMS', city: 'Ámsterdam', country: 'Países Bajos', name: 'Amsterdam Airport Schiphol' },
  { code: 'FRA', city: 'Frankfurt', country: 'Alemania', name: 'Frankfurt Airport' },
  { code: 'MUC', city: 'Múnich', country: 'Alemania', name: 'Munich Airport' },
  { code: 'LIS', city: 'Lisboa', country: 'Portugal', name: 'Lisbon Portela Airport' },
  { code: 'ZRH', city: 'Zúrich', country: 'Suiza', name: 'Zurich Airport' },
  { code: 'VIE', city: 'Viena', country: 'Austria', name: 'Vienna International Airport' },
  { code: 'IST', city: 'Estambul', country: 'Turquía', name: 'Istanbul Airport' },

  // Asia
  { code: 'NRT', city: 'Tokio', country: 'Japón', name: 'Narita International Airport' },
  { code: 'HND', city: 'Tokio (Haneda)', country: 'Japón', name: 'Tokyo Haneda Airport' },
  { code: 'ICN', city: 'Seúl', country: 'Corea del Sur', name: 'Incheon International Airport' },
  { code: 'PVG', city: 'Shanghái', country: 'China', name: 'Shanghai Pudong International Airport' },
  { code: 'PEK', city: 'Pekín', country: 'China', name: 'Beijing Capital International Airport' },
  { code: 'HKG', city: 'Hong Kong', country: 'Hong Kong', name: 'Hong Kong International Airport' },
  { code: 'SIN', city: 'Singapur', country: 'Singapur', name: 'Singapore Changi Airport' },
  { code: 'BKK', city: 'Bangkok', country: 'Tailandia', name: 'Suvarnabhumi Airport' },
  { code: 'DXB', city: 'Dubái', country: 'Emiratos Árabes Unidos', name: 'Dubai International Airport' },

  // Oceanía
  { code: 'SYD', city: 'Sídney', country: 'Australia', name: 'Sydney Kingsford Smith Airport' },
  { code: 'AKL', city: 'Auckland', country: 'Nueva Zelanda', name: 'Auckland Airport' },
];

/**
 * Search airports by code, city, or country
 */
export function searchAirports(query: string): Airport[] {
  if (!query || query.length < 2) return [];

  const searchTerm = query.toLowerCase().trim();

  return AIRPORTS.filter(airport =>
    airport.code.toLowerCase().includes(searchTerm) ||
    airport.city.toLowerCase().includes(searchTerm) ||
    airport.country.toLowerCase().includes(searchTerm)
  ).slice(0, 8); // Limit to 8 results
}
