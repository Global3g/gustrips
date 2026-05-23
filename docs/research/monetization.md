# Gustrips · Investigación de Monetización 2025-2026

> **Target**: parejas viajeras 25-45 con buena disposición a pagar.
> **Fecha**: 2026-05-22
> **Fuentes**: páginas oficiales de competidores + RevenueCat State of Subscription Apps 2026 + Business of Apps 2026.

---

## 1. Pricing concreto de los 5 competidores top

### 1.1 TripIt / TripIt Pro

| Tier | Precio | Notas |
|---|---|---|
| Free | $0 | Itinerarios automáticos vía email forward a `plans@tripit.com` |
| Pro (anual) | **$49 / año USD** | 30 días free trial |

- Fuente: <https://www.tripit.com/web/pro/pricing> (verificado 2026)
- Reviews: <https://www.going.com/guides/tripit-review>, <https://insidea.com/spotlight/listing/tripit/>

**Free incluye**: parsing de emails, itinerario centralizado, sync básico (Calendar), hasta 3 documentos por viaje.

**Pro encierra detrás del paywall**:
- Real-time flight alerts (gate changes, delays, cancellations)
- Alternate flight finder cuando hay cancelación
- Seat tracker (avisa cuando se libera mejor asiento)
- Fare refund alerts (cuando baja el precio del ticket comprado)
- Points & miles tracker unificado
- Neighborhood safety scores cerca del hotel
- Hasta 25 documentos por viaje (vs 3 en free)

---

### 1.2 Wanderlog Pro

| Tier | Precio | Notas |
|---|---|---|
| Free | $0 | Planificación manual completa |
| Pro (mensual) | **$17 / mes USD** | Equivalente a $204/año (anchoring para empujar al anual) |
| Pro (anual) | **$39.99 / año USD** (~$3.33/mes equivalente) | Plan dominante |

- Fuente: <https://wanderlog.com/pro>, <https://monkeyeatingmango.com/blog/wanderlog-pricing-2026/>
- Promo codes disponibles -20% en SimplyCodes (mayo 2026): <https://simplycodes.com/store/wanderlog.com>

**Free incluye**: planning manual, mapa, route optimization básica, colaboración multiusuario, itinerarios de comunidad.

**Pro encierra detrás del paywall**:
- Offline access (mapas + itinerario sin internet)
- Export a PDF
- Dark mode
- Sin ads
- Gmail scanner (auto-import vuelos/hoteles)
- AI suggestions + route optimization avanzada (reordenar día por eficiencia)

> **Observación clave**: el offline access es el feature #1 mencionado por usuarios como justificación del paywall para viajes internacionales.

---

### 1.3 Polarsteps

| Tier | Precio | Notas |
|---|---|---|
| App | **$0 (100% gratis)** | Sin tier premium en la app |
| Travel Book físico | **€36 – €150 EUR** | One-time purchase, 24 páginas mínimo |

- Fuente: <https://support.polarsteps.com/hc/en-us/articles/24003935464466-What-is-the-price-of-a-Travel-Book>
- Review: <https://mattsnextsteps.com/polarsteps-review-is-polarsteps-the-best-travel-tracking-app/>

**Modelo**: el app es 100% gratis. Monetiza 100% vía venta de libros impresos premium (modelo print-on-demand, márgenes altos). Lay-Flat Premium es el upsell más caro.

> **Lesson**: parejas viajeras compran libros físicos como regalo / recuerdo. Es un revenue stream paralelo al SaaS que vale la pena explorar para gustrips.

---

### 1.4 Journi Blog (Journi PLUS)

| Tier | Precio | Notas |
|---|---|---|
| Free | $0 | Diario básico + uploads en baja resolución |
| PLUS (mensual) | **€9.99 / mes** | |
| PLUS (6 meses) | **€43.99** | ~€7.33/mes equivalente |
| PLUS (anual) | **€53.99 / año** | ~€4.50/mes — mejor valor |

- Fuente: <https://www.pilotplans.com/blog/journi-review>, <https://www.journiapp.com/pricing/>
- Search context: pricing puede variar por país.

**PLUS encierra**:
- Fotos en alta resolución (hasta 16MP)
- 1TB de storage en cloud
- Backup automático a Dropbox / Google Drive
- Funcionalidad offline + sync multi-device
- 10% off en photo books (cross-sell con el negocio físico)

> **Modelo híbrido**: combinan suscripción + venta de libros físicos como Polarsteps. Doble revenue stream.

---

### 1.5 Roadtrippers Plus

| Tier | Precio | Notas |
|---|---|---|
| Free | $0 | Hasta 7 waypoints por trip |
| Plus (anual) | **$29.99 / año USD** | 7 días free trial; algunas fuentes listan $35.99 |

- Fuente: <https://roadtrippers.com/membership/>, <https://support.roadtrippers.com/hc/en-us/articles/360000831566>

**Plus encierra**:
- Hasta 150 waypoints (vs 7 en free)
- Trip collaboration con pareja/familia
- Offline maps
- Live traffic
- RV-specific routing
- AI Autopilot (sugerencias curadas en ruta)
- Member discounts en campsites / atracciones

> **Insight**: el límite duro de waypoints (7 vs 150) es uno de los paywalls más agresivos de la industria — y funciona porque cualquier trip real necesita >7 paradas.

---

## 2. Resumen comparativo de pricing

| App | Free | Premium $/año | Premium $/mes | Estrategia |
|---|---|---|---|---|
| TripIt | Sí | $49 | n/a | Solo anual; trial 30d |
| Wanderlog | Sí | **$39.99** | $17 (anchor) | Anchoring brutal |
| Polarsteps | Sí (todo) | $0 + libros físicos | $0 | Print monetization |
| Journi | Sí | ~$58 (€53.99) | ~$11 (€9.99) | 3 tiers (mes/6m/año) |
| Roadtrippers | Sí (limit duro) | $29.99 | n/a | Feature gating duro |

**Mediana del sector**: ~$40-50/año, ~$5-9/mes equivalente. RevenueCat 2026 reporta median anual de apps subscription en $38.42/año global, $12.99/mes — los travel apps están en el cluster medio.

Fuente: <https://www.revenuecat.com/state-of-subscription-apps/>

---

## 3. Métricas industria (RevenueCat State of Subscription Apps 2026 + Business of Apps)

### 3.1 Conversion Free → Paid

- **Travel apps**: trial → paid conversion **más alto** de todas las categorías (mejor que productivity, health, dating).
  - Fuente: <https://www.businessofapps.com/data/app-subscription-trial-benchmarks/>
- **Freemium general**: 1-5% conversion baseline; visitor→freemium 13.3%, freemium→paid 2.6%.
- **Travel con introductory offers**: 15-30% conversion en el premium segment (caso Skyscanner: +25% en registros al introducir free + premium).
  - Fuente: <https://moldstud.com/articles/p-freemium-models-in-travel-apps-success-stories-key-lessons-learned>
- **Hard paywall vs freemium**: hard paywall convierte 5x mejor (10.7% vs 2.1%) en short-term, pero retention a 1 año se empareja.

### 3.2 ARPU / Revenue

- **Travel apps median monthly revenue per active payer**: **$35** (RevenueCat 2026).
- **Travel apps top 10%**: $822 — la categoría más comprimida (Photo & Video llega a $3,600+).
- **Average annual revenue per download (Travel)**: $0.55 USD esperado en 2027 (Statista).
- **Subscription apps general ARPU**: $3-9/mes.
  - Fuente: <https://www.revenuecat.com/state-of-subscription-apps/>

### 3.3 Retention / Churn

- **Travel + Business apps**: median annual renewal rate **40%** (uno de los más altos del mercado).
- **Yearly plans**: top quartile retiene 60-75% año-2 (vs 10% en monthly).
- **65% del revenue en travel apps viene del plan anual** — el yearly domina la categoría.
- Day 1 retention general: 25.3%, Day 30: 5.7%.
  - Fuente: <https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category/>

### 3.4 Willingness to pay (App Annie)

- **66% de usuarios travel pagarían por**: offline access + exclusive discounts.
- **+20% conversion** con personalización + targeted promos.

---

## 4. Modelos alternativos que funcionan

### 4.1 One-time purchases (Polarsteps model)
- Libros impresos de viajes: €36-150, márgenes 40-60%.
- Print-on-demand de fotos premium, calendars (Journi: £19.99-24.99), polaroids retro.
- **Pro**: no requiere convencer al usuario de recurrencia. Compra emocional post-viaje.
- **Con**: requiere capacidad logística (proveedor de impresión + shipping).

### 4.2 Affiliate / Commission (modelo más escalable sin infra)

| Partner | Categoría | Comisión |
|---|---|---|
| **Airalo** | eSIM internacional | **10-15%** por venta · Impact platform |
| **Booking.com** | Hotel | **4%** alojamiento, 6% car rental, 4% atracciones, €2 por vuelo |
| **World Nomads** | Seguro de viaje | **$0.83 / quote** (tier base) · 60-day cookie |
| **SafetyWing** | Seguro nómadas/parejas | **10% recurrente** (70% de subs siguen pagando) · 364-day window |

Fuentes: <https://partners.airalo.com/solutions/affiliates>, <https://www.booking.com/affiliate-program/v2/index.html>, <https://partner.worldnomads.com/>, <https://safetywing.com/ambassador/signup>

> **Top pick para parejas**: SafetyWing tiene la mejor estructura de comisiones (10% recurrente) y el segmento parejas 25-45 calza con su buyer persona.

### 4.3 B2B / White-label
- Licenciar a agencias de viaje boutique para que sus clientes (parejas en luna de miel, etc.) tracken sus trips bajo branding propio.
- Pricing típico: $99-499/mes por agencia con N usuarios incluidos.
- Mercado: ~5,000 agencias boutique en LATAM + Iberia con interés en herramientas de retención.

### 4.4 Ad-supported (NO RECOMENDADO)
- Ads degradan UX en apps emocionales como travel logging.
- Polarsteps y TripIt no usan ads. Wanderlog usa pero los esconde detrás del paywall (incentivo a upgrade).

---

## 5. RECOMENDACIÓN: Pricing tier para Gustrips

### 5.1 Estructura sugerida

```
gustrips Free
├── Hasta 3 trips activos
├── 50 fotos por trip
├── 1 colaborador (la pareja core)
├── Itinerario manual + mapa
├── Sync básico cross-device
└── Watermark "made with gustrips" en exports

gustrips Couple (Premium)
├── Trips ilimitados
├── Fotos ilimitadas (alta resolución)
├── Colaboradores ilimitados (hasta 5)
├── Offline maps + offline itinerary
├── AI trip planner (sugerencias según historial)
├── Export PDF / shareable web link sin watermark
├── Backup automático a Drive/Dropbox
├── Travel book físico con 15% off
└── Sin ads, ever
```

### 5.2 Precios sugeridos (USD)

| Plan | Precio | Justificación |
|---|---|---|
| **Free** | $0 | Acquisition + viral loop (parejas invitan parejas) |
| **Couple Monthly** | **$6.99 / mes** | Anchor agresivo (vs Wanderlog $17). Mensual existe pero NO se promueve. |
| **Couple Annual** | **$39 / año** | Sweet spot: matchea Wanderlog ($39.99) y queda bajo TripIt ($49). ~$3.25/mes efectivo. |
| **Lifetime** (lanzamiento) | **$99 one-time** | Para first 1000 usuarios. Reduce CAC, da cash inicial. |

**Justificación del $39/año**:
- Está EXACTO en el sweet spot del mercado (Wanderlog $39.99, Roadtrippers $29.99, TripIt $49).
- Genera ARPU anual de ~$39 vs el median del sector ($35/mes payer activo, pero esto es por payer activo no por user).
- Permite ofrecer trial gratis 14 días sin perder demasiado margen.
- Conversion target realista: 4-7% free→paid (encima del baseline 2-5% por feature de parejas).

### 5.3 Trial strategy
- **14 días free trial del Premium** al onboarding (no 30d como TripIt — más urgencia).
- Activar trial automáticamente cuando el usuario crea su primer trip con pareja invitada (momento de máxima intención).
- Fuente: RevenueCat reporta travel apps con trial distribuido más allá de 9 días para evaluar.

---

## 6. Features: qué va dónde

### 6.1 Tres features que SOLO deben ser premium

1. **Offline maps + offline itinerario completo**
   - El 66% de usuarios travel diría YES a pagar por esto (App Annie).
   - Es el #1 reason en Wanderlog reviews para upgrade.
   - Mid-trip en roaming = momento perfecto de máxima friction → conversion.

2. **AI Trip Planner ("Plan a 7-day Italy honeymoon")**
   - 2026 es el año del AI feature gating (RevenueCat report: "AI ate everything").
   - Diferenciador clave vs apps viejos como TripIt.
   - Caro de operar (LLM tokens) — debe estar paywalled.

3. **Colaboración multi-pareja + viajes ilimitados**
   - Parejas que viajan con otra pareja (4 personas) son el upsell natural.
   - Limit duro de 3 trips activos en free fuerza upgrade en el viajero recurrente (target 25-45 viaja 3+ veces/año).

### 6.2 Tres features que SIEMPRE deben ser free (engagement / viral)

1. **Geo-tracking automático del viaje (mapa con ruta)**
   - Es el hook visual que hace que la app sea Instagram-able.
   - Polarsteps demuestra que esto se puede dar 100% gratis y aun así monetizar.
   - Genera el "wow moment" que retiene al usuario.

2. **Compartir el viaje vía link público (con watermark)**
   - El watermark hace marketing por nosotros — viral loop.
   - Sus amigos lo ven, lo descargan, repiten ciclo.
   - Quitar el watermark = upsell premium claro.

3. **Subir fotos al diario del viaje (baja resolución, limit razonable)**
   - Es el corazón emocional del producto. Cobrar por esto destruye el hook.
   - El UPSELL natural: alta resolución, ilimitado, backup automático.

---

## 7. Monetización secundaria: affiliates recomendados

Orden de prioridad para gustrips (target parejas 25-45):

### Tier 1 (integrar en MVP)

1. **Airalo eSIM** (10-15% comisión)
   - Trigger: cuando usuario crea trip internacional, banner contextual "Necesitás internet en X? Activá tu eSIM".
   - Comisión esperada: $2-5 por activación, conversion ~5% del flujo internacional.
   - ARPU adicional estimado: $1.50-3 por usuario activo/año.

2. **SafetyWing** (10% recurrente · mejor LTV)
   - Trigger: en onboarding del trip — "Asegurá a tu pareja por $X/semana".
   - Comisión recurrente mientras renuevan = revenue passive.
   - ARPU adicional estimado: $4-8 por usuario activo/año si conversion 3%.

### Tier 2 (post product-market fit)

3. **Booking.com** (4% accommodation)
   - Trigger: cuando usuario agrega "Hotel TBD" al itinerario.
   - Comisión: low % pero ticket alto (1 noche pareja ~$150 → $6 USD).
   - Requiere API integration.

4. **World Nomads** ($0.83-3 por quote tier-dependent)
   - Backup de SafetyWing si target tira más a "aventura" que a "nómada digital".

### NO integrar en MVP

- Vuelos (Skyscanner/Kayak): comisiones bajas (€2 fixed por flight Booking), no compensa la complejidad regulatoria.
- Apple Wallet pass distribution: no hay programa de monetización directo de Apple para pasajes que sea relevante para devs (boarding passes son funcionalidad, no revenue).

---

## 8. Proyección de revenue (Year 1)

**Asumiendo 10,000 usuarios free activos al final del año 1:**

| Fuente | Conversion / Rate | Usuarios | Revenue anual |
|---|---|---|---|
| Premium subscriptions | 5% conv. @ $39 | 500 | **$19,500** |
| Lifetime (first 1000) | 1000 vendidos @ $99 | 1,000 | **$99,000** (one-time) |
| Airalo eSIM affiliate | 8% trigger × $3 | 800 activaciones | **$2,400** |
| SafetyWing affiliate | 3% conv. × $25 recurring | 300 polizas | **$7,500** |
| Travel books (post-trip) | 2% conv. × $40 margen | 200 books | **$8,000** |
| **Total Year 1** | | | **~$136,400** |

Asumiendo growth y churn realistas, Year 2 sin lifetime sale: ~$60-90k recurring.

---

## 9. Conclusión

El sweet spot para gustrips es **$39/año + $6.99/mes**, free tier generoso con engagement features (geo-tracking, sharing), y paywall en offline + AI planner + colaboración ilimitada. Monetización secundaria vía SafetyWing (recurring affiliate) + Airalo (transactional affiliate) suma 30-50% sobre el revenue base. Travel books físicos como upsell emocional post-viaje (modelo Polarsteps/Journi) puede agregar 10-20% más a partir de Year 2.

El segmento de parejas 25-45 tiene la mejor combinación de la industria: trial→paid más alto + renewal anual del 40% (datos RevenueCat 2026). Es un mercado en el que se puede construir un negocio recurrente sano sin necesitar millones de usuarios.

---

## Anexo: Fuentes

- TripIt Pricing: <https://www.tripit.com/web/pro/pricing>
- Wanderlog Pro: <https://wanderlog.com/pro>
- Wanderlog Pricing Analysis 2026: <https://monkeyeatingmango.com/blog/wanderlog-pricing-2026/>
- Polarsteps Travel Book Pricing: <https://support.polarsteps.com/hc/en-us/articles/24003935464466-What-is-the-price-of-a-Travel-Book>
- Journi Review + Pricing: <https://www.pilotplans.com/blog/journi-review>
- Roadtrippers Membership: <https://roadtrippers.com/membership/>
- RevenueCat State of Subscription Apps 2026: <https://www.revenuecat.com/state-of-subscription-apps/>
- RevenueCat Renewal Rates by Category 2026: <https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category/>
- Business of Apps Travel Benchmarks 2026: <https://www.businessofapps.com/data/travel-app-benchmarks/>
- Business of Apps Trial Benchmarks 2026: <https://www.businessofapps.com/data/app-subscription-trial-benchmarks/>
- MoldStud Freemium Travel Apps: <https://moldstud.com/articles/p-freemium-models-in-travel-apps-success-stories-key-lessons-learned>
- Airalo Affiliate: <https://partners.airalo.com/solutions/affiliates>
- Booking.com Affiliate: <https://www.booking.com/affiliate-program/v2/index.html>
- World Nomads Partners: <https://partner.worldnomads.com/>
- SafetyWing Ambassador: <https://safetywing.com/ambassador/signup>
- Statista Travel Apps ARPU: <https://www.statista.com/forecasts/891478/arpu-in-the-online-travel-booking-market-worldwide>
