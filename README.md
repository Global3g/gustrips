# GusTrips

Organizador de viajes premium construido con Next.js 15, React 19, Firebase y Tailwind CSS 4.

## Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **UI**: Tailwind CSS 4 + Framer Motion
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions v2)
- **Validación**: Zod
- **Iconos**: Lucide React
- **Fechas**: date-fns con locale español
- **PWA**: Service Worker + Web Push (`web-push` + VAPID)
- **Mapas**: React Leaflet
- **E2E**: Playwright

## Configuración

```bash
git clone <url-del-repo>
cd gustrips
npm install
cp .env.local.example .env.local
# Completar las variables NEXT_PUBLIC_FIREBASE_*
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Dev server en `http://localhost:3000` (Turbopack desactivado por compatibilidad) |
| `npm run build` | Build de producción |
| `npm run start` | Servir el build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config en `eslint.config.mjs`) |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run test:e2e:ui` | Playwright en modo UI |

## Firebase

### Servicios requeridos
1. **Authentication**: Email/Password + Google.
2. **Firestore**: Modo producción.
3. **Storage**: Habilitar.
4. **Cloud Functions**: Region `us-central1`. Runtime Node.js 20.

### Despliegue de seguridad — CRÍTICO

Las reglas controlan el acceso a datos. Después de cualquier cambio en `firestore.rules`, `storage.rules` o `firestore.indexes.json`:

```bash
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
```

### Despliegue de Cloud Functions

`functions/index.js` contiene:
- `heicToJpeg` (HTTP) — conversión HEIC servidor de fallback.
- `migrateAlbumPhotos` (HTTP) — migra `trip.albumPhotos[]` → subcollection.
- `checkEventReminders` (scheduled, cada 5 min) — notifica eventos próximos vía web-push.
- `tripshistory` (HTTP) — Express app del subproyecto TypeScript en `functions/tripshistory/`.

Antes del primer deploy:
```bash
cd functions/tripshistory && npm install && npm run build
firebase deploy --only functions
```

### Push Notifications

Generar y guardar las claves VAPID en variables de entorno de la función:
```bash
npx web-push generate-vapid-keys
firebase functions:secrets:set VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_EMAIL
```
La clave pública se inyecta también en el cliente vía `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## CI

`.github/workflows/ci.yml` corre en cada PR/push a `main`:
1. `tsc --noEmit`
2. `npm run lint` (warnings, no bloqueante todavía)
3. `npm run build`
4. Playwright smoke tests

## Estructura

```
src/
├── app/                  # App Router (server + client components)
├── components/           # UI components
├── context/              # React contexts (Auth, Toast, TripData)
├── features/             # Feature-scoped code (ej. tripshistory)
├── hooks/                # Custom hooks (incluyendo los que abren listeners a Firestore)
├── lib/                  # Utilities, Firebase clients, photo pipeline, HEIC, etc.
└── types/                # Tipos compartidos
functions/
├── index.js              # Cloud Functions principales
└── tripshistory/         # Subproyecto Express + TypeScript
public/
└── sw.js                 # Service Worker (cache + push)
```

## Error Reporting (Sentry)

Sentry está **integrado pero inactivo** hasta que pongas un DSN. Funciona así:

1. Crea cuenta en https://sentry.io (free tier: 5k errores/mes).
2. Crea un proyecto tipo "Next.js".
3. Copia el DSN y pégalo en `.env.local`:
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/XXXX
   SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/XXXX
   ```
4. (Opcional, para stack traces sin minificar en producción) Crea un auth token en https://sentry.io/settings/account/api/auth-tokens/ y agrega:
   ```
   SENTRY_ORG=tu-org
   SENTRY_PROJECT=gustrips
   SENTRY_AUTH_TOKEN=sntrys_...
   ```

Sin esos vars, todas las llamadas a `Sentry.captureException()` son no-op y el build sigue corriendo normal.

**Cloud Functions (`functions/index.js`)** también reportan a Sentry vía `@sentry/node`. Necesitan el mismo `SENTRY_DSN` configurado como secret del entorno de Functions:

```bash
firebase functions:secrets:set SENTRY_DSN
# (opcional) etiqueta el entorno
firebase functions:config:set sentry.env=production
```

Y declara el secret en la función que lo usa (o vía `defineSecret`) para que el runtime lo monte como `process.env.SENTRY_DSN`. Sin DSN, `Sentry.init()` se salta y todas las capturas son no-op igual que en el frontend.

**Qué se reporta automáticamente:**
- Errores capturados por `ErrorBoundary` (UI tree)
- Errores que llegan a `error.tsx` (Next.js error boundary)
- Errores del servidor (route handlers, server components)
- Performance traces (10% del tráfico)
- Session replays para sesiones con error (con texto y media enmascarados por privacidad)

Cada error se tagea automáticamente con el `uid` del usuario logueado (email NO se envía).

## Tareas pendientes notorias

- Tests E2E reales (los actuales son solo smoke contra rutas públicas).
- Reducir uso de `'use client'` en layouts (la mayoría podrían ser RSC).
- 98 warnings de ESLint preexistentes (set-state-in-effect + react-compiler analysis).
