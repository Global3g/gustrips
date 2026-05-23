export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

/**
 * Packing list AI suggester.
 *
 * Receives the trip's destination, dates, an optional tripType hint
 * (one of the TRIP_TEMPLATES ids) and the list of items the user has
 * already added — and asks Gemini 2.5 Flash for 5-10 ADDITIONAL items
 * the user might have missed.
 *
 * Returns `{ ok: true, suggestions: string[] }`. Each suggestion is a
 * short single-line phrase (no quantity, no category) in Spanish
 * rioplatense — the client picks the category from a dropdown when it
 * adds the suggestion to the live list.
 *
 * Uses Gemini's `responseSchema` so we get strict JSON and don't have
 * to fight with markdown fences or trailing commas.
 */

interface SuggestRequest {
  destination?: string;
  startDate?: string;
  endDate?: string;
  tripType?: string;
  currentItems?: string[];
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

const SYSTEM_PROMPT = `Sos un asistente experto en armar maletas para viajeros argentinos / rioplatenses. Te paso info de un viaje y la lista actual de cosas que el usuario ya tiene en su maleta. Tu trabajo es sugerir entre 5 y 10 items ADICIONALES que probablemente se está olvidando, considerando el destino, las fechas (estación del año en el destino) y el tipo de viaje.

Reglas:
- Devolvé items específicos y accionables (ej. "Adaptador de enchufe tipo G para Reino Unido", no "adaptador").
- NUNCA repitas un item que ya esté en la lista actual (revisá con criterio amplio — si ya tiene "bloqueador solar" no agregues "protector solar").
- Usá español rioplatense natural ("malla" no "traje de baño", "campera" no "chaqueta", "remera" no "playera").
- No expliques nada, devolvé solamente la lista.
- Cada item debe ser una frase corta de 1 línea (máximo 50 caracteres).
- Si el viaje es a clima frío evitá items de calor y viceversa.
- Pensá en cosas que se suelen olvidar: cargadores específicos, medicamentos, adaptadores, protección, snacks, ropa de gala si aplica, etc.`;

function buildUserPrompt(req: SuggestRequest): string {
  const destination = (req.destination || '').trim() || 'destino sin especificar';
  const start = (req.startDate || '').trim();
  const end = (req.endDate || '').trim();
  const tripType = (req.tripType || '').trim();
  const currentItems = (req.currentItems || []).filter(Boolean).slice(0, 200);

  const lines: string[] = [];
  lines.push(`Destino: ${destination}`);
  if (start || end) {
    lines.push(`Fechas: ${start || '?'} a ${end || '?'}`);
  }
  if (tripType) {
    lines.push(`Tipo de viaje: ${tripType}`);
  }
  lines.push('');
  lines.push('Items ya en la maleta:');
  if (currentItems.length === 0) {
    lines.push('(la maleta está vacía)');
  } else {
    for (const it of currentItems) {
      lines.push(`- ${it}`);
    }
  }
  lines.push('');
  lines.push('Devolveme entre 5 y 10 sugerencias ADICIONALES en JSON.');
  return lines.join('\n');
}

async function callGemini(apiKey: string, userPrompt: string): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // The system instruction stays separate from the user content so
        // we can tune the rules without touching every call site.
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              suggestions: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                minItems: 3,
                maxItems: 12,
              },
            },
            required: ['suggestions'],
          },
          thinkingConfig: { thinkingBudget: 512 },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: 'no-key', error: 'GEMINI_API_KEY no configurada en el servidor' },
      { status: 500 },
    );
  }

  let body: SuggestRequest;
  try {
    body = (await req.json()) as SuggestRequest;
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'bad-request', error: 'Body inválido' },
      { status: 400 },
    );
  }

  const userPrompt = buildUserPrompt(body);

  // Retry once on transient 5xx / empty-text responses.
  for (let attempt = 1; attempt <= 2; attempt++) {
    let response: Response;
    try {
      response = await callGemini(apiKey, userPrompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed';
      console.error(`[packing-suggest] attempt ${attempt} fetch error:`, msg);
      if (attempt === 2) {
        return NextResponse.json(
          {
            ok: false,
            reason: 'timeout',
            error: 'No pudimos contactar al asistente. Probá de nuevo en un momento.',
          },
          { status: 504 },
        );
      }
      await sleep(600);
      continue;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiMsg = data?.error?.message || `Gemini ${response.status}`;
      console.error(`[packing-suggest] attempt ${attempt} gemini error:`, response.status, apiMsg);
      if (response.status >= 500 && attempt < 2) {
        await sleep(600);
        continue;
      }
      const reason = response.status === 429 ? 'rate-limited' : 'gemini-error';
      const userMsg =
        response.status === 429
          ? 'Muchos pedidos seguidos. Esperá unos segundos.'
          : 'El asistente rechazó la consulta. Probá de nuevo.';
      return NextResponse.json(
        { ok: false, reason, error: userMsg, gemini: apiMsg },
        { status: 502 },
      );
    }

    const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts || [];
    let text = '';
    for (const part of parts) {
      if (part?.thought) continue;
      if (typeof part?.text === 'string') text += part.text;
    }

    if (!text) {
      if (attempt < 2) {
        await sleep(400);
        continue;
      }
      return NextResponse.json(
        { ok: false, reason: 'no-text', error: 'El asistente no devolvió sugerencias. Probá otra vez.' },
        { status: 502 },
      );
    }

    let parsed: { suggestions?: unknown };
    try {
      parsed = JSON.parse(text.trim());
    } catch (err) {
      console.error('[packing-suggest] parse failed despite responseSchema:', err, 'raw:', text.slice(0, 200));
      return NextResponse.json(
        { ok: false, reason: 'parse-failed', error: 'Respuesta inesperada del asistente.' },
        { status: 502 },
      );
    }

    const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    // Sanitize: trim, drop empties / duplicates, cap at 10.
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const cleaned = item.trim().replace(/^[-•*\s]+/, '');
      if (!cleaned) continue;
      const key = cleaned.toLocaleLowerCase('es');
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(cleaned.slice(0, 80));
      if (suggestions.length >= 10) break;
    }

    return NextResponse.json({ ok: true, suggestions });
  }

  return NextResponse.json({ ok: false, reason: 'unknown', error: 'No fue posible' }, { status: 500 });
}
