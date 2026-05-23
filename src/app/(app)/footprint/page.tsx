'use client';

/**
 * Footprint page — the user's "huella" across every trip they've ever taken.
 * Lives at /footprint (NOT inside a trip).
 *
 * Three things on this page:
 *  1) A world map with one pin per geocoded trip destination
 *     (FootprintMap component, leaflet, dynamically imported to avoid
 *     SSR window/Document references).
 *  2) A stats strip — trips, países, ciudades, km estimados.
 *  3) An "ubicando…" indicator while Nominatim trickles in.
 *
 * We deliberately stay simple on km estimation: it's the sum of
 * great-circle distances between consecutive trips ordered by start date.
 * Not a literal "this is how far you flew", but a tangible number that
 * grows with each new pin and reads as "kilómetros recorridos".
 */

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Globe, MapPin, Loader2, Flag, Compass, Route } from 'lucide-react';
import { useTrips } from '@/hooks/useTrips';
import { useGeocodedTrips } from '@/hooks/useGeocodedTrips';
import type { Trip } from '@/types';

const FootprintMap = dynamic(
  () => import('@/components/footprint/FootprintMap'),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[55vh] sm:h-[60vh] w-full rounded-2xl flex items-center justify-center border border-white/10"
        style={{ background: 'linear-gradient(135deg, #0d1320 0%, #1c2436 100%)' }}
      >
        <div className="text-center">
          <Loader2 className="w-6 h-6 text-sky-300 animate-spin mx-auto mb-2" />
          <p className="text-sm text-white/60">Cargando el mapa…</p>
        </div>
      </div>
    ),
  },
);

/** Best-effort country extraction from a destination string. We trust the
 *  user-provided format (e.g. "París, Francia" or "Tokio, Japón") and pull
 *  the trailing chunk. Falls back to the full destination if there's no
 *  comma. We dedupe case-insensitively. */
function extractCountry(destination: string): string {
  if (!destination) return '';
  const parts = destination.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  return parts[parts.length - 1];
}

/** Same idea but for the city (first comma-separated chunk). */
function extractCity(destination: string): string {
  if (!destination) return '';
  const parts = destination.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[0] ?? '';
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function plural(n: number, sing: string, plur: string): string {
  return n === 1 ? sing : plur;
}

export default function FootprintPage() {
  const { trips, loading: tripsLoading } = useTrips();
  const { geocodedTrips, loading: geocoding, pendingCount } = useGeocodedTrips(trips);

  const stats = useMemo(() => {
    const tripsCount = trips.length;
    const countries = new Set<string>();
    const cities = new Set<string>();
    for (const t of trips) {
      const country = extractCountry(t.destination).toLowerCase();
      if (country) countries.add(country);
      const city = extractCity(t.destination).toLowerCase();
      if (city) cities.add(city);
    }

    // km: sum haversine between consecutive trips, ordered by startDate. Uses
    // only geocoded trips since we need coordinates.
    const sorted = [...geocodedTrips].sort((a, b) =>
      (a.startDate ?? '').localeCompare(b.startDate ?? ''),
    );
    let km = 0;
    for (let i = 1; i < sorted.length; i++) {
      km += haversineKm(
        [sorted[i - 1].lat, sorted[i - 1].lng],
        [sorted[i].lat, sorted[i].lng],
      );
    }

    return {
      tripsCount,
      countriesCount: countries.size,
      citiesCount: cities.size,
      km: Math.round(km),
    };
  }, [trips, geocodedTrips]);

  const initialLoading = tripsLoading && trips.length === 0;

  return (
    <div className="space-y-6">
      {/* Hero header — editorial, world-feel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl"
        style={{
          minHeight: 180,
          background:
            'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute -top-12 left-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.18), transparent 70%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(244,114,182,0.16), transparent 70%)' }}
        />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-sky-300/30"
              style={{
                background: 'linear-gradient(135deg, rgba(125,211,252,0.18), rgba(125,211,252,0.06))',
                boxShadow: '0 0 20px rgba(125,211,252,0.25)',
              }}
            >
              <Globe className="w-6 h-6 text-sky-200" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-eyebrow"
                style={{ color: '#7dd3fc' }}
              >
                Tu huella en el mundo
              </div>
              <h1
                className="text-hero mt-1"
                style={{ color: '#f4f0e6' }}
              >
                Mapa de viajes
              </h1>
              <p className="text-sm mt-2" style={{ color: 'rgba(244,240,230,0.7)' }}>
                Cada pin es un viaje. Cada color cuenta en qué momento está.
              </p>
            </div>
            {geocoding && pendingCount > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-sky-100 bg-sky-400/10 border border-sky-300/30 px-3 py-1.5 rounded-full backdrop-blur-sm flex-shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Ubicando {pendingCount}…
              </div>
            )}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <StatCard
              icon={<Compass className="w-4 h-4 text-sky-200" />}
              label={plural(stats.tripsCount, 'viaje', 'viajes')}
              value={stats.tripsCount.toLocaleString('es-MX')}
              tint="rgba(125,211,252,0.18)"
              border="rgba(125,211,252,0.30)"
            />
            <StatCard
              icon={<Flag className="w-4 h-4 text-pink-200" />}
              label={plural(stats.countriesCount, 'país', 'países')}
              value={stats.countriesCount.toLocaleString('es-MX')}
              tint="rgba(244,114,182,0.18)"
              border="rgba(244,114,182,0.30)"
            />
            <StatCard
              icon={<MapPin className="w-4 h-4 text-indigo-200" />}
              label={plural(stats.citiesCount, 'ciudad', 'ciudades')}
              value={stats.citiesCount.toLocaleString('es-MX')}
              tint="rgba(129,140,248,0.20)"
              border="rgba(129,140,248,0.30)"
            />
            <StatCard
              icon={<Route className="w-4 h-4 text-amber-200" />}
              label="km recorridos"
              value={`~${stats.km.toLocaleString('es-MX')}`}
              tint="rgba(245,192,98,0.18)"
              border="rgba(245,192,98,0.30)"
            />
          </div>
        </div>
      </motion.div>

      {/* Map */}
      {initialLoading ? (
        <div
          className="h-[55vh] sm:h-[60vh] w-full rounded-2xl flex items-center justify-center border border-white/10"
          style={{ background: 'linear-gradient(135deg, #0d1320 0%, #1c2436 100%)' }}
        >
          <div className="text-center">
            <Loader2 className="w-6 h-6 text-sky-300 animate-spin mx-auto mb-2" />
            <p className="text-sm text-white/60">Cargando viajes…</p>
          </div>
        </div>
      ) : trips.length === 0 ? (
        <EmptyState />
      ) : (
        <FootprintMap trips={geocodedTrips} className="h-[55vh] sm:h-[60vh] w-full rounded-2xl overflow-hidden border border-white/10" />
      )}

      {/* Legend + list */}
      {trips.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Legend />
          <TripList trips={trips} geocoded={geocodedTrips} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  border: string;
}) {
  return (
    <div
      className="rounded-2xl border backdrop-blur-sm p-3 sm:p-4 flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.02))`,
        borderColor: border,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold truncate">
          {label}
        </div>
        <div className="text-base sm:text-lg font-black text-white truncate leading-tight">
          {value}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const items: { color: string; label: string }[] = [
    { color: '#ff6b6b', label: 'En curso' },
    { color: '#e8c87a', label: 'Próximos' },
    { color: '#1a3d62', label: 'Terminados' },
    { color: '#9ca3af', label: 'Cancelados' },
  ];
  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
    >
      <div className="text-[11px] uppercase tracking-wider font-semibold text-white/60 mb-3">
        Referencias
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-xs text-white/80">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{
                background: it.color,
                boxShadow: `0 0 8px ${it.color}80`,
                border: '2px solid rgba(255,255,255,0.85)',
              }}
            />
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TripList({ trips, geocoded }: { trips: Trip[]; geocoded: GeocodedTripLike[] }) {
  const geocodedIds = useMemo(() => new Set(geocoded.map((g) => g.id)), [geocoded]);
  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
    >
      <div className="text-[11px] uppercase tracking-wider font-semibold text-white/60 mb-3">
        Tus destinos
      </div>
      <div className="max-h-[200px] overflow-y-auto scrollbar-thin space-y-1.5">
        {trips.slice(0, 50).map((t) => {
          const located = geocodedIds.has(t.id);
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className={
                  located
                    ? 'w-2 h-2 rounded-full bg-sky-300 flex-shrink-0'
                    : 'w-2 h-2 rounded-full bg-white/20 flex-shrink-0'
                }
              />
              <span className="text-white/90 truncate font-medium">{t.title}</span>
              <span className="text-white/40 truncate">· {t.destination || 'sin destino'}</span>
            </div>
          );
        })}
        {trips.length > 50 && (
          <p className="text-[11px] text-white/40 mt-2">
            … y {trips.length - 50} más
          </p>
        )}
      </div>
    </div>
  );
}

// Avoid importing the heavy GeocodedTrip from the hook just for the types
// of a side panel — duck-type the shape we actually read.
interface GeocodedTripLike {
  id: string;
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl border border-white/10 p-10 text-center"
      style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
    >
      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
        <Globe className="w-6 h-6 text-white/40" />
      </div>
      <p className="text-sm text-white/65 max-w-xs mx-auto">
        Cuando armes tu primer viaje, su destino aparece acá como un pin.
      </p>
    </div>
  );
}
