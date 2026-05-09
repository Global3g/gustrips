'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface ChatbotButtonProps {
  readonly onClick: () => void;
}

export function ChatbotButton({ onClick }: ChatbotButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      title="Abrir asistente de viaje"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.08, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 z-40 w-14 h-14 rounded-2xl flex items-center justify-center group overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
        boxShadow:
          '0 10px 30px -8px rgba(245,158,11,0.55), 0 4px 12px -4px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      {/* Soft inner highlight */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.35), transparent 60%)',
        }}
      />

      {/* Pulsing glow ring */}
      <motion.span
        animate={{ scale: [1, 1.4, 1], opacity: [0.45, 0, 0.45] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ boxShadow: '0 0 0 6px rgba(245,158,11,0.4)' }}
      />

      {/* Icon */}
      <motion.span
        animate={{ rotate: [0, 12, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
      >
        <Sparkles
          className="w-6 h-6 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
          fill="currentColor"
        />
      </motion.span>

      {/* Tiny notification dot accent */}
      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 border-2 border-amber-700 shadow" />
    </motion.button>
  );
}
