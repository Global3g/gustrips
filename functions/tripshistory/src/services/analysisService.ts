/**
 * Analysis service — automatic photo analysis state.
 *
 * STUB IMPLEMENTATION. Real impl will:
 *  - Group photos by day (capturedAt + timezone)
 *  - Cluster temporally (event candidates)
 *  - GPS-cluster when location is present
 *  - Detect duplicates via perceptualHash
 */
import type { AnalysisState } from '../models/types';

function nowIso(): string {
  return new Date().toISOString();
}

export const analysisService = {
  async getState(userId: string, storyId: string): Promise<AnalysisState> {
    void userId;
    void storyId;
    return {
      status: 'questioning',
      photoCount: 42,
      photosWithGps: 30,
      photosWithDates: 42,
      detectedDays: [
        { date: '2025-08-12', photoCount: 14 },
        { date: '2025-08-13', photoCount: 18 },
        { date: '2025-08-14', photoCount: 10 },
      ],
      detectedClusters: [
        {
          clusterId: 'cluster_1',
          startTime: '2025-08-12T09:00:00Z',
          endTime: '2025-08-12T12:30:00Z',
          photoCount: 9,
          hasLocation: true,
        },
        {
          clusterId: 'cluster_2',
          startTime: '2025-08-12T19:00:00Z',
          endTime: '2025-08-12T21:30:00Z',
          photoCount: 5,
          hasLocation: false,
        },
      ],
      duplicateGroups: 3,
      lastAnalyzedAt: nowIso(),
    };
  },

  async enqueueReanalysis(userId: string, storyId: string): Promise<void> {
    // STUB: real impl pushes a task to a queue / Cloud Task / Pub/Sub
    void userId;
    void storyId;
    return;
  },
};
