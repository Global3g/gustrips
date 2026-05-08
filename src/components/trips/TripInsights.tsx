'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, Navigation, CalendarDays, Camera } from 'lucide-react';
import { EVENT_TYPES } from '@/config/constants';
import type { Trip, TripEvent } from '@/types';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function StatBlock({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-300' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-300' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-300' },
  };
  const c = colorMap[color] ?? colorMap.emerald;
  return (
    <div className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm">
      <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-3.5 h-3.5 ${c.text}`} />
      </div>
      <p className="text-white font-bold text-lg leading-none tabular-nums">{value}</p>
      <p className="text-white/40 text-[10px] uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

interface TripInsightsProps {
  trip: Trip;
  events: TripEvent[];
}

export default function TripInsights({ trip, events }: TripInsightsProps) {
  const insights = useMemo(() => {
    const cities = new Set<string>();
    for (const e of events) {
      const c = e.city?.trim() || (e.location?.split(',')[0]?.trim() ?? '');
      if (c && c.length > 1) cities.add(c.toLowerCase());
    }

    let kmTotal = 0;
    const sorted = [...events].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.startTime || '').localeCompare(b.startTime || '');
    });
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a.latitude && a.longitude && b.latitude && b.longitude) {
        kmTotal += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
      }
    }

    const typeCount: Record<string, number> = {};
    for (const e of events) typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    const topTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { cities: cities.size, kmTotal, topTypes };
  }, [events]);

  if (events.length === 0 && (trip.albumPhotos?.length ?? 0) === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl p-5 relative overflow-hidden border border-white/[0.08]"
      style={{ background: 'linear-gradient(135deg, rgba(12,25,41,0.95) 0%, rgba(22,42,68,0.95) 100%)' }}
    >
      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none"
        style={{ background: 'rgba(59,130,246,0.08)' }}
      />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Tu viaje en números</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBlock icon={MapPin} label="Ciudades" value={insights.cities.toString()} color="emerald" />
          <StatBlock
            icon={Navigation}
            label="Kilómetros"
            value={insights.kmTotal > 0 ? Math.round(insights.kmTotal).toLocaleString() : '—'}
            color="cyan"
          />
          <StatBlock icon={CalendarDays} label="Eventos" value={events.length.toString()} color="violet" />
          <StatBlock icon={Camera} label="Fotos" value={(trip.albumPhotos?.length ?? 0).toString()} color="rose" />
        </div>

        {insights.topTypes.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/40 font-semibold mb-2">Más frecuentes</p>
            <div className="flex flex-wrap gap-1.5">
              {insights.topTypes.map(([type, count]) => {
                const cfg = EVENT_TYPES[type as keyof typeof EVENT_TYPES];
                if (!cfg) return null;
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 backdrop-blur-sm border border-white/[0.08]"
                    style={{ backgroundColor: `${cfg.color}1c`, color: cfg.color }}
                  >
                    <span>{cfg.label}</span>
                    <span className="bg-white/10 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
