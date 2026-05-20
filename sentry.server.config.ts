/**
 * Sentry Node.js configuration — loaded on the server side
 * (route handlers, server components, middleware).
 *
 * Uses SENTRY_DSN (server-only) or falls back to NEXT_PUBLIC_SENTRY_DSN
 * if you'd rather share a single project.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    // Server traces are cheaper than browser — sample more aggressively.
    tracesSampleRate: 0.2,
  });
}
