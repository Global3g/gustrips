'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { ChatMessage } from './types';
import { GREETING, QUICK_ACTIONS } from './constants';
import { ChatbotButton } from './ChatbotButton';

// Lazy-load the heavy panel UI; the panel chunk only ships once the user opens the chat.
const ChatbotPanel = dynamic(
  () => import('./ChatbotPanel').then((m) => m.ChatbotPanel),
  { ssr: false },
);
import {
  useTripFromContext,
  useEventsFromContext,
  useExpensesFromContext,
} from '@/context/TripDataContext';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { TOOL_SCHEMAS, executeToolCall, type ToolDeps } from '@/lib/assistant/tools';
import { useUserLocation } from '@/hooks/useUserLocation';
import type { TripEvent, Trip, GlobalTraveler } from '@/types';

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (current <= last) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function buildTripContext(
  trip: Trip,
  events: TripEvent[],
  allTravelers: GlobalTraveler[],
  geoStatus: 'granted' | 'pending' | 'denied' | 'unsupported',
): string {
  const travelerNames = (trip.travelerIds ?? [])
    .map((id) => allTravelers.find((t) => t.id === id)?.fullName)
    .filter(Boolean)
    .join(', ');

  const startDate = trip.startDate;
  const endDate = trip.endDate;
  const days = getDaysBetween(startDate, endDate);
  const totalDays = days.length;

  // Sort events by date + startTime
  const sorted = [...events].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.startTime.localeCompare(b.startTime);
  });

  const eventsText = sorted
    .map((e) => {
      const costStr = e.cost > 0 ? `$${e.cost.toLocaleString()} ${e.currency}` : 'sin costo';
      return `- ${e.date} ${e.startTime} ${e.title} (${e.type}) ${costStr}`;
    })
    .join('\n');

  // --- Automatic analysis ---
  const issues: string[] = [];

  // Determine cruise nights (night of cruise event date)
  const cruiseNights = new Set<string>();
  sorted.forEach((e) => {
    if (e.type === 'cruise') {
      cruiseNights.add(e.date);
    }
  });

  // Nights needing hotel: all nights except the last day (checkout day) and cruise nights
  const nightsNeedingHotel = days.slice(0, -1).filter((d) => !cruiseNights.has(d));
  const hotelDates = new Set<string>();
  sorted.forEach((e) => {
    if (e.type === 'hotel') {
      // A hotel covers the night of its date
      hotelDates.add(e.date);
    }
  });
  const nightsWithoutHotel = nightsNeedingHotel.filter((d) => !hotelDates.has(d));
  if (nightsWithoutHotel.length > 0) {
    issues.push(`Sin hotel: ${nightsWithoutHotel.join(', ')}`);
  }

  // Meals analysis - check for days without any restaurant/meal event
  const mealKeywords = ['desayuno', 'comida', 'cena', 'almuerzo', 'breakfast', 'lunch', 'dinner'];
  const daysWithMeals = new Set<string>();
  sorted.forEach((e) => {
    if (e.type === 'restaurant') {
      daysWithMeals.add(e.date);
    }
    const titleLower = e.title.toLowerCase();
    if (mealKeywords.some((k) => titleLower.includes(k))) {
      daysWithMeals.add(e.date);
    }
  });
  const daysWithoutMeals = days.filter((d) => !daysWithMeals.has(d));
  if (daysWithoutMeals.length > 0) {
    issues.push(`Sin comidas planificadas: ${daysWithoutMeals.join(', ')}`);
  }

  // Check return flight
  const flights = sorted.filter((e) => e.type === 'flight');
  const hasReturnFlight = flights.some((f) => {
    // A return flight is typically on or near the end date
    return f.date >= days[Math.floor(days.length * 0.6)];
  });
  if (flights.length > 0 && !hasReturnFlight) {
    issues.push('Sin vuelo de regreso detectado');
  }
  if (flights.length === 0) {
    issues.push('Sin vuelos registrados');
  }

  // Check transfers for flights
  const flightsWithoutTransfer: string[] = [];
  flights.forEach((flight) => {
    const transfersOnDay = sorted.filter(
      (e) => e.type === 'transport' && e.date === flight.date,
    );
    if (transfersOnDay.length === 0) {
      flightsWithoutTransfer.push(`${flight.date} ${flight.title}`);
    }
  });
  if (flightsWithoutTransfer.length > 0) {
    issues.push(`Vuelos sin traslado: ${flightsWithoutTransfer.join(', ')}`);
  }

  const analysisText = issues.length > 0
    ? `\nANALISIS AUTOMATICO:\n${issues.map((i) => `- ${i}`).join('\n')}`
    : '\nANALISIS AUTOMATICO:\n- Todo parece cubierto';

  const geoLine = (() => {
    switch (geoStatus) {
      case 'granted':
        return 'GEO: ubicación del dispositivo disponible y se inyecta automáticamente en searchPlaces. NO preguntes dónde está el usuario; ya tienes sus coordenadas.';
      case 'pending':
        return 'GEO: pidiendo permiso al usuario. Si necesitas su ubicación inmediata, pídele que toque "Permitir" en el aviso del navegador.';
      case 'denied':
        return 'GEO: el usuario denegó el permiso de ubicación. Si quieres buscar lugares cerca, pídele que escriba la ciudad o lugar.';
      case 'unsupported':
        return 'GEO: el navegador no expone ubicación. Pregunta la ciudad / lugar si te hace falta.';
    }
  })();

  // ── Today section ── highlights what's happening RIGHT NOW so the
  // model doesn't have to scan the whole events list to answer "qué tengo
  // hoy". Only meaningful when the trip is currently active.
  const todayIso = new Date().toISOString().slice(0, 10);
  const tripIsActive = todayIso >= startDate && todayIso <= endDate;
  const todayEvents = sorted.filter((e) => e.date === todayIso);
  const dayNumber = tripIsActive
    ? days.findIndex((d) => d === todayIso) + 1
    : 0;
  const todaySection = tripIsActive
    ? `\nHOY (${todayIso}, dia ${dayNumber} de ${totalDays}):\n${
        todayEvents.length > 0
          ? todayEvents
              .map((e) => {
                const cost = e.cost > 0 ? ` $${e.cost.toLocaleString()} ${e.currency}` : '';
                return `- ${e.startTime} ${e.title} (${e.type})${cost}`;
              })
              .join('\n')
          : '- Sin eventos planificados para hoy. El usuario tiene el dia libre.'
      }\n`
    : '';

  // ── Lifecycle stage ── lets the model answer differently if the trip
  // is in planning (countdown) vs active (live coach) vs memories (recap).
  const stage = todayIso < startDate ? 'planificacion' : todayIso > endDate ? 'pasado' : 'activo';
  const stageLine = stage === 'planificacion'
    ? `ETAPA: planificacion (el viaje arranca el ${startDate}).`
    : stage === 'pasado'
      ? `ETAPA: pasado (el viaje termino el ${endDate}).`
      : `ETAPA: activo (estan dentro del viaje).`;

  return `[CONTEXTO DEL VIAJE]
Titulo: ${trip.title}
Destino: ${trip.destination}
Fechas: ${startDate} al ${endDate} (${totalDays} dias)
${stageLine}
Viajeros: ${travelerNames || 'No especificados'}
${trip.budget ? `Presupuesto: $${trip.budget.toLocaleString()} ${trip.budgetCurrency || 'MXN'}` : ''}
${geoLine}
${todaySection}
EVENTOS (por fecha):
${eventsText || '- Sin eventos registrados'}
${analysisText}`;
}

export function Chatbot() {
  const pathname = usePathname();

  // Detect if inside a trip route: /trips/[tripId] or /trips/[tripId]/...
  const tripIdMatch = pathname.match(/^\/trips\/([^/]+)/);
  const tripId = tripIdMatch ? tripIdMatch[1] : '';

  // Chatbot now lives INSIDE /trips/[tripId]/layout so it can read from
  // TripDataProvider's context — this avoids opening duplicate
  // onSnapshot listeners (the old behavior was 3 extra listeners per
  // trip view, which was a measurable battery + CPU hit on mobile).
  const { trip, updateTrip } = useTripFromContext();
  const { events, createEvent, updateEvent, deleteEvent } = useEventsFromContext();
  const { expenses, addTripExpense } = useExpensesFromContext();
  const { travelers } = useGlobalTravelers();
  const { user } = useAuth();

  // Live user location.
  // watchPosition silently fails on Safari/iOS until permission is granted
  // explicitly via getCurrentPosition. The hook exposes `request()` to fire
  // that prompt — we trigger it the first time the user opens the chat.
  const { location: userLocation, permission: geoPermission, request: requestGeo } = useUserLocation({
    enabled: !!tripId,
  });

  const tripContext = useMemo(() => {
    if (!trip || !tripId) return null;
    const geoStatus: 'granted' | 'pending' | 'denied' | 'unsupported' = userLocation
      ? 'granted'
      : geoPermission === 'denied'
      ? 'denied'
      : geoPermission === 'unknown' || geoPermission === 'prompt'
      ? 'pending'
      : 'unsupported';
    return buildTripContext(trip, events, travelers, geoStatus);
  }, [trip, events, travelers, tripId, userLocation, geoPermission]);

  // Bundle the dependencies the executor needs to actually mutate trip data.
  const toolDeps: ToolDeps | null = useMemo(() => {
    if (!trip || !tripId || !user) return null;
    const tripTravelerIds = trip.travelerIds || [];
    const filteredTravelers = travelers.filter((t) => tripTravelerIds.includes(t.id));
    const defaultPaidBy = filteredTravelers[0]?.id || user.uid;
    const defaultSplitBetween = filteredTravelers.map((t) => t.id);
    if (defaultSplitBetween.length === 0) defaultSplitBetween.push(user.uid);
    return {
      trip,
      events,
      expenses,
      currentUserId: user.uid,
      defaultPaidBy,
      defaultSplitBetween,
      todayDate: new Date().toISOString().split('T')[0],
      userLocation: userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng, accuracy: userLocation.accuracy }
        : null,
      createEvent,
      updateEvent,
      deleteEvent,
      addTripExpense,
      updateTrip,
    };
  }, [trip, tripId, user, travelers, events, expenses, userLocation, createEvent, updateEvent, deleteEvent, addTripExpense, updateTrip]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([
    { role: 'assistant', content: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // First time the chat opens, ask the browser for geo permission. This
  // unlocks searchPlaces with the real device coordinates so the model
  // doesn't have to ask "¿en qué ciudad estás?".
  const geoRequestedRef = useRef(false);
  useEffect(() => {
    if (!isOpen || geoRequestedRef.current) return;
    if (geoPermission === 'unknown' || geoPermission === 'prompt') {
      geoRequestedRef.current = true;
      requestGeo();
    }
  }, [isOpen, geoPermission, requestGeo]);

  // Listen for external requests to open the assistant with a prefilled prompt.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setIsOpen(true);
      if (detail?.prompt) setInput(detail.prompt);
    };
    window.addEventListener('gustrips:open-assistant', handler);
    return () => window.removeEventListener('gustrips:open-assistant', handler);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText.trim() };
    let convo: ChatMessage[] = [...messages, userMessage];
    setMessages(convo);
    setInput('');
    setLoading(true);

    const enableTools = !!toolDeps;
    const toolsPayload = enableTools
      ? TOOL_SCHEMAS.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }))
      : undefined;

    const buildHistorial = (latest: ChatMessage[]) => {
      const trimmed = latest.slice(-30).map((m) => ({
        role: m.role,
        content: m.content,
        toolName: m.toolName,
        toolCalls: m.toolCalls ? m.toolCalls.map((tc) => ({ ...tc })) : undefined,
      }));
      if (tripContext) trimmed.unshift({ role: 'user', content: tripContext, toolName: undefined, toolCalls: undefined });
      return trimmed;
    };

    try {
      // Tool-call loop. Cap at 5 round-trips so a runaway model can't burn
      // the user's API quota.
      for (let i = 0; i < 5; i++) {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: buildHistorial(convo),
            tools: toolsPayload,
            enableTools,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

        const toolCalls: { name: string; args: Record<string, unknown> }[] | undefined = data.toolCalls;
        const content: string | undefined = data.content;

        if (toolCalls && toolCalls.length > 0 && toolDeps) {
          // Add the assistant turn that requested tool calls
          const assistantTurn: ChatMessage = {
            role: 'assistant',
            content: content || `Ejecutando: ${toolCalls.map((tc) => tc.name).join(', ')}…`,
            toolCalls,
          };
          convo = [...convo, assistantTurn];
          setMessages(convo);

          // Execute each tool sequentially so dependent state updates settle
          const toolResultMessages: ChatMessage[] = [];
          for (const tc of toolCalls) {
            try {
              const result = await executeToolCall(tc.name, tc.args as Record<string, unknown>, toolDeps);
              toolResultMessages.push({ role: 'tool', content: result, toolName: tc.name });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toolResultMessages.push({
                role: 'tool',
                content: JSON.stringify({ ok: false, error: msg }),
                toolName: tc.name,
              });
            }
          }
          convo = [...convo, ...toolResultMessages];
          setMessages(convo);
          // Loop back so the model can craft a final reply with the results
          continue;
        }

        if (content) {
          convo = [...convo, { role: 'assistant', content }];
          setMessages(convo);
        }
        break;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Lo siento, hubo un error: ${errorMessage}. Por favor intenta de nuevo.` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, tripContext, toolDeps]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleQuickAction = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([{ role: 'assistant', content: 'Chat reiniciado. En que puedo ayudarte?' }]);
  }, []);

  const closeChatbot = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!isOpen) {
    return <ChatbotButton onClick={() => setIsOpen(true)} />;
  }

  return (
    <ChatbotPanel
      messages={messages}
      input={input}
      loading={loading}
      messagesEndRef={messagesEndRef}
      quickActions={QUICK_ACTIONS}
      onClear={clearChat}
      onClose={closeChatbot}
      onSetInput={setInput}
      onSend={() => sendMessage()}
      onKeyDown={handleKeyDown}
      onQuickAction={handleQuickAction}
    />
  );
}
