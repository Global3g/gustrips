/**
 * /photos routes
 *  POST /stories/:storyId/photos:batch  → 202 PhotoBatchResponse
 *  GET  /stories/:storyId/photos        → 200 PhotoListResponse
 *
 * NOTE on path: OpenAPI uses `photos:batch` (Google-style action verb).
 * Express path-to-regexp treats ':' as a param prefix, so we register
 * the colon-action route with an escaped pattern.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { photoService } from '../services/photoService';
import type { PhotoBatch } from '../models/types';

export const photosRouter = Router();

// `photos\\:batch` escapes the colon so Express treats it as a literal.
photosRouter.post(
  '/stories/:storyId/photos\\:batch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    const body = (req.body ?? {}) as PhotoBatch;

    if (!body || !Array.isArray(body.photos) || body.photos.length === 0) {
      throw HttpError.badRequest('PhotoBatch.photos must be a non-empty array');
    }
    if (body.photos.length > 100) {
      throw HttpError.badRequest('PhotoBatch.photos accepts at most 100 items per call');
    }
    for (const [i, p] of body.photos.entries()) {
      if (!p || typeof p.clientId !== 'string' || !p.clientId) {
        throw HttpError.badRequest(`photos[${i}].clientId is required`);
      }
      if (typeof p.capturedAt !== 'string' || !p.capturedAt) {
        throw HttpError.badRequest(`photos[${i}].capturedAt is required`);
      }
    }

    const result = await photoService.ingestBatch(userId, storyId, body);
    res.status(202).json(result);
  }),
);

photosRouter.get(
  '/stories/:storyId/photos',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;

    const limitRaw = req.query.limit;
    let limit = 50;
    if (typeof limitRaw === 'string') {
      const n = Number.parseInt(limitRaw, 10);
      if (Number.isFinite(n) && n > 0) {
        limit = Math.min(n, 200);
      }
    }

    const result = await photoService.list(userId, storyId, {
      dayId: typeof req.query.dayId === 'string' ? req.query.dayId : undefined,
      eventId: typeof req.query.eventId === 'string' ? req.query.eventId : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      limit,
    });
    res.status(200).json(result);
  }),
);
