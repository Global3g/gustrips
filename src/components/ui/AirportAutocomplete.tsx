'use client';

import { useState, useRef, useEffect } from 'react';
import { Plane, X } from 'lucide-react';
import { searchAirports, type Airport } from '@/data/airports';
import { classNames } from '@/lib/utils/helpers';

interface AirportAutocompleteProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function AirportAutocomplete({
  label,
  value,
  onChange,
  placeholder = 'Buscar ciudad o código...',
  required = false,
}: AirportAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (query: string) => {
    setInputValue(query);

    if (query.length >= 2) {
      const searchResults = searchAirports(query);
      setResults(searchResults);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }

    // If user is typing and we had a selection, clear it
    if (selectedAirport) {
      setSelectedAirport(null);
      onChange('');
    }
  };

  const handleSelectAirport = (airport: Airport) => {
    setSelectedAirport(airport);
    setInputValue(`${airport.city} (${airport.code})`);
    onChange(airport.code);
    setShowResults(false);
  };

  const handleClear = () => {
    setInputValue('');
    setSelectedAirport(null);
    onChange('');
    setResults([]);
    setShowResults(false);
  };

  const handleFocus = () => {
    if (inputValue.length >= 2 && results.length > 0) {
      setShowResults(true);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-white/90 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
          <Plane className="h-4 w-4" />
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={classNames(
            'w-full rounded-lg border border-white/10 bg-white/5',
            'px-10 py-2.5 text-sm text-white placeholder:text-white/40',
            'transition-all duration-200',
            'focus:border-cyan-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/20',
            'hover:bg-white/[0.07]'
          )}
          required={required}
        />

        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-xl max-h-64 overflow-y-auto">
          {results.map((airport) => (
            <button
              key={airport.code}
              type="button"
              onClick={() => handleSelectAirport(airport)}
              className={classNames(
                'w-full px-4 py-3 text-left transition-colors',
                'hover:bg-cyan-500/10 border-b border-white/5 last:border-b-0',
                'flex items-start gap-3'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <span className="text-cyan-400 font-bold text-sm">{airport.code}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">
                  {airport.city}
                </p>
                <p className="text-white/50 text-xs truncate">
                  {airport.country}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showResults && inputValue.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-xl p-4 text-center">
          <p className="text-white/50 text-sm">No se encontraron aeropuertos</p>
          <p className="text-white/40 text-xs mt-1">Intenta con otra ciudad o código</p>
        </div>
      )}
    </div>
  );
}
