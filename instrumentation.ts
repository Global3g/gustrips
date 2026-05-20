/**
 * Next.js instrumentation entry point.
 *
 * Boots the Sentry server/edge SDK based on the runtime. The client SDK
 * is loaded automatically via `sentry.client.config.ts`. This file is
 * required by @sentry/nextjs v10+ — without it, server errors won't be
 * reported even with a valid DSN.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// In @sentry/nextjs v10 the export was renamed to `captureRequestError`.
// Next.js still expects an `onRequestError` named export, so we re-export
// under that name.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
