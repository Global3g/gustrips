export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

/**
 * Receipt OCR endpoint.
 *
 * 2026-05-23 hardening: the user reported the scan was failing
 * intermittently on real receipts during a London trip. Causes addressed
 * here:
 *   1. The old prompt was too rigid about output shape and currency.
 *      Now we use Gemini's responseSchema so the model is FORCED to
 *      return well-typed JSON. That removes the entire "fix the markdown
 *      fences" + JSON.parse failure surface.
 *   2. The currency whitelist was too short (5 codes); a London receipt
 *      in GBP, an airport eur charge, BRL/CLP/JPY all fell off. The new
 *      prompt accepts any ISO 4217 code.
 *   3. We retry once on Gemini 5xx and on "no text" responses (which
 *      Gemini returns when its safety filter trips on a busy image),
 *      with a tiny delay. Most failures were transient.
 *   4. Error responses now include a `reason` discriminator the client
 *      maps to a friendlier message.
 */

const PROMPT = `Esto es la foto de un ticket / recibo / factura de un viaje.

Extraé los siguientes campos del documento:
- description: nombre del comercio o concepto principal (corto, 1 línea)
- amount: monto TOTAL pagado, sólo el número (sin signo monetario, sin separadores de miles, con punto decimal si aplica)
- currency: código ISO 4217 de 3 letras (MXN, USD, EUR, GBP, JPY, BRL, ARS, COP, CLP, PEN, CAD, AUD, CHF, etc). Si no podés determinarla, devolvé "USD".
- category: una de [flight, hotel, car_rental, activity, restaurant, transport, cruise, souvenirs, snacks, clothing, fuel, misc]. Elegí la que mejor describa el gasto.
- paymentMethod: una de [cash, debit, credit, transfer, points, other]. Detectá del texto del ticket: "efectivo"/"contado"/"cash"=cash, "débito"/"debit"=debit, "crédito"/"credit"/"VISA"/"MC"/"AMEX"=credit, "transferencia"/"SPEI"/"BIZUM"=transfer. Si no se ve, devolvé "other".

Si la foto no parece un ticket o no podés leer el monto, devolvé igual el objeto pero con amount=0 y description="ticket ilegible".`;

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

async function callGemini(apiKey: string, base64: string, mimeType: string): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          // Force structured JSON output — eliminates the markdown-fences
          // + JSON.parse failure mode entirely.
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              description: { type: 'STRING' },
              amount: { type: 'NUMBER' },
              currency: { type: 'STRING' },
              category: { type: 'STRING' },
              paymentMethod: { type: 'STRING' },
            },
            required: ['description', 'amount', 'currency', 'category', 'paymentMethod'],
          },
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
      signal: AbortSignal.timeout(45_000),
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

  let body: { base64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'bad-request', error: 'Body inválido' },
      { status: 400 },
    );
  }
  const base64 = String(body?.base64 || '');
  const mimeType = String(body?.mimeType || 'image/jpeg');
  if (!base64) {
    return NextResponse.json(
      { ok: false, reason: 'no-image', error: 'Falta el campo base64' },
      { status: 400 },
    );
  }

  // Up to 2 attempts. Gemini 5xx and empty-candidates are usually
  // transient; everything else fails on the first try.
  for (let attempt = 1; attempt <= 2; attempt++) {
    let response: Response;
    try {
      response = await callGemini(apiKey, base64, mimeType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed';
      console.error(`[scan-receipt] attempt ${attempt} fetch error:`, msg);
      if (attempt === 2) {
        return NextResponse.json(
          {
            ok: false,
            reason: 'timeout',
            error: 'No pudimos contactar al servicio de OCR. Probá de nuevo en un momento.',
          },
          { status: 504 },
        );
      }
      await sleep(800);
      continue;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiMsg = data?.error?.message || `Gemini ${response.status}`;
      console.error(`[scan-receipt] attempt ${attempt} gemini error:`, response.status, apiMsg);
      // Retry on 5xx; bail on 4xx.
      if (response.status >= 500 && attempt < 2) {
        await sleep(800);
        continue;
      }
      const reason = response.status === 429 ? 'rate-limited' : 'gemini-error';
      const userMsg = response.status === 429
        ? 'Muchos pedidos seguidos. Esperá unos segundos e intentá de nuevo.'
        : response.status === 413
          ? 'La foto es muy grande. Probá con una más chica o reenfocá el ticket.'
          : 'El servicio de OCR rechazó la foto. Probá otra.';
      return NextResponse.json(
        { ok: false, reason, error: userMsg, gemini: apiMsg },
        { status: 502 },
      );
    }

    // Pull the JSON text out of the response.
    const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts || [];
    let text = '';
    for (const part of parts) {
      if (part?.thought) continue;
      if (typeof part?.text === 'string') text += part.text;
    }

    // Empty response — often the safety filter on noisy images. Retry once.
    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      console.warn(
        `[scan-receipt] attempt ${attempt} empty text, finishReason=${finishReason}`,
      );
      if (attempt < 2) {
        await sleep(600);
        continue;
      }
      return NextResponse.json(
        {
          ok: false,
          reason: 'no-text',
          error:
            finishReason === 'SAFETY'
              ? 'La foto fue rechazada por seguridad. Probá con otra.'
              : 'El modelo no devolvió datos. Probá con una foto más clara o nítida.',
        },
        { status: 502 },
      );
    }

    // Because we set responseMimeType: application/json + a schema, the
    // text is now guaranteed-ish to be valid JSON. We still try/catch
    // because Gemini occasionally wraps it in extra whitespace.
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text.trim());
    } catch (err) {
      console.error('[scan-receipt] parse failed despite responseSchema:', err, 'raw:', text.slice(0, 200));
      return NextResponse.json(
        {
          ok: false,
          reason: 'parse-failed',
          error: 'El servicio devolvió datos inesperados. Probá otra foto.',
        },
        { status: 502 },
      );
    }

    // Sanity floor on amount so a confused model doesn't pre-fill garbage.
    if (typeof parsed.amount === 'string') {
      const n = parseFloat((parsed.amount as string).replace(/[^0-9.]/g, ''));
      parsed.amount = Number.isFinite(n) ? n : 0;
    }
    return NextResponse.json({ ok: true, data: parsed });
  }

  // Unreachable — every branch above returns.
  return NextResponse.json({ ok: false, reason: 'unknown', error: 'No fue posible' }, { status: 500 });
}
