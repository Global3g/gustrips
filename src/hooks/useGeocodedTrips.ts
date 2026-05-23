'use client';

/**
 * useGeocodedTrips — augments the trip list with `{ lat, lng, name }` for each
 * trip's destination. Used by the user-level Footprint Map.
 *
 * Caching strategy
 * ----------------
 * Geocoded coordinates are persisted in Firestore at
 *   trips/<id>/meta/geocoded
 * so subsequent visits don't pay another Nominatim round-trip. We keep ONE
 * doc per trip because each trip has exactly one destination string.
 *
 * Why a subcollection (and not a field on the trip doc): the firestore rules
 * for /trips reject any update where the caller isn't the owner; meta
 * subdocs, on the other hand, are writable by both owner and invited
 * travelers, which matches who would open the Footprint map.
 *
 * Rate limiting
 * -------------
 * Nominatim asks for ≤ 1 req/sec. We respect that by sequentially geocoding
 * one trip per second. The hook returns trips with coordinates as they
 * arrive so the map can pin them progressively rather than waiting for the
 * entire backlog to drain.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import type { Trip } from '@/types';

export interface GeocodedTrip extends Trip {
  lat: number;
  lng: number;
  geoName?: string;
}

interface GeocodeCache {
  lat: number;
  lng: number;
  name?: string;
}

const NOMINATIM_DELAY_MS = 1100;

/** Best-effort lookup against Nominatim. Returns null on failure. */
async function geocodeOnce(destination: string): Promise<GeocodeCache | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1&accept-language=es`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as { lat?: string; lon?: string; display_name?: string };
    const lat = first.lat ? parseFloat(first.lat) : NaN;
    const lng = first.lon ? parseFloat(first.lon) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, name: first.display_name };
  } catch {
    return null;
  }
}

interface UseGeocodedTripsReturn {
  geocodedTrips: GeocodedTrip[];
  loading: boolean;
  pendingCount: number;
}

export function useGeocodedTrips(trips: Trip[]): UseGeocodedTripsReturn {
  // We key the augmented map by trip id so the result list stays stable as
  // we resolve geocodes progressively.
  const [coords, setCoords] = useState<Record<string, GeocodeCache>>({});
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (trips.length === 0) {
      // Reset asynchronously to keep this effect free of synchronous
      // setState calls (the cascading-render warning). A zero-delay
      // microtask works because nothing observable depends on the order
      // here — the previous coords are stale anyway.
      queueMicrotask(() => {
        setCoords({});
        setLoading(false);
        setPendingCount(0);
      });
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    let cancelled = false;

    (async () => {
      const db = getClientDb();
      setLoading(true);

      // 1) Hydrate from Firestore meta docs first so already-cached trips
      //    appear instantly on the map.
      const initial: Record<string, GeocodeCache> = {};
      const needsGeocode: Trip[] = [];

      for (const trip of trips) {
        if (!trip.destination || trip.destination.trim().length === 0) continue;
        try {
          const ref = doc(db, 'trips', trip.id, 'meta', 'geocoded');
          const snap = await getDoc(ref);
          if (cancelled) {
            inFlightRef.current = false;
            return;
          }
          if (snap.exists()) {
            const data = snap.data() as Partial<GeocodeCache> & { destination?: string };
            const sameDestination = (data.destination ?? '').trim().toLowerCase() === trip.destination.trim().toLowerCase();
            if (
              sameDestination &&
              typeof data.lat === 'number' &&
              typeof data.lng === 'number' &&
              Number.isFinite(data.lat) &&
              Number.isFinite(data.lng)
            ) {
              initial[trip.id] = { lat: data.lat, lng: data.lng, name: data.name };
              continue;
            }
          }
        } catch {
          // Firestore read failed — fall through to geocoding live.
        }
        needsGeocode.push(trip);
      }

      if (cancelled) {
        inFlightRef.current = false;
        return;
      }

      setCoords(initial);
      setPendingCount(needsGeocode.length);

      if (needsGeocode.length === 0) {
        setLoading(false);
        inFlightRef.current = false;
        return;
      }

      // 2) Resolve missing ones sequentially, respecting Nominatim's
      //    1 req/sec cap. Persist each result so other clients (and future
      //    sessions) benefit.
      for (let i = 0; i < needsGeocode.length; i++) {
        if (cancelled) break;
        const trip = needsGeocode[i];
        const result = await geocodeOnce(trip.destination);
        if (cancelled) break;

        if (result) {
          setCoords((prev) => ({ ...prev, [trip.id]: result }));
          try {
            await setDoc(
              doc(db, 'trips', trip.id, 'meta', 'geocoded'),
              {
                lat: result.lat,
                lng: result.lng,
                name: result.name ?? null,
                destination: trip.destination,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } catch {
            // Cache write failed — not fatal, the pin still shows this session.
          }
        }
        setPendingCount(Math.max(0, needsGeocode.length - (i + 1)));

        // Throttle between requests so we never exceed 1 req/sec.
        if (i < needsGeocode.length - 1 && !cancelled) {
          await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS));
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
      inFlightRef.current = false;
    })();

    return () => {
      cancelled = true;
      inFlightRef.current = false;
    };
    // We intentionally key on a stable identity of the trip list (ids +
    // destinations). Re-running on every parent re-render would re-fire the
    // whole geocode dance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips.map((t) => `${t.id}:${t.destination}`).join('|')]);

  const geocodedTrips = useMemo<GeocodedTrip[]>(() => {
    const out: GeocodedTrip[] = [];
    for (const trip of trips) {
      const c = coords[trip.id];
      if (!c) continue;
      out.push({ ...trip, lat: c.lat, lng: c.lng, geoName: c.name });
    }
    return out;
  }, [trips, coords]);

  return { geocodedTrips, loading, pendingCount };
}
