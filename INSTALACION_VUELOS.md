# 🛫 Instalación y Uso - API de Vuelos

## ✅ Lo que se implementó

1. **Backend FastAPI** (`flight-api/`)
   - API RESTful con endpoints de búsqueda
   - Integración con Fli (Google Flights)
   - Caché en memoria (30 minutos)
   - Documentación automática con Swagger

2. **Frontend Next.js**
   - Servicio API (`src/lib/api/flights.ts`)
   - Modal de búsqueda (`FlightSearchModal.tsx`)
   - Integración con formulario de eventos
   - Auto-llenado de campos

## 📦 Instalación Rápida

### 1. Instalar Backend

```bash
cd "/Users/gusmac/Desktop/PROYECTOS WEB/GUSTRIPS/flight-api"

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

### 2. Verificar Frontend

El frontend ya está configurado. Solo asegúrate de que `.env.local` tenga:

```env
NEXT_PUBLIC_FLIGHT_API_URL=http://localhost:8000
```

## 🚀 Iniciar Servicios

### Terminal 1 - Backend (Python)
```bash
cd "/Users/gusmac/Desktop/PROYECTOS WEB/GUSTRIPS/flight-api"
source venv/bin/activate
python main.py
```

Verás:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 2 - Frontend (Next.js)
```bash
cd "/Users/gusmac/Desktop/PROYECTOS WEB/GUSTRIPS"
npm run dev
```

## 🧪 Probar la Integración

### Opción 1: Desde la UI

1. Abre `http://localhost:3000`
2. Inicia sesión
3. Crea o abre un viaje
4. Ve a "Itinerario" → "Nuevo Evento"
5. Selecciona tipo "Vuelo"
6. Click en "Buscar vuelo" (botón arriba de los campos)
7. Ingresa:
   - Origen: `GDL` (Guadalajara)
   - Destino: `CUN` (Cancún)
   - Fecha: Cualquier fecha futura
8. Click "Buscar Vuelos"
9. Selecciona un vuelo → Se auto-llenan los campos

### Opción 2: Probar API directamente

Abre `http://localhost:8000/docs` en el navegador para ver la documentación interactiva.

O desde la terminal:
```bash
curl "http://localhost:8000/api/flights/search?origin=GDL&destination=CUN&departure_date=2026-06-15"
```

## 📚 Endpoints Disponibles

### `GET /api/flights/search`
Busca vuelos disponibles.

**Ejemplo:**
```bash
curl "http://localhost:8000/api/flights/search?origin=MEX&destination=NYC&departure_date=2026-07-01&cabin_class=ECONOMY"
```

### `GET /api/flights/dates`
Encuentra las fechas más baratas.

**Ejemplo:**
```bash
curl "http://localhost:8000/api/flights/dates?origin=GDL&destination=CUN&start_date=2026-06-01&end_date=2026-06-30&trip_duration=7"
```

### `GET /api/health`
Health check del servicio.

## 🔧 Troubleshooting

### Error: "Module 'fli' not found"
```bash
cd flight-api
source venv/bin/activate
pip install flights
```

### Error: "Connection refused"
Verifica que el backend esté corriendo en `http://localhost:8000`

### Error: "CORS policy"
El backend ya tiene CORS configurado para `localhost:3000`. Si usas otro puerto, edita `flight-api/main.py`:
```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:TU_PUERTO",  # Agregar aquí
],
```

### Los vuelos no aparecen
1. Verifica que el backend esté corriendo
2. Abre la consola del navegador (F12) para ver errores
3. Verifica la fecha (debe ser futura)
4. Prueba con códigos IATA válidos (GDL, MEX, CUN, etc.)

## 🎯 Códigos IATA Comunes

- **México**: GDL (Guadalajara), MEX (CDMX), CUN (Cancún), MTY (Monterrey), TIJ (Tijuana)
- **USA**: LAX (Los Ángeles), JFK (Nueva York), MIA (Miami), ORD (Chicago)
- **Europa**: LHR (Londres), MAD (Madrid), CDG (París), BCN (Barcelona)

## 📊 Caché

El backend cachea resultados por 30 minutos. Para limpiar el caché:
1. Reinicia el servidor backend
2. O espera 30 minutos

## 🚢 Desplegar a Producción

### Backend (Railway.app)

1. Crea cuenta en https://railway.app
2. Crea nuevo proyecto desde GitHub
3. Selecciona el directorio `flight-api`
4. Railway detectará Python automáticamente
5. Actualiza `NEXT_PUBLIC_FLIGHT_API_URL` en Vercel con la URL de Railway

### Frontend (Vercel)

Ya está configurado. Solo agrega la variable de entorno:
```
NEXT_PUBLIC_FLIGHT_API_URL=https://tu-backend.railway.app
```

## 💡 Próximas Mejoras

- [ ] Redis para caché distribuido
- [ ] Rate limiting por usuario
- [ ] Guardar búsquedas en Firestore
- [ ] Alertas de precio
- [ ] Comparación de precios históricos
- [ ] Búsqueda de hoteles y autos
