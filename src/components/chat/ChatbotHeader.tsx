'use client';

import { RotateCcw, X, Plane } from 'lucide-react';

interface ChatbotHeaderProps {
  readonly onClear: () => void;
  readonly onClose: () => void;
}

export function ChatbotHeader({ onClear, onClose }: ChatbotHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 rounded-t-2xl bg-gradient-to-r from-amber-50 to-orange-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600">
          <Plane size={18} className="text-white" />
        </div>
        <div>
          <h3 className="text-gray-800 font-semibold text-sm">Asistente de Viaje</h3>
          <p className="text-[11px] text-gray-400">GusTrips AI</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onClear}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          title="Limpiar chat"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          title="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
