/**
 * Tripshistory client types.
 *
 * Hand-written from /docs/tripshistory/api.yaml (OpenAPI 3.1 — source of truth).
 * Keep in sync whenever the spec changes.
 */

/* ─── Errors ───────────────────────────────────────── */

export interface TripshistoryApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/* ─── Story lifecycle ─────────────────────────────── */

export type StoryStatus =
  | 'draft'
  | 'analyzing'
  | 'questioning'
  | 'ready'
  | 'finalized';

export interface ApproximateDates {
  start?: string; // YYYY-MM-DD
  end?: string;   // YYYY-MM-DD
}

export interface CreateStoryRequest {
  tripId?: string;
  title?: string;
  approximateDates?: ApproximateDates;
}

export interface Story {
  id: string;
  userId: string;
  tripId: string | null;
  title?: string;
  status: StoryStatus;
  photoCount?: number;
  dayCount?: number;
  eventCount?: number;
  pendingQuestionCount?: number;
  createdAt: string; // ISO date-time
  updatedAt?: string;
}

/* ─── Photos ───────────────────────────────────────── */

export interface PhotoLocation {
  lat?: number;
  lng?: number;
  altitude?: number;
  accuracy?: number;
}

export interface PhotoDimensions {
  width?: number;
  height?: number;
}

export interface PhotoMetadata {
  clientId: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  fullUrl?: string;
  capturedAt: string; // ISO date-time
  timezone?: string;
  location?: PhotoLocation;
  dimensions?: PhotoDimensions;
  perceptualHash?: string;
  blurScore?: number;
  sizeBytes?: number;
  mimeType?: string;
}

export interface PhotoBatch {
  photos: PhotoMetadata[]; // 1..100
}

export interface PhotoBatchResponse {
  storyId: string;
  photosReceived: number;
  photosRejected: number;
  rejectionReasons?: string[];
}

export interface Photo extends PhotoMetadata {
  id: string;
  storyId: string;
  dayId?: string | null;
  eventId?: string | null;
  isDuplicate?: boolean;
  isHighlight?: boolean;
  uploadedAt?: string;
}

export interface PhotoListResponse {
  photos: Photo[];
  nextCursor: string | null;
  total?: number;
}

export interface PhotoListParams {
  dayId?: string;
  eventId?: string;
  limit?: number;
  cursor?: string;
}

/* ─── Analysis ─────────────────────────────────────── */

export interface DetectedDay {
  date: string; // YYYY-MM-DD
  photoCount: number;
}

export interface DetectedCluster {
  clusterId: string;
  startTime: string;
  endTime: string;
  photoCount: number;
  hasLocation: boolean;
}

export interface AnalysisState {
  status: StoryStatus;
  photoCount: number;
  photosWithGps: number;
  photosWithDates: number;
  detectedDays?: DetectedDay[];
  detectedClusters?: DetectedCluster[];
  duplicateGroups?: number;
  lastAnalyzedAt?: string;
}

/* ─── Questions ────────────────────────────────────── */

export type QuestionType =
  | 'location'
  | 'event_name'
  | 'companions'
  | 'day_gap'
  | 'transition'
  | 'trip_dates'
  | 'trip_title';

export type QuestionStatus = 'pending' | 'answered' | 'skipped';

export interface QuestionContext {
  photoSampleIds?: string[];
  photoCount?: number;
  dateRange?: {
    start?: string;
    end?: string;
  };
  relatedDayId?: string;
  relatedEventId?: string;
}

export interface Answer {
  value?: string;
  structuredValue?: Record<string, unknown>;
}

export interface Question {
  id: string;
  storyId: string;
  type: QuestionType;
  prompt: string;
  context?: QuestionContext;
  suggestedAnswers?: string[];
  priority?: number;
  status: QuestionStatus;
  answer?: Answer | null;
  createdAt?: string;
  answeredAt?: string | null;
}

export interface AnswerRequest {
  value: string;
  structuredValue?: Record<string, unknown>;
}

export interface AnswerResponse {
  question: Question;
  nextQuestion: Question | null;
}

export type QuestionStatusFilter = 'pending' | 'answered' | 'skipped' | 'all';

/* ─── Storyboard ───────────────────────────────────── */

export interface Day {
  id: string;
  storyId: string;
  date: string; // YYYY-MM-DD
  title?: string;
  summary?: string;
  coverPhotoId?: string;
  eventIds?: string[];
  photoCount?: number;
  primaryLocation?: string;
}

export interface DayPatch {
  title?: string;
  summary?: string;
  coverPhotoId?: string;
}

export interface EventCoordinates {
  lat?: number;
  lng?: number;
}

export interface Event {
  id: string;
  storyId: string;
  dayId: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  coordinates?: EventCoordinates;
  photoIds?: string[];
  highlightPhotoIds?: string[];
  photoCount?: number;
}

export interface EventPatch {
  title?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  addPhotoIds?: string[];
  removePhotoIds?: string[];
}

export interface StoryboardDay extends Day {
  events?: Event[];
}

export interface Storyboard {
  story: Story;
  days: StoryboardDay[];
  unassignedPhotoCount?: number;
}

/* ─── Convert to Trip ──────────────────────────────── */

export interface ConvertToTripRequest {
  title?: string;
  destination?: string;
}

export interface ConvertToTripResponse {
  tripId: string;
  storyId: string;
}
