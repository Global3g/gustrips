/**
 * Tripshistory Engine — Express app.
 *
 * Exports:
 *  - `app`: the bare Express application (mountable in tests).
 *  - `tripshistoryHandler`: the same app, exported as the value the
 *    parent functions/index.js will wrap with `onRequest(...)`.
 *
 * The Firebase Functions HTTPS trigger is created in functions/index.js,
 * not here, so this package stays free of Firebase Functions runtime
 * concerns and is easy to spin up locally / move to a standalone service.
 */
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';

import { storiesRouter } from './routes/stories';
import { photosRouter } from './routes/photos';
import { analysisRouter } from './routes/analysis';
import { questionsRouter } from './routes/questions';
import { storyboardRouter } from './routes/storyboard';
import { tripsRouter } from './routes/trips';
import { errorHandler, notFoundHandler } from './middleware/errors';

export const app = express();

app.disable('x-powered-by');

// CORS — allow GusTrips web clients (prod + Vercel previews + localhost dev).
// Authorization header carries the Firebase ID token, so it must be explicit
// in allowedHeaders; preflight is short-circuited at 204.
const allowedOriginExact = new Set<string>([
  'https://gustrips.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
]);
const allowedOriginPatterns: RegExp[] = [
  // Vercel preview deployments: gustrips-<hash>-<owner>.vercel.app
  /^https:\/\/gustrips-[a-z0-9-]+\.vercel\.app$/,
];

app.use(
  cors({
    origin(origin, callback) {
      // No origin header (server-to-server, curl, healthcheck) — allow.
      if (!origin) return callback(null, true);
      if (allowedOriginExact.has(origin)) return callback(null, true);
      if (allowedOriginPatterns.some((re) => re.test(origin))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 3600,
    optionsSuccessStatus: 204,
  }),
);

app.use(express.json({ limit: '2mb' }));

// Liveness — useful for sanity checks during deploy.
app.get('/_health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: 'tripshistory', version: '0.1.0' });
});

// Domain routers — each one owns its own path prefixes per api.yaml.
app.use('/', storiesRouter);
app.use('/', photosRouter);
app.use('/', analysisRouter);
app.use('/', questionsRouter);
app.use('/', storyboardRouter);
app.use('/', tripsRouter);

// 404 + centralized error handler must be registered LAST.
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Default export shape that functions/index.js consumes. Express apps
 * are themselves request listeners, so this is just an alias for clarity.
 */
export const tripshistoryHandler = app;
export default app;
