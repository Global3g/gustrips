import type { EventType } from '@/types';

export interface ScannedEvent {
  type: EventType;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  location?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  timezone?: string; // IANA timezone
  arrivalTimezone?: string; // for flights
  details: Record<string, string>;
}

/** Custom error class so the UI can detect network drops vs API errors. */
export class ScanNetworkError extends Error {
  constructor(message = 'Network error') {
    super(message);
    this.name = 'ScanNetworkError';
  }
}

/**
 * Fetch wrapper that retries once on transient network errors. The Gemini
 * API occasionally closes the connection mid-stream (ERR_CONNECTION_CLOSED);
 * a single retry resolves most of those cases without bothering the user.
 * After `attempts` failures, throws a `ScanNetworkError` so the UI can
 * render a friendly retry CTA.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 2,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      // Small backoff before retrying so we don't hammer a flaky API.
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
  throw new ScanNetworkError(
    lastErr instanceof Error ? lastErr.message : 'Connection failed',
  );
}

/**
 * Convert a File to base64 using FileReader (browser-compatible).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to convert file to base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Scan a travel document (PDF, JPG, PNG) using Google Gemini AI
 * and extract structured event data.
 */
export async function scanDocument(file: File): Promise<ScannedEvent> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API key not configured');

  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'application/pdf';

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
              {
                text: `Analyze this travel document (boarding pass, hotel confirmation, restaurant reservation, car rental, etc.) and extract the following information. Return ONLY valid JSON, no markdown, no explanation.

{
  "type": "flight|hotel|restaurant|car_rental|activity|transport|cruise|souvenirs|snacks|clothing|fuel|misc",
  "title": "descriptive title in Spanish",
  "date": "YYYY-MM-DD (departure date for flights, check-in for hotels)",
  "startTime": "HH:MM (departure time for flights, check-in time for hotels) or null",
  "endTime": "HH:MM (arrival time for flights, check-out time for hotels) or null",
  "location": "address or location name",
  "cost": number or null,
  "currency": "MXN|USD|EUR|GBP or detected currency",
  "timezone": "IANA timezone based on location (e.g. America/Mexico_City, Europe/London, Europe/Paris)",
  "arrivalTimezone": "IANA timezone of arrival location (only for flights, null otherwise)",
  "notes": "any additional relevant info",
  "details": {
    For flights: "airline", "flightNumber", "origin", "destination", "confirmationCode", "seatNumber", "terminal", "baggage"
    For hotels: "hotelName", "address", "checkInDate", "checkOutDate", "checkInTime", "checkOutTime", "confirmationCode", "roomType"
    For car_rental: "rentalCompany", "carType", "pickupLocation", "dropoffLocation", "pickupDate", "pickupTime", "dropoffDate", "dropoffTime", "confirmationCode"
    For restaurants: "restaurantName", "address", "reservationName", "guests", "cuisine"
    Include only fields that are found in the document, use empty string for missing fields
  }
}

Return ONLY the JSON object. If you cannot determine the type, use "misc". All text should be in the original language of the document.`,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Gemini 2.5 returns thinking + text parts. Skip thinking.
  const parts = data.candidates?.[0]?.content?.parts || [];
  let text = '';
  for (const part of parts) {
    if (part.thought) continue;
    if (part.text) text += part.text;
  }
  if (!text) {
    for (const part of parts) {
      if (part.text) text += part.text;
    }
  }

  if (!text) throw new Error('No response from AI');

  // Extract JSON from response
  let jsonStr = text.trim();
  if (jsonStr.includes('```')) {
    const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) jsonStr = match[1].trim();
    else jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
  }
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
    const objMatch = jsonStr.match(/(\{[\s\S]*\})/);
    if (objMatch) jsonStr = objMatch[1];
  }

  let parsed: ScannedEvent;
  try {
    parsed = JSON.parse(jsonStr) as ScannedEvent;
  } catch {
    console.error('Failed to parse JSON:', jsonStr.substring(0, 300));
    throw new Error('Could not parse AI response as JSON');
  }

  // Validate required fields
  if (!parsed.type || !parsed.title || !parsed.date) {
    throw new Error('Could not extract required information from document');
  }

  // Ensure type is valid
  const validTypes: EventType[] = ['flight', 'hotel', 'activity', 'restaurant', 'transport', 'car_rental', 'cruise', 'souvenirs', 'snacks', 'clothing', 'fuel', 'misc'];
  if (!validTypes.includes(parsed.type)) {
    parsed.type = 'misc';
  }

  // Ensure details is an object
  if (!parsed.details || typeof parsed.details !== 'object') {
    parsed.details = {};
  }

  // Clean null string values in details
  const cleanDetails: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.details)) {
    if (value && value !== 'null' && value !== '') {
      cleanDetails[key] = String(value);
    }
  }
  parsed.details = cleanDetails;

  return parsed;
}

/**
 * Scan a travel document that may contain MULTIPLE events (e.g. cruise itinerary,
 * multi-city flight, road trip plan). Returns an array of ScannedEvent.
 */
export async function scanBulkDocument(file: File, tripYear?: number): Promise<ScannedEvent[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API key not configured');

  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'application/pdf';

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: `Analyze this travel document. It may contain MULTIPLE events, stops, or destinations (like a cruise itinerary, multi-city flight, road trip plan, etc.).

Extract ALL events/stops found in the document. Return a JSON ARRAY of events.

Return ONLY valid JSON array, no markdown, no explanation:

[
  {
    "type": "flight|hotel|restaurant|car_rental|activity|transport|cruise|souvenirs|snacks|clothing|fuel|misc",
    "title": "descriptive title in Spanish",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM (24h format) or null",
    "endTime": "HH:MM (24h format) or null",
    "location": "city, country or address",
    "cost": number or null,
    "currency": "MXN|USD|EUR|GBP or detected currency",
    "timezone": "IANA timezone based on event location (e.g. Europe/London, Europe/Dublin, America/Mexico_City)",
    "arrivalTimezone": "IANA timezone of arrival (only for flights, null otherwise)",
    "notes": "relevant details like port info, shuttle required, etc",
    "details": {
      For flights: "airline", "flightNumber", "origin", "destination", "confirmationCode", "seatNumber", "terminal", "departureTerminal", "baggage", "cabin", "passengers", "bookingCode", "arrivalDate" (YYYY-MM-DD if different from departure)
      For hotels: "hotelName", "address", "checkInDate", "checkOutDate", "confirmationCode"
      For cruise stops/ports: use type "cruise", include port name in "portName" detail field
      For transport: "fromLocation", "toLocation"
      For "At Sea" days on cruises: use type "cruise", title "Dia en el mar"
    }
  },
  ...more events
]

IMPORTANT:
- Convert all times to 24h format (7:00am = 07:00, 4:00pm = 16:00, 8:00pm = 20:00)
- Convert dates to YYYY-MM-DD format. ${tripYear ? `The year is ${tripYear}. If the document only shows month/day, use ${tripYear} as the year.` : 'If the year is ambiguous or missing, use 2026.'}
- For cruise ports: startTime = arrival time, endTime = departure time
- For "At Sea" days: use type "cruise", title "Dia en el mar"
- CONNECTING FLIGHTS: If the document shows multiple flight segments (e.g. LHR→MEX then MEX→CUL), create a SEPARATE event for EACH flight leg. Title each one as "Vuelo {origin} → {destination}" with its own times, terminals, and flight number. Mark in notes "Vuelo en conexion" for connecting flights.
- For flights that arrive the next day, include "arrivalDate" in details with the arrival date
- Include passenger names in details.passengers if found
- Include booking/confirmation code in details.bookingCode or details.confirmationCode
- Include cabin class in details.cabin if found
- Include ALL rows/stops/segments, don't skip any
- Do NOT duplicate events. Each distinct flight/stop should appear only ONCE
- Title should be in Spanish when possible
- Return ONLY the JSON array` }
          ],
        }],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();

  // Gemini 2.5 returns thinking parts + text parts. Only use text parts (skip thinking).
  const parts = data.candidates?.[0]?.content?.parts || [];
  let text = '';
  for (const part of parts) {
    // Skip thinking/thought parts — only take actual text output
    if (part.thought) continue;
    if (part.text) text += part.text;
  }

  // Fallback: if no non-thought parts, try all parts
  if (!text) {
    for (const part of parts) {
      if (part.text) text += part.text;
    }
  }

  if (!text) {
    console.error('Gemini response:', JSON.stringify(data).substring(0, 500));
    throw new Error('No response from AI');
  }

  console.log('AI raw response (first 300 chars):', text.substring(0, 300));

  // Extract JSON from response — handle markdown blocks, leading text, etc.
  let jsonStr = text.trim();

  // Remove markdown code blocks
  if (jsonStr.includes('```')) {
    const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      jsonStr = match[1].trim();
    } else {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
    }
  }

  // Try to find JSON array or object if there's leading/trailing text
  if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
    const arrMatch = jsonStr.match(/(\[[\s\S]*\])/);
    const objMatch = jsonStr.match(/(\{[\s\S]*\})/);
    if (arrMatch) jsonStr = arrMatch[1];
    else if (objMatch) jsonStr = objMatch[1];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error('Failed to parse JSON:', jsonStr.substring(0, 300));
    throw new Error('Could not parse AI response as JSON');
  }

  // Handle both single object and array responses
  const rawEvents: ScannedEvent[] = Array.isArray(parsed) ? parsed : [parsed as ScannedEvent];

  const validTypes: EventType[] = ['flight', 'hotel', 'activity', 'restaurant', 'transport', 'car_rental', 'cruise', 'souvenirs', 'snacks', 'clothing', 'fuel', 'misc'];

  // Validate and clean each event
  const cleaned = rawEvents
    .filter((e) => e && e.type && e.title && e.date)
    .map((e) => {
      if (!validTypes.includes(e.type)) {
        return { ...e, type: 'misc' as EventType };
      }
      // Ensure details is an object
      const details: Record<string, string> = {};
      if (e.details && typeof e.details === 'object') {
        for (const [key, value] of Object.entries(e.details)) {
          if (value && value !== 'null' && value !== '') {
            details[key] = String(value);
          }
        }
      }
      return { ...e, details };
    });

  if (cleaned.length === 0) {
    throw new Error('Could not extract any events from the document');
  }

  return cleaned;
}
