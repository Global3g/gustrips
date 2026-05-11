/**
 * Question service — conversational question generation/flow.
 *
 * STUB IMPLEMENTATION. Real impl will:
 *  - Derive questions from analysis state and existing answers
 *  - Track priority + status (pending/answered/skipped)
 *  - Suggest answers from GPS reverse-geocode and prior trips
 */
import type {
  AnswerQuestionResponse,
  AnswerRequest,
  Question,
  QuestionListFilter,
} from '../models/types';
import { HttpError } from '../middleware/errors';

function nowIso(): string {
  return new Date().toISOString();
}

function mockQuestion(storyId: string, id = 'q_mock_1'): Question {
  return {
    id,
    storyId,
    type: 'location',
    prompt: 'Detecté 9 fotos juntas el 12 de agosto a media mañana. ¿Dónde estaban?',
    context: {
      photoSampleIds: ['photo_mock_1', 'photo_mock_2', 'photo_mock_3'],
      photoCount: 9,
      dateRange: {
        start: '2025-08-12T09:00:00Z',
        end: '2025-08-12T12:30:00Z',
      },
    },
    suggestedAnswers: ['Centro histórico', 'Parque Chapultepec'],
    priority: 90,
    status: 'pending',
    answer: null,
    createdAt: nowIso(),
    answeredAt: null,
  };
}

export const questionService = {
  /**
   * Returns the highest-priority pending question, or null if none.
   * Routes should map a null return to HTTP 204.
   */
  async getNext(userId: string, storyId: string): Promise<Question | null> {
    void userId;
    // STUB: deterministic mock — replace with priority-ordered Firestore query.
    return mockQuestion(storyId);
  },

  async list(
    userId: string,
    storyId: string,
    filter: QuestionListFilter,
  ): Promise<Question[]> {
    void userId;
    void filter;
    return [mockQuestion(storyId)];
  },

  async answer(
    userId: string,
    storyId: string,
    questionId: string,
    body: AnswerRequest,
  ): Promise<AnswerQuestionResponse> {
    void userId;
    if (!body || typeof body.value !== 'string' || body.value.length === 0) {
      throw HttpError.badRequest('AnswerRequest.value is required and must be a non-empty string');
    }
    const question: Question = {
      ...mockQuestion(storyId, questionId),
      status: 'answered',
      answer: {
        value: body.value,
        ...(body.structuredValue ? { structuredValue: body.structuredValue } : {}),
      },
      answeredAt: nowIso(),
    };
    const nextQuestion: Question | null = mockQuestion(storyId, 'q_mock_2');
    return { question, nextQuestion };
  },

  async skip(userId: string, storyId: string, questionId: string): Promise<void> {
    void userId;
    void storyId;
    void questionId;
    return;
  },
};
