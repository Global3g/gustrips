'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wrench } from 'lucide-react';
import type { ChatMessage, QuickAction } from './types';
import { renderMarkdown } from './utils';

interface ChatbotMessagesProps {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly loading: boolean;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly quickActions: ReadonlyArray<QuickAction>;
  readonly onQuickAction: (prompt: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  createEvent: 'Creando evento',
  updateEvent: 'Actualizando evento',
  deleteEvent: 'Eliminando evento',
  addExpense: 'Registrando gasto',
  updateBudget: 'Ajustando presupuesto',
  getStats: 'Leyendo estadísticas',
};

export function ChatbotMessages({
  messages,
  loading,
  messagesEndRef,
  quickActions,
  onQuickAction,
}: ChatbotMessagesProps) {
  // Hide raw tool results from the UI — they're just for the model's context.
  const visible = messages.filter((m) => m.role !== 'tool');
  const showQuickActions = visible.length <= 1;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 sidebar-nav-scroll">
      <AnimatePresence initial={false}>
        {visible.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const hasToolCalls = !!msg.toolCalls && msg.toolCalls.length > 0;
          return (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[88%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Tool-call indicator (above the message text) */}
                {hasToolCalls && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.toolCalls!.map((tc, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-300/15 text-amber-200 border border-amber-300/30"
                      >
                        <Wrench className="w-2.5 h-2.5" />
                        {TOOL_LABELS[tc.name] || tc.name}
                      </motion.span>
                    ))}
                  </div>
                )}

                <div
                  className={`rounded-2xl px-3.5 py-2.5 backdrop-blur-sm border ${
                    isUser
                      ? 'text-amber-50 border-amber-300/40'
                      : 'text-white/90 border-white/[0.08] bg-white/[0.05]'
                  }`}
                  style={
                    isUser
                      ? {
                          background:
                            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          boxShadow:
                            '0 8px 22px -8px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
                        }
                      : undefined
                  }
                >
                  <div className="text-[13px] whitespace-pre-wrap leading-relaxed">
                    {renderMarkdown(msg.content)}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Quick actions when chat is empty */}
      {showQuickActions && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-1.5 pt-2"
        >
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onQuickAction(action.prompt)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white/85 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] hover:border-amber-300/40 transition-all"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              {action.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Loading typing indicator */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm rounded-2xl px-3.5 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </motion.div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
