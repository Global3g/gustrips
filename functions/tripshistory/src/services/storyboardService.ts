/**
 * Storyboard service — assembles the final hierarchical view and
 * supports editing days/events.
 *
 * STUB IMPLEMENTATION. Real impl will:
 *  - Join story + days + events + photos from their subcollections
 *  - Apply patches via transactions
 *  - Maintain photoIds / eventIds inverse indexes
 */
import type {
  Day,
  DayPatch,
  DayWithEvents,
  Event,
  EventPatch,
  Storyboard,
} from '../models/types';
import { storyService } from './storyService';

function nowIso(): string {
  return new Date().toISOString();
}

function mockDay(storyId: string, id = 'day_mock_1', date = '2025-08-12'): Day {
  return {
    id,
    storyId,
    date,
    title: 'Día 1 — Llegada',
    summary: 'Llegada y primer recorrido por el centro.',
    coverPhotoId: 'photo_mock_1',
    eventIds: ['event_mock_1'],
    photoCount: 14,
    primaryLocation: 'Ciudad de México',
  };
}

function mockEvent(storyId: string, dayId: string, id = 'event_mock_1'): Event {
  return {
    id,
    storyId,
    dayId,
    title: 'Comida en el centro',
    startTime: '2025-08-12T13:30:00Z',
    endTime: '2025-08-12T15:00:00Z',
    location: 'Restaurante El Cardenal',
    coordinates: { lat: 19.4326, lng: -99.1332 },
    photoIds: ['photo_mock_1', 'photo_mock_2'],
    highlightPhotoIds: ['photo_mock_1'],
    photoCount: 2,
  };
}

export const storyboardService = {
  async get(userId: string, storyId: string): Promise<Storyboard> {
    const story = await storyService.get(userId, storyId);
    const day = mockDay(storyId);
    const event = mockEvent(storyId, day.id);
    const dayWithEvents: DayWithEvents = { ...day, events: [event] };
    return {
      story,
      days: [dayWithEvents],
      unassignedPhotoCount: 4,
    };
  },

  async patchDay(
    userId: string,
    storyId: string,
    dayId: string,
    patch: DayPatch,
  ): Promise<Day> {
    void userId;
    const base = mockDay(storyId, dayId);
    return {
      ...base,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.coverPhotoId !== undefined ? { coverPhotoId: patch.coverPhotoId } : {}),
    };
  },

  async patchEvent(
    userId: string,
    storyId: string,
    eventId: string,
    patch: EventPatch,
  ): Promise<Event> {
    void userId;
    void nowIso;
    const base = mockEvent(storyId, 'day_mock_1', eventId);
    const existingPhotoIds = base.photoIds ?? [];
    const removeSet = new Set(patch.removePhotoIds ?? []);
    const nextPhotoIds = existingPhotoIds
      .filter((p) => !removeSet.has(p))
      .concat(patch.addPhotoIds ?? []);
    return {
      ...base,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.startTime !== undefined ? { startTime: patch.startTime } : {}),
      ...(patch.endTime !== undefined ? { endTime: patch.endTime } : {}),
      photoIds: nextPhotoIds,
      photoCount: nextPhotoIds.length,
    };
  },

  async deleteEvent(userId: string, storyId: string, eventId: string): Promise<void> {
    void userId;
    void storyId;
    void eventId;
    return;
  },
};
