/**
 * TypeScript types matching the OpenAPI 3.1 schemas defined in
 * /docs/tripshistory/api.yaml. Hand-written for leanness; treat
 * api.yaml as the source of truth and keep these in sync.
 */

// ─────────────────────────────────────────────────────────────────
// Common
// ─────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type StoryStatus =
  | 'draft'
  | 'analyzing'
  | 'questioning'
  | 'ready'
  | 'finalized';

// ─────────────────────────────────────────────────────────────────
// Story
// ─────────────────────────────────────────────────────────────────

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
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────────────
// Photo
// ─────────────────────────────────────────────────────────────────

export interface GeoLocation {
  lat?: number;
  lng?: number;
  altitude?: number;
  accuracy?: number;
}

export interface Dimensions {
  width?: number;
  height?: number;
}

export interface PhotoMetadata {
  clientId: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  fullUrl?: string;
  capturedAt: string;
  timezone?: string;
  location?: GeoLocation;
  dimensions?: Dimensions;
  perceptualHash?: string;
  blurScore?: number;
  sizeBytes?: number;
  mimeType?: string;
}

export interface PhotoBatch {
  photos: PhotoMetadata[];
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

export interface PhotoBatchResponse {
  storyId: string;
  photosReceived: number;
  photosRejected: number;
  rejectionReasons: string[];
}

export interface PhotoListResponse {
  photos: Photo[];
  nextCursor: string | null;
  total: number;
}

// ─────────────────────────────────────────────────────────────────
// Analysis
// ─────────────────────────────────────────────────────────────────

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
  detectedDays: DetectedDay[];
  detectedClusters: DetectedCluster[];
  duplicateGroups: number;
  lastAnalyzedAt?: string;
}

// ─────────────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────────────

export type QuestionType =
  // existing
  | 'location'
  | 'event_name'
  | 'companions'
  | 'day_gap'
  | 'transition'
  | 'trip_dates'
  | 'trip_title'
  // trip-level expansion
  | 'trip_companions'
  | 'trip_purpose'
  | 'trip_highlight'
  | 'trip_anecdote'
  | 'trip_transport'
  | 'trip_accommodation'
  | 'trip_budget_approx'
  | 'trip_learnings'
  | 'trip_recommend'
  | 'trip_would_return'
  // day-level expansion
  | 'day_phrase'
  | 'day_weather'
  | 'day_food'
  | 'day_surprise'
  // event-level expansion
  | 'event_companions'
  | 'event_rating'
  | 'event_cost_approx';

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
  /** UI hints for the client. */
  skippable?: boolean;
  multiline?: boolean;
  placeholder?: string;
  helperText?: string;
}

export interface Answer {
  value?: string;
  structuredValue?: Record<string, unknown>;
}

export interface AnswerRequest {
  value: string;
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

export interface AnswerQuestionResponse {
  question: Question;
  nextQuestion: Question | null;
}

export type QuestionListFilter = 'pending' | 'answered' | 'skipped' | 'all';

// ─────────────────────────────────────────────────────────────────
// Storyboard / Day / Event
// ─────────────────────────────────────────────────────────────────

export interface Day {
  id: string;
  storyId: string;
  date: string;
  title?: string;
  summary?: string;
  coverPhotoId?: string;
  eventIds?: string[];
  photoCount?: number;
  primaryLocation?: string;
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}

export interface EventPatch {
  title?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  addPhotoIds?: string[];
  removePhotoIds?: string[];
}

export interface DayWithEvents extends Day {
  events: Event[];
}

export interface Storyboard {
  story: Story;
  days: DayWithEvents[];
  unassignedPhotoCount: number;
}

// ─────────────────────────────────────────────────────────────────
// Trips integration
// ─────────────────────────────────────────────────────────────────

export interface ConvertToTripRequest {
  title?: string;
  destination?: string;
}

export interface ConvertToTripResponse {
  tripId: string;
  storyId: string;
}
