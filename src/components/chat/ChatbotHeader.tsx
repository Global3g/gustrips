'use client';

import { motion } from 'framer-motion';
import { RotateCcw, X, Sparkles } from 'lucide-react';

interface ChatbotHeaderProps {
  readonly onClear: () => void;
  readonly onClose: () => void;
}

export function ChatbotHeader({ onClear, onClose }: ChatbotHeaderProps) {
  return (
    <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-300/30"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.08))',
            boxShadow: '0 0 18px rgba(245,158,11,0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          <motion.span
            animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="w-4 h-4 text-amber-200" fill="currentColor" />
          </motion.span>
        </div>
        <div className="min-w-0">
          <h3
            className="text-sm font-black tracking-tight bg-clip-text text-transparent truncate"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #ffffff 0%, #fde68a 60%, #fcd34d 100%)',
            }}
          >
            Asistente del viaje
          </h3>
          <p className="text-[10px] text-white/45 leading-tight flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shadow-[0_0_6px_rgba(110,231,183,0.85)]" />
            En línea · GusTrips AI
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onClear}
          className="p-1.5 text-white/55 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
          title="Reiniciar chat"
        >
          <RotateCcw size={15} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-white/55 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
          title="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
