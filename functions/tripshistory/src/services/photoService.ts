/**
 * Photo service — batch ingestion and listing.
 *
 * STUB IMPLEMENTATION. Real implementation will:
 *  - Validate each PhotoMetadata
 *  - Dedupe via clientId + perceptualHash
 *  - Persist into the photos subcollection
 *  - Trigger an analysis pass
 */
import type {
  PhotoBatch,
  PhotoBatchResponse,
  Photo,
  PhotoListResponse,
} from '../models/types';
import { paths } from '../lib/firestore';

function nowIso(): string {
  return new Date().toISOString();
}

export interface ListPhotosOptions {
  dayId?: string;
  eventId?: string;
  limit?: number;
  cursor?: string;
}

export const photoService = {
  async ingestBatch(
    userId: string,
    storyId: string,
    batch: PhotoBatch,
  ): Promise<PhotoBatchResponse> {
    // STUB: real impl writes to paths.photosCollection(userId, storyId)
    void userId;
    void paths;
    const received = batch.photos.length;
    return {
      storyId,
      photosReceived: received,
      photosRejected: 0,
      rejectionReasons: [],
    };
  },

  async list(
    userId: string,
    storyId: string,
    opts: ListPhotosOptions,
  ): Promise<PhotoListResponse> {
    // STUB: returns a single mock photo. Real impl will paginate
    // via paths.photosCollection(userId, storyId) using opts.cursor.
    void userId;
    void opts;
    const photo: Photo = {
      id: 'photo_mock_1',
      storyId,
      clientId: 'client_mock_1',
      capturedAt: nowIso(),
      thumbnailUrl: 'https://example.invalid/thumb.jpg',
      mediumUrl: 'https://example.invalid/medium.jpg',
      fullUrl: 'https://example.invalid/full.jpg',
      dimensions: { width: 4032, height: 3024 },
      mimeType: 'image/jpeg',
      sizeBytes: 1_843_200,
      dayId: null,
      eventId: null,
      isDuplicate: false,
      isHighlight: false,
      uploadedAt: nowIso(),
    };
    return {
      photos: [photo],
      nextCursor: null,
      total: 1,
    };
  },
};
