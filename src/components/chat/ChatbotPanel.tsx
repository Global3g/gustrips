'use client';

import { motion } from 'framer-motion';
import type { ChatMessage, QuickAction } from './types';
import Particles from '@/components/ui/Particles';
import { ChatbotHeader } from './ChatbotHeader';
import { ChatbotMessages } from './ChatbotMessages';
import { ChatbotInput } from './ChatbotInput';

interface ChatbotPanelProps {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly input: string;
  readonly loading: boolean;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly quickActions: ReadonlyArray<QuickAction>;
  readonly onClear: () => void;
  readonly onClose: () => void;
  readonly onSetInput: (value: string) => void;
  readonly onSend: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
  readonly onQuickAction: (prompt: string) => void;
}

export function ChatbotPanel({
  messages,
  input,
  loading,
  messagesEndRef,
  quickActions,
  onClear,
  onClose,
  onSetInput,
  onSend,
  onKeyDown,
  onQuickAction,
}: ChatbotPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 w-[calc(100vw-48px)] sm:w-[400px] h-[75vh] sm:h-[560px] rounded-3xl shadow-2xl shadow-black/40 flex flex-col z-50 overflow-hidden border border-white/[0.08]"
      style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
    >
      {/* Visual layer */}
      <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
        <Particles count={20} />
        <div
          className="absolute -top-12 -left-12 w-56 h-56 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.22), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-16 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-12 left-1/4 w-48 h-48 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.16), transparent 70%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        <ChatbotHeader onClear={onClear} onClose={onClose} />

        <ChatbotMessages
          messages={messages}
          loading={loading}
          messagesEndRef={messagesEndRef}
          quickActions={quickActions}
          onQuickAction={onQuickAction}
        />

        <ChatbotInput
          input={input}
          loading={loading}
          onChange={onSetInput}
          onSend={onSend}
          onKeyDown={onKeyDown}
        />
      </div>
    </motion.div>
  );
}
