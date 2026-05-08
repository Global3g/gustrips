import type { Trip, TripEvent } from '@/types';

export interface ExportIcsOptions {
  trip: Pick<Trip, 'title' | 'destination' | 'startDate' | 'endDate'>;
  events: TripEvent[];
}

export function buildIcsString(options: ExportIcsOptions): string {
  const { trip, events } = options;
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//GusTrips//Trip Itinerary//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escapeIcsText(trip.title)}`);
  lines.push(`X-WR-CALDESC:${escapeIcsText(`Itinerario de viaje a ${trip.destination}`)}`);

  for (const event of events) {
    const eventLines = buildEventVEvent(event, trip);
    lines.push(...eventLines);
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function buildEventVEvent(event: TripEvent, trip: ExportIcsOptions['trip']): string[] {
  // trip is currently unused but kept for future expansion (e.g. fallback dates).
  void trip;
  const out: string[] = [];
  out.push('BEGIN:VEVENT');
  out.push(`UID:${event.id}@gustrips.app`);
  out.push(`DTSTAMP:${formatIcsDateTime(new Date())}`);

  const dtstart = buildDateTime(event.date, event.startTime, event.timezone);
  const arrivalDate = event.details?.arrivalDate || event.date;
  const dtend = buildDateTime(
    arrivalDate,
    event.endTime || addMinutesToTime(event.startTime, 60),
    event.details?.arrivalTimezone || event.timezone
  );

  if (dtstart.allDay) {
    out.push(`DTSTART;VALUE=DATE:${dtstart.value}`);
    if (dtend.value) out.push(`DTEND;VALUE=DATE:${dtend.value}`);
  } else {
    if (dtstart.tzid) out.push(`DTSTART;TZID=${dtstart.tzid}:${dtstart.value}`);
    else out.push(`DTSTART:${dtstart.value}`);
    if (dtend.value) {
      if (dtend.tzid) out.push(`DTEND;TZID=${dtend.tzid}:${dtend.value}`);
      else out.push(`DTEND:${dtend.value}`);
    }
  }

  out.push(`SUMMARY:${escapeIcsText(event.title)}`);

  if (event.location) out.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.latitude !== undefined && event.longitude !== undefined) {
    out.push(`GEO:${event.latitude.toFixed(6)};${event.longitude.toFixed(6)}`);
  }

  // Description: notes + details + cost
  const descParts: string[] = [];
  if (event.notes) descParts.push(event.notes);

  const detailLines = formatDetails(event.details);
  if (detailLines.length > 0) descParts.push(detailLines.join('\\n'));

  if (event.cost > 0) descParts.push(`Costo: ${event.cost} ${event.currency || 'MXN'}`);
  descParts.push(`Tipo: ${event.type}`);

  if (descParts.length > 0) out.push(`DESCRIPTION:${escapeIcsText(descParts.join('\\n\\n'))}`);

  // Category
  out.push(`CATEGORIES:${event.type.toUpperCase()}`);

  out.push('END:VEVENT');
  return out;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsDateTime(d: Date): string {
  // Format: YYYYMMDDTHHMMSSZ (UTC)
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function buildDateTime(date: string, time?: string, timezone?: string): { value: string; tzid?: string; allDay: boolean } {
  if (!date) return { value: '', allDay: false };
  const dateClean = date.replace(/-/g, '');

  if (!time || !/^\d{2}:\d{2}/.test(time)) {
    // All-day
    return { value: dateClean, allDay: true };
  }

  const [hh, mm] = time.split(':');
  const ssRaw = '00';
  const value = `${dateClean}T${hh}${mm}${ssRaw}`;

  if (timezone) return { value, tzid: timezone, allDay: false };
  return { value, allDay: false };
}

function addMinutesToTime(time: string, minutes: number): string {
  if (!time || !/^\d{2}:\d{2}/.test(time)) return '';
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function formatDetails(details?: Record<string, string>): string[] {
  if (!details) return [];
  const labelMap: Record<string, string> = {
    airline: 'Aerolinea',
    flightNumber: 'Vuelo',
    confirmationCode: 'Confirmacion',
    seatNumber: 'Asiento',
    hotelName: 'Hotel',
    address: 'Direccion',
    rentalCompany: 'Empresa',
    pickupLocation: 'Recogida',
    dropoffLocation: 'Devolucion',
  };
  const out: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (!value || typeof value !== 'string' || !value.trim()) continue;
    if (key === 'arrivalDate' || key === 'arrivalTimezone') continue;
    const label = labelMap[key] || key;
    out.push(`${label}: ${value.trim()}`);
  }
  return out;
}

export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getTripIcsFilename(title: string): string {
  const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'viaje';
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-${date}.ics`;
}
