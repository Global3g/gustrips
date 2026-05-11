'use client';

import { motion } from 'framer-motion';
import { Sparkles, Camera, MapPin, Calendar, Loader2 } from 'lucide-react';
import type { AnalysisState } from '@/features/tripshistory/types';

interface AnalysisProgressProps {
  state: AnalysisState | null;
  totalExpected?: number;
}

/**
 * Shows engine progress while it crunches photos.
 * "Analizando 200 fotos..." with detected days, GPS coverage, duplicates.
 */
export default function AnalysisProgress({
  state,
  totalExpected,
}: AnalysisProgressProps) {
  const photoCount = state?.photoCount ?? 0;
  const target = totalExpected ?? Math.max(photoCount, 1);
  const pct = Math.min(100, Math.round((photoCount / target) * 100));

  const status = state?.status ?? 'analyzing';
  const isAnalyzing = status === 'draft' || status === 'analyzing';

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-amber-500/5 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
          {isAnalyzing ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
            {isAnalyzing ? 'Analizando' : 'Análisis listo'}
          </p>
          <p className="text-lg font-bold text-white truncate">
            {isAnalyzing
              ? `Estudiando ${photoCount.toLocaleString('es')} fotos...`
              : `${photoCount.toLocaleString('es')} fotos procesadas`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-white/[0.06] mb-5">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<Calendar className="w-4 h-4" />}
          label="Días"
          value={(state?.detectedDays?.length ?? 0).toString()}
        />
        <Stat
          icon={<MapPin className="w-4 h-4" />}
          label="Con GPS"
          value={(state?.photosWithGps ?? 0).toString()}
        />
        <Stat
          icon={<Camera className="w-4 h-4" />}
          label="Eventos"
          value={(state?.detectedClusters?.length ?? 0).toString()}
        />
      </div>

      {state && state.duplicateGroups !== undefined && state.duplicateGroups > 0 && (
        <p className="text-xs text-white/60 mt-4 text-center">
          {state.duplicateGroups} {state.duplicateGroups === 1 ? 'grupo' : 'grupos'} de fotos repetidas detectadas
        </p>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-amber-300">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          {label}
        </span>
      </div>
      <p className="mt-1 text-xl font-black text-white tabular-nums">{value}</p>
    </div>
  );
}
