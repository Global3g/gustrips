/**
 * Daily highlights — Gemini picks the top 3 photos of a given day and
 * writes a short caption + reason for each.
 *
 *   POST /api/highlights
 *     headers: Authorization: Bearer <firebase-id-token>
 *     body:    { tripId: string, date: 'YYYY-MM-DD' }
 *
 *   Response: { ok: true, highlights: Array<{ photoUrl, caption, reason }> }
 *
 * Source material
 * ---------------
 * - All non-deleted photos in trips/<id>/photos with date === <date>.
 *   Up to 24 candidates per day to keep the model prompt under control;
 *   if there are more, we sample favorites first, then everything else,
 *   newest upload first.
 * - Events of that same day (title, location, type) so the model knows
 *   what was happening when the photos were taken.
 *
 * Why we don't pass images
 * ------------------------
 * The endpoint contract here is "URLs + descriptions" — Gemini gets the
 * photo URLs as part of a text block, NOT as binary parts. This keeps the
 * request fast and side-steps any storage/auth complications. The model
 * still reasons about which photos are most worth surfacing based on the
 * caption, favorite flag, and the matching event context.
 *
 * If a photo has no caption, we fall back to "(sin descripción)" so the
 * model has something to anchor on.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CANDIDATES = 24;

const SYSTEM = `Sos el curador de un álbum de viaje en español rioplatense. Te pasan las fotos de un día (con caption opcional y un marcador de favorita) y los eventos de ese día. Tu trabajo es elegir las TRES fotos que mejor cuenten el día — privilegiando momentos significativos, lugares mencionados en los eventos, y fotos marcadas como favoritas.

Para cada foto seleccionada devolvé:
- "photoUrl": el URL exacto que recibiste (sin modificar).
- "caption": una frase corta (máx. 12 palabras), tono cálido y observador, sin emojis, sin markdown. Si la foto ya venía con un caption del usuario, podés reformularlo en clave editorial — pero respetando el lugar/contexto real.
- "reason": una línea (máx. 18 palabras) explicando por qué la elegiste — esa frase la vamos a mostrar al usuario en letra chica abajo del caption.

Reglas:
- Devolvé EXACTAMENTE 3 fotos si hay 3 o más candidatas. Si hay menos, devolvé las que haya.
- Si una foto está marcada como favorita, dale preferencia.
- Si un caption del usuario menciona un lugar, mantenelo.
- NUNCA inventes lugares o personas que no estén en el contexto.
- NO uses emojis ni negritas.

Respondé SOLO con JSON válido con esta forma exacta:
{ "highlights": [ { "photoUrl": "...", "caption": "...", "reason": "..." }, ... ] }

Nada más. Sin texto antes ni después.`;

interface InboundBody {
  tripId: string;
  date: string;
}

interface TripDoc {
  title?: string;
  destination?: string;
  createdBy: string;
  travelerIds?: string[];
}

interface PhotoDoc {
  url?: string;
  caption?: string;
  favorite?: boolean;
  date?: string;
  uploadedAt?: string;
  deletedAt?: unknown;
  eventId?: string;
}

interface EventDoc {
  title?: string;
  startTime?: string;
  location?: string;
  city?: string;
  country?: string;
  type?: string;
  date?: string;
  deletedAt?: unknown;
}

interface HighlightOut {
  photoUrl: string;
  caption: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'GEMINI_API_KEY no configurada' },
      { status: 500 },
    );
  }

  // 1. Auth
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { ok: false, error: 'missing-authorization' },
      { status: 401 },
    );
  }
  let uid: string;
  try {
    const decoded = await getAdminAuth(getAdminApp()).verifyIdToken(
      authHeader.slice('Bearer '.length).trim(),
    );
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-token' }, { status: 401 });
  }

  // 2. Validate body
  let body: InboundBody;
  try {
    body = (await req.json()) as InboundBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  if (!body.tripId || !body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json(
      { ok: false, error: 'missing-or-invalid-fields' },
      { status: 400 },
    );
  }

  // 3. Authorise the trip
  const db = getAdminFirestore(getAdminApp());
  const tripSnap = await db.collection('trips').doc(body.tripId).get();
  if (!tripSnap.exists) {
    return NextResponse.json({ ok: false, error: 'trip-not-found' }, { status: 404 });
  }
  const trip = tripSnap.data() as TripDoc;
  if (
    trip.createdBy !== uid &&
    !(trip.travelerIds || []).includes(uid)
  ) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // 4. Gather candidate photos + events for the day
  const [photosSnap, eventsSnap] = await Promise.all([
    db.collection('trips').doc(body.tripId).collection('photos').get(),
    db.collection('trips').doc(body.tripId).collection('events').get(),
  ]);

  const dayPhotos = photosSnap.docs
    .map((d) => d.data() as PhotoDoc)
    .filter((p) => !p.deletedAt && !!p.url && p.date === body.date)
    .sort((a, b) => {
      // Favorites first, then newest upload first.
      const af = a.favorite ? 1 : 0;
      const bf = b.favorite ? 1 : 0;
      if (af !== bf) return bf - af;
      return (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '');
    });

  if (dayPhotos.length === 0) {
    return NextResponse.json({ ok: true, highlights: [] });
  }

  const candidates = dayPhotos.slice(0, MAX_CANDIDATES);

  const dayEvents = eventsSnap.docs
    .map((d) => d.data() as EventDoc)
    .filter((e) => !e.deletedAt && e.date === body.date)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  // 5. Build prompt
  const eventLines = dayEvents.map((ev) => {
    const time = ev.startTime ? `${ev.startTime}` : '—';
    const loc = [ev.location, ev.city, ev.country].filter(Boolean).join(', ');
    return `- ${time} · ${ev.title ?? 'Evento'}${loc ? ` (${loc})` : ''}`;
  });

  const photoLines = candidates.map((p, i) => {
    const fav = p.favorite ? ' [FAVORITA]' : '';
    const cap = p.caption?.trim() || '(sin descripción)';
    return `${i + 1}. URL: ${p.url}\n   Caption del usuario: ${cap}${fav}`;
  });

  const dataBlock = [
    `Viaje: ${trip.title ?? 'sin título'}`,
    `Destino: ${trip.destination ?? 'sin destino'}`,
    `Fecha: ${body.date}`,
    '',
    'Eventos del día:',
    eventLines.length > 0 ? eventLines.join('\n') : '(sin eventos)',
    '',
    `Fotos del día (${candidates.length} candidatas):`,
    photoLines.join('\n'),
    '',
    'Devolvé las 3 mejores con su caption editorial y razón breve, en JSON.',
  ].join('\n');

  // 6. Call Gemini 2.5 Flash with JSON output enforced
  let modelText = '';
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: SYSTEM }] },
            { role: 'model', parts: [{ text: 'Entendido. Espero los datos del día.' }] },
            { role: 'user', parts: [{ text: dataBlock }] },
          ],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 900,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('[highlights] Gemini error', data);
      return NextResponse.json(
        { ok: false, error: data?.error?.message || `Gemini ${response.status}` },
        { status: 502 },
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (typeof part?.text === 'string') modelText += part.text;
    }
    modelText = modelText.trim();
    if (!modelText) {
      return NextResponse.json({ ok: false, error: 'empty-response' }, { status: 502 });
    }
  } catch (err) {
    console.error('[highlights] gemini call failed', err);
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // 7. Parse + sanitise. We trust the model's URL only if it matches one
  //    of the candidate URLs (defensive: the model could hallucinate). Any
  //    duplicates or unknowns are dropped silently.
  let parsed: unknown;
  try {
    parsed = JSON.parse(modelText);
  } catch {
    // Sometimes the model wraps JSON in a code fence even with
    // responseMimeType set. Try a soft extraction before giving up.
    const fenced = modelText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced && fenced[1]) {
      try {
        parsed = JSON.parse(fenced[1]);
      } catch {
        return NextResponse.json(
          { ok: false, error: 'invalid-model-json' },
          { status: 502 },
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'invalid-model-json' },
        { status: 502 },
      );
    }
  }

  const validUrls = new Set(candidates.map((c) => c.url!).filter(Boolean));
  const rawList: unknown = (parsed as { highlights?: unknown })?.highlights;
  const out: HighlightOut[] = [];
  const seen = new Set<string>();

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;
      const it = item as { photoUrl?: unknown; caption?: unknown; reason?: unknown };
      const url = typeof it.photoUrl === 'string' ? it.photoUrl : '';
      const caption = typeof it.caption === 'string' ? it.caption.trim() : '';
      const reason = typeof it.reason === 'string' ? it.reason.trim() : '';
      if (!url || !validUrls.has(url)) continue;
      if (seen.has(url)) continue;
      if (!caption) continue;
      seen.add(url);
      out.push({ photoUrl: url, caption, reason });
      if (out.length >= 3) break;
    }
  }

  // Fallback: if the model returned nothing usable, surface the top
  // candidates so the UI still has something to render.
  if (out.length === 0) {
    for (const c of candidates.slice(0, 3)) {
      out.push({
        photoUrl: c.url!,
        caption: c.caption?.trim() || 'Un momento del día',
        reason: c.favorite ? 'Foto marcada como favorita' : 'Foto destacada del día',
      });
    }
  }

  return NextResponse.json({ ok: true, highlights: out });
}
