export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  searchCacheKey,
  detailsCacheKey,
  getCached,
  setCached,
  checkLimits,
  recordCall,
} from '@/lib/places/cache';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
  'places.priceLevel',
  'places.types',
  'places.photos',
].join(',');

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'currentOpeningHours',
  'regularOpeningHours',
  'photos',
  'reviews',
  'types',
].join(',');

interface PlaceLite {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingsTotal: number | null;
  openNow: boolean | null;
  priceLevel: string | null;
  types: string[];
  lat: number;
  lng: number;
  photoRef: string | null;
}

interface PlaceFull extends PlaceLite {
  phone: string | null;
  website: string | null;
  openingHours: string[] | null;
  photos: string[];
  reviews: Array<{
    author: string;
    rating: number | null;
    text: string;
    relativeTime: string;
  }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapSearchResult(place: any): PlaceLite {
  const photos = Array.isArray(place?.photos) ? place.photos : [];
  return {
    id: String(place?.id || ''),
    name: String(place?.displayName?.text || ''),
    address: String(place?.formattedAddress || ''),
    rating: typeof place?.rating === 'number' ? place.rating : null,
    userRatingsTotal: typeof place?.userRatingCount === 'number' ? place.userRatingCount : null,
    openNow:
      typeof place?.currentOpeningHours?.openNow === 'boolean'
        ? place.currentOpeningHours.openNow
        : null,
    priceLevel: place?.priceLevel ? String(place.priceLevel) : null,
    types: Array.isArray(place?.types) ? place.types.map((t: unknown) => String(t)) : [],
    lat: Number(place?.location?.latitude) || 0,
    lng: Number(place?.location?.longitude) || 0,
    photoRef: photos[0]?.name ? String(photos[0].name) : null,
  };
}

function mapDetailsResult(place: any): PlaceFull {
  const lite = mapSearchResult(place);
  const photos = Array.isArray(place?.photos)
    ? place.photos
        .slice(0, 5)
        .map((p: any) => (p?.name ? String(p.name) : ''))
        .filter(Boolean)
    : [];

  const openingHours: string[] | null = Array.isArray(
    place?.currentOpeningHours?.weekdayDescriptions,
  )
    ? place.currentOpeningHours.weekdayDescriptions.map((d: unknown) => String(d))
    : Array.isArray(place?.regularOpeningHours?.weekdayDescriptions)
      ? place.regularOpeningHours.weekdayDescriptions.map((d: unknown) => String(d))
      : null;

  const reviews = Array.isArray(place?.reviews)
    ? place.reviews.slice(0, 3).map((r: any) => ({
        author: String(r?.authorAttribution?.displayName || ''),
        rating: typeof r?.rating === 'number' ? r.rating : null,
        text: String(r?.text?.text || r?.originalText?.text || ''),
        relativeTime: String(r?.relativePublishTimeDescription || ''),
      }))
    : [];

  return {
    ...lite,
    phone: place?.internationalPhoneNumber
      ? String(place.internationalPhoneNumber)
      : place?.nationalPhoneNumber
        ? String(place.nationalPhoneNumber)
        : null,
    website: place?.websiteUri ? String(place.websiteUri) : null,
    openingHours,
    photos,
    reviews,
  };
}

async function handleSearch(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') || '').trim();
  const location = (req.nextUrl.searchParams.get('location') || '').trim();
  const radiusRaw = (req.nextUrl.searchParams.get('radius') || '').trim();
  const tripId = (req.nextUrl.searchParams.get('tripId') || '').trim() || undefined;

  if (query.length < 2) {
    return NextResponse.json({ ok: false, error: 'Consulta demasiado corta' }, { status: 400 });
  }

  // 1. Cache: nearby same-query searches share an entry (7d TTL). Free hit.
  const cacheKey = searchCacheKey(query, location, radiusRaw);
  const cached = await getCached(cacheKey);
  if (cached !== null) {
    return NextResponse.json({ ok: true, data: cached, cached: true });
  }

  // 2. Cost gates: monthly cap + per-trip daily limit. Fail-open.
  const gate = await checkLimits(tripId);
  if (!gate.allowed) {
    return NextResponse.json({ ok: false, error: gate.reason, capped: true });
  }

  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: 'es',
    maxResultCount: 10,
  };

  if (location) {
    const parts = location.split(',').map((p) => p.trim());
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    const radius = Number(radiusRaw) || 5000;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      body.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: Math.min(Math.max(radius, 100), 50000),
        },
      };
    }
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Places API search error:', err);
    return NextResponse.json(
      { ok: false, error: err?.error?.message || `Error ${response.status}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  const results = (Array.isArray(data?.places) ? data.places : []).map(mapSearchResult);
  // Real call succeeded: cache the result + count it against the budget.
  await Promise.all([setCached(cacheKey, results, 'search'), recordCall(tripId)]);
  return NextResponse.json({ ok: true, data: results });
}

async function handleDetails(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') || '').trim();
  const tripId = (req.nextUrl.searchParams.get('tripId') || '').trim() || undefined;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Falta placeId' }, { status: 400 });
  }

  // Place details rarely change — cache aggressively (30d).
  const cacheKey = detailsCacheKey(id);
  const cached = await getCached(cacheKey);
  if (cached !== null) {
    return NextResponse.json({ ok: true, data: cached, cached: true });
  }

  const gate = await checkLimits(tripId);
  if (!gate.allowed) {
    return NextResponse.json({ ok: false, error: gate.reason, capped: true });
  }

  const placePath = id.startsWith('places/') ? id : `places/${id}`;
  const url = `https://places.googleapis.com/v1/${placePath}?languageCode=es`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Places API details error:', err);
    return NextResponse.json(
      { ok: false, error: err?.error?.message || `Error ${response.status}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  const mapped = mapDetailsResult(data);
  await Promise.all([setCached(cacheKey, mapped, 'details'), recordCall(tripId)]);
  return NextResponse.json({ ok: true, data: mapped });
}

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({
      ok: false,
      error: 'Google Places no configurada en el servidor',
    });
  }

  const action = (req.nextUrl.searchParams.get('action') || '').trim();

  try {
    if (action === 'search' || action === '') {
      // Default to search to keep backwards compatibility with the older
      // ?q=... only callers.
      return await handleSearch(req);
    }
    if (action === 'details') {
      return await handleDetails(req);
    }
    return NextResponse.json(
      { ok: false, error: `Acción desconocida: ${action}` },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Places route error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
