'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
}

interface PlacesAutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  compact?: boolean;
}

export default function PlacesAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  placeholder = 'Buscar lugar...',
  compact = false,
}: PlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/places?action=search&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const list: PlaceResult[] = Array.isArray(data?.data)
        ? data.data.map((p: { id?: string; name?: string; address?: string; lat?: number; lng?: number }) => ({
            name: p.name || '',
            address: p.address || '',
            lat: p.lat || 0,
            lng: p.lng || 0,
            placeId: p.id || '',
          }))
        : [];
      setSuggestions(list);
      setShowDropdown(list.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    onChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  };

  const handleSelect = (place: PlaceResult) => {
    onChange(place.name);
    setShowDropdown(false);
    setSuggestions([]);
    onSelect?.(place);
  };

  const inputClasses = compact
    ? 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all'
    : 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all';

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className={`block font-medium text-gray-700 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder={placeholder}
          className={inputClasses}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
          {suggestions.map((place) => (
            <button
              key={place.placeId}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-b-0"
            >
              <MapPin className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{place.name}</p>
                <p className="text-xs text-gray-400 truncate">{place.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
