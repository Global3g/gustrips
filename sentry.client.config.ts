/**
 * Sentry browser configuration.
 *
 * Loaded automatically by @sentry/nextjs in client components. If the DSN
 * env var is missing (e.g. local dev without an account) initialization is
 * a no-op, so the app keeps working — only `captureException` calls become
 * silent. Once you set NEXT_PUBLIC_SENTRY_DSN, reports start flowing.
 *
 * Setup checklist (one-time, by you):
 *   1. Sign up at https://sentry.io and create a Next.js project.
 *   2. Copy the DSN into `.env.local` as NEXT_PUBLIC_SENTRY_DSN.
 *   3. (Optional) Add SENTRY_ORG + SENTRY_PROJECT + SENTRY_AUTH_TOKEN so
 *      `next build` uploads source maps for un-minified stack traces.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    // Sample 10% of normal traffic for performance traces. Bump up while
    // debugging perf issues, dial back to control cost.
    tracesSampleRate: 0.1,
    // Capture full session replays only for 10% of sessions, but always
    // for sessions where an error fires.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        // Mask PII by default — emails, names, photos inside the trip
        // shouldn't end up in the replay.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Strip noisy errors that aren't actionable.
    ignoreErrors: [
      // User cancelled OAuth popup — not a bug.
      'popup-closed-by-user',
      // Network drops on mobile while backgrounded.
      'NetworkError when attempting to fetch resource',
      'Failed to fetch',
      // Service Worker registration race on slow connections.
      'The script has an unsupported MIME type',
      // Browser extensions injecting into the page.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  });
}
