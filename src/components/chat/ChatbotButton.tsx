'use client';

import { MessageCircle } from 'lucide-react';

interface ChatbotButtonProps {
  readonly onClick: () => void;
}

export function ChatbotButton({ onClick }: ChatbotButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300 group bg-gradient-to-br from-amber-400 to-amber-600"
      title="Abrir Asistente de Viaje"
    >
      <MessageCircle
        size={24}
        className="text-white group-hover:rotate-12 transition-transform"
      />

      {/* Ping animation */}
      <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-20" />
    </button>
  );
}
