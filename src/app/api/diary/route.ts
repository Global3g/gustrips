/**
 * Daily diary — Gemini writes a short, warm summary of a given day in a
 * trip using its events + expenses as source material.
 *
 *   POST /api/diary
 *     headers: Authorization: Bearer <firebase-id-token>
 *     body:    { tripId: string, date: 'YYYY-MM-DD' }
 *
 *   Response: { ok: true, content: string }
 *
 * Why this endpoint exists separately from the chat one: the diary is a
 * one-shot generation with strict shape (~80-150 words, narrative,
 * present perfect, second person plural for couples). Letting it share
 * the chat history would entangle the prompt with conversational state.
 *
 * The diary text itself is persisted client-side to Firestore (see
 * components/diary/DailyDiaryCard.tsx) — this endpoint only generates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `Sos el narrador del diario de viaje de una pareja, escribiendo en español rioplatense, en segunda persona plural ("ustedes"), tono cálido y observador (no cursi).

Recibís el contexto del día: destino, eventos vividos, gastos hechos, fotos sacadas. Tu trabajo es escribir UN PÁRRAFO de 80-150 palabras que cuente el día. Reglas:

- Hablás en pretérito perfecto compuesto: "Hoy desayunaron en…, después caminaron por…".
- Mencioná los lugares y nombres reales del día. NO inventes nada.
- Si hay gastos, mencionalos solo cuando sumen color a la narrativa ("se dieron el gusto de…", "ahorraron yendo a…"). NUNCA listés todos los precios.
- Si hay muchas fotos, decílo como observación afectiva ("muchas para recordar", "una imagen para guardar"), no como cifra.
- Cerrá el párrafo con una observación breve del día, una frase corta. NO conclusiones tipo "qué día tan especial".
- NO uses emojis. NO uses negritas. Sin markdown.
- Si el día no tiene actividades cargadas, escribí algo corto y honesto ("hoy descansaron, sin agenda" o similar) en lugar de inventar.

Devolvé SOLO el párrafo, sin título ni metadatos.`;

interface InboundBody {
  tripId: string;
  date: string;
}

interface TripDoc {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  travelerIds?: string[];
}

interface EventDoc {
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  city?: string;
  country?: string;
  notes?: string;
  type?: string;
  cost?: number;
  currency?: string;
  deletedAt?: unknown;
}

interface ExpenseDoc {
  amount?: number;
  currency?: string;
  category?: string;
  description?: string;
  deletedAt?: unknown;
}

interface PhotoDoc {
  takenAt?: string;
  deletedAt?: unknown;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
  }

  // 1. Auth
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'missing-authorization' }, { status: 401 });
  }
  let uid: string;
  try {
    const decoded = await getAdminAuth(getAdminApp()).verifyIdToken(authHeader.slice('Bearer '.length).trim());
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
    return NextResponse.json({ ok: false, error: 'missing-or-invalid-fields' }, { status: 400 });
  }

  // 3. Load + authorise trip
  const db = getAdminFirestore(getAdminApp());
  const tripSnap = await db.collection('trips').doc(body.tripId).get();
  if (!tripSnap.exists) {
    return NextResponse.json({ ok: false, error: 'trip-not-found' }, { status: 404 });
  }
  const trip = tripSnap.data() as TripDoc;
  if (trip.createdBy !== uid && !(trip.travelerIds || []).includes(uid)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // 4. Pull the day's events, expenses, photo count
  const [eventsSnap, expensesSnap, photosSnap] = await Promise.all([
    db.collection('trips').doc(body.tripId).collection('events').get(),
    db.collection('trips').doc(body.tripId).collection('expenses').get(),
    db.collection('trips').doc(body.tripId).collection('photos').get(),
  ]);

  const dayEvents = eventsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as EventDoc) }))
    .filter((ev) => !ev.deletedAt && (ev as unknown as { date?: string }).date === body.date)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const dayExpenses = expensesSnap.docs
    .map((d) => d.data() as ExpenseDoc & { date?: string })
    .filter((ex) => !ex.deletedAt && ex.date === body.date);

  const dayPhotoCount = photosSnap.docs
    .map((d) => d.data() as PhotoDoc)
    .filter((ph) => {
      if (ph.deletedAt) return false;
      if (!ph.takenAt) return false;
      // Compare just the date portion; photos may store a full ISO timestamp.
      return ph.takenAt.slice(0, 10) === body.date;
    }).length;

  // 5. Build the data block for the model
  const eventLines = dayEvents.map((ev) => {
    const time = ev.startTime ? `${ev.startTime}` : '—';
    const loc = [ev.location, ev.city, ev.country].filter(Boolean).join(', ');
    return `- ${time} · ${ev.title || 'Evento'}${loc ? ` (${loc})` : ''}${ev.notes ? ` · nota: ${ev.notes}` : ''}`;
  });

  const expenseLines = dayExpenses.map((ex) => {
    const cat = ex.category ? ` · ${ex.category}` : '';
    return `- ${ex.amount} ${ex.currency || ''} · ${ex.description || 'sin descripción'}${cat}`;
  });

  const dataBlock = [
    `Viaje: ${trip.title}`,
    `Destino: ${trip.destination}`,
    `Fecha: ${body.date}`,
    '',
    'Eventos del día:',
    eventLines.length > 0 ? eventLines.join('\n') : '(sin eventos cargados)',
    '',
    'Gastos del día:',
    expenseLines.length > 0 ? expenseLines.join('\n') : '(sin gastos cargados)',
    '',
    `Fotos sacadas hoy: ${dayPhotoCount}`,
  ].join('\n');

  // 6. Call Gemini
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
            temperature: 0.7,
            maxOutputTokens: 400,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('[diary] Gemini error', data);
      return NextResponse.json(
        { ok: false, error: data?.error?.message || `Gemini ${response.status}` },
        { status: 502 },
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    let text = '';
    for (const part of parts) {
      if (typeof part?.text === 'string') text += part.text;
    }
    text = text.trim();
    if (!text) {
      return NextResponse.json({ ok: false, error: 'empty-response' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, content: text });
  } catch (err) {
    console.error('[diary] error', err);
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
