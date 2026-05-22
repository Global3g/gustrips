/**
 * iCalendar (.ics) export for a single trip.
 *
 *   GET /api/trips/<tripId>/ics
 *     ?token=<shareToken>     (optional — for unauthenticated public share)
 *
 * Returns an RFC-5545 .ics file that any calendar app (Apple Calendar,
 * Google Calendar, Outlook, Notion Calendar) can import. Each TripEvent
 * becomes a VEVENT, with the trip start/end framing the whole trip as a
 * separate all-day VEVENT so the user sees a labeled bar in week/month
 * views even before drilling into the day.
 *
 * Auth: prefers Firebase ID token in Authorization header for owner
 * access. Falls back to a share token query param when present and valid
 * on the trip doc (see /share/<token>). If neither matches, 401.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ─── .ics helpers ──────────────────────────────────────── */

function escapeIcsText(s: string): string {
  // RFC 5545 §3.3.11 — escape backslash, semicolon, comma, newline.
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldIcsLine(line: string): string {
  // RFC 5545 §3.1 — lines longer than 75 octets must be folded with CRLF + space.
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 75));
    i += 75;
  }
  return chunks.join('\r\n ');
}

function formatIcsDate(dateStr: string): string {
  // YYYY-MM-DD → YYYYMMDD for DTSTART/DTEND of all-day events.
  return dateStr.replace(/-/g, '');
}

function formatIcsDateTime(dateStr: string, timeStr: string | undefined): string {
  // Local "floating" time format YYYYMMDDTHHMMSS — no TZ suffix.
  // Calendar apps will display it as the user's local time, which is what
  // a traveler usually wants for an itinerary (the time is local to the
  // destination, not to where the .ics was generated).
  const date = dateStr.replace(/-/g, '');
  const time = (timeStr || '00:00').replace(/:/g, '') + '00';
  return `${date}T${time}`;
}

function buildIcs(trip: TripDoc, events: EventDoc[]): string {
  const now = new Date();
  const dtStamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    'T' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0') +
    'Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GusTrips//Trip Export 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(trip.title || 'Mi viaje')}`,
    `X-WR-CALDESC:${escapeIcsText(`Itinerario de ${trip.destination || 'tu viaje'} exportado de GusTrips`)}`,
  ];

  // Whole-trip frame as a single all-day event. DTEND is exclusive per the
  // RFC, so we add 1 day to endDate.
  if (trip.startDate && trip.endDate) {
    const endExclusive = new Date(trip.endDate + 'T00:00:00');
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endIso = endExclusive.toISOString().slice(0, 10);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${trip.id}@gustrips`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(trip.startDate)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(endIso)}`,
      `SUMMARY:✈ ${escapeIcsText(trip.title || 'Mi viaje')}`,
      `LOCATION:${escapeIcsText(trip.destination || '')}`,
      `DESCRIPTION:${escapeIcsText('Viaje completo · exportado de GusTrips')}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  // Per-event timed entries.
  for (const ev of events) {
    if (!ev.date) continue;
    const hasTime = !!ev.startTime;
    const summary = ev.title || 'Evento';
    const description = [ev.notes, ev.location, ev.city ? `Ciudad: ${ev.city}` : null]
      .filter(Boolean)
      .join('\n');

    lines.push('BEGIN:VEVENT', `UID:${ev.id}@gustrips`, `DTSTAMP:${dtStamp}`);

    if (hasTime) {
      // Use floating time so the calendar app shows it in destination-local time.
      const dtStart = formatIcsDateTime(ev.date, ev.startTime);
      const dtEnd = formatIcsDateTime(ev.date, ev.endTime || ev.startTime);
      lines.push(`DTSTART:${dtStart}`, `DTEND:${dtEnd}`);
    } else {
      // All-day event.
      const next = new Date(ev.date + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${formatIcsDate(ev.date)}`,
        `DTEND;VALUE=DATE:${formatIcsDate(next.toISOString().slice(0, 10))}`,
      );
    }

    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 wants CRLF line endings and 75-octet folding.
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/* ─── Firestore shapes (minimal) ────────────────────────── */

interface TripDoc {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  travelerIds?: string[];
  shareToken?: string;
}

interface EventDoc {
  id: string;
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  location?: string;
  city?: string;
  deletedAt?: unknown;
}

/* ─── Handler ───────────────────────────────────────────── */

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization') || '';

  const app = getAdminApp();
  const db = getAdminFirestore(app);

  // Load trip
  const tripSnap = await db.collection('trips').doc(tripId).get();
  if (!tripSnap.exists) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  const trip = { id: tripSnap.id, ...(tripSnap.data() as Omit<TripDoc, 'id'>) } as TripDoc;

  // Authorize: either valid ID token + caller is owner/member, OR valid share token.
  let authorized = false;
  if (authHeader.startsWith('Bearer ')) {
    try {
      const decoded = await getAdminAuth(app).verifyIdToken(authHeader.slice('Bearer '.length).trim());
      const uid = decoded.uid;
      if (trip.createdBy === uid || (trip.travelerIds || []).includes(uid)) {
        authorized = true;
      }
    } catch {
      // fall through to share-token check
    }
  }
  if (!authorized && token && trip.shareToken && trip.shareToken === token) {
    authorized = true;
  }
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Load events. We sort client-side by date+time after the fetch so the
  // export is stable regardless of Firestore ordering.
  const eventsSnap = await db.collection('trips').doc(tripId).collection('events').get();
  const events: EventDoc[] = eventsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<EventDoc, 'id'>) }))
    .filter((ev) => !ev.deletedAt)
    .sort((a, b) => {
      const ad = a.date || '';
      const bd = b.date || '';
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

  const ics = buildIcs(trip, events);

  const filename = `${(trip.title || 'viaje').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
