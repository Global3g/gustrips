/**
 * /stories routes
 *  POST   /stories                 → 201 Story
 *  GET    /stories                 → 200 { stories: Story[] }
 *  GET    /stories/:storyId        → 200 Story
 *  DELETE /stories/:storyId        → 204
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { storyService } from '../services/storyService';
import type { CreateStoryRequest, StoryStatus } from '../models/types';

export const storiesRouter = Router();

const VALID_STORY_STATUSES: ReadonlyArray<StoryStatus> = [
  'draft',
  'analyzing',
  'questioning',
  'ready',
  'finalized',
];

storiesRouter.post(
  '/stories',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const body = (req.body ?? {}) as CreateStoryRequest;

    // Validate ApproximateDates shape if present
    if (body.approximateDates) {
      const { start, end } = body.approximateDates;
      if (start && typeof start !== 'string') {
        throw HttpError.badRequest('approximateDates.start must be a YYYY-MM-DD string');
      }
      if (end && typeof end !== 'string') {
        throw HttpError.badRequest('approximateDates.end must be a YYYY-MM-DD string');
      }
    }

    const story = await storyService.create(userId, body);
    res.status(201).json(story);
  }),
);

storiesRouter.get(
  '/stories',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;

    const tripIdRaw = req.query.tripId;
    const statusRaw = req.query.status;

    const tripId =
      typeof tripIdRaw === 'string' && tripIdRaw.length > 0
        ? tripIdRaw
        : undefined;

    let status: StoryStatus | undefined;
    if (typeof statusRaw === 'string' && statusRaw.length > 0) {
      if (!VALID_STORY_STATUSES.includes(statusRaw as StoryStatus)) {
        throw HttpError.badRequest(
          `status must be one of: ${VALID_STORY_STATUSES.join(', ')}`,
        );
      }
      status = statusRaw as StoryStatus;
    }

    const stories = await storyService.list(userId, { tripId, status });
    res.status(200).json({ stories });
  }),
);

storiesRouter.get(
  '/stories/:storyId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    const story = await storyService.get(userId, storyId);
    res.status(200).json(story);
  }),
);

storiesRouter.delete(
  '/stories/:storyId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    await storyService.delete(userId, storyId);
    res.status(204).send();
  }),
);
