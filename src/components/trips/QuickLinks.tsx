'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plane,
  Hotel,
  Car,
  UtensilsCrossed,
  Compass,
  Map,
  Shield,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';

/* ─── Tipos ────────────────────────────────────── */

interface QuickLink {
  name: string;
  url: string;
  logo: string; // favicon URL
}

interface LinkCategory {
  label: string;
  icon: LucideIcon;
  color: string;
  iconBg: string;
  links: QuickLink[];
}

/* ─── Datos ────────────────────────────────────── */

const LINK_CATEGORIES: LinkCategory[] = [
  {
    label: 'Vuelos',
    icon: Plane,
    color: 'border-blue-200 bg-blue-50',
    iconBg: 'bg-blue-50 text-blue-600',
    links: [
      { name: 'Google Flights', url: 'https://www.google.com/travel/flights', logo: 'https://www.google.com/favicon.ico' },
      { name: 'Skyscanner', url: 'https://www.skyscanner.com', logo: 'https://www.skyscanner.com/favicon.ico' },
      { name: 'Kayak', url: 'https://www.kayak.com', logo: 'https://www.kayak.com/favicon.ico' },
      { name: 'Kiwi', url: 'https://www.kiwi.com', logo: 'https://www.kiwi.com/favicon.ico' },
    ],
  },
  {
    label: 'Hoteles',
    icon: Hotel,
    color: 'border-violet-200 bg-violet-50',
    iconBg: 'bg-violet-50 text-violet-600',
    links: [
      { name: 'Booking.com', url: 'https://www.booking.com', logo: 'https://www.booking.com/favicon.ico' },
      { name: 'Expedia', url: 'https://www.expedia.com', logo: 'https://www.expedia.com/favicon.ico' },
      { name: 'Airbnb', url: 'https://www.airbnb.com', logo: 'https://www.airbnb.com/favicon.ico' },
      { name: 'Hotels.com', url: 'https://www.hotels.com', logo: 'https://www.hotels.com/favicon.ico' },
      { name: 'Trivago', url: 'https://www.trivago.com', logo: 'https://www.trivago.com/favicon.ico' },
    ],
  },
  {
    label: 'Renta de Autos',
    icon: Car,
    color: 'border-cyan-200 bg-cyan-50',
    iconBg: 'bg-cyan-50 text-cyan-600',
    links: [
      { name: 'Sixt', url: 'https://www.sixt.com', logo: 'https://www.sixt.com/favicon.ico' },
      { name: 'Hertz', url: 'https://www.hertz.com', logo: 'https://www.hertz.com/favicon.ico' },
      { name: 'National', url: 'https://www.nationalcar.com', logo: 'https://www.nationalcar.com/favicon.ico' },
      { name: 'Europcar', url: 'https://www.europcar.com', logo: 'https://www.europcar.com/favicon.ico' },
    ],
  },
  {
    label: 'Restaurantes',
    icon: UtensilsCrossed,
    color: 'border-amber-200 bg-amber-50',
    iconBg: 'bg-amber-50 text-amber-600',
    links: [
      { name: 'OpenTable', url: 'https://www.opentable.com', logo: 'https://www.opentable.com/favicon.ico' },
      { name: 'Yelp', url: 'https://www.yelp.com', logo: 'https://www.yelp.com/favicon.ico' },
      { name: 'TheFork', url: 'https://www.thefork.com', logo: 'https://www.thefork.com/favicon.ico' },
      { name: 'TripAdvisor', url: 'https://www.tripadvisor.com/Restaurants', logo: 'https://www.tripadvisor.com/favicon.ico' },
    ],
  },
  {
    label: 'Tours y Actividades',
    icon: Compass,
    color: 'border-emerald-200 bg-emerald-50',
    iconBg: 'bg-emerald-50 text-emerald-600',
    links: [
      { name: 'Viator', url: 'https://www.viator.com', logo: 'https://www.viator.com/favicon.ico' },
      { name: 'GetYourGuide', url: 'https://www.getyourguide.com', logo: 'https://www.getyourguide.com/favicon.ico' },
      { name: 'Klook', url: 'https://www.klook.com', logo: 'https://www.klook.com/favicon.ico' },
      { name: 'Civitatis', url: 'https://www.civitatis.com', logo: 'https://www.civitatis.com/favicon.ico' },
    ],
  },
  {
    label: 'Mapas y Transporte',
    icon: Map,
    color: 'border-rose-200 bg-rose-50',
    iconBg: 'bg-rose-50 text-rose-600',
    links: [
      { name: 'Google Maps', url: 'https://maps.google.com', logo: 'https://maps.google.com/favicon.ico' },
      { name: 'Rome2Rio', url: 'https://www.rome2rio.com', logo: 'https://www.rome2rio.com/favicon.ico' },
      { name: 'Uber', url: 'https://www.uber.com', logo: 'https://www.uber.com/favicon.ico' },
    ],
  },
  {
    label: 'Seguros',
    icon: Shield,
    color: 'border-teal-200 bg-teal-50',
    iconBg: 'bg-teal-50 text-teal-600',
    links: [
      { name: 'World Nomads', url: 'https://www.worldnomads.com', logo: 'https://www.worldnomads.com/favicon.ico' },
      { name: 'SafetyWing', url: 'https://www.safetywing.com', logo: 'https://www.safetywing.com/favicon.ico' },
    ],
  },
];

/* ─── Componente de categoria ──────────────────── */

function CategorySection({ category }: { category: LinkCategory }) {
  const [open, setOpen] = useState(true);
  const Icon = category.icon;

  return (
    <div className={classNames('rounded-xl border overflow-hidden', category.color)}>
      {/* Encabezado */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className={classNames(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            category.iconBg
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex-1 text-gray-900 font-semibold text-sm">{category.label}</span>
        <span className="text-gray-300 text-xs">{category.links.length}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-300 flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* Links */}
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="px-4 pb-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {category.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <img
                  src={link.logo}
                  alt={link.name}
                  className="w-4 h-4 rounded-sm flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-gray-700 text-xs font-medium group-hover:text-gray-900 transition-colors truncate">
                  {link.name}
                </span>
                <ExternalLink className="w-3 h-3 text-gray-200 group-hover:text-gray-400 ml-auto flex-shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Componente principal ─────────────────────── */

export default function QuickLinks() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {LINK_CATEGORIES.map((category) => (
        <CategorySection key={category.label} category={category} />
      ))}
    </div>
  );
}
