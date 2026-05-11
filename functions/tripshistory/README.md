# Tripshistory Engine (Firebase Function)

Backend service that analyzes trip photos and drives a conversational
wizard to reconstruct a trip storyboard. Lives inside `gustrips/functions/`
as a TypeScript subproject; the parent `functions/index.js` (plain Node)
imports its compiled output and exposes it as a Firebase HTTPS function.

The OpenAPI 3.1 spec at `docs/tripshistory/api.yaml` is the source of
truth for endpoints and types.

## Layout

```
functions/tripshistory/
  src/
    index.ts                 Express app + handler export
    routes/                  HTTP route handlers (one file per tag)
    services/                Stubbed business logic
    middleware/              Auth + centralized error handling
    models/types.ts          Hand-written types matching api.yaml schemas
    lib/firestore.ts         Firestore admin client + path helpers
  tsconfig.json
  package.json               Deps for this subproject only
  dist/                      Build output (consumed by parent index.js)
```

## Install

This subproject has its own `package.json` so it does not pollute the
parent `functions/package.json` (which stays plain JS). From the repo
root:

```bash
cd functions/tripshistory
npm install
```

## Build

```bash
npm run build         # one-shot compile to ./dist
npm run build:watch   # watch mode during development
npm run typecheck     # tsc --noEmit
```

The parent `functions/index.js` imports from `./tripshistory/dist/index.js`,
so **you must run `npm run build` before deploying**. A convenient combo:

```bash
cd functions/tripshistory && npm run build && cd .. && firebase deploy --only functions
```

> Consider adding a `predeploy` hook in `firebase.json` so this is
> automatic. Out of scope for the initial scaffold.

## Auth

Every route requires `Authorization: Bearer <Firebase ID token>`.
The token is verified with `admin.auth().verifyIdToken()` and the
decoded UID is attached as `req.userId`.

## Firestore layout

The engine owns its own subtree, independent of `/trips/{tripId}`,
so the stories collection can outlive any single Trip:

```
users/{userId}/tripstories/{storyId}
users/{userId}/tripstories/{storyId}/photos/{photoId}
users/{userId}/tripstories/{storyId}/questions/{questionId}
users/{userId}/tripstories/{storyId}/days/{dayId}
users/{userId}/tripstories/{storyId}/events/{eventId}
```

When a story is linked to a trip, the Trip stores `{ storyId }` as a
reference — the trip never embeds story data.

## Status

This is a **scaffold**. Every service in `src/services/` returns mock
data shaped to match the OpenAPI response schemas. There is no real
photo analysis, no question generation, and no AI/LLM integration —
those land in v2.

What works:

- All routes from `api.yaml` are wired with the correct method/path/
  status codes and apply auth middleware.
- Returned bodies match the OpenAPI shapes (helpful for client work
  to start in parallel).
- TypeScript compiles cleanly with strict mode.

What is stubbed:

- Firestore reads/writes (services only reference path helpers; nothing
  is persisted yet).
- Photo analysis (clustering, GPS, duplicates, blur scoring).
- Question prioritization + generation.
- Storyboard assembly from real data.
- `convert-to-trip` does not actually create a Trip in `/trips/`.

## Notes on path quirks

OpenAPI uses two Google-style action verbs that include a literal `:`:

- `POST /stories/{storyId}/photos:batch`
- `POST /stories/{storyId}:convert-to-trip`

Express's path-to-regexp treats `:` as a param prefix, so these are
registered as `photos\\:batch` and `:storyId\\:convert-to-trip`
(escaped colons) in the route files.
