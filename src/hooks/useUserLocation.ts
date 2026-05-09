'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number;
}

export type GeoPermission = 'unknown' | 'granted' | 'denied' | 'prompt';

export interface UseUserLocationOptions {
  enabled?: boolean;
  highAccuracy?: boolean;
  maxAgeMs?: number;
}

export interface UseUserLocationResult {
  location: UserLocation | null;
  permission: GeoPermission;
  request: () => void;
  error: string | null;
}

function mapGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado';
    case err.POSITION_UNAVAILABLE:
      return 'Ubicación no disponible en este momento';
    case err.TIMEOUT:
      return 'Tiempo agotado al obtener tu ubicación';
    default:
      return 'No se pudo obtener tu ubicación';
  }
}

/**
 * React hook around `navigator.geolocation.watchPosition`.
 *
 * Returns the user's current coordinates, the geolocation permission state,
 * an explicit `request()` to trigger the browser prompt, and any error
 * surfaced by the geolocation API as a Spanish-language string.
 */
export function useUserLocation(
  opts?: UseUserLocationOptions
): UseUserLocationResult {
  const enabled = opts?.enabled ?? true;
  const highAccuracy = opts?.highAccuracy ?? true;
  const maxAgeMs = opts?.maxAgeMs ?? 30_000;

  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permission, setPermission] = useState<GeoPermission>('unknown');
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // Permissions API check (best-effort — not all browsers support it).
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!navigator.geolocation) {
      setPermission('denied');
      setError('Geolocalización no disponible');
      return;
    }

    let cancelled = false;
    let permStatus: PermissionStatus | null = null;

    const handleChange = () => {
      if (cancelled || !permStatus) return;
      setPermission(permStatus.state as GeoPermission);
    };

    if (
      typeof navigator.permissions !== 'undefined' &&
      typeof navigator.permissions.query === 'function'
    ) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permStatus = status;
          setPermission(status.state as GeoPermission);
          status.addEventListener('change', handleChange);
        })
        .catch(() => {
          // Some browsers (older Safari) reject the query — leave as 'unknown'.
        });
    }

    return () => {
      cancelled = true;
      if (permStatus) {
        permStatus.removeEventListener('change', handleChange);
      }
    };
  }, []);

  // watchPosition subscription.
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const success = (pos: GeolocationPosition) => {
      setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        ts: pos.timestamp,
      });
      setPermission('granted');
      setError(null);
    };

    const fail = (err: GeolocationPositionError) => {
      setError(mapGeoError(err));
      if (err.code === err.PERMISSION_DENIED) {
        setPermission('denied');
      }
    };

    const id = navigator.geolocation.watchPosition(success, fail, {
      enableHighAccuracy: highAccuracy,
      maximumAge: maxAgeMs,
      timeout: 15_000,
    });
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, highAccuracy, maxAgeMs]);

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('denied');
      setError('Geolocalización no disponible');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: pos.timestamp,
        });
        setPermission('granted');
        setError(null);
      },
      (err) => {
        setError(mapGeoError(err));
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: maxAgeMs,
        timeout: 15_000,
      }
    );
  }, [highAccuracy, maxAgeMs]);

  return { location, permission, request, error };
}
