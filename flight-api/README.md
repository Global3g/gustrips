# GusTrips Flight API

API backend para búsqueda de vuelos usando Fli (Google Flights API).

## Instalación

1. Crear entorno virtual:
```bash
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

## Desarrollo

Iniciar servidor de desarrollo:
```bash
uvicorn main:app --reload --port 8000
```

O simplemente:
```bash
python main.py
```

La API estará disponible en:
- **Aplicación**: http://localhost:8000
- **Documentación interactiva**: http://localhost:8000/docs
- **Documentación alternativa**: http://localhost:8000/redoc

## Endpoints

### `GET /api/flights/search`
Busca vuelos disponibles.

**Parámetros:**
- `origin` (requerido): Código IATA de origen (ej. GDL)
- `destination` (requerido): Código IATA de destino (ej. CUN)
- `departure_date` (requerido): Fecha de salida (YYYY-MM-DD)
- `return_date` (opcional): Fecha de regreso (YYYY-MM-DD)
- `cabin_class` (opcional): ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST
- `max_stops` (opcional): ANY, NON_STOP, ONE_STOP, TWO_PLUS_STOPS
- `sort_by` (opcional): CHEAPEST, DURATION, DEPARTURE_TIME, ARRIVAL_TIME
- `passengers` (opcional): Número de pasajeros (default: 1)

**Ejemplo:**
```bash
curl "http://localhost:8000/api/flights/search?origin=GDL&destination=CUN&departure_date=2026-06-15"
```

### `GET /api/flights/dates`
Encuentra las fechas más baratas en un rango.

**Parámetros:**
- `origin` (requerido): Código IATA de origen
- `destination` (requerido): Código IATA de destino
- `start_date` (requerido): Inicio del rango (YYYY-MM-DD)
- `end_date` (requerido): Fin del rango (YYYY-MM-DD)
- `trip_duration` (opcional): Duración del viaje en días (default: 7)
- `is_round_trip` (opcional): ¿Ida y vuelta? (default: true)
- `cabin_class` (opcional): Clase de cabina (default: ECONOMY)

### `GET /api/health`
Health check del servicio.

## Características

- ✅ Caché en memoria (30 minutos TTL)
- ✅ CORS configurado para localhost:3000
- ✅ Validación de parámetros con Pydantic
- ✅ Documentación automática con Swagger UI
- ✅ Manejo de errores robusto

## Producción

Para producción, usar Gunicorn:
```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Despliegue

Recomendaciones para desplegar:
- **Railway.app**: Push automático desde GitHub
- **Render.com**: Plan gratuito disponible
- **Fly.io**: Excelente para Python
