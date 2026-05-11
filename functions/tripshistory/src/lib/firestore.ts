/**
 * Firestore admin client. Reuses the default Firebase Admin app that
 * the parent functions/index.js has already initialized with
 * admin.initializeApp(). If for some reason no app is present yet,
 * initialize a default one lazily.
 */
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();

// ─────────────────────────────────────────────────────────────────
// Firestore path helpers — keeps tripshistory data independent
// from /trips/{tripId}, so the engine fully owns its data.
// ─────────────────────────────────────────────────────────────────

export const paths = {
  story: (userId: string, storyId: string): string =>
    `users/${userId}/tripstories/${storyId}`,
  storiesCollection: (userId: string): string =>
    `users/${userId}/tripstories`,
  photo: (userId: string, storyId: string, photoId: string): string =>
    `users/${userId}/tripstories/${storyId}/photos/${photoId}`,
  photosCollection: (userId: string, storyId: string): string =>
    `users/${userId}/tripstories/${storyId}/photos`,
  question: (userId: string, storyId: string, questionId: string): string =>
    `users/${userId}/tripstories/${storyId}/questions/${questionId}`,
  questionsCollection: (userId: string, storyId: string): string =>
    `users/${userId}/tripstories/${storyId}/questions`,
  day: (userId: string, storyId: string, dayId: string): string =>
    `users/${userId}/tripstories/${storyId}/days/${dayId}`,
  daysCollection: (userId: string, storyId: string): string =>
    `users/${userId}/tripstories/${storyId}/days`,
  event: (userId: string, storyId: string, eventId: string): string =>
    `users/${userId}/tripstories/${storyId}/events/${eventId}`,
  eventsCollection: (userId: string, storyId: string): string =>
    `users/${userId}/tripstories/${storyId}/events`,
};

export { admin };
