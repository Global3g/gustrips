/**
 * /storyboard routes
 *  GET    /stories/:storyId/storyboard          → 200 Storyboard
 *  PATCH  /stories/:storyId/days/:dayId         → 200 Day
 *  PATCH  /stories/:storyId/events/:eventId     → 200 Event
 *  DELETE /stories/:storyId/events/:eventId     → 204
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';
import { storyboardService } from '../services/storyboardService';
import type { DayPatch, EventPatch } from '../models/types';

export const storyboardRouter = Router();

storyboardRouter.get(
  '/stories/:storyId/storyboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    const sb = await storyboardService.get(userId, storyId);
    res.status(200).json(sb);
  }),
);

storyboardRouter.patch(
  '/stories/:storyId/days/:dayId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId, dayId } = req.params;
    const patch = (req.body ?? {}) as DayPatch;
    const day = await storyboardService.patchDay(userId, storyId, dayId, patch);
    res.status(200).json(day);
  }),
);

storyboardRouter.patch(
  '/stories/:storyId/events/:eventId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId, eventId } = req.params;
    const patch = (req.body ?? {}) as EventPatch;
    const event = await storyboardService.patchEvent(userId, storyId, eventId, patch);
    res.status(200).json(event);
  }),
);

storyboardRouter.delete(
  '/stories/:storyId/events/:eventId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId, eventId } = req.params;
    await storyboardService.deleteEvent(userId, storyId, eventId);
    res.status(204).send();
  }),
);
