export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Eres el asistente de viajes de GusTrips. Ayudas a planificar viajes, dar recomendaciones de destinos, restaurantes, actividades, y consejos de viaje. Respondes en español. Eres amigable, conocedor y conciso.

Cuando recibas datos de un viaje con [CONTEXTO DEL VIAJE], analiza el itinerario y detecta:
- Si falta un vuelo de regreso
- Si hay noches sin hotel reservado (excepto noches en crucero)
- Si hay dias sin comidas planificadas (desayuno, comida, cena)
- Si hay vuelos sin traslado al aeropuerto o del aeropuerto al hotel
- Si el presupuesto parece insuficiente para el destino
- Si faltan documentos importantes (pasaporte, visa, seguro de viaje)
- Cualquier gap o inconsistencia en el itinerario

Cuando detectes algo faltante, sugierelo de forma amigable. No repitas lo que ya esta cubierto.

Instrucciones:
- Responde siempre en español
- Sé conciso pero útil
- Usa **negritas** para información importante
- Da recomendaciones prácticas y actualizadas
- Si no sabes algo, dilo honestamente
- Puedes usar listas y formato markdown básico`;

export async function POST(req: NextRequest) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY no configurada' },
      { status: 500 }
    );
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de mensajes' },
        { status: 400 }
      );
    }

    // Build Gemini contents format
    const contents = [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido. Soy el asistente de viajes de GusTrips. Estoy listo para ayudar.' }],
      },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return NextResponse.json(
        { error: data.error?.message || `Error ${response.status}` },
        { status: response.status }
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json(
        { error: 'No se obtuvo respuesta del modelo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ content: text });
  } catch (error: unknown) {
    console.error('Error en API chat:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
