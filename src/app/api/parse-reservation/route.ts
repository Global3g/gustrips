export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

/**
 * Fallback reservation parser. The client tries `parseReservationLocal` first
 * (regex, offline); it only calls this route when the local pass can't fill the
 * key fields. Uses Gemini 2.5 Flash with a strict responseSchema so we get
 * structured JSON back instead of prose to re-parse.
 */

const SYSTEM = `Extraés datos de una reserva (restaurante, hotel o actividad) desde el texto/URL que un usuario compartió a su app de viajes. Devolvé SOLO los campos que estén explícitos. No inventes nada. Si el texto NO es una reserva, devolvé isReservation=false.

- type: "restaurant" para mesas (OpenTable, Resy, TheFork); "hotel" para alojamiento (Booking, Airbnb, Hotels.com); "activity" para tours/entradas; "misc" si no aplica.
- date / endDate: formato YYYY-MM-DD. endDate solo para hoteles (check-out).
- startTime: formato HH:MM 24h.
- title: nombre del lugar/restaurante/hotel, no el nombre del proveedor.
- partySize: número de personas si aparece.
- confirmationCode: código de confirmación si aparece.
- location: dirección o ciudad si aparece.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isReservation: { type: 'BOOLEAN' },
    type: { type: 'STRING', enum: ['restaurant', 'hotel', 'activity', 'misc'] },
    title: { type: 'STRING' },
    date: { type: 'STRING', description: 'YYYY-MM-DD' },
    endDate: { type: 'STRING', description: 'YYYY-MM-DD (hotel check-out)' },
    startTime: { type: 'STRING', description: 'HH:MM 24h' },
    location: { type: 'STRING' },
    partySize: { type: 'INTEGER' },
    confirmationCode: { type: 'STRING' },
  },
  required: ['isReservation'],
} as const;

export async function POST(req: NextRequest) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
  }

  let body: { text?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const text = String(body?.text || '').trim();
  const url = String(body?.url || '').trim();
  if (!text && !url) {
    return NextResponse.json({ ok: false, error: 'Falta text o url' }, { status: 400 });
  }

  // Cap input so a giant pasted email can't blow up token cost.
  const payload = [url ? `URL: ${url}` : '', text].filter(Boolean).join('\n\n').slice(0, 6000);

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: payload }] }],
    systemInstruction: { parts: [{ text: SYSTEM }] },
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30_000),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error?.message || `Error ${res.status}` },
        { status: res.status },
      );
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      return NextResponse.json({ ok: false, error: 'Sin respuesta del modelo' }, { status: 502 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: 'Respuesta no parseable' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
