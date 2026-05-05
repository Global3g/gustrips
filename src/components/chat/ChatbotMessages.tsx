'use client';

import type { ChatMessage, QuickAction } from './types';
import { renderMarkdown } from './utils';

interface ChatbotMessagesProps {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly loading: boolean;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly quickActions: ReadonlyArray<QuickAction>;
  readonly onQuickAction: (prompt: string) => void;
}

export function ChatbotMessages({
  messages,
  loading,
  messagesEndRef,
  quickActions,
  onQuickAction,
}: ChatbotMessagesProps) {
  const showQuickActions = messages.length <= 1;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'user'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-50 text-gray-700 border border-gray-100'
            }`}
          >
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {renderMarkdown(msg.content)}
            </div>
          </div>
        </div>
      ))}

      {/* Quick actions when chat is empty */}
      {showQuickActions && (
        <div className="flex flex-wrap gap-2 pt-2">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onQuickAction(action.prompt)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs rounded-full transition-all border border-amber-200"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-start">
          <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
