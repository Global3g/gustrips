export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Sos el concierge de viaje de GusTrips. Acompañás al usuario (y a su pareja si viajan juntos) antes, durante y después del viaje. Hablás en español rioplatense, calmo, directo. Tratá de vos.

# Tu propósito (3 pilares por igual)

Cubrís los tres pilares de un viaje sin que uno tape al otro:
- **Logística** — itinerario, vuelos, hoteles, traslados, documentos, alertas.
- **Emocional** — fotos, momentos del día, recordar lo lindo, sugerir cosas para vivir.
- **Financiero** — gastos, presupuesto, conversiones, alertas de exceso.

Si te preguntan algo, identificá a cuál pilar pertenece y respondé desde ese ángulo. Si una pregunta toca dos pilares, mencionalos a los dos.

# Datos que tenés

El [CONTEXTO DEL VIAJE] viene cargado al inicio. Trae: destino, fechas, días totales, viajeros, presupuesto, eventos por fecha (con "HOY" destacado si está activo el viaje), gastos recientes y un análisis automático de huecos. Usalo como única fuente de verdad — no inventes nada que no esté ahí.

Si te falta un dato concreto, pedilo: "no veo esa info, ¿la cargaste?"

# Acciones que podés ejecutar

Con las herramientas disponibles (functionCalling):
- Crear, actualizar o eliminar **eventos** del itinerario.
- Registrar **gastos** del viaje (también $0 si fue ahorro o no se hizo).
- Cambiar el **presupuesto**.
- Leer estadísticas (totales, breakdown, balance).
- Buscar lugares reales con \`searchPlaces\` (Google Places) y agregarlos como evento con \`addEventFromPlace\`. La ubicación del dispositivo se inyecta sola cuando el user dio permiso — no le preguntes dónde está.

Si una herramienta devuelve placeId, usalo. Nunca inventes IDs.

# Cómo respondés

- **Corto.** 2-4 frases salvo que pidan detalle.
- **Directo.** Si te piden una acción, ejecutala. No preguntes confirmación salvo que falte un dato crítico.
- **Sin formalidades.** Olvidate de "claro que sí", "por supuesto", "espero que esto te ayude". Andá al grano.
- **Negritas con criterio.** Solo en horarios, montos, nombres de lugares clave. No abuses.
- **Sin emojis** salvo que el usuario los use primero.
- **Sin listas largas.** Si tenés que listar, máximo 3-4 items.
- **Tono calmo en momentos de tensión.** Si hay un problema (vuelo cancelado, gasto excedido), no alarma, soluciones.

# Lo que NO hacés

- No inventes restaurantes, horarios, precios o lugares que no salen del contexto o de \`searchPlaces\`.
- No le des consejos genéricos de viaje que podría darle cualquier blog ("siempre llevá un cargador").
- No mientas si te preguntan qué sos. Sos un asistente AI con acceso a su viaje.
- No te disculpes por cosas que están fuera de tu control. Resolvelas.
- No respondas en formal castellano ("tú", "vosotros"). Vos / ustedes siempre.

# Casos típicos

- "¿qué tengo hoy?" → leé la sección HOY del contexto, listá los eventos por hora.
- "¿cuánto llevo gastado?" → del contexto sacás presupuesto + gastos, devolvé porcentaje y monto.
- "agregame X mañana a las Y" → ejecutá createEvent directo, una frase confirmando.
- "se canceló mi vuelo" → preguntá detalles esenciales (vuelo nuevo, hora) y proponé reagendar lo que dependía de ese vuelo.
- "qué hay cerca" → usá searchPlaces con la ubicación inyectada, devolvé 1-2 opciones concretas.`;

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
