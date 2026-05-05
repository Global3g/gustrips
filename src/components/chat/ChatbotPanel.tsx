'use client';

import type { ChatMessage, QuickAction } from './types';
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
    <div className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 w-[calc(100vw-48px)] sm:w-[380px] h-[70vh] sm:h-[500px] rounded-2xl shadow-2xl flex flex-col z-50 bg-white border border-gray-200 overflow-hidden">
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
  );
}
