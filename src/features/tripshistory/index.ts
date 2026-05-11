/**
 * Tripshistory public API.
 *
 * Anything imported from `@/features/tripshistory` should come from this file.
 */

// Types
export type * from '@/features/tripshistory/types';

// API
export {
  tripshistoryClient,
  TripshistoryError,
  getTripshistoryBaseUrl,
} from '@/features/tripshistory/api/client';
export * as tripshistoryApi from '@/features/tripshistory/api/endpoints';

// Hooks
export { useStory } from '@/features/tripshistory/hooks/useStory';
export { useStoriesByTrip } from '@/features/tripshistory/hooks/useStoriesByTrip';
export { useStoryboard } from '@/features/tripshistory/hooks/useStoryboard';
export { useNextQuestion } from '@/features/tripshistory/hooks/useNextQuestion';
export { useAnswerQuestion } from '@/features/tripshistory/hooks/useAnswerQuestion';
export { usePhotoBatch } from '@/features/tripshistory/hooks/usePhotoBatch';
export { useAnalysisState } from '@/features/tripshistory/hooks/useAnalysisState';

// Components
export { default as StoryWizard } from '@/features/tripshistory/components/StoryWizard';
export { default as PhotoSelector } from '@/features/tripshistory/components/PhotoSelector';
export { default as AnalysisProgress } from '@/features/tripshistory/components/AnalysisProgress';
export { default as QuestionCard } from '@/features/tripshistory/components/QuestionCard';
export { default as AnswerInput } from '@/features/tripshistory/components/AnswerInput';
export { default as StoryboardView } from '@/features/tripshistory/components/StoryboardView';
export { default as DayCard } from '@/features/tripshistory/components/DayCard';
export { default as EventCard } from '@/features/tripshistory/components/EventCard';
export { default as UnassignedPhotos } from '@/features/tripshistory/components/UnassignedPhotos';

// Utils
export {
  extractPhotoMetadata,
  extractPhotoMetadataBatch,
} from '@/features/tripshistory/utils/photoMetadata';
export {
  computePerceptualHash,
  computePerceptualHashStub,
  hammingDistance,
} from '@/features/tripshistory/utils/perceptualHash';
