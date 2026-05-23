'use client';

/**
 * Footprint map — leaflet map with one pin per trip destination. Used by
 * /footprint at the user level (across all trips). Pin colour reflects the
 * trip's lifecycle (planning / active / completed / cancelled) so a glance
 * tells the user where they've been vs where they're going.
 *
 * Tile provider is CARTO Voyager — same family the in-trip map uses, but
 * the light variant since at world zoom levels the dark tiles wash out the
 * pin contrast.
 */

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import type { GeocodedTrip } from '@/hooks/useGeocodedTrips';
import type { TripStatus } from '@/types';

// react-leaflet defaults to an icon URL relative to the bundler entry,
// which Next can't resolve — point at a CDN like MapView does.
type LeafletIconDefault = typeof L.Icon.Default.prototype & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as LeafletIconDefault)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STATUS_COLORS: Record<TripStatus, string> = {
  planning: '#e8c87a', // mustard — anticipation
  active: '#ff6b6b',   // coral — happening now
  completed: '#1a3d62', // deep ocean — memory
  cancelled: '#9ca3af', // grey — past, irrelevant
};

const STATUS_LABELS: Record<TripStatus, string> = {
  planning: 'Próximo',
  active: 'En curso',
  completed: 'Terminado',
  cancelled: 'Cancelado',
};

function createPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid rgba(255,255,255,0.95);
        box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.85);
        "></div>
      </div>
    `,
  });
}

function FitWorld({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const prevSig = useRef<string>('');
  useEffect(() => {
    if (positions.length === 0) return;
    const sig = positions.map(([la, ln]) => `${la.toFixed(2)},${ln.toFixed(2)}`).join('|');
    if (sig === prevSig.current) return;
    prevSig.current = sig;
    if (positions.length === 1) {
      map.setView(positions[0], 4);
    } else {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }
  }, [positions, map]);
  return null;
}

interface FootprintMapProps {
  trips: GeocodedTrip[];
  className?: string;
}

export default function FootprintMap({ trips, className }: FootprintMapProps) {
  const positions = useMemo<[number, number][]>(
    () => trips.map((t) => [t.lat, t.lng]),
    [trips],
  );

  if (trips.length === 0) {
    return (
      <div
        className={className || 'h-[60vh] w-full'}
        style={{
          background: 'linear-gradient(135deg, #0d1320 0%, #1c2436 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '1rem',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem' }}>
          Aún no podemos ubicar ninguno de tus viajes en el mapa
        </p>
      </div>
    );
  }

  return (
    <div
      className={className || 'h-[60vh] w-full rounded-2xl overflow-hidden border border-white/10'}
      style={{ background: '#0d1b2e' }}
    >
      <style>{`
        .footprint-leaflet .leaflet-container {
          background: #0d1b2e !important;
        }
        .footprint-leaflet .leaflet-popup-content-wrapper {
          background: rgba(15, 15, 25, 0.9) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
          color: white !important;
          padding: 0 !important;
        }
        .footprint-leaflet .leaflet-popup-content {
          margin: 0 !important;
          min-width: 200px !important;
        }
        .footprint-leaflet .leaflet-popup-tip {
          background: rgba(15, 15, 25, 0.9) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
        }
        .footprint-leaflet .leaflet-popup-close-button {
          color: rgba(255,255,255,0.55) !important;
          font-size: 18px !important;
          top: 6px !important;
          right: 8px !important;
        }
        .footprint-leaflet .leaflet-control-zoom a {
          background: rgba(15, 23, 42, 0.85) !important;
          color: rgba(255,255,255,0.85) !important;
          border-color: rgba(255,255,255,0.12) !important;
          backdrop-filter: blur(8px) !important;
        }
        .footprint-leaflet .leaflet-control-attribution {
          background: rgba(15, 23, 42, 0.7) !important;
          color: rgba(255,255,255,0.55) !important;
          font-size: 10px !important;
        }
        .footprint-leaflet .leaflet-control-attribution a {
          color: rgba(125,211,252,0.85) !important;
        }
      `}</style>
      <div className="footprint-leaflet" style={{ height: '100%', width: '100%' }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          worldCopyJump
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <CartoLightTiles />
          <FitWorld positions={positions} />
          {trips.map((trip) => {
            const color = STATUS_COLORS[trip.status] ?? STATUS_COLORS.completed;
            const icon = createPinIcon(color);
            return (
              <Marker key={trip.id} position={[trip.lat, trip.lng]} icon={icon}>
                <Popup>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-white text-sm font-semibold leading-tight truncate">
                        {trip.title}
                      </span>
                    </div>
                    <p className="text-white/55 text-xs">
                      {STATUS_LABELS[trip.status] ?? 'Viaje'} · {trip.destination}
                    </p>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="inline-block text-[11px] font-semibold tracking-wide uppercase text-sky-300 hover:text-sky-200 transition-colors"
                    >
                      Abrir viaje →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

/**
 * Light-themed CARTO tiles. Inline so the component stays self-contained
 * and we don't pull in the CachedTileLayer abstraction (which is tuned for
 * a single trip's bounding box, not world scale).
 */
function CartoLightTiles() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/voyager_nolabels/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    );
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map]);
  return null;
}
