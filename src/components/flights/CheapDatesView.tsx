'use client';

import { Calendar, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateResult } from '@/lib/api/flights';

interface CheapDatesViewProps {
  dates: DateResult[];
  onSelectDate: (date: DateResult) => void;
}

export default function CheapDatesView({ dates, onSelectDate }: CheapDatesViewProps) {
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency === 'MXN' ? 'MXN' : 'USD',
    }).format(price);
  };

  const formatDateRange = (departureDate: string, returnDate: string) => {
    try {
      const departure = new Date(departureDate);
      const returnD = new Date(returnDate);

      const depFormatted = format(departure, 'd MMM', { locale: es });
      const retFormatted = format(returnD, 'd MMM', { locale: es });

      return `${depFormatted} - ${retFormatted}`;
    } catch {
      return `${departureDate} - ${returnDate}`;
    }
  };

  // Encontrar el precio más bajo para marcar la mejor oferta
  const lowestPrice = Math.min(...dates.map((d) => d.price));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-cyan-400" />
          Fechas más baratas
        </h2>
        <p className="text-sm text-white/60">
          {dates.length} opción{dates.length !== 1 ? 'es' : ''} encontrada{dates.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dates.map((date, index) => {
          const isBestDeal = date.price === lowestPrice;

          return (
            <button
              key={index}
              onClick={() => onSelectDate(date)}
              className={`relative rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${
                isBestDeal
                  ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-lg shadow-cyan-500/20'
                  : 'border-white/10 bg-white/5 hover:border-cyan-500/30 hover:bg-white/10'
              }`}
            >
              {/* Best Deal Badge */}
              {isBestDeal && (
                <div className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                  Mejor Precio
                </div>
              )}

              <div className="space-y-3">
                {/* Dates */}
                <div className="flex items-center gap-2">
                  <Calendar className={`h-4 w-4 ${isBestDeal ? 'text-cyan-400' : 'text-white/60'}`} />
                  <p className={`text-sm font-medium ${isBestDeal ? 'text-cyan-400' : 'text-white/80'}`}>
                    {formatDateRange(date.departure_date, date.return_date)}
                  </p>
                </div>

                {/* Full Dates */}
                <div className="space-y-1 text-xs text-white/50">
                  <p>Ida: {date.departure_date}</p>
                  <p>Vuelta: {date.return_date}</p>
                </div>

                {/* Price */}
                <div className="pt-2 border-t border-white/10">
                  <p className={`text-2xl font-bold ${isBestDeal ? 'text-cyan-400' : 'text-white'}`}>
                    {formatPrice(date.price, date.currency)}
                  </p>
                  <p className="text-xs text-white/50">por persona</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
        <p className="text-sm text-cyan-400">
          💡 <strong>Tip:</strong> Haz clic en una fecha para buscar vuelos específicos en ese rango
        </p>
      </div>
    </div>
  );
}
