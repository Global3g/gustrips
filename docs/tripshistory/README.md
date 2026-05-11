# Tripshistory

Módulo de reconstrucción colaborativa de viajes a partir de fotos.

## Qué es

Tripshistory toma fotos de un viaje (pasado o futuro), las analiza, agrupa por día/evento, y guía al usuario por un wizard conversacional para llenar huecos: "¿Dónde estaban esa tarde?", "¿Qué fue esta cena?", "Detecté un cambio de ciudad, ¿cómo se movieron?". El resultado es un storyboard navegable que vive dentro del viaje.

## Principios de arquitectura

1. **Cliente y motor desacoplados**. El cliente habla con el motor solo por HTTP/JSON, aunque hoy vivan en el mismo monorepo. Mañana se puede sacar a su propio servicio sin reescribir.
2. **Fotos pesadas nunca en Firestore**. Las fotos viven en Firebase Storage; Firestore guarda solo metadata y referencias.
3. **Subcolección, no array**. Las fotos de la historia viven en `/trips/{tripId}/story/{storyId}/photos/{photoId}` — escala sin pegar contra el límite de 1MB por doc.
4. **Análisis perezoso e idempotente**. Re-analizar una historia no debe duplicar datos ni costar más de lo necesario.
5. **Privacidad por defecto**. EXIF/GPS solo se extrae si el usuario lo autoriza. Datos viven en el proyecto del usuario.

## Estructura del módulo

```
/docs/tripshistory/
  README.md               # Este archivo
  api.yaml                # OpenAPI 3.1 spec — fuente de verdad

/functions/tripshistory/  # Motor (Firebase Functions, TS)
  src/
    routes/               # Endpoints HTTP
    services/             # Lógica de análisis, preguntas, storyboard
    models/               # Tipos compartidos con cliente
  package.json

/src/features/tripshistory/   # Cliente (Next.js Client Components)
  api/                    # Cliente HTTP dedicado
  components/             # UI específica del módulo
  hooks/                  # useStory, useQuestions, etc.
  types/                  # Generados desde api.yaml
```

## Flujo de usuario (MVP)

### Caso A — Reconstruir viaje pasado desde fotos

1. Usuario abre `/trips/new` y elige "Reconstruir desde fotos"
2. Selecciona fotos (PhotoKit en iOS, file picker en web)
3. Cliente extrae metadata local (fecha, GPS si existe, dimensiones, hash perceptual)
4. Cliente sube metadata + thumbnails al motor (`POST /stories/{id}/photos:batch`)
5. Motor analiza: agrupa por día, detecta clusters temporales, GPS, duplicados
6. Cliente pide la siguiente pregunta (`GET /stories/{id}/questions/next`)
7. Usuario contesta (`POST /stories/{id}/questions/{qid}/answer`)
8. Loop 6-7 hasta que motor diga "ya no tengo preguntas"
9. Cliente muestra storyboard final (`GET /stories/{id}/storyboard`)
10. Usuario puede convertir la historia a un Trip de GusTrips si arrancó desde fotos sueltas

### Caso B — Enriquecer viaje existente

Igual que A, pero el cliente crea la historia atada a un `tripId` existente, y el motor usa el itinerario y eventos del trip como contexto para hacer mejores preguntas y agrupaciones.

## Estados de una historia

```
draft → analyzing → questioning → ready → finalized
   │         │           │           │         │
   │         │           │           │         └── usuario terminó, storyboard inmutable
   │         │           │           └── todas las preguntas contestadas, sin más por hacer
   │         │           └── motor tiene preguntas pendientes, usuario contestando
   │         └── motor procesando fotos batch
   └── recién creada, esperando fotos
```

## Decisiones pendientes

- [ ] ¿Motor en Node (Firebase Functions) o Python (FastAPI separado, junto al de vuelos)? — Recomendación: Node por consistencia y latencia
- [ ] ¿IA para detectar escenas (comida, monumento, playa) en MVP o v2? — Recomendación: v2
- [ ] ¿Permitimos historia con cero fotos (solo preguntas)? — Recomendación: no, mínimo 10 fotos
- [ ] ¿Cómo manejamos fotos sin metadata (WhatsApp, screenshots)? — Las preguntas las recuperan
