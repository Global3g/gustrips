# Gustrips · Competitor Analysis

> Premium travel app for couples 25–45. Thesis: combine **logistical** (flights, docs) + **emotional** (photos, diary) + **financial** (expenses, budget) in one app without one tab eating the others.

**Date:** 2026-05-22
**Method:** WebSearch + WebFetch on public marketing/help pages and independent reviews. Where official pricing/feature pages were unreachable (e.g. TripIt direct, Airbnb), data was triangulated from independent reviews (Going.com, Frugal Flyer, Sunset Magazine, Pilot Plans, etc.).

---

## 1. TripIt

- **URL:** https://www.tripit.com
- **Pricing:**
  - Free: forever.
  - **TripIt Pro: $49.00 / year** (only paid tier). 30-day free trial. ([source](https://www.tripit.com/web/pro/pricing), [Going.com review](https://www.going.com/guides/tripit-review))
- **Top 5 distinctive features:**
  1. Email-forwarding auto-itinerary builder (forward booking confirmations to `plans@tripit.com` and it parses them into a master itinerary).
  2. Real-time flight alerts (delays, gate changes, cancellations) often before the airline pushes them — Pro only.
  3. Alternate-flight finder when your flight is cancelled — Pro only.
  4. Seat tracker / "best seat" picker (Pro).
  5. Points & miles tracker across loyalty programs (Pro).
- **UX patterns:**
  - Inbox-driven planning (no manual entry required).
  - Master itinerary is **linear / timeline-based**, very business-traveler oriented.
  - Calendar sync as a first-class feature.
- **Gaps:**
  - No real photo/journal layer.
  - No expense/budget tracking.
  - No couple/group collaboration with roles.
  - UI feels dated (multiple 2025/2026 reviews call out the legacy look).
  - Higher document upload limit gated behind Pro (25 vs 3).
- **Target:** Frequent flyers, especially **business travelers**. Reviews ([Going.com](https://www.going.com/guides/tripit-review)) explicitly say "for most leisure travelers, the answer is no" on Pro.

---

## 2. Wanderlog

- **URL:** https://wanderlog.com
- **Pricing:**
  - Free: fully functional, ad-free.
  - **Pro: ~$39.99 / year** (some sources $40/yr ≈ $3.33/mo equivalent). Monthly plan exists at $17/mo. ([Monkey Eating Mango breakdown](https://monkeyeatingmango.com/blog/wanderlog-pricing-2026/), [Wanderlog Pro page](https://wanderlog.com/pro))
- **Top 5 distinctive features:**
  1. Map-first multi-day itinerary builder with drag-and-drop reordering.
  2. Real-time collaboration on itineraries (Google-Docs style).
  3. Expense splitting built into the itinerary.
  4. Reservation auto-import via email forwarding.
  5. AI route optimization & itinerary suggestions (Pro).
- **UX patterns:**
  - Map + list **split view**, very Google-Maps-native feel.
  - Group planning is the default mental model.
  - PDF export + offline access locked to Pro.
- **Gaps:**
  - No photo/diary surface (planning tool, not memory tool).
  - Expense splitting is utilitarian, not a real finance layer.
  - No "emotional" / post-trip memory product.
  - No physical book output.
- **Target:** Road-trippers, group/collaborative planners, budget-conscious travelers ([wandrly review](https://www.wandrly.app/reviews/wanderlog)).

---

## 3. Polarsteps

- **URL:** https://www.polarsteps.com
- **Pricing:**
  - **App is 100% free.** No subscription. Revenue comes from physical Travel Books.
  - Travel Books: **from €36 up to €150** (24 pages minimum). 10% off for 2 copies, 15% off for 3+. ([pricing help center](https://support.polarsteps.com/hc/en-us/articles/24003935464466-What-is-the-price-of-a-Travel-Book))
- **Top 5 distinctive features:**
  1. Automatic background route tracking, **<4% battery/day**.
  2. Works fully **offline / off-grid** and syncs later.
  3. Beautiful printed hardback Travel Book as the monetization output.
  4. Trip Reels — auto-generated video recaps.
  5. Granular privacy (private / friends-family / public) — proudly ad-free.
- **UX patterns:**
  - Tracker-first: the app records *where you went*, you add photos/stories retroactively.
  - Long-trip / backpacker mindset (multi-month trips, world maps with stats).
  - Public-feed component (you can browse other travelers' trips).
- **Gaps (multiple reviews confirm):**
  - **No flight / accommodation booking integration or tracking** — explicitly called out as missing.
  - **No expense or budget tracking** at all.
  - No document storage.
  - Tracking glitches (mystery flights, can't manually start/end trip at non-midnight).
  - No real itinerary planning UI.
- **Target:** Long-term travelers, backpackers, "die-hard" adventurers, 20M+ users ([Polarsteps homepage](https://www.polarsteps.com), [pilotplans review](https://www.pilotplans.com/blog/polarsteps-review)).

---

## 4. Journi

- **URL:** https://journiapp.com
- **Pricing:**
  - Free app with Premium IAP.
  - **Premium: €9.99 / month, €43.99 / 6 months, €53.99 / year** (~$58/yr). ([Pilot Plans Journi review](https://www.pilotplans.com/blog/journi-review))
  - Photo books from €22.99 (€19.99 starter per official site) including worldwide shipping.
- **Top 5 distinctive features:**
  1. AI auto-arranges photos into a timeline diary "in seconds."
  2. 1 TB cloud storage + auto-backup to Dropbox / Google Drive (Premium).
  3. Weather + flight info auto-injected into timeline entries (Premium).
  4. 600 stickers + multiple book finishes (matte/glossy/satin, hard/soft/layflat).
  5. Sustainability angle: "Plant a tree for every order" (Plant-for-the-Planet partnership).
- **UX patterns:**
  - Diary/timeline-first; planning is secondary.
  - Photo-book funnel is heavy (the diary exists to sell the book).
  - 10M+ users, 4.5★ Trustpilot.
- **Gaps:**
  - No flight/document logistics layer.
  - No expense tracking.
  - No real-time couple collaboration.
  - Heavy upsell pressure toward physical product.
- **Target:** Memory-keepers, casual photo-savers, wedding/family/travel album makers ([Journi blog](https://www.journiapp.com/blog)).

---

## 5. Airbnb Trips

- **URL:** https://www.airbnb.com/trips (direct fetch returned 403; data triangulated from Airbnb Help + Sunset Magazine).
- **Pricing:** **Free**, included with any Airbnb booking. ([Airbnb Help](https://www.airbnb.com/help/article/2672), [Sunset Magazine on new group features](https://sunset.com/travel/airbnb-group-trip-features))
- **Top 5 distinctive features:**
  1. Auto-itinerary from your Airbnb bookings (reservation + check-in + Wi-Fi password all there).
  2. **Digital postcards** to invite co-travelers — embeds reservation details automatically.
  3. Group-trip planning surface (Airbnb says >80% of bookings are groups).
  4. Downloadable PDF itinerary (useful for visa applications).
  5. Native integration with Airbnb Experiences (bookable activities inline).
- **UX patterns:**
  - Trips is a **secondary surface inside the booking app** — not a standalone planner.
  - Strong on the *day-of* and *during stay* moments (check-in instructions, host messaging) rather than pre-planning.
- **Gaps:**
  - Only useful if you booked on Airbnb. Flights, non-Airbnb hotels, third-party tours not represented.
  - No photo/diary feature.
  - No expense tracking.
  - No multi-source itinerary.
- **Target:** Airbnb users, increasingly group-travel oriented (recent product updates focus there).

---

## 6. Roadtrippers

- **URL:** https://roadtrippers.com
- **Pricing (annual only; no monthly):**
  - Free: $0 — 1 saved trip, 3 stops max.
  - **Basic: $35.99/yr** — 3 trips, 20 stops.
  - **Pro: $49.99/yr** — 5 trips, 50 stops, collaboration, navigation.
  - **Premium: $59.99/yr** — unlimited trips, 150 stops, RV GPS, offline maps. ([Roadtrippers pricing](https://roadtrippers.com))
- **Top 5 distinctive features:**
  1. "Autopilot™" AI itinerary built on 42M real trips of data.
  2. 5M curated points-of-interest (kitsch, scenic, food).
  3. RV-specific routing (height/weight restrictions, overnight parking).
  4. Native turn-by-turn navigation inside the planning app (Pro+).
  5. Offline maps (Premium).
- **UX patterns:**
  - Map-first, **stop-based** mental model (not day-based).
  - 4 tiers — most aggressive tiering of any competitor in this set.
  - Heavy POI discovery feed; brand voice is "Americana road trip."
- **Gaps:**
  - North-America-centric (limited international depth).
  - No photo/diary layer.
  - No expense tracking.
  - Couples not the obvious target — leans family + RV.
- **Target:** US road-trippers and RV enthusiasts; group/family travel.

---

## 7. PackPoint

- **URL:** https://packpnt.com
- **Pricing:**
  - Free with ads.
  - **PackPoint Premium: ~$2.99 USD one-time purchase** (no subscription). ([App Store listing](https://apps.apple.com/us/app/packpoint-premium-packing-list/id953333522), [Travel Checklist breakdown](https://www.travelchecklist.app/how-much-does-the-packpoint-app-cost/))
- **Top 5 distinctive features:**
  1. Auto-generates a packing list from destination + duration + activities + live weather.
  2. **TripIt sync** (pulls in upcoming trips) — Premium.
  3. Custom activities/items — Premium.
  4. Shareable packing lists with travel companions — Premium.
  5. >2M lists generated per year; coverage on CNN/Forbes/WaPo.
- **UX patterns:**
  - Single-purpose utility, opens straight into "new trip" wizard.
  - Activity-driven (pick "running," "snorkeling" → adds items).
- **Gaps:**
  - Single-purpose by design — no itinerary, photos, docs, money.
  - No couple/shared luggage logic ("who packs what").
  - Weather data quality varies by destination.
- **Target:** "Serious travel pros" / frequent flyers who care about gear ([Packpnt.com](https://packpnt.com)).

---

## 8. Splitwise

- **URL:** https://www.splitwise.com
- **Pricing (2025/2026):**
  - Free with daily expense-add caps and ads.
  - **Splitwise Pro: $2.99/month OR ~$29–$40/year** (varies by region — $29/yr is the most-cited US price, $40/yr appears in some markets). ([Splitwise Pro](https://www.splitwise.com/pro), [SplitterUp math](https://www.splitterup.app/blog/splitwise-pro-worth-it))
- **Top 5 distinctive features:**
  1. Debt simplification across groups (minimum-transfer algorithm).
  2. 100+ currency support with live conversion (Pro).
  3. **Receipt scanning + line-item splitting** (Pro).
  4. Recurring expenses + offline mode with cloud sync.
  5. Card/transaction import (US only, Pro).
- **UX patterns:**
  - Group-first (not trip-first) — works equally well for housemates.
  - "You owe / you are owed" headline number on every screen.
  - Pro gates have become aggressive in 2024–2026 (daily expense limit on free).
- **Gaps:**
  - Standalone finance — no link to flights, hotels, itinerary, photos.
  - Not specifically designed for **a trip arc** (pre-trip budget → in-trip spend → post-trip settlement).
  - No "budget planning" before the trip — only after-the-fact recording.
- **Target:** Roommates, friend groups, families, travel companions. Generalist, not travel-specific ([Splitwise homepage](https://www.splitwise.com)).

---

## Comparative Feature Matrix

Key: ✅ first-class · 🟡 partial / weak / paid-only · ❌ absent · 💰 Pro-gated

| Feature              | TripIt | Wanderlog | Polarsteps | Journi | Airbnb Trips | Roadtrippers | PackPoint | Splitwise | **Gustrips (target)** |
| -------------------- | :----: | :-------: | :--------: | :----: | :----------: | :----------: | :-------: | :-------: | :-------------------: |
| Flight tracking      |   ✅💰  |    🟡     |     ❌     |   🟡   |      ❌      |      ❌      |    ❌     |    ❌     |          ✅           |
| Document storage     |  🟡💰  |    🟡     |     ❌     |   ❌   |      🟡      |      ❌      |    ❌     |    ❌     |          ✅           |
| Photos / diary       |   ❌   |    ❌     |     ✅     |   ✅   |      ❌      |      ❌      |    ❌     |    ❌     |          ✅           |
| Expenses / budget    |   ❌   |    🟡     |     ❌     |   ❌   |      ❌      |      ❌      |    ❌     |    ✅     |          ✅           |
| AI assistance        |  🟡💰  |    💰     |     🟡     |   ✅   |      ❌      |      ✅      |    🟡     |    ❌     |          ✅           |
| Map (multi-stop)     |   ❌   |    ✅     |     ✅     |   🟡   |      ❌      |      ✅      |    ❌     |    ❌     |          ✅           |
| Share / collaborate  |   🟡   |    ✅     |     ✅     |   🟡   |      ✅      |    ✅💰      |    💰     |    ✅     |          ✅           |
| Offline              |   🟡   |    💰     |     ✅     |   💰   |      🟡      |    ✅💰      |    🟡     |    🟡     |          ✅           |
| Packing list         |   ❌   |    ✅     |     ❌     |   ❌   |      ❌      |      ❌      |    ✅     |    ❌     |          🟡           |
| Couple-first design  |   ❌   |    ❌     |     ❌     |   ❌   |      ❌      |      ❌      |    ❌     |    ❌     |          ✅           |
| Physical book output |   ❌   |    ❌     |     ✅     |   ✅   |      ❌      |      ❌      |    ❌     |    ❌     |        (opt-in?)      |

**Read:** No competitor covers logistical + emotional + financial in one product. Polarsteps + Journi own *emotional*; TripIt + Wanderlog own *logistical*; Splitwise owns *financial*. The middle is empty.

---

## Gap Analysis — 5 Opportunities for Gustrips

### 1. The "Couple Mode" — none of the 8 competitors are built for two people
All the planners are either solo (TripIt) or group-generic (Wanderlog, Airbnb, Splitwise). A couple has very specific needs no one is serving: **shared but private** photo album, joint budget with optional individual sub-budgets, "who has the passport copy / boarding passes" role assignment, anniversary/honeymoon framing. This is *brand positioning + product behavior* combined — and it's wide open.

### 2. The trifecta in one screen — kill the tab-switching tax
Today a couple uses **TripIt for flights + Polarsteps for photos + Splitwise for money** and pays three subscriptions. Gustrips collapses that into one daily-driver. The "without one tab eating the others" thesis maps to a **trip-day timeline** where each day shows logistics on top, photos in the middle, spend on the bottom — none of the competitors do this stacked view.

### 3. Pre-trip budget vs. in-trip spend reconciliation
Splitwise only records *after* the fact. Wanderlog has utilitarian splitting. Nobody has a real **"planned vs. actual"** budget arc that a couple sets up before the trip and then checks against in-trip. This is a CFO-style move that fits 25–45 professional couples perfectly.

### 4. Document vault as a real feature, not a Pro upsell
TripIt locks document storage behind Pro and caps it. Polarsteps and Journi don't do it at all. A premium app for 25–45 couples can make **passport + visa + insurance + vaccination + booking PDFs** a free, beautiful, OCR-searchable vault — and quietly become indispensable.

### 5. Memory output that isn't a $40+ printed book
Journi/Polarsteps monetize via physical books (€36–€150). That's a one-time purchase that requires a long trip to justify. Gustrips can ship a **digital "trip recap" shareable artifact** (web link + PDF + Reels-style video) for free as part of subscription, with optional print upsell. This widens the "worth-it" trigger from once-a-year-big-trip to every-weekend-getaway.

---

## Pricing Recommendation

### Anchors (annual, for context)

| App | Annual | Notes |
| --- | --- | --- |
| TripIt Pro | $49 | logistics only, business-traveler skew |
| Wanderlog Pro | $40 | planning only |
| Roadtrippers Premium | $60 | top tier, road-trip only |
| Splitwise Pro | $29–$40 | finance only |
| Journi Premium | ~$58 (€53.99) | diary + storage |
| Polarsteps | $0 (book upsell) | free app model |
| PackPoint Premium | $2.99 one-time | utility |

### Proposed Gustrips tiers

A 25–45 couple with disposable income looks at a $99/year price tag *for two people* and compares it to TripIt + Splitwise + Journi separately (~$130+/yr combined). That's the anchor.

**Recommended structure:**

- **Gustrips Free** — 1 active trip, basic itinerary, photos (capped, e.g. 200), basic expenses, 1 doc per category. *Goal: get the couple to add their next trip and feel the value.*
- **Gustrips Couple — $7.99 / month or $59 / year** (per couple, not per person).
  - Unlimited trips and photos, full doc vault with OCR, AI itinerary + AI photo recap, expense splitting + planned-vs-actual budget, offline mode, real-time flight alerts, shared/private layers per partner.
  - Positioned **below TripIt Pro alone** ($49) on apparent feature density but priced for two-person value.
- **Gustrips Couple+ — $99 / year** (optional)
  - Adds: priority support, one free annual digital trip-book + 20% off print, multi-currency advanced, integrations (Google Photos, Belvo/Plaid for spend auto-import).

### Rationale
- **$59/year for a couple** = $4.92/mo, lower friction than two separate $30–$50 subs.
- **No monthly under ~$8** — keeps revenue density healthy; couples plan in trip-cycles, not month-to-month.
- **Annual-only Pro is acceptable** — Wanderlog, Roadtrippers, and TripIt all do annual-only at this exact price band.
- **Free tier must include 1 full trip end-to-end** to prove the "no tab eats the others" thesis before paywall.
- **Avoid the Polarsteps "free app + print book" model** — it caps ARPU and the target couple is willing to pay for software directly.

---

## Top Independent Sources Cited

- TripIt: [Going.com 2026 review](https://www.going.com/guides/tripit-review), [Tineo blog](https://tineo.ai/blog/tripit-pro-vs-free-worth-it/), [TripIt Pro pricing page](https://www.tripit.com/web/pro/pricing)
- Wanderlog: [Wanderlog Pro page](https://wanderlog.com/pro), [Monkey Eating Mango 2026 cost breakdown](https://monkeyeatingmango.com/blog/wanderlog-pricing-2026/), [wandrly review](https://www.wandrly.app/reviews/wanderlog)
- Polarsteps: [Polarsteps homepage](https://www.polarsteps.com), [Help Center pricing](https://support.polarsteps.com/hc/en-us/sections/23760163148818-Pricing-payment-options), [Pilot Plans review](https://www.pilotplans.com/blog/polarsteps-review), [Travel Book pricing](https://support.polarsteps.com/hc/en-us/articles/24003935464466-What-is-the-price-of-a-Travel-Book)
- Journi: [Pilot Plans Journi review](https://www.pilotplans.com/blog/journi-review), [App Store listing](https://apps.apple.com/us/app/journi-blog-travel-tracker/id884030844), [Journi homepage](https://journiapp.com)
- Airbnb Trips: [Airbnb Help](https://www.airbnb.com/help/article/2672), [Sunset Magazine on group trip features](https://sunset.com/travel/airbnb-group-trip-features)
- Roadtrippers: [Roadtrippers.com pricing tiers](https://roadtrippers.com)
- PackPoint: [App Store listing](https://apps.apple.com/us/app/packpoint-premium-packing-list/id953333522), [Travel Checklist 2026 guide](https://www.travelchecklist.app/how-much-does-the-packpoint-app-cost/), [packpnt.com](https://packpnt.com)
- Splitwise: [Splitwise Pro page](https://www.splitwise.com/pro), [SaaSworthy 2025 pricing](https://www.saasworthy.com/product/splitwise/pricing), [SplitterUp math](https://www.splitterup.app/blog/splitwise-pro-worth-it)
