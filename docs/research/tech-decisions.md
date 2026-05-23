# Tech Decisions — gustrips 2026

> Research date: 2026-05-22
> Stack actual: Next.js 15 + React 19 + Firebase + Tailwind 4 + Sentry + Vercel + Firestore + Cloud Functions Node 20
> Objetivo: Decisiones técnicas para evolucionar de PWA a app premium multi-plataforma con AI concierge, parsing de reservas, tracking de vuelos y mapas premium.

---

## TL;DR — Stack Recomendado 2026

| Categoría | Recomendación | Costo estimado @1k MAU | Costo estimado @10k MAU |
|---|---|---|---|
| Mobile wrapper | **Capacitor 6+** | $0 (one-time setup) | $0 (one-time setup) |
| Email parsing | **Gmail API directo + Claude Haiku 4.5** | ~$3–8/mes | ~$30–80/mes |
| Flight tracking | **AeroDataBox (start)** -> FlightAware AeroAPI (scale) | $32/mes | $150–300/mes |
| AI concierge | **Claude Sonnet 4.6 + Haiku 4.5 routing + prompt caching** | ~$15–40/mes | ~$200–500/mes |
| Mapas | **Mapbox** (Mobile SDK + GL JS) | $0 (free tier) | ~$150–400/mes |
| Push | **@capacitor-firebase/messaging** (FCM + APNs) | $0 (FCM gratis) | $0–25/mes (gateway) |

---

## 1. Capacitor vs React Native vs PWA pura

### Recomendación: **Capacitor 6+** sobre la app Next.js existente

### Razón
La app ya existe como Next.js 15 PWA. Capacitor envuelve la build estática en un WebView nativo y expone APIs nativas vía plugins JS. **No requiere reescritura** — la misma codebase corre en web, iOS y Android. React Native requeriría rehacer toda la UI con componentes RN (View/Text/etc.), perdiendo Tailwind, layouts CSS y SSR. PWA pura tiene techos críticos: sin background fetch en iOS, sin Live Activities, sin biometrics nativos, sin App Store distribution.

### Trade-offs

| Criterio | PWA | Capacitor | React Native |
|---|---|---|---|
| Reuso de código Next.js | 100% | ~95% (export estático) | ~0% (rewrite UI) |
| Performance UI | Excelente | Excelente (WebView moderno) | Mejor en animaciones complejas |
| Biometric / Face ID | No | Sí (`@capgo/capacitor-native-biometric`, `@aparajita/capacitor-biometric-auth` v10) | Sí (nativo) |
| Push avanzados (Rich, Live Activities) | Parcial (iOS limitado) | Sí (vía `@capacitor-firebase/messaging`) | Sí |
| Background sync | No en iOS | Sí (`@capawesome/capacitor-background-task`) | Sí |
| App Store / Play Store | Workarounds | Sí | Sí |
| Dev experience desde web team | Excelente | Excelente | Pendiente nuevo skillset |
| Tiempo a primera app store build | N/A | 1–2 semanas | 2–4 meses (rewrite) |

### Costo
- Capacitor: **gratis open source**. Sólo costo Apple Developer Program ($99/año) + Google Play ($25 one-time).
- Ionic Appflow (CI/CD opcional, no requerido si usás EAS-equivalent o GitHub Actions): $49–499/mes.

### Tiempo de implementación
- Setup inicial Capacitor + build iOS/Android: **3–5 días**.
- Migración Next.js a `output: 'export'` o adaptación SSR: **3–7 días** (depende de uso de API routes).
- Integración plugins (push, biometric, geo, camera): **1–2 semanas**.
- **Total realista a primera beta TestFlight + Play Internal**: 3–4 semanas.

### Riesgos
- Next.js `output: 'export'` no soporta API routes ni server actions → mover lógica server a Cloud Functions (ya están).
- WebView en iOS antiguo (<iOS 16) limita ciertos APIs, pero base ya iOS 16+ en el mercado.
- Performance crítica de animaciones 60fps complejas: si el roadmap incluye AR o mapas con miles de markers animados, evaluar componentes nativos puntuales.

### Sources
- https://capacitorjs.com/docs
- https://nextnative.dev/blog/capacitor-vs-react-native
- https://thedebuggersitsolutions.com/blog/cross-platform-app-2026-flutter-react-native-capacitor
- https://www.npmjs.com/package/@capgo/capacitor-native-biometric
- https://github.com/aparajita/capacitor-biometric-auth

---

## 2. Parsing de emails de reserva

### Recomendación: **Gmail API directo + Claude Haiku 4.5 para parsing** (Outlook vía Microsoft Graph)

### Razón
Nylas y Unipile cobran **por cuenta conectada** ($2–9/cuenta/mes), lo cual escala mal cuando todos tus usuarios conectan su mail. A 10k usuarios con Nylas pagaríamos $20k+/mes solo en conexiones. Gmail API y Microsoft Graph son **gratuitos hasta cuotas muy altas** (Gmail: 1B quota units/día). El parsing semántico con LLM (Haiku 4.5) cuesta centavos por email. Plus, Gmail tiene `users.watch` con Pub/Sub para push real-time desde Google → tu webhook.

### Comparativa

| Solución | Modelo de costo | Setup | Multi-provider |
|---|---|---|---|
| Gmail API + LLM | Gratis API + ~$0.0005/email (Haiku) | Medio (OAuth + Pub/Sub watch) | No (Gmail only) |
| Microsoft Graph + LLM | Gratis API + ~$0.0005/email | Medio (OAuth + subscriptions) | No (Outlook/365 only) |
| Nylas | $15 base + $2/cuenta/mes (Email API) | Bajo | Sí |
| Unipile | Comparable a Nylas | Bajo | Sí |
| Mailparser.io | Reglas regex, no LLM | Bajo, frágil | Provider-agnostic vía forward |
| Custom regex/IMAP | Gratis infra + dev caro | Muy alto | Sí |

### Costos estimados (asumiendo 1 email de reserva ~2k tokens input + 500 output con Claude Haiku 4.5 @ $1/MTok input, $5/MTok output)
- Por email: ~$0.0045 (sin caching). Con prompt caching: ~$0.0015.
- **1k usuarios × ~5 emails de reserva/mes = 5k emails**: ~$7.5/mes en LLM + Cloud Functions (despreciable).
- **10k usuarios × 5 = 50k emails/mes**: ~$75/mes en LLM.
- Comparado: Nylas a 10k cuentas ~ $20,015/mes ($15 base + 10k × $2).

### Tiempo de implementación
- Gmail OAuth + scopes restrictivos (`gmail.readonly` con label filter `category:travel` o queries específicas) y Pub/Sub watch: **3–5 días**.
- Microsoft Graph equivalent: **2–3 días** adicionales.
- Prompt engineering + schema validation (Zod) + Claude prompt con structured output: **3–5 días**.
- Pipeline de retries + idempotency + Firestore writes: **2–3 días**.
- **Total**: 2–3 semanas para Gmail+Outlook con producción-grade.

### Riesgos
- **Google OAuth verification**: scopes restringidos requieren CASA tier 2 security review (~$15–75k one-time si no calificás para self-attestation). Mitigación: empezá con `gmail.metadata` + `gmail.addons.current.message.readonly`, escalar a `gmail.readonly` solo si necesario y aplicar al programa de verification temprano.
- **Granular OAuth Consent (enero 2026)**: usuarios pueden negar permisos específicos — manejar fallbacks.
- **LLM hallucinations en parsing**: validar con Zod schema, rechazar y reintentar con prompt más estricto, log a Sentry.
- **Privacy/GDPR**: nunca persistir el body raw del email; sólo guardar campos estructurados extraídos.

### Sources
- https://www.nylas.com/pricing/
- https://www.unipile.com/email-api-providers/
- https://deadsimple.email/blog/email-api-cost-comparison-ai-agents-2026.html
- https://developers.google.com/gmail/api (Gmail watch + Pub/Sub)
- https://platform.claude.com/docs/en/about-claude/pricing

---

## 3. Flight tracking API

### Recomendación: **AeroDataBox (MVP) → FlightAware AeroAPI (scale + premium)**

### Razón
AeroDataBox tiene la mejor relación costo/cobertura para arrancar: $5–32/mes cubre la mayoría de casos con flight status, schedules y delays. Cuando los usuarios premium exijan tracking real-time push (posiciones en mapa cada 5s, alertas de gate change instantáneas), FlightAware AeroAPI ofrece webhooks con alerts, y Firehose ofrece streaming TCP+SSL real-time (enterprise).

### Comparativa

| API | Free tier | Plan inicial | Plan medio | Real-time push | Coverage |
|---|---|---|---|---|---|
| **AeroDataBox** | 600 calls/mes | $5/mo (6k calls) | $32/mo (60k calls) | No, polling | Comercial global, buena |
| **FlightAware AeroAPI** | 500 calls/mes (personal) | $100/mo (10k calls) | $1,000/mo (100k calls) | Sí, alerts via webhook | Excelente, incluye aviación privada |
| **FlightAware Firehose** | No | Enterprise quote (~$5k+/mes típico) | — | Sí, TCP streaming JSON Lines | Best-in-class |
| **Flightradar24 API** | No (B2B) | $9/mo (30k calls) | $900/mo (4M calls) | Polling rápido | ADS-B fuerte |
| **OpenSky Network** | Gratis (académico/personal) | Gratis | Gratis | Polling, datos crudos ADS-B | Crowdsourced, gaps en aviación comercial scheduled |

### Costos estimados
- **1k usuarios** (asumir 2 vuelos activos/mes/usuario, polling cada 15min mientras vuelo activo ~ 30 polls/vuelo): ~60k requests/mes → **AeroDataBox MEGA $32/mes**.
- **10k usuarios**: ~600k requests/mes → AeroDataBox MEGA topa, requiere upgrade a UNLIMITED o migración a **AeroAPI ~$150–300/mes** dependiendo del mix.
- Para premium tier con tracking en vivo: AeroAPI con alerts ~$100–300/mes adicionales.

### Tiempo de implementación
- Integración AeroDataBox con queries por número de vuelo + caché agresivo en Firestore: **3–5 días**.
- Worker programado (Cloud Functions Scheduler) que actualiza vuelos activos: **2 días**.
- Migración futura a AeroAPI con alerts webhook: **3–5 días** adicionales.

### Riesgos
- OpenSky descartado para producción: gaps en cobertura comercial scheduled y términos restrictivos para comercial.
- FlightAware free tier es solo personal-use; producción requiere plan pago desde día 1.
- Real-time push (Firehose) tiene un piso de costo enterprise alto — sólo justificado a 10k+ usuarios con tier premium.
- "Buscar pricing actualizado" para Firehose y AeroAPI enterprise — Anthropic-style sales motion, requiere RFQ.

### Sources
- https://aerodatabox.com/pricing/
- https://www.flightaware.com/commercial/aeroapi/
- https://www.flightaware.com/commercial/firehose/
- https://geekflare.com/dev/flight-data-api/
- https://discussions.flightaware.com/t/help-best-way-to-receive-real-time-flight-updates-gate-changes-delays-cancellations-via-aeroapi-webhooks/99825

---

## 4. AI concierge LLM provider

### Recomendación: **Claude Sonnet 4.6** (default) + **Claude Haiku 4.5** (parsing/clasificación) + prompt caching agresivo

### Razón
Claude 4.6 ofrece la mejor combinación calidad/precio para tareas conversacionales largas con tool use (búsquedas, mapas, reservas). Streaming SSE soportado nativamente. Prompt caching reduce input hasta 10x en contexto recurrente (perfil del usuario, sus viajes activos). Routing Haiku para clasificación y Sonnet para razonamiento. Gemini 2.5 Flash es más barato pero menos consistente en tool calling complejo; GPT-5.5 más caro sin ventaja clara para travel. Anthropic además es el provider que ya conocés mejor y el SDK tiene la mejor DX para agentes.

### Pricing comparativo (mayo 2026, $/MTok)

| Modelo | Input | Output | 5m cache write | Cache read |
|---|---|---|---|---|
| **Claude Sonnet 4.6** | $3 | $15 | $3.75 | $0.30 |
| **Claude Haiku 4.5** | $1 | $5 | $1.25 | $0.10 |
| **Claude Opus 4.7** | $5 | $25 | $6.25 | $0.50 |
| GPT-5.2 | $1.75 | $14 | — | — |
| GPT-5.5 | $5 | $30 | — | — |
| Gemini 2.5 Pro | $1.25 | $10 | — | — |
| Gemini 2.5 Flash | $0.30 | $2.50 | — | — |

### Costos estimados (asumiendo concierge interactivo: 10 turnos/usuario/mes, ~3k input + 800 output por turno, 70% input cacheable)

- **Por usuario/mes con Sonnet 4.6 + caching**:
  - Cache write 1x: ~2.1k × $3.75/MTok = $0.0079
  - Cache reads 9x: ~2.1k × 9 × $0.30/MTok = $0.0057
  - Uncached input 10x: ~0.9k × 10 × $3/MTok = $0.027
  - Output 10x: 0.8k × 10 × $15/MTok = $0.12
  - **Total ~ $0.16/usuario/mes**
- **1k usuarios activos**: ~$160/mes (con Haiku routing para 60% de queries reduce a ~$60–80/mes).
- **10k usuarios**: ~$1,600/mes sin optimizar → con Haiku routing y cache agresivo realista **$400–600/mes**.

### Tiempo de implementación
- Claude SDK (`@anthropic-ai/sdk`) ya familiar: 1 día setup.
- Streaming SSE en Next.js Route Handler + Cloud Function gateway: 2–3 días.
- Tool use (búsqueda lugares, agregar a viaje, consultar reserva): 5–7 días.
- Prompt engineering + eval harness con Langfuse o similar: 5 días.
- **Total**: 2–3 semanas para v1 funcional.

### Riesgos
- Rate limits Tier 1 al arrancar (~50 RPM) — escalar Tier ANTES del launch público.
- Costos pueden escalar mal con conversaciones largas si no usás cache breakpoints correctamente.
- Streaming en Capacitor WebView requiere validar que SSE atraviesa el bridge nativo (debería andar pero testear).
- Privacy: nunca enviar PII completa al modelo; sanitizá direcciones, contactos.

### Sources
- https://platform.claude.com/docs/en/about-claude/pricing
- https://www.anthropic.com/claude/sonnet
- https://devtk.ai/en/blog/ai-api-pricing-comparison-2026/
- https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude
- https://techbullion.com/the-2026-llm-api-pricing-comparison-gpt-5-5-claude-sonnet-4-6-gemini-3-5-flash-and-deepseek-v4/

---

## 5. Mapas premium

### Recomendación: **Mapbox** (Mobile Maps SDK + Mapbox GL JS para web)

### Razón
Mejor combinación de customización visual (Mapbox Studio para diseñar el style del map matching la brand), pricing predecible, y stacks unificado web + iOS + Android. Google Maps tiene mejor Places data pero pricing 30%+ más caro y UI/style restringido. MapTiler es competitivo en EU pero ecosistema mobile menos maduro. Leaflet con tiles custom queda como opción para reducir costos al máximo pero pierde features (turn-by-turn, satellite, 3D buildings).

### Comparativa pricing 2026

| Proveedor | Web map loads | Mobile MAU | Directions API |
|---|---|---|---|
| **Mapbox** | 50k free, luego $5/1k (50k–100k) | 25k MAU free, luego $4/1k | 100k free, luego $1.20/1k |
| **Google Maps** | ~28.5k free, Starter $100/mo (50k), Pro $1,200/mo (250k); overage $7/1k | Incluido en map loads | $5/1k después de free tier |
| **MapTiler** | Plans desde $29/mes | Plans desde $29/mes | Routes API en plans superiores |
| **Leaflet + OSM tiles** | Gratis con tiles propios | Gratis | Vía OSRM self-hosted |

### Costos estimados
- **1k usuarios** (asumiendo 50 map loads/usuario/mes = 50k web loads + 1k mobile MAU): **dentro del free tier** de Mapbox → **$0**.
- **10k usuarios**: ~500k web loads + 10k mobile MAU → Mapbox ~ $1,650/mes (web tiered) + $0 (MAU dentro de 25k free). Optimizando con vector tiles cached client-side + map seats en lugar de loads, realista ~ **$300–500/mes**.
- Google Maps equivalente: ~$2,400+/mes (~30% premium).

### Tiempo de implementación
- Mapbox GL JS en Next.js: **2–3 días** (custom style + markers + clustering).
- Mapbox Studio custom style con brand: **2–4 días** de diseño.
- Mapbox Mobile Maps SDK vía Capacitor plugin (`@capacitor-community/mapbox` o webview-only): **1–3 días**.
- **Total**: ~1.5 semanas.

### Riesgos
- Mapbox Places search es menos rica que Google Places — para POI/restaurantes/hoteles considerar combinar con **Google Places API** o **Foursquare** sólo para search, manteniendo Mapbox para render.
- Vector tiles atribución obligatoria — chequear branding requirements.
- En offline mode (importante para travelers): Mapbox tiene mejor soporte de tile caching que Google.

### Sources
- https://www.mapbox.com/pricing
- https://docs.mapbox.com/accounts/guides/pricing/
- https://www.buildmvpfast.com/api-costs/maps
- https://radar.com/blog/mapbox-vs-google-maps-api
- https://www.maptiler.com/cloud/pricing/

---

## 6. Push notifications avanzadas

### Recomendación: **`@capacitor-firebase/messaging`** (FCM unificado para iOS + Android) + Capacitor Local Notifications para rich

### Razón
Web push en iOS Safari (PWA-only, no funciona en EU desde DMA, vagamente confiable, sin Live Activities, sin Time Sensitive). Con Capacitor + FCM tenés un único token endpoint que FCM enruta a APNs en iOS y a su propia red en Android. Soporta rich notifications con imagen, actions, Live Activities (vía plugin adicional), Time Sensitive interruption level, y silent push para data sync.

### Estado del web push en iOS Safari (2026)
- **Soportado** sólo en PWAs instaladas (Add to Home Screen), iOS 16.4+.
- **No funciona** en EU para PWAs (DMA forzó tabs en Safari sin pushManager).
- Sin Live Activities, sin Focus Mode breakthrough, sin Background Sync API, sin Periodic Background Sync, sin Background Fetch.
- Reportes de delivery inconsistente.

### Comparativa

| Capability | Web Push (PWA) | Capacitor + FCM |
|---|---|---|
| iOS (no-EU) | Limitado, sólo PWA instalada | Pleno (APNs vía FCM) |
| iOS (EU) | No funciona | Pleno |
| Rich (image, actions) | Parcial | Sí |
| Time Sensitive / breakthrough Focus | No | Sí |
| Live Activities (Lock Screen tracking de vuelo) | No | Sí (con `capacitor-live-activities` o plugin custom Swift) |
| Background sync | No iOS | Sí |
| Costo del gateway | $0 (VAPID self-hosted) | $0 FCM, opcionalmente OneSignal/Pusher ($25–100/mes a escala) |

### Costos estimados
- **1k–10k usuarios**: **$0** — FCM es gratis ilimitado. APNs es gratis con Apple Developer account ($99/año).
- Si se usa OneSignal/Customer.io para segmentación: ~$0 free tier, $25–100/mes a 10k MAU.

### Tiempo de implementación
- Setup `@capacitor-firebase/messaging` + Firebase project + APNs auth key (.p8): **2–3 días**.
- Backend (Cloud Functions) → FCM Admin SDK → tokens de Firestore: **2 días**.
- Rich notifications con imágenes (logos aerolínea, mapa de gate): **2–3 días**.
- Live Activities para tracking de vuelo en tiempo real (Lock Screen widget): **5–8 días** (requiere Swift custom + plugin bridge).
- **Total v1 (sin Live Activities)**: 1 semana. Con Live Activities: 2–3 semanas.

### Riesgos
- APNs sólo funciona en device físico (no en simulator) — testing requiere TestFlight loop.
- iOS exige user permission prompt; ratio de opt-in típicamente 60–70%.
- Live Activities tienen budget de updates (ApplicationContext) y requieren ActivityKit (iOS 16.1+).
- FCM tokens rotan — backend debe manejar refresh y tombstones.

### Sources
- https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- https://capacitorjs.com/docs/guides/push-notifications-firebase
- https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- https://dev.to/saltorgil/the-complete-guide-to-capacitor-push-notifications-ios-android-firebase-bh4
- https://capawesome.io/blog/the-push-notifications-guide-for-capacitor/

---

## Apéndice: Orden recomendado de implementación

1. **Mapbox** (semana 1) — base visual para UX premium.
2. **Capacitor wrap** (semanas 2–4) — habilita app stores, biometric, push.
3. **Push via FCM** (semana 5) — engagement.
4. **AI concierge Claude** (semanas 6–8) — diferenciador clave, foundation para agentic.
5. **Email parsing Gmail+Claude Haiku** (semanas 9–11) — magic moment para conversion.
6. **Flight tracking AeroDataBox** (semana 12) — completa el "agentic travel companion".

## Apéndice: Items que requieren cotización directa

- FlightAware Firehose enterprise — buscar pricing actualizado vía sales contact.
- AeroAPI volumen >100k calls/mes — pricing custom.
- Volúmenes Claude Tier 4 / Enterprise — contactar `sales@anthropic.com`.
- Mapbox MAU >250k — pricing escalonado custom.
- Si Capacitor build/deploy via Ionic Appflow: pricing $49–499/mes — buscar pricing actualizado.
