/**
 * POST /api/generate-reel
 *
 * Submits a Trip Reel render job to Shotstack. The client sends the
 * selected photos, music choice, aspect ratio, and style preset; we
 * build the Shotstack edit JSON, fire the render, and return the id.
 *
 * If `SHOTSTACK_API_KEY` is not configured (typical for local dev or
 * preview environments before the user has signed up), the route falls
 * back to a deterministic mock response so the UI flow can still be
 * exercised end-to-end.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  buildReelEdit,
  submitRender,
  MissingKeyError,
  type ReelMusic,
  type ReelAspect,
  type ReelStyle,
  type ReelPhoto,
} from '@/lib/shotstack';

interface GenerateReelBody {
  photos?: ReelPhoto[];
  music?: ReelMusic;
  aspect?: ReelAspect;
  style?: ReelStyle;
  tripTitle?: string;
  destination?: string;
  dateRange?: string;
}

const VALID_MUSIC: ReelMusic[] = ['chill', 'upbeat', 'cinematic'];
const VALID_ASPECT: ReelAspect[] = ['1:1', '9:16'];
const VALID_STYLE: ReelStyle[] = ['cinematic', 'vibrant', 'slow'];

/** A short, royalty-free sample MP4 used for mock responses so the UI
 *  can show a playable preview when the API key isn't configured. */
const MOCK_VIDEO_URL =
  'https://shotstack-assets.s3.amazonaws.com/footage/beach-sample.mp4';

export async function POST(req: NextRequest) {
  let body: GenerateReelBody;
  try {
    body = (await req.json()) as GenerateReelBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (photos.length < 2) {
    return NextResponse.json(
      { ok: false, error: 'Se necesitan al menos 2 fotos' },
      { status: 400 },
    );
  }
  if (photos.length > 24) {
    return NextResponse.json(
      { ok: false, error: 'Máximo 24 fotos por reel' },
      { status: 400 },
    );
  }
  // Normalize and validate each photo entry.
  const cleanPhotos: ReelPhoto[] = [];
  for (const p of photos) {
    if (!p || typeof p.url !== 'string' || !/^https?:\/\//.test(p.url)) {
      return NextResponse.json(
        { ok: false, error: 'Cada foto debe tener una URL http(s) válida' },
        { status: 400 },
      );
    }
    cleanPhotos.push({
      url: p.url,
      caption: typeof p.caption === 'string' ? p.caption : undefined,
      date: typeof p.date === 'string' ? p.date : '',
    });
  }

  const music = VALID_MUSIC.includes(body.music as ReelMusic)
    ? (body.music as ReelMusic)
    : 'chill';
  const aspect = VALID_ASPECT.includes(body.aspect as ReelAspect)
    ? (body.aspect as ReelAspect)
    : '1:1';
  const style = VALID_STYLE.includes(body.style as ReelStyle)
    ? (body.style as ReelStyle)
    : 'cinematic';
  const tripTitle = (body.tripTitle && body.tripTitle.trim()) || 'Mi viaje';
  const destination = body.destination?.trim() || undefined;
  const dateRange = body.dateRange?.trim() || undefined;

  // Build the timeline regardless of whether we have a key — building
  // is cheap and makes the mock path return the same shape.
  const edit = buildReelEdit({
    photos: cleanPhotos,
    music,
    aspect,
    style,
    tripTitle,
    destination,
    dateRange,
  });

  // No key → mock response. The status route will short-circuit too.
  if (!process.env.SHOTSTACK_API_KEY) {
    return NextResponse.json({
      ok: true,
      renderId: `mock-${Date.now().toString(36)}`,
      mockUrl: MOCK_VIDEO_URL,
      mock: true,
    });
  }

  try {
    const { id } = await submitRender(edit);
    return NextResponse.json({ ok: true, renderId: id });
  } catch (err: unknown) {
    if (err instanceof MissingKeyError) {
      // Defensive: shouldn't happen because we already checked above.
      return NextResponse.json({
        ok: true,
        renderId: `mock-${Date.now().toString(36)}`,
        mockUrl: MOCK_VIDEO_URL,
        mock: true,
      });
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[generate-reel] submit failed:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
