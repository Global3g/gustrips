'use client';

import { motion } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';

interface ChatbotInputProps {
  readonly input: string;
  readonly loading: boolean;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
}

export function ChatbotInput({ input, loading, onChange, onSend, onKeyDown }: ChatbotInputProps) {
  const canSend = !loading && input.trim().length > 0;
  return (
    <div className="px-3 py-2.5 border-t border-white/[0.06]">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Pregunta o pide una acción…"
            rows={1}
            className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 resize-none outline-none focus:border-amber-300/60 focus:bg-white/[0.08] backdrop-blur-sm transition-colors text-sm"
            style={{ maxHeight: '120px', minHeight: '42px' }}
          />
        </div>
        <motion.button
          onClick={onSend}
          disabled={!canSend}
          whileTap={canSend ? { scale: 0.92 } : undefined}
          whileHover={canSend ? { y: -1 } : undefined}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden flex-shrink-0"
          style={{
            background: canSend
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%)'
              : 'rgba(255,255,255,0.05)',
            boxShadow: canSend
              ? '0 6px 16px -4px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.2)'
              : 'none',
          }}
        >
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                canSend
                  ? 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.32), transparent 60%)'
                  : 'transparent',
            }}
          />
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin relative" />
          ) : (
            <Send className="w-4 h-4 relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
          )}
        </motion.button>
      </div>
      <p className="text-[10px] text-white/30 mt-1.5 px-1">
        Puedo crear eventos, registrar gastos y leer tus stats.
      </p>
    </div>
  );
}
