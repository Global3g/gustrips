'use client';

import { motion } from 'framer-motion';
import { Send, Loader2, Mic } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface ChatbotInputProps {
  readonly input: string;
  readonly loading: boolean;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
}

export function ChatbotInput({ input, loading, onChange, onSend, onKeyDown }: ChatbotInputProps) {
  const canSend = !loading && input.trim().length > 0;
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition({
    lang: 'es-MX',
    continuous: false,
    interimResults: true,
  });

  const lastTranscriptRef = useRef<string>('');
  const inputRef = useRef<string>(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Append diff between new and previously appended transcript
  useEffect(() => {
    if (!transcript) return;
    const last = lastTranscriptRef.current;
    if (transcript === last) return;

    let delta = '';
    if (transcript.startsWith(last)) {
      delta = transcript.slice(last.length);
    } else {
      // Speech recognition rewrote interim text — replace tail
      // Strategy: roll back the previously appended portion and append the new transcript
      const current = inputRef.current;
      if (last && current.endsWith(last)) {
        const base = current.slice(0, current.length - last.length);
        const next = base + (base && !base.endsWith(' ') ? ' ' : '') + transcript;
        onChange(next);
        lastTranscriptRef.current = transcript;
        return;
      }
      delta = transcript;
    }

    if (!delta) {
      lastTranscriptRef.current = transcript;
      return;
    }

    const current = inputRef.current;
    const needsSpace = current.length > 0 && !current.endsWith(' ') && lastTranscriptRef.current.length === 0;
    const next = current + (needsSpace ? ' ' : '') + delta;
    onChange(next);
    lastTranscriptRef.current = transcript;
  }, [transcript, onChange]);

  const handleMicClick = () => {
    if (listening) {
      stop();
    } else {
      lastTranscriptRef.current = '';
      reset();
      start();
    }
  };

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
        {supported && (
          <motion.button
            onClick={handleMicClick}
            whileTap={{ scale: 0.92 }}
            whileHover={!listening ? { y: -1 } : undefined}
            animate={listening ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={listening ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            aria-label={listening ? 'Detener dictado' : 'Iniciar dictado'}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white transition-colors overflow-hidden flex-shrink-0"
            style={{
              background: listening
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 60%, #b91c1c 100%)'
                : 'rgba(255,255,255,0.05)',
              boxShadow: listening
                ? '0 6px 16px -4px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.2)'
                : 'none',
              border: listening ? 'none' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                background: listening
                  ? 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.32), transparent 60%)'
                  : 'transparent',
              }}
            />
            <Mic className="w-4 h-4 relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
            {listening && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
          </motion.button>
        )}
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
        {listening
          ? '🎙 Escuchando — toca el micrófono para terminar'
          : 'Puedo crear eventos, registrar gastos y leer tus stats.'}
      </p>
    </div>
  );
}
