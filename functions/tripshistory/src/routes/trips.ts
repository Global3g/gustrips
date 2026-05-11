/**
 * /trips integration
 *  POST /stories/:storyId:convert-to-trip  → 201 { tripId, storyId }
 *
 * NOTE: like /photos:batch, OpenAPI uses a colon-action verb on the
 * resource itself: /stories/{storyId}:convert-to-trip. We escape the
 * colon for Express.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';
import { tripsService } from '../services/tripsService';
import type { ConvertToTripRequest } from '../models/types';

export const tripsRouter = Router();

tripsRouter.post(
  '/stories/:storyId\\:convert-to-trip',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    const body = (req.body ?? {}) as ConvertToTripRequest;

    const result = await tripsService.convertToTrip(userId, storyId, body);
    res.status(201).json(result);
  }),
);
