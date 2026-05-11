/**
 * /stories routes
 *  POST   /stories                 → 201 Story
 *  GET    /stories/:storyId        → 200 Story
 *  DELETE /stories/:storyId        → 204
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { storyService } from '../services/storyService';
import type { CreateStoryRequest } from '../models/types';

export const storiesRouter = Router();

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
