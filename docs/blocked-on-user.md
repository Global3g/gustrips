# Blocked on user input

Things the agent cannot complete autonomously. Each requires a decision or an external account/credential the agent cannot create.

## Tesis (CONFIRMED)
- **Decided:** "App que combina lo logístico (vuelos, docs) + emocional (fotos, diario) + financiero (presupuesto, gastos) sin que uno tape al otro."
- **Implication:** Three-pillar design system. Today screen must surface all three. Trip hero cards must show: next logistics event, latest emotional moment, budget status.

## Rebrand
- **Decided:** soft rebrand (keep `gustrips` as internal name; ship commercially with a different name later).
- **Pending from user:**
  - Final commercial name
  - Domain
  - Logo + app icon (designer needed)
  - Brand voice guide

## Monetization
- **Decided:** defer. Will revisit after Wave 1 research lands.
- **Pending from user:**
  - Approval of pricing tier proposal once research is in
  - Stripe / Lemon Squeezy account setup
  - Billing flow design

## Target
- **Decided:** parejas viajeras 25-45.

## Platform
- **Not decided yet.**
- **Pending from user:**
  - PWA-only vs Capacitor iOS vs React Native — choose after tech-decisions.md (Wave 1) lands.
  - If iOS: Apple Developer account + provisioning.

## External services that need user setup

### AI concierge
- **Choice pending** (Anthropic Claude vs OpenAI GPT-4 vs Gemini) — Wave 1 research will recommend.
- User needs to:
  - Create account with chosen provider
  - Generate API key
  - Set monthly budget cap
  - Add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to Vercel env vars

### Gmail email importer
- User needs to:
  - Create Google Cloud project (or reuse existing Firebase one — `gustrips-a317e`)
  - Enable Gmail API
  - Configure OAuth consent screen (with privacy + terms URLs)
  - Generate OAuth client credentials
  - Add to Vercel env vars: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
  - Verify scopes: `gmail.readonly`

### Flight tracking
- **Provider TBD** — Wave 1 research will recommend.
- Most providers (AeroDataBox, FlightAware) require paid subscription.
- User needs API key + billing setup.

### Mapbox (if we replace Leaflet)
- User needs:
  - Mapbox account
  - Access token
  - Style URL for custom map design
  - Pricing tier choice (free up to ~50k loads/mo)

### Native iOS (if Capacitor route is chosen)
- User needs:
  - Apple Developer Program membership ($99/year)
  - App ID + bundle identifier
  - Provisioning profiles + certificates
  - TestFlight access for beta

### Affiliate revenue
- eSIM (Airalo): account + referral link
- Travel insurance (World Nomads / SafetyWing): affiliate program signup
- Booking referrals: partner application

## Design artifacts pending
- App icon (1024×1024 + iOS variations)
- Splash screen
- Empty-state illustrations
- 3-screen onboarding artwork

## Things the agent will do now without waiting
- Design tokens + typography
- 3-palette system per mode
- Today screen redesign
- Hero card + countdown
- Biometric lock (WebAuthn — no external service needed)
- Onboarding skeleton (artwork-free, copy-driven)
- Privacy + Security pages
- .ics calendar export (no external API)
- Public share view
- E2E test suite expansion
- Skeleton states + view-transitions polish
