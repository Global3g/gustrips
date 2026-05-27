---
name: project-conventions
description: gustrips project conventions and decisions the assistant must follow. Background knowledge for any session working in this repo.
user-invocable: false
---

# gustrips — conventions & decisions

App: Next.js 15 (App Router) + React 19 + Firebase (Firestore/Storage/Auth) + firebase-admin · Sentry · Tailwind 4 · npm · deploy to Vercel. Single user for now (Gustavo), who travels and uses it live.

## Decisions already made — do NOT relitigate
- **Keep ALL photo features** (album + book + collage + show + reel). If refactoring those pages, extract hooks/sub-components — never remove features.
- **Lint does NOT block the build** (`eslint.ignoreDuringBuilds: true`). Lint is advisory.
- **Toasts only on manual user actions**, never on background/cleanup/listeners.
- **Multi-currency**: financial views consolidate to the trip's base currency (MXN) via `useExchangeRates().convert`, with a per-currency strip for original amounts. Points shown separately.
- **Hotels**: a multi-night hotel is ONE expense covering all its nights (the chatbot analysis counts every night check-in→check-out-1).
- **Photo location** is auto-suggested from the itinerary by date (`inferDateLocation`), editable.

## Offline is critical (the user travels with bad connectivity)
- Firestore uses `persistentLocalCache`. The Service Worker (`public/sw.js`) uses **stable cache names** + precaches the full build manifest; **bump `SW_VERSION` on any sw.js change**.
- Auth must never block render waiting on the network (token refresh is fire-and-forget).
- **React #310 risk**: never put hooks after an early return. The auth/offline timing makes `trip` resolve null→loaded, which exposes that bug. Use the `react-hooks-reviewer` agent before shipping.

## Workflow
- Commit + deploy directly to `main` (matches the repo's history). See the `ship` skill for the release flow.
- GitHub push from the assistant shell needs `ssh-add ~/.ssh/id_ed25519` + sandbox disabled; otherwise the user pushes from their real Terminal.
- TypeScript strict, CommonJS-free app code, follow existing file conventions.
