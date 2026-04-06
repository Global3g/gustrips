# GusTrips

Organizador de viajes colaborativo construido con Next.js, Firebase y Tailwind CSS con búsqueda de vuelos integrada.

## Configuracion

1. Clonar el repositorio:
   ```bash
   git clone <url-del-repo>
   cd gustrips
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Crear archivo de variables de entorno:
   ```bash
   cp .env.example .env.local
   ```
   Completar las variables de Firebase en `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   ```

## Desarrollo

```bash
npm run dev
```

La aplicacion estara disponible en `http://localhost:3000`.

## Firebase

### Servicios requeridos

1. **Authentication**: Habilitar los proveedores Email/Password y Google.
2. **Firestore Database**: Crear la base de datos en modo produccion.
3. **Storage**: Habilitar Firebase Storage para subida de documentos.

### Reglas de Firestore

Desplegar las reglas de seguridad:

```bash
firebase deploy --only firestore:rules
```

Las reglas se encuentran en `firestore.rules` en la raiz del proyecto.

## Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS 4 + Framer Motion
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Flight API**: FastAPI + Fli (Google Flights)
- **Validacion**: Zod
- **Iconos**: Lucide React
- **Fechas**: date-fns con locale espanol

## API de Búsqueda de Vuelos

La aplicación incluye una API de búsqueda de vuelos que usa [Fli](https://github.com/punitarani/fli) para acceder a Google Flights.

### Configuración del Backend

1. Navegar al directorio de la API:
   ```bash
   cd flight-api
   ```

2. Crear entorno virtual de Python:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```

3. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```

4. Iniciar el servidor:
   ```bash
   python main.py
   ```

   La API estará disponible en `http://localhost:8000`
   - Documentación interactiva: `http://localhost:8000/docs`

### Uso en la Aplicación

Una vez que tanto el frontend como el backend estén corriendo, tienes **dos formas** de buscar vuelos:

#### Opción 1: Sección Dedicada de Vuelos
1. Ir a **"Buscar Vuelos"** en la navegación principal
2. Seleccionar modo de búsqueda:
   - **Búsqueda de vuelos**: Para fechas específicas con filtros avanzados
   - **Fechas más baratas**: Para encontrar los mejores precios en un rango
3. Ingresar origen, destino y fechas
4. Ver resultados y comparar opciones
5. Click en **"Agregar a viaje"** para guardar en cualquier viaje existente

#### Opción 2: Desde el Itinerario
1. Ir al itinerario de un viaje
2. Crear un nuevo evento de tipo "Vuelo"
3. Click en el botón **"Buscar vuelo"**
4. Buscar y seleccionar un vuelo
5. Los campos se llenarán automáticamente

### Características

- ✅ **Sección dedicada de búsqueda de vuelos** (`/flights`)
- ✅ Búsqueda en tiempo real de vuelos desde Google Flights
- ✅ Dos modos: Fechas específicas o Fechas más baratas
- ✅ Filtros avanzados: clase de cabina, escalas, ordenamiento, pasajeros
- ✅ Comparación visual de precios con resaltado de mejor oferta
- ✅ Agregar vuelos directamente a cualquier viaje
- ✅ Integración en formulario de eventos del itinerario
- ✅ Caché de 30 minutos para mejorar rendimiento
- ✅ Auto-llenado de formularios con datos de vuelo
- ✅ Interfaz moderna y responsive

### Desarrollo

Para desarrollo, ejecuta ambos servicios:

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd flight-api
source venv/bin/activate
python main.py
```
