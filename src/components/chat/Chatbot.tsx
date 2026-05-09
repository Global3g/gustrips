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
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
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

  return `[CONTEXTO DEL VIAJE]
Titulo: ${trip.title}
Destino: ${trip.destination}
Fechas: ${startDate} al ${endDate} (${totalDays} dias)
Viajeros: ${travelerNames || 'No especificados'}
${trip.budget ? `Presupuesto: $${trip.budget.toLocaleString()} ${trip.budgetCurrency || 'MXN'}` : ''}

EVENTOS (por fecha):
${eventsText || '- Sin eventos registrados'}
${analysisText}`;
}

export function Chatbot() {
  const pathname = usePathname();

  // Detect if inside a trip route: /trips/[tripId] or /trips/[tripId]/...
  const tripIdMatch = pathname.match(/^\/trips\/([^/]+)/);
  const tripId = tripIdMatch ? tripIdMatch[1] : '';

  const { trip, updateTrip } = useTrip(tripId);
  const { events, createEvent, updateEvent, deleteEvent } = useEvents(tripId);
  const { expenses, addTripExpense } = useExpenses(tripId);
  const { travelers } = useGlobalTravelers();
  const { user } = useAuth();

  const tripContext = useMemo(() => {
    if (!trip || !tripId) return null;
    return buildTripContext(trip, events, travelers);
  }, [trip, events, travelers, tripId]);

  // Live user location — only enabled when chat is open and inside a trip.
  // The hook itself only reads navigator.geolocation when granted.
  const { location: userLocation } = useUserLocation({ enabled: !!tripId });

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
