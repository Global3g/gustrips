/**
 * /questions routes
 *  GET  /stories/:storyId/questions/next                       → 200 Question | 204
 *  GET  /stories/:storyId/questions?status=...                 → 200 Question[]
 *  POST /stories/:storyId/questions/:questionId/answer         → 200 { question, nextQuestion }
 *  POST /stories/:storyId/questions/:questionId/skip           → 204
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { questionService } from '../services/questionService';
import type { AnswerRequest, QuestionListFilter } from '../models/types';

export const questionsRouter = Router();

const VALID_FILTERS: ReadonlySet<QuestionListFilter> = new Set([
  'pending',
  'answered',
  'skipped',
  'all',
]);

questionsRouter.get(
  '/stories/:storyId/questions/next',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;
    const next = await questionService.getNext(userId, storyId);
    if (!next) {
      res.status(204).send();
      return;
    }
    res.status(200).json(next);
  }),
);

questionsRouter.get(
  '/stories/:storyId/questions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId } = req.params;

    const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'pending';
    if (!VALID_FILTERS.has(statusRaw as QuestionListFilter)) {
      throw HttpError.badRequest(
        `Invalid status filter. Expected one of: ${Array.from(VALID_FILTERS).join(', ')}`,
      );
    }
    const filter = statusRaw as QuestionListFilter;

    const list = await questionService.list(userId, storyId, filter);
    res.status(200).json(list);
  }),
);

questionsRouter.post(
  '/stories/:storyId/questions/:questionId/answer',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId, questionId } = req.params;
    const body = (req.body ?? {}) as AnswerRequest;
    const result = await questionService.answer(userId, storyId, questionId, body);
    res.status(200).json(result);
  }),
);

questionsRouter.post(
  '/stories/:storyId/questions/:questionId/skip',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { storyId, questionId } = req.params;
    await questionService.skip(userId, storyId, questionId);
    res.status(204).send();
  }),
);
