# Bloqueado en input del usuario — V2 (post auditoría #2)

Lista viva. Lo que aparece acá no se puede automatizar — necesita una decisión, una cuenta externa, o una credencial.

## Decisiones de marca y producto (NO RESUELTAS)
- **Commercial name (rebrand)** — `GusTrips` como interno OK; falta el nombre comercial para landing + App Store
- **App icon premium** — 1024×1024 + variantes iOS. Recomendado: Dribbble freelance 200–500 USD
- **Splash screen** — coherente con app icon
- **Logo wordmark** — para footer + emails + share preview
- **Brand voice guide** — para que el chatbot, los toasts y el copy se mantengan consistentes

## Decisiones comerciales
- **Pricing tier** confirmado (research sugiere $59/año couple plan + $6.99/mo anchor)
- **Stripe account + Customer Portal** setup
- **Landing page** copy + estructura

## External services (cada uno necesita una cuenta + API key)

### AI proactivo + features Claude-específicos
- **`ANTHROPIC_API_KEY`** en Vercel env vars
  - Necesario para: features que pidan razonamiento profundo (closing letter narrativa, análisis multi-step)
  - El producto actual usa Gemini para todo; Anthropic sumaría sin reemplazar

### Importador de emails de reserva
- **Gmail OAuth en Google Cloud Console**
  - OAuth client + Consent Screen (privacy URL: https://gustrips.vercel.app/privacy)
  - Scopes: `gmail.readonly`
  - Vercel env vars: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
  - Verificación de Google App requerida para salir de "Testing" mode

### Tracking de vuelos en vivo
- **AeroDataBox** ($32/mes plan MEGA por research)
  - Cuenta en RapidAPI
  - `AERODATABOX_API_KEY` env var

### Mapas custom
- **Mapbox token**
  - Free tier hasta 50k loads/mes
  - `NEXT_PUBLIC_MAPBOX_TOKEN` env var

### Push avanzado + Live Activities (iOS native)
- **Apple Developer Program** ($99/año)
- Bundle identifier + provisioning
- Capacitor + Live Activities ActivityKit

### Affiliate revenue (cuando el producto tenga tracción)
- **Airalo** (eSIM) — cuenta de afiliado
- **SafetyWing** (seguros) — programa de afiliados
- **Booking** referrals

## Pendientes de aprobación de producto (decisión tuya)
- ¿Activamos el AI proactivo? Implica usage de tokens más alto
- ¿Hacemos el rebrand antes de mes 3 o esperamos al PMF?
- ¿iOS native (Capacitor) ya o esperamos a tener 1k users?

---

## YA RESUELTO en sesiones anteriores
- Tesis del producto: tres pilares balanceados (logística + emocional + financiero)
- Rebrand approach: soft (mantener interno `gustrips`, lanzar comercial con nombre nuevo)
- Target: parejas viajeras 25-45 como prioridad
- Monetización approach: defer pricing hasta tener más data

---

## YA AUTOMATIZADO (no necesita user input)

Completado en sesiones previas + en curso:
- Three-pillar palettes (mode-planning / active / memories / money) en CSS, default values en :root
- Fraunces + Inter cargados via next/font
- View Transitions API setup en globals.css
- TripDataContext consolidado (4 listeners en lugar de 10+)
- Daily diary AI + auto-backfill + Bitácora tab + sección en /recap
- Fast Expense FAB con OCR rich (date / merchant / subtotal / tax / tip) + needsReview + banner pendientes
- Photo Web Worker (HEIC + compress + hash off main thread)
- Photo upload pool (concurrencia 3)
- Batch trip.updatedAt bump
- Biometric lock /documents (WebAuthn)
- Calendar .ics export endpoint
- Bottom nav mobile con auto-collapse
- Today hero + tabs Hoy/Historia + diary card
- Privacy + Security pages
- 13 temas photobook + crop manual + PDF parallel
- TripHeroCard mode-aware en dashboard
- Public share view (`/shared/[token]`)

## En CURSO (agentes background, esta sesión)
- Maleta inteligente + templates por destino
- Templates por tipo de viaje (luna miel / road trip / family / business / crucero)
- Modos contextuales (Aeropuerto / Hotel / Restaurante)
- Mapa de huellas mundial (Leaflet + Nominatim free, sin Mapbox)
- Highlights diarios auto-curados (Gemini)
- Auto-photobook al cierre + Closing ceremony
- Multi-tenant con roles (owner / editor / viewer / kid) + Firestore rules
- Pasada de paletas mode a las pages restantes (vía global :root defaults)
- View Transitions API auto-nav
