# Visual References — Premium Travel App 2026

> Investigación visual para gustrips. Target: parejas 25–45.
> Concepto: logístico + emocional + financiero.
> Fecha: mayo 2026.

Notas de método: hex codes y nombres de fuente verificados se marcan sin sufijo. Cuando no pude confirmar visualmente desde screenshot/site oficial, lo marco `(estimado)` o `(buscar confirmación)`.

---

## 1. Referencias estudiadas

### 1.1 Polarsteps (Summer 2025 release)
- **Qué es**: app de tracking + journaling de viaje. Top 3 Travel App en App Store 2026. App of the Day 2025.
- **Layout patterns únicos**:
  - **Map-first**: el mapa interactivo es la columna vertebral. Cada "step" es un punto geolocalizado con foto + nota.
  - **Step page rediseñado 2025**: fotos a tamaño hero (full-bleed), tipografía secundaria pequeña, mucho aire.
  - **Trip Reels**: convierte el viaje en un reel cinemático automáticamente (videos + fotos + ruta).
  - **AI Itineraries** (powered by Claude): combina historial del usuario + contenido editorial humano.
- **Paleta** *(buscar confirmación visual directa)*: dominante blanco + gris claro, acentos cálidos en mapa (rutas naranjas/coral, estimado).
- **Tipografía**: sans-serif geométrica neutra (buscar confirmación).
- **Microinteractions**: pinch-to-zoom en fotos, tap-to-fullscreen, swipe entre días.
- **Robar para gustrips**: el patrón "mapa como narrador del viaje" + el reel automático como objeto emocional al final del trip.

### 1.2 Day One (Bloom Built / Automattic)
- **Qué es**: app de journaling. Award-winning design. Cross-platform.
- **Layout patterns únicos**:
  - **Calendar view** con preview visual de cada entry (foto pequeña embebida en el cuadradito del día).
  - **On This Day**: surface algorítmico de memorias del pasado.
  - **Map view**: "take a trip through all your trips" — vista global de todos los lugares donde escribiste.
  - **Media tab**: grid limpio tipo Apple Photos pero filtrado por entries.
  - **Printed books**: extiende lo digital al objeto físico (libro impreso de tus entries).
- **Paleta** *(buscar confirmación)*: blanco/off-white base, acentos de color por journal (cada journal tiene un color).
- **Tipografía**: serif para body (lectura larga), sans para UI chrome.
- **Robar para gustrips**: el patrón **"On This Day"** aplicado a aniversarios del viaje (1 año desde Roma, etc.) + el calendar-with-preview + la idea de imprimir el viaje como libro.

### 1.3 Tripsy (iOS / iPad / Apple Watch)
- **Qué es**: trip planner premium del Apple ecosystem. Diseñado por Thiago Sanchez.
- **Layout patterns únicos**:
  - **Modal cards** muy bien implementados — feels native, como Apple Maps/Shortcuts.
  - **Activity icons** coloridos por categoría (reminiscent de Apple Maps pins).
  - **Dark mode + light mode** ambos pulidos.
  - **Apple Watch complications** + Smart Stack — el viaje vive en tu muñeca el día del viaje.
- **Paleta**: sigue tokens del sistema iOS (system grays + accent colors por categoría).
- **Tipografía**: SF Pro (sistema iOS).
- **Robar para gustrips**: el patrón de **modal cards nativas** y los **icons coloridos por tipo de actividad** (vuelo, hotel, restaurante, museo). Idea Apple Watch para el día activo del viaje.

### 1.4 Kinfolk Magazine (redesign 2021, Schick Toikka × Alex Hunting Studio)
- **Qué es**: revista premium de lifestyle/slow living. Tono editorial calmo.
- **Layout patterns únicos**:
  - Custom typeface family de **6 estilos** (serif + sans counterpart con italics) compartiendo dimensiones verticales — mezclables sin friccionar.
  - **Text style** (cuerpo + captions) vs **Display style** (más contraste, peso más liviano para gran tamaño).
  - 12-column grid → flexibilidad para variar el ritmo página a página.
- **Paleta histórica** *(iteraciones tempranas)*: negro + rojo + **mushroom grey** (un gris cálido beige). El redesign 2021 no documenta hex codes públicamente.
- **Tipografía**: custom Schick Toikka × Kinfolk (no comercial). Alternativas accesibles: **GT Sectra** (display) + **Söhne** o **Aeonik** (sans).
- **Robar para gustrips**: la lógica de **2 fuentes que comparten métricas y se mezclan** + el ratio editorial alto de espacio blanco vs contenido.

### 1.5 Cereal Magazine (versión digital)
- **Qué es**: revista de travel + design británica. Referencia oro para travel premium minimal.
- **Layout patterns únicos**:
  - Solo **2 tipografías**: serif + sans-serif, cada una en **un solo peso y un solo tamaño**.
  - Jerarquía vía **MAYÚSCULAS, small caps, italics** — no vía cambio de tamaño.
  - **Page breakers Morning / Afternoon / Evening** — paso del tiempo como estructura editorial.
  - Cromática separada por sección horaria (mañana / tarde / noche).
  - "Moments of Harmony" — densidad gráfica baja, mucho blanco.
- **Tipografía**: Garamond (serif) + Gill Sans (sans-serif). Body serif ~8.5pt, captions sans ~6pt en print.
- **Paleta**: blanco base extremo + un acento cromático por sección (no hex codes públicos — estimado: arena, azul polvoriento, lavanda/violeta tenue).
- **Robar para gustrips**: el patrón **Morning / Afternoon / Evening** como organización de un día de viaje (en vez de timeline hora por hora). La regla de "un peso, un tamaño, jerarquía vía estilo".

### 1.6 Airbnb (2025–2026 redesign)
- **Qué es**: el benchmark masivo. Brian Chesky relanzó design system en 2025.
- **Layout patterns únicos**:
  - **Search bar pill-shaped** completamente redondeada.
  - **Property cards** con border-radius ~14px.
  - **Buttons** con border-radius 8px.
  - Soft shape language en todos los componentes.
- **Paleta** (verificada):
  - Radical Red `#FF385C` (brand primary)
  - Mine Shaft `#222222` (texto primario)
  - White `#FFFFFF`
  - Luxe purple `#460479` (solo sub-brand Luxe)
  - Plus magenta `#92174D` (solo sub-brand Plus)
- **Tipografía**: **Airbnb Cereal VF** (variable font, custom) en todo — display, body, nav, captions. Display 22–28px peso 500–600.
- **Robar para gustrips**: el **system color minimal** (1 hero + 1 dark + blanco) y el **pill-search**. Tipografía única variable para todo (menos cognitive load).

### 1.7 TripMemo / LoveMap / Between (couples apps)
- **Qué es**: nicho competitivo directo de gustrips.
- **Layout patterns únicos**:
  - **TripBook compartido** en tiempo real — ambos partners suman fotos/notas al mismo objeto simultáneamente, aparecen live.
  - **LoveMap**: mapa de relación con pins de ciudades visitadas juntos.
  - **Between**: timeline privado de fotos + chat + calendar compartido.
  - **Couple Joy**: autocomplete de location/date desde metadata EXIF de fotos.
  - **Happyfeed**: widget de home screen "Shared Memories" — últimas 7 memorias.
- **Robar para gustrips**: el patrón de **EXIF autocomplete** (ahorra fricción) + **widget de iOS home screen** con la próxima parada del viaje o "On This Day" + **realtime co-edit** del trip plan.

### 1.8 Hedwig (Curated Travel, Readymag) — Awwwards Honorable Mention abril 2026
- **Qué es**: web de travel curated, premiado en Awwwards 2026.
- **Detalle**: no pude extraer paleta/typography concreta del crawl (sitio bloquea WebFetch). **Buscar confirmación abriendo el sitio**.
- **Robar para gustrips**: revisar visual del sitio en sesión humana, es la referencia 2026 más fresca.

### 1.9 Apple Photos — Memories + Liquid Glass (iOS 26)
- **Qué es**: la baseline de Apple para memorias visuales.
- **Layout patterns únicos**:
  - **Liquid Glass headings/buttons** — se mezclan naturalmente con la foto detrás, adaptan contraste.
  - **Memories auto-generated**: combina fotos+videos+música.
  - **For You tab** como surface algorítmico de memorias.
- **Robar para gustrips**: si el equipo va iOS-first, usar **Liquid Glass** como lenguaje de superficie por encima de fotos del viaje. Memory cards generados automáticamente al cerrar el trip.

---

## 2. Mood board verbal — 5 patterns visuales clave

1. **Foto full-bleed como protagonista**, UI chrome reducida al mínimo (Polarsteps + Apple Photos). La foto no es ilustración: es el contenido.
2. **Map-as-narrative**: el mapa cuenta el viaje, no es un sidebar (Polarsteps + LoveMap). Cada parada es un punto vivo, tappable, con su micro-historia.
3. **Editorial pacing**: ratio alto blanco/contenido, jerarquía via estilo (italics, small caps, weight) más que via size jump (Kinfolk + Cereal). El viaje se siente como una revista, no como una hoja de cálculo.
4. **Modal cards nativas + iconografía categórica colorida** (Tripsy + Apple Maps). Cada tipo de actividad — vuelo, hotel, food, museo, naturaleza, transporte — tiene su color/icon consistente.
5. **Memorias temporales en surface**: On This Day, anniversaries, "1 año desde Roma", widget de iOS home screen (Day One + Happyfeed + Apple Photos). La app sigue dando valor emocional después del viaje.

---

## 3. Sistema de tipografía recomendado

Recomendación de 3 fuentes (display editorial + body workhorse + UI/numeric).

### Display / Headlines / Trip names
**GT Sectra Display** (Grilli Type) — serif con personalidad calligraphic + scalpel-sharp. Probada en revistas editoriales premium. Alternativas si presupuesto: **Editorial New** (Pangram Pangram) o **Canela** (Commercial Type).
Uso: nombres del trip ("Roma · noviembre 2026"), hero titles, quotes editoriales dentro de memorias.

### Body / Reading / Notes
**Söhne** (Klim Type Foundry) — grotesque contemporáneo, warm, excelente legibilidad. Alternativa: **Aeonik** (CoType) por su mecánica + warmth.
Uso: cuerpo de notas, descripciones, body de itinerario, captions de fotos.

### UI Chrome / Numeric / Tabular
**Inter** (Rasmus Andersson, open source) o **SF Pro** (si iOS-only) — para precios, fechas, distancias, datos financieros del trip. Tabular figures activos por default para que los $ se alineen.
Uso: presupuesto, balances, fechas, contadores de días, tabs y nav.

**Reglas de jerarquía** (de Cereal):
- Idealmente, solo 2–3 tamaños totales en toda la app.
- Subir importancia con MAYÚSCULAS o italics, no agrandando font-size.
- Mezclar serif + sans solo si comparten métricas verticales.

---

## 4. Tres paletas recomendadas por fase del viaje

> Las paletas siguen la lógica de **warm minimalism 2026** (oat white, beige, milk tea, terracotta, warm gray, sage green) cruzada con la separación cromática Morning/Afternoon/Evening de Cereal.

### Paleta A — "Planning Mode" (antes del viaje) → Anticipación, calma, soñar despierto
| Token | Hex | Uso |
|---|---|---|
| Bone White | `#F7F4EE` | Fondo principal |
| Warm Ink | `#1F1B16` | Texto primario |
| Dust Lavender | `#C9C2D6` *(estimado, ajustar en pruebas)* | Acento — futuro, sueño |
| Sage Quiet | `#A8B5A0` *(estimado)* | Confirmaciones / "reserved" |
| Soft Sand | `#E8DFD0` | Cards / superficies elevadas |

Mood: amanecer suave. Tipografía display GT Sectra en italics para títulos del viaje aún sin confirmar.

### Paleta B — "Active Mode" (durante el viaje) → Energía, claridad, navegable bajo sol fuerte
| Token | Hex | Uso |
|---|---|---|
| Paper | `#FFFFFF` | Fondo (máxima legibilidad outdoor) |
| Asphalt | `#111111` | Texto primario, alto contraste |
| Terracotta Live | `#C85A3C` *(estimado, calibrar accesibilidad)* | CTA principal, "siguiente parada" |
| Map Cobalt | `#2A4A7F` *(estimado)* | Rutas en mapa, transporte |
| Forest | `#2F5D3A` *(estimado)* | Naturaleza / outdoor / hiking |
| Cream | `#FAF6EE` | Cards sobre mapa |

Mood: mediodía. Contraste alto para uso al sol. CTA terracotta funciona como pin de Apple Maps en tono más cálido.

### Paleta C — "Memories Mode" (después del viaje) → Nostalgia, calidez, sepia editorial
| Token | Hex | Uso |
|---|---|---|
| Aged Paper | `#F2EBDD` | Fondo cálido |
| Espresso | `#2B1F17` | Texto primario warm-black |
| Rose Dust | `#D4A89A` *(estimado)* | Acentos sentimentales, anniversaries |
| Olive Velvet | `#6B6A3E` *(estimado)* | Tags, secciones |
| Muted Gold | `#B89968` *(estimado)* | "On This Day" badges, hitos |

Mood: golden hour, foto Polaroid descolorida. Hace que las memorias se sientan ya antiguas, valiosas, "Wabi Sabi Nomad".

> **Importante**: los hex marcados estimado los derivé del lenguaje verbal (oat white / terracotta / sage) pero no los confirmé en screenshots. Antes de tokenizar, hacer pruebas de contraste WCAG AA y mostrar en pantalla outdoor.

---

## 5. Top 5 referencias — links que vos como humano deberías abrir

1. **Polarsteps Summer 2025 announcement** — la referencia más cercana al concepto gustrips (map-first + memorias + AI). [news.polarsteps.com/news/polarsteps-summer-2025-release-is-here](https://news.polarsteps.com/news/polarsteps-summer-2025-release-is-here)
2. **Day One features page** — patrón de On This Day + calendar preview + printed books. [dayoneapp.com/features](https://dayoneapp.com/features/)
3. **Hedwig Curated Travel** (Awwwards 2026 winner abril) — fresh visual benchmark, requiere abrir el sitio en navegador. [hedwigtravel.com](https://www.hedwigtravel.com/)
4. **Kinfolk redesign por Alex Hunting Studio + Schick Toikka** — sistema tipográfico editorial transferible. [alexhunting.studio/blogs/projects/kinfolk](https://alexhunting.studio/blogs/projects/kinfolk)
5. **Tripsy review en MacStories** — cómo se ve un travel planner premium iOS-native (modal cards, watchOS, icons). [macstories.net/reviews/tripsy-review-the-ultimate-trip-planner-for-iphone-and-ipad](https://www.macstories.net/reviews/tripsy-review-the-ultimate-trip-planner-for-iphone-and-ipad/)

### Bonus references útiles
- **Awwwards travel/tourism category** — pool actualizado mensual: [awwwards.com/websites/travel-tourism](https://www.awwwards.com/websites/travel-tourism/)
- **Mobbin travel category** — screenshots reales de apps en producción: [mobbin.com/explore/mobile/app-categories/travel-transportation](https://mobbin.com/explore/mobile/app-categories/travel-transportation)
- **Cereal Magazine digital case study** (Guillem Moix): [medium.com/@guillem_moix/cereal-magazine-turning-print-into-digital](https://medium.com/@guillem_moix/cereal-magazine-turning-print-into-digital-ux-ui-case-study-84c77dc90289)
- **Airbnb 2025 design system** (color tokens verificables): [mobbin.com/colors/brand/airbnb](https://mobbin.com/colors/brand/airbnb)
- **Creative Boom — Top 50 fonts 2026**: [creativeboom.com/resources/top-50-fonts-in-2026](https://www.creativeboom.com/resources/top-50-fonts-in-2026/)

---

## 6. Síntesis aplicable a gustrips

- **Estructura emocional del producto**: el viaje tiene 3 fases con tonos distintos (Planning / Active / Memories). Cada fase debería **literalmente cambiar la paleta** y los acentos tipográficos. Es la diferencia entre una app utilitaria y una que se siente como una experiencia.
- **Map-first + editorial pacing**: combinar Polarsteps (mapa narrador) con Kinfolk/Cereal (densidad gráfica baja, jerarquía via estilo). El balance lo logístico+emocional se resuelve dándole al mapa el rol narrativo y al texto el rol contemplativo.
- **El componente financiero** no debería romper la calma. Tabular numerics + un color de sistema neutral (no rojo de alerta, no verde gamificado). El budget vive en la misma estética calma que el resto.
- **Couples-first**: realtime co-edit (TripMemo), EXIF autocomplete, widget compartido, anniversaries automáticos. Lo "para parejas" no es color rosa, es **superficies compartidas vivas**.

---

*Generado mayo 2026. Revisar paletas estimadas con screenshots reales antes de tokenizar en design system.*
