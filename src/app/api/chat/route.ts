export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Eres el asistente del viaje del usuario en GusTrips. Ayudas a planificar y gestionar el viaje en tiempo real.

Cuando recibas datos del viaje con [CONTEXTO DEL VIAJE], úsalos para responder con precisión.

Acciones que puedes ejecutar (usa las herramientas disponibles cuando aplique):
- Crear, actualizar o eliminar eventos del itinerario
- Registrar gastos del viaje (incluso $0 si fue ahorro / no se realizó)
- Cambiar el presupuesto del viaje
- Leer estadísticas del viaje (totales, breakdown, balance)

Puedes buscar lugares reales con searchPlaces (Google Places) y agregarlos como eventos con addEventFromPlace. Cuando el usuario pida sugerencias o "qué hay cerca", úsalo. La ubicación real del dispositivo se inyecta automáticamente en searchPlaces cuando el usuario dio permiso de geo, así que "qué hay cerca" busca cerca de donde está físicamente, no del destino del viaje. Si el resultado tiene un placeId, puedes usar getPlaceDetails o addEventFromPlace con ese ID — no inventes IDs.

Reglas:
- Cuando el usuario pida una acción concreta (agrega, registra, cambia, elimina), úsala. No preguntes confirmación a menos que falte información clave.
- Si faltan datos críticos para una acción (ej. fecha o monto), pregunta SOLO lo que falta, no llenes con placeholders.
- Cuando el usuario haga una pregunta de lectura ("cuánto llevo gastado", "qué tengo mañana"), responde directo con los datos del contexto sin llamar herramientas si ya tienes la respuesta.
- Si llamas una herramienta, espera el resultado y luego confirma al usuario en una sola frase concisa.
- Responde siempre en español, conciso, con **negritas** en lo importante.
- No inventes IDs ni datos que no estén en el contexto.`;

interface IncomingMessage {
  role: 'user' | 'assistant' | 'model' | 'tool';
  content: string;
  toolName?: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
}

interface IncomingTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function toGeminiContents(messages: IncomingMessage[]) {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      // Tool result echoed back to the model
      let parsed: unknown = m.content;
      try {
        parsed = JSON.parse(m.content);
      } catch {
        // keep as-is
      }
      out.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: m.toolName || 'unknown',
              response: typeof parsed === 'object' && parsed !== null ? parsed : { result: parsed },
            },
          },
        ],
      });
      continue;
    }
    if (m.role === 'assistant' || m.role === 'model') {
      const parts: any[] = [];
      if (m.toolCalls && m.toolCalls.length > 0) {
        for (const tc of m.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.args || {} } });
        }
      }
      if (m.content) parts.push({ text: m.content });
      if (parts.length === 0) parts.push({ text: '' });
      out.push({ role: 'model', parts });
      continue;
    }
    out.push({ role: 'user', parts: [{ text: m.content }] });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY no configurada' },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const messages: IncomingMessage[] = body?.messages;
    const tools: IncomingTool[] | undefined = body?.tools;
    const enableTools: boolean = !!body?.enableTools;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de mensajes' },
        { status: 400 },
      );
    }

    const contents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      {
        role: 'model',
        parts: [{ text: 'Entendido. Soy el asistente de tu viaje.' }],
      },
      ...toGeminiContents(messages),
    ];

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048,
      },
    };

    if (enableTools && tools && tools.length > 0) {
      requestBody.tools = [{ functionDeclarations: tools }];
      // ANY mode would force a tool call; AUTO lets the model decide.
      requestBody.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(45_000),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return NextResponse.json(
        { error: data.error?.message || `Error ${response.status}` },
        { status: response.status },
      );
    }

    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const toolCalls: { name: string; args: Record<string, unknown> }[] = [];
    let text = '';
    for (const part of parts) {
      if (part?.functionCall?.name) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      } else if (typeof part?.text === 'string' && part.text) {
        text += (text ? '\n' : '') + part.text;
      }
    }

    if (toolCalls.length > 0) {
      return NextResponse.json({ toolCalls, content: text || undefined });
    }

    if (!text) {
      return NextResponse.json(
        { error: 'No se obtuvo respuesta del modelo' },
        { status: 500 },
      );
    }

    return NextResponse.json({ content: text });
  } catch (error: unknown) {
    console.error('Error en API chat:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
