'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { EVENT_TYPES } from '@/config/constants';
import { formatCurrency } from '@/lib/utils/helpers';
import type { TripEvent, EventType } from '@/types';

/* ─── Fix default marker icon issue with Next.js ── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ─── Create colored circle marker icon ──────────── */
function createCircleIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid rgba(255,255,255,0.9);
        box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.8);
        "></div>
      </div>
    `,
  });
}

/* ─── Auto-fit bounds component ──────────────────── */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const prevLength = useRef(0);

  useEffect(() => {
    if (positions.length > 0 && positions.length !== prevLength.current) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      prevLength.current = positions.length;
    }
  }, [positions, map]);

  return null;
}

/* ─── Center on event component ──────────────────── */
function CenterOnEvent({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();

  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.flyTo([lat, lng], 15, { duration: 0.8 });
    }
  }, [lat, lng, map]);

  return null;
}

/* ─── Props ─────────────────────────────────────── */
interface MapViewProps {
  events: TripEvent[];
  centerLat?: number | null;
  centerLng?: number | null;
  className?: string;
}

/* ─── Component ─────────────────────────────────── */
export default function MapView({ events, centerLat = null, centerLng = null, className }: MapViewProps) {
  const eventsWithCoords = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events],
  );

  const positions = useMemo<[number, number][]>(
    () => eventsWithCoords.map((e) => [e.latitude!, e.longitude!]),
    [eventsWithCoords],
  );

  /* Group events by date for polylines */
  const polylinesByDate = useMemo(() => {
    const groups: Record<string, [number, number][]> = {};
    for (const event of eventsWithCoords) {
      if (!event.date) continue;
      if (!groups[event.date]) groups[event.date] = [];
      groups[event.date].push([event.latitude!, event.longitude!]);
    }
    return Object.values(groups).filter((g) => g.length >= 2);
  }, [eventsWithCoords]);

  /* Default center: first event or world center */
  const defaultCenter: [number, number] = positions.length > 0
    ? positions[0]
    : [20.6597, -103.3496]; // Guadalajara default

  if (eventsWithCoords.length === 0) {
    return (
      <div className={className || "h-[400px] lg:h-[500px] rounded-2xl border border-gray-200 bg-gray-50"}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">
              Agrega coordenadas a tus eventos para verlos en el mapa
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className || "rounded-2xl overflow-hidden border border-gray-200 h-[400px] lg:h-[500px]"}>
      <style>{`
        .leaflet-popup-content-wrapper {
          background: rgba(15, 15, 25, 0.85) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
          color: white !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          min-width: 180px !important;
        }
        .leaflet-popup-tip {
          background: rgba(15, 15, 25, 0.85) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-top: none !important;
          border-left: none !important;
        }
        .leaflet-popup-close-button {
          color: rgba(255,255,255,0.5) !important;
          font-size: 18px !important;
          top: 6px !important;
          right: 8px !important;
        }
        .leaflet-popup-close-button:hover {
          color: white !important;
        }
        .leaflet-control-zoom a {
          background: white !important;
          color: #374151 !important;
          border-color: #e5e7eb !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f3f4f6 !important;
        }
        .leaflet-control-attribution {
          background: rgba(255,255,255,0.8) !important;
          color: #9ca3af !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a {
          color: #6b7280 !important;
        }
      `}</style>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <FitBounds positions={positions} />
        <CenterOnEvent lat={centerLat ?? null} lng={centerLng ?? null} />

        {/* Polylines connecting events on the same day */}
        {polylinesByDate.map((line, idx) => (
          <Polyline
            key={`poly-${idx}`}
            positions={line}
            pathOptions={{
              color: 'rgba(96, 165, 250, 0.5)',
              weight: 2,
              dashArray: '6, 8',
            }}
          />
        ))}

        {/* Event markers */}
        {eventsWithCoords.map((event) => {
          const typeConfig = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.misc;
          const icon = createCircleIcon(typeConfig.color);

          return (
            <Marker
              key={event.id}
              position={[event.latitude!, event.longitude!]}
              icon={icon}
            >
              <Popup>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: typeConfig.color }}
                    />
                    <span className="text-white text-sm font-semibold leading-tight">
                      {event.title}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/50 text-xs">
                      {typeConfig.label}
                    </p>
                    {event.startTime && (
                      <p className="text-white/60 text-xs">
                        {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                      </p>
                    )}
                    {event.cost > 0 && (
                      <p className="text-white/70 text-xs font-medium">
                        {formatCurrency(event.cost, event.currency)}
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
