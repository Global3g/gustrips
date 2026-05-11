/**
 * /analysis routes
 *  GET  /stories/:storyId/analysis  → 200 AnalysisState
 *  POST /stories/:storyId/analysis  → 202 (re-analysis enqueued)
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';
import { analysisService } from '../services/analysisService';

export const analysisRouter = Router();

analysisRouter.get(
  '/stories/:storyId/analysis',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    const state = await analysisService.getState(userId, storyId);
    res.status(200).json(state);
  }),
);

analysisRouter.post(
  '/stories/:storyId/analysis',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    await analysisService.enqueueReanalysis(userId, storyId);
    res.status(202).send();
  }),
);
