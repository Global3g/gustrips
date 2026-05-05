'use client';

import { Send } from 'lucide-react';

interface ChatbotInputProps {
  readonly input: string;
  readonly loading: boolean;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
}

export function ChatbotInput({ input, loading, onChange, onSend, onKeyDown }: ChatbotInputProps) {
  return (
    <div className="p-3 border-t border-gray-200">
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pregunta sobre tu viaje..."
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors text-sm"
          rows={1}
          style={{ maxHeight: '100px', minHeight: '42px' }}
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="p-2.5 rounded-xl text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 bg-gradient-to-br from-amber-400 to-amber-600"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
