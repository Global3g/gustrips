'use client';

import { useEffect, useState, useRef } from 'react';
import type { TripEvent } from '@/types';

interface GeocodedEvent extends TripEvent {
  _geoLat?: number;
  _geoLng?: number;
}

const CACHE_KEY = 'gustrips-geocache';
const RATE_LIMIT_MS = 350; // gentle throttle; /api/places is server-cached + capped

function getCache(): Record<string, { lat: number; lng: number }> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, { lat: number; lng: number }>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full — ignore
  }
}

/**
 * Geocodes event locations via Google Places (our own /api/places, which is
 * server-cached and monthly-capped). This is a FALLBACK: events ideally get
 * lat/lng stamped at creation by PlacesAutocomplete in the event form. Results
 * are also cached in localStorage. Events that already have coords pass through
 * untouched (so the map is instant + offline once coords are stored).
 */
export function useGeocode(events: TripEvent[]): { geocodedEvents: GeocodedEvent[]; loading: boolean } {
  const [geocoded, setGeocoded] = useState<GeocodedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const cache = getCache();
      const results: GeocodedEvent[] = [];
      const toGeocode: { index: number; location: string }[] = [];

      // First pass: use existing coords or cache
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];

        // Already has coordinates
        if (ev.latitude != null && ev.longitude != null) {
          results[i] = { ...ev, _geoLat: ev.latitude, _geoLng: ev.longitude };
          continue;
        }

        // No location text to geocode
        if (!ev.location || ev.location.trim().length < 3) {
          results[i] = { ...ev };
          continue;
        }

        const cacheKey = ev.location.trim().toLowerCase();
        if (cache[cacheKey]) {
          results[i] = { ...ev, _geoLat: cache[cacheKey].lat, _geoLng: cache[cacheKey].lng };
          continue;
        }

        // Need to geocode
        results[i] = { ...ev };
        toGeocode.push({ index: i, location: ev.location.trim() });
      }

      // Update with cached results immediately
      if (!cancelled) setGeocoded([...results]);

      // Geocode remaining with rate limiting
      for (const item of toGeocode) {
        if (cancelled) break;

        try {
          const response = await fetch(
            `/api/places?action=search&q=${encodeURIComponent(item.location)}`,
          );
          if (!response.ok) continue;

          const json = await response.json();
          const first = Array.isArray(json?.data) ? json.data[0] : null;
          const lat = Number(first?.lat);
          const lng = Number(first?.lng);
          // Guard the 0,0 sentinel /api/places returns when Google had no coords.
          if (first && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
            results[item.index] = { ...results[item.index], _geoLat: lat, _geoLng: lng };

            // Save to cache
            const cacheKey = item.location.toLowerCase();
            cache[cacheKey] = { lat, lng };
            setCache(cache);

            if (!cancelled) setGeocoded([...results]);
          }
        } catch {
          // Geocoding failed — skip silently
        }

        // Rate limit
        if (toGeocode.indexOf(item) < toGeocode.length - 1) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
        }
      }

      if (!cancelled) {
        setGeocoded([...results]);
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      abortRef.current = true;
    };
  }, [events]);

  return { geocodedEvents: geocoded, loading };
}
