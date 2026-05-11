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
import type {
  ConvertToTripRequest,
  ConvertToTripResponse,
} from '../models/types';

export const tripsRouter = Router();

tripsRouter.post(
  '/stories/:storyId\\:convert-to-trip',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    const body = (req.body ?? {}) as ConvertToTripRequest;

    // STUB: real impl will build a Trip from the storyboard, write to
    // /trips/{tripId} in Firestore, and set { tripId } back on the story doc.
    void userId;
    void body;

    const response: ConvertToTripResponse = {
      tripId: `trip_${Math.random().toString(36).slice(2, 10)}`,
      storyId,
    };
    res.status(201).json(response);
  }),
);
