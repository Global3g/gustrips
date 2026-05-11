/**
 * Story service — CRUD operations for trip stories.
 *
 * STUB IMPLEMENTATION. Returns mock data shaped to match the
 * OpenAPI Story schema. Replace with real Firestore reads/writes
 * once the engine is wired up.
 */
import type { CreateStoryRequest, Story } from '../models/types';
import { HttpError } from '../middleware/errors';
import { paths } from '../lib/firestore';

function nowIso(): string {
  return new Date().toISOString();
}

function newStoryId(): string {
  return `story_${Math.random().toString(36).slice(2, 10)}`;
}

export const storyService = {
  async create(userId: string, body: CreateStoryRequest): Promise<Story> {
    // STUB: would write to paths.story(userId, newId)
    const id = newStoryId();
    const story: Story = {
      id,
      userId,
      tripId: body.tripId ?? null,
      title: body.title ?? 'Untitled story',
      status: 'draft',
      photoCount: 0,
      dayCount: 0,
      eventCount: 0,
      pendingQuestionCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    // TODO: persist to Firestore at paths.story(userId, id)
    void paths;
    return story;
  },

  async get(userId: string, storyId: string): Promise<Story> {
    // STUB: would read paths.story(userId, storyId)
    if (!storyId) {
      throw HttpError.notFound('Story not found');
    }
    const story: Story = {
      id: storyId,
      userId,
      tripId: null,
      title: 'Sample Story',
      status: 'questioning',
      photoCount: 42,
      dayCount: 3,
      eventCount: 7,
      pendingQuestionCount: 2,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    return story;
  },

  async delete(userId: string, storyId: string): Promise<void> {
    // STUB: would delete story + all subcollections (photos, questions, days, events)
    void userId;
    void storyId;
    return;
  },
};
