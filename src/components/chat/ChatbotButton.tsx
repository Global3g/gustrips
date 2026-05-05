'use client';

interface ChatbotButtonProps {
  readonly onClick: () => void;
}

export function ChatbotButton({ onClick }: ChatbotButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300 group"
      style={{ background: '#1e3a5f' }}
      title="Abrir Asistente de Viaje"
    >
      <img
        src="/compass-icon.png"
        alt="Asistente"
        className="w-9 h-9 object-contain group-hover:rotate-45 transition-transform"
      />

      {/* Ping animation */}
      <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#1e3a5f' }} />
    </button>
  );
}
