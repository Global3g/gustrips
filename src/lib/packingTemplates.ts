/**
 * Smart packing templates — Maleta inteligente.
 *
 * Each template is a curated list of items for a specific trip type.
 * Templates are merged into the user's packing list when they apply one,
 * and the trip-level template (lib/tripTemplates) also references a
 * packing template id so creating a trip can seed the maleta in one shot.
 *
 * `weatherDependent` is a hint the AI suggester (and future weather
 * widget) can use to suppress winter gear on a beach trip or vice versa.
 */

export type PackingCategory =
  | 'ropa'
  | 'calzado'
  | 'aseo'
  | 'documentos'
  | 'electronica'
  | 'medicacion'
  | 'accesorios'
  | 'comida'
  | 'otros';

export interface PackingTemplateItem {
  name: string;
  category: PackingCategory;
  quantity: number;
  optional: boolean;
  weatherDependent?: 'cold' | 'warm' | 'rain';
}

export type PackingTemplateId = 'BEACH' | 'SKI' | 'CITY' | 'ROADTRIP';

export interface PackingTemplate {
  id: PackingTemplateId;
  label: string;
  description: string;
  items: PackingTemplateItem[];
}

const BEACH: PackingTemplate = {
  id: 'BEACH',
  label: 'Playa',
  description: 'Sol, arena y mar — todo lo esencial para una escapada costera.',
  items: [
    { name: 'Malla / traje de baño', category: 'ropa', quantity: 2, optional: false, weatherDependent: 'warm' },
    { name: 'Remera / musculosa liviana', category: 'ropa', quantity: 5, optional: false, weatherDependent: 'warm' },
    { name: 'Short', category: 'ropa', quantity: 3, optional: false, weatherDependent: 'warm' },
    { name: 'Vestido o pareo', category: 'ropa', quantity: 2, optional: true, weatherDependent: 'warm' },
    { name: 'Campera liviana para la noche', category: 'ropa', quantity: 1, optional: false },
    { name: 'Ropa interior', category: 'ropa', quantity: 7, optional: false },
    { name: 'Pijama', category: 'ropa', quantity: 1, optional: true },
    { name: 'Ojotas', category: 'calzado', quantity: 1, optional: false, weatherDependent: 'warm' },
    { name: 'Sandalias / zapatillas livianas', category: 'calzado', quantity: 1, optional: false },
    { name: 'Toalla de playa / microfibra', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Bloqueador solar FPS 50+', category: 'aseo', quantity: 1, optional: false, weatherDependent: 'warm' },
    { name: 'After sun / aloe vera', category: 'aseo', quantity: 1, optional: true, weatherDependent: 'warm' },
    { name: 'Repelente de mosquitos', category: 'aseo', quantity: 1, optional: false },
    { name: 'Gorra o sombrero', category: 'accesorios', quantity: 1, optional: false, weatherDependent: 'warm' },
    { name: 'Anteojos de sol', category: 'accesorios', quantity: 1, optional: false, weatherDependent: 'warm' },
    { name: 'Botella de agua reutilizable', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Shampoo / acondicionador (viaje)', category: 'aseo', quantity: 1, optional: false },
    { name: 'Cepillo y pasta de dientes', category: 'aseo', quantity: 1, optional: false },
    { name: 'Desodorante', category: 'aseo', quantity: 1, optional: false },
    { name: 'Snacks no perecederos', category: 'comida', quantity: 1, optional: true },
    { name: 'Bolsa estanca para celular', category: 'accesorios', quantity: 1, optional: true },
    { name: 'Cargador de celular', category: 'electronica', quantity: 1, optional: false },
    { name: 'Libro o e-reader', category: 'accesorios', quantity: 1, optional: true },
    { name: 'DNI / pasaporte', category: 'documentos', quantity: 1, optional: false },
    { name: 'Tarjetas y efectivo', category: 'documentos', quantity: 1, optional: false },
  ],
};

const SKI: PackingTemplate = {
  id: 'SKI',
  label: 'Ski / Nieve',
  description: 'Capas térmicas y protección para días de pista.',
  items: [
    { name: 'Campera de ski impermeable', category: 'ropa', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Pantalón de ski', category: 'ropa', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Primera piel térmica (top)', category: 'ropa', quantity: 2, optional: false, weatherDependent: 'cold' },
    { name: 'Primera piel térmica (bottom)', category: 'ropa', quantity: 2, optional: false, weatherDependent: 'cold' },
    { name: 'Polar / segunda capa', category: 'ropa', quantity: 2, optional: false, weatherDependent: 'cold' },
    { name: 'Guantes impermeables', category: 'accesorios', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Gorro / beanie', category: 'accesorios', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Cuello / buff', category: 'accesorios', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Antiparras / goggles', category: 'accesorios', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Anteojos de sol UV alto', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Medias térmicas de ski', category: 'ropa', quantity: 4, optional: false, weatherDependent: 'cold' },
    { name: 'Botas après-ski', category: 'calzado', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Ropa cómoda para el hotel', category: 'ropa', quantity: 2, optional: false },
    { name: 'Bloqueador solar FPS 50+ (sí, en la nieve)', category: 'aseo', quantity: 1, optional: false },
    { name: 'Bálsamo labial con FPS', category: 'aseo', quantity: 1, optional: false, weatherDependent: 'cold' },
    { name: 'Crema hidratante para el frío', category: 'aseo', quantity: 1, optional: true, weatherDependent: 'cold' },
    { name: 'Termo con bebida caliente', category: 'accesorios', quantity: 1, optional: true, weatherDependent: 'cold' },
    { name: 'Mochila pequeña para la pista', category: 'accesorios', quantity: 1, optional: true },
    { name: 'Cargador de celular', category: 'electronica', quantity: 1, optional: false },
    { name: 'Documentos y pase de ski', category: 'documentos', quantity: 1, optional: false },
  ],
};

const CITY: PackingTemplate = {
  id: 'CITY',
  label: 'Ciudad',
  description: 'Recorridos urbanos, museos y caminatas largas.',
  items: [
    { name: 'Zapatillas cómodas para caminar', category: 'calzado', quantity: 1, optional: false },
    { name: 'Calzado para salir a la noche', category: 'calzado', quantity: 1, optional: true },
    { name: 'Remeras / camisas', category: 'ropa', quantity: 5, optional: false },
    { name: 'Pantalón o jean', category: 'ropa', quantity: 2, optional: false },
    { name: 'Buzo o sweater', category: 'ropa', quantity: 2, optional: false },
    { name: 'Campera mediana', category: 'ropa', quantity: 1, optional: false },
    { name: 'Outfit para salida especial', category: 'ropa', quantity: 1, optional: true },
    { name: 'Ropa interior', category: 'ropa', quantity: 7, optional: false },
    { name: 'Medias', category: 'ropa', quantity: 7, optional: false },
    { name: 'Pijama', category: 'ropa', quantity: 1, optional: true },
    { name: 'Paraguas plegable', category: 'accesorios', quantity: 1, optional: false, weatherDependent: 'rain' },
    { name: 'Mochila o bolso día', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Adaptador de enchufe', category: 'electronica', quantity: 1, optional: false },
    { name: 'Cargador de celular', category: 'electronica', quantity: 1, optional: false },
    { name: 'Power bank', category: 'electronica', quantity: 1, optional: true },
    { name: 'Auriculares', category: 'electronica', quantity: 1, optional: true },
    { name: 'Cámara de fotos', category: 'electronica', quantity: 1, optional: true },
    { name: 'Anteojos de sol', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Botella de agua reutilizable', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Cepillo y pasta de dientes', category: 'aseo', quantity: 1, optional: false },
    { name: 'Shampoo / acondicionador (viaje)', category: 'aseo', quantity: 1, optional: false },
    { name: 'Desodorante', category: 'aseo', quantity: 1, optional: false },
    { name: 'Perfume', category: 'aseo', quantity: 1, optional: true },
    { name: 'Maquillaje básico', category: 'aseo', quantity: 1, optional: true },
    { name: 'Analgésicos (ibuprofeno / paracetamol)', category: 'medicacion', quantity: 1, optional: false },
    { name: 'Curitas / antiampollas', category: 'medicacion', quantity: 1, optional: true },
    { name: 'Mapa offline / app de transporte', category: 'electronica', quantity: 1, optional: true },
    { name: 'DNI / pasaporte', category: 'documentos', quantity: 1, optional: false },
    { name: 'Tarjetas y efectivo local', category: 'documentos', quantity: 1, optional: false },
    { name: 'Tarjeta de transporte urbano', category: 'documentos', quantity: 1, optional: true },
  ],
};

const ROADTRIP: PackingTemplate = {
  id: 'ROADTRIP',
  label: 'Roadtrip',
  description: 'Para horas de ruta, paradas y mucho mate.',
  items: [
    { name: 'Mate, bombilla y yerba', category: 'comida', quantity: 1, optional: true },
    { name: 'Termo con agua caliente', category: 'comida', quantity: 1, optional: false },
    { name: 'Almohada de cuello / viaje', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Manta liviana', category: 'accesorios', quantity: 1, optional: true },
    { name: 'Snacks (frutos secos, barritas, galletitas)', category: 'comida', quantity: 1, optional: false },
    { name: 'Agua en bidón', category: 'comida', quantity: 1, optional: false },
    { name: 'Cargador de auto (12V o USB)', category: 'electronica', quantity: 1, optional: false },
    { name: 'Power bank', category: 'electronica', quantity: 1, optional: false },
    { name: 'Cable HDMI / aux para música', category: 'electronica', quantity: 1, optional: true },
    { name: 'Playlist offline descargada', category: 'electronica', quantity: 1, optional: false },
    { name: 'Anteojos de sol', category: 'accesorios', quantity: 1, optional: false },
    { name: 'Gorra', category: 'accesorios', quantity: 1, optional: true, weatherDependent: 'warm' },
    { name: 'Ropa cómoda para manejar', category: 'ropa', quantity: 3, optional: false },
    { name: 'Calzado cómodo', category: 'calzado', quantity: 1, optional: false },
    { name: 'Buzo / abrigo liviano', category: 'ropa', quantity: 1, optional: false },
    { name: 'Ropa interior', category: 'ropa', quantity: 5, optional: false },
    { name: 'Toallita de mano / wipes', category: 'aseo', quantity: 1, optional: false },
    { name: 'Bolsas de basura', category: 'otros', quantity: 1, optional: false },
    { name: 'Botiquín básico', category: 'medicacion', quantity: 1, optional: false },
    { name: 'Documentos del auto (cédula, seguro)', category: 'documentos', quantity: 1, optional: false },
    { name: 'Licencia de conducir', category: 'documentos', quantity: 1, optional: false },
    { name: 'Efectivo para peajes y nafta', category: 'documentos', quantity: 1, optional: false },
    { name: 'Mapa offline / GPS', category: 'electronica', quantity: 1, optional: false },
    { name: 'Cooler / conservadora chica', category: 'otros', quantity: 1, optional: true },
    { name: 'Linterna o frontal', category: 'otros', quantity: 1, optional: true },
  ],
};

export const PACKING_TEMPLATES: Record<PackingTemplateId, PackingTemplate> = {
  BEACH,
  SKI,
  CITY,
  ROADTRIP,
};

export const PACKING_TEMPLATE_LIST: PackingTemplate[] = [BEACH, SKI, CITY, ROADTRIP];

/** Stable list of every category that can appear in a packing list. */
export const PACKING_CATEGORIES: PackingCategory[] = [
  'ropa',
  'calzado',
  'aseo',
  'documentos',
  'electronica',
  'medicacion',
  'accesorios',
  'comida',
  'otros',
];

export const PACKING_CATEGORY_LABEL: Record<PackingCategory, string> = {
  ropa: 'Ropa',
  calzado: 'Calzado',
  aseo: 'Aseo personal',
  documentos: 'Documentos',
  electronica: 'Electrónica',
  medicacion: 'Medicación',
  accesorios: 'Accesorios',
  comida: 'Comida y bebida',
  otros: 'Otros',
};
