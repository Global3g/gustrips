export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: 'es',
          maxResultCount: 5,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Places API error:', error);
      return NextResponse.json({ results: [] });
    }

    const data = await response.json();

    const results = (data.places || []).map((place: {
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      id?: string;
    }) => ({
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      lat: place.location?.latitude || 0,
      lng: place.location?.longitude || 0,
      placeId: place.id || '',
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Places search error:', err);
    return NextResponse.json({ results: [] });
  }
}
