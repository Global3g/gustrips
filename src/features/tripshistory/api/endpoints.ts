/**
 * Typed endpoint functions mapping 1:1 to /docs/tripshistory/api.yaml.
 *
 * Each function returns the parsed response body (or void for 204).
 * Errors throw TripshistoryError.
 */

import { tripshistoryClient } from '@/features/tripshistory/api/client';
import type {
  AnalysisState,
  AnswerRequest,
  AnswerResponse,
  ConvertToTripRequest,
  ConvertToTripResponse,
  CreateStoryRequest,
  Day,
  DayPatch,
  Event,
  EventPatch,
  ListStoriesParams,
  ListStoriesResponse,
  PhotoBatch,
  PhotoBatchResponse,
  PhotoListParams,
  PhotoListResponse,
  Question,
  QuestionStatusFilter,
  Story,
  Storyboard,
} from '@/features/tripshistory/types';

/* ─── Stories ──────────────────────────────────────── */

export function createStory(input: CreateStoryRequest): Promise<Story> {
  return tripshistoryClient.post<Story>('/stories', input);
}

export function listStories(
  filters: ListStoriesParams = {},
): Promise<ListStoriesResponse> {
  return tripshistoryClient.get<ListStoriesResponse>('/stories', {
    query: filters as Record<string, string | undefined>,
  });
}

export function getStory(storyId: string): Promise<Story> {
  return tripshistoryClient.get<Story>(`/stories/${storyId}`);
}

export function deleteStory(storyId: string): Promise<void> {
  return tripshistoryClient.delete<void>(`/stories/${storyId}`);
}

/* ─── Photos ───────────────────────────────────────── */

export function uploadPhotoBatch(
  storyId: string,
  batch: PhotoBatch,
): Promise<PhotoBatchResponse> {
  return tripshistoryClient.post<PhotoBatchResponse>(
    `/stories/${storyId}/photos:batch`,
    batch,
  );
}

export function listPhotos(
  storyId: string,
  params: PhotoListParams = {},
): Promise<PhotoListResponse> {
  return tripshistoryClient.get<PhotoListResponse>(
    `/stories/${storyId}/photos`,
    { query: params as Record<string, string | number | undefined> },
  );
}

/* ─── Analysis ─────────────────────────────────────── */

export function getAnalysisState(storyId: string): Promise<AnalysisState> {
  return tripshistoryClient.get<AnalysisState>(`/stories/${storyId}/analysis`);
}

export function forceReanalysis(storyId: string): Promise<void> {
  return tripshistoryClient.post<void>(`/stories/${storyId}/analysis`);
}

/* ─── Questions ────────────────────────────────────── */

export async function getNextQuestion(
  storyId: string,
): Promise<Question | null> {
  // Spec: 200 returns Question, 204 returns no body.
  const result = await tripshistoryClient.get<Question | undefined>(
    `/stories/${storyId}/questions/next`,
  );
  return result ?? null;
}

export function listQuestions(
  storyId: string,
  status: QuestionStatusFilter = 'pending',
): Promise<Question[]> {
  return tripshistoryClient.get<Question[]>(
    `/stories/${storyId}/questions`,
    { query: { status } },
  );
}

export function answerQuestion(
  storyId: string,
  questionId: string,
  body: AnswerRequest,
): Promise<AnswerResponse> {
  return tripshistoryClient.post<AnswerResponse>(
    `/stories/${storyId}/questions/${questionId}/answer`,
    body,
  );
}

export function skipQuestion(
  storyId: string,
  questionId: string,
): Promise<void> {
  return tripshistoryClient.post<void>(
    `/stories/${storyId}/questions/${questionId}/skip`,
  );
}

/* ─── Storyboard ───────────────────────────────────── */

export function getStoryboard(storyId: string): Promise<Storyboard> {
  return tripshistoryClient.get<Storyboard>(`/stories/${storyId}/storyboard`);
}

export function patchDay(
  storyId: string,
  dayId: string,
  patch: DayPatch,
): Promise<Day> {
  return tripshistoryClient.patch<Day>(
    `/stories/${storyId}/days/${dayId}`,
    patch,
  );
}

export function patchEvent(
  storyId: string,
  eventId: string,
  patch: EventPatch,
): Promise<Event> {
  return tripshistoryClient.patch<Event>(
    `/stories/${storyId}/events/${eventId}`,
    patch,
  );
}

export function deleteEvent(
  storyId: string,
  eventId: string,
): Promise<void> {
  return tripshistoryClient.delete<void>(
    `/stories/${storyId}/events/${eventId}`,
  );
}

/* ─── Trips integration ────────────────────────────── */

export function convertStoryToTrip(
  storyId: string,
  body: ConvertToTripRequest = {},
): Promise<ConvertToTripResponse> {
  return tripshistoryClient.post<ConvertToTripResponse>(
    `/stories/${storyId}:convert-to-trip`,
    body,
  );
}

/**
 * Alias matching the spec wording `convert-to-trip`. Kept so callers can
 * use either `convertStoryToTrip` (legacy) or `convertToTrip` (matches
 * the OpenAPI operationId).
 */
export const convertToTrip = convertStoryToTrip;
