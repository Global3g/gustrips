export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

const PROMPT = `Extract from this receipt/ticket: merchant name or description, total amount (number only), currency (MXN/USD/EUR/GBP/CAD), category (one of: flight, hotel, car_rental, activity, restaurant, transport, cruise, souvenirs, snacks, clothing, fuel, misc), and payment method (one of: cash, debit, credit, transfer, points, other — detect from "efectivo"/"contado"=cash, "tarjeta de débito"=debit, "tarjeta de crédito"/"TDC"/"visa"/"mastercard"=credit, "transferencia"/"SPEI"=transfer). Return JSON only: {"description", "amount", "currency", "category", "paymentMethod"}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'GEMINI_API_KEY no configurada en el servidor' },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const base64 = String(body?.base64 || '');
    const mimeType = String(body?.mimeType || 'image/jpeg');
    if (!base64) {
      return NextResponse.json(
        { ok: false, error: 'Falta el campo base64' },
        { status: 400 },
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { thinkingConfig: { thinkingBudget: 1024 } },
          contents: [
            {
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: PROMPT },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message || `Gemini ${response.status}`;
      console.error('[scan-receipt] Gemini error:', msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    let text = '';
    for (const part of parts) {
      if (part?.thought) continue;
      if (typeof part?.text === 'string') text += part.text;
    }
    if (!text) {
      for (const part of parts) {
        if (typeof part?.text === 'string') text += part.text;
      }
    }
    if (!text) {
      return NextResponse.json(
        { ok: false, error: 'Gemini no devolvió texto' },
        { status: 502 },
      );
    }

    let jsonStr = text.trim();
    if (jsonStr.includes('```')) {
      const m = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      jsonStr = m ? m[1].trim() : jsonStr.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
    }
    if (!jsonStr.startsWith('{')) {
      const m = jsonStr.match(/(\{[\s\S]*\})/);
      if (m) jsonStr = m[1];
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      console.error('[scan-receipt] JSON parse failed:', err, 'raw:', text);
      return NextResponse.json(
        { ok: false, error: 'No pude parsear la respuesta del modelo. Intenta con otra foto.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[scan-receipt] error:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
