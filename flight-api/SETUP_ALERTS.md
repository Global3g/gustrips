# Configuración del Sistema de Alertas de Precios

## 1. Firebase Admin SDK

Necesitas descargar las credenciales de tu proyecto Firebase:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Project Settings** (ícono de engranaje)
4. Pestaña **Service Accounts**
5. Click en **Generate new private key**
6. Guarda el archivo JSON como `firebase-service-account.json` en esta carpeta (`flight-api/`)

## 2. Resend API Key (para emails)

Resend es gratuito hasta 3,000 emails/mes y 100 emails/día.

1. Ve a [Resend](https://resend.com/)
2. Crea una cuenta gratuita
3. Ve a **API Keys**
4. Click en **Create API Key**
5. Copia la API key

## 3. Configurar variables de entorno

Crea un archivo `.env` en la carpeta `flight-api/`:

```bash
cp .env.example .env
```

Edita `.env` y completa:

```bash
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
RESEND_API_KEY=re_tu_api_key_aqui
FRONTEND_URL=http://localhost:3000
```

## 4. Estructura de datos en Firestore

El sistema creará automáticamente esta estructura:

```
alerts/
  {alertId}/
    userId: string
    email: string
    origin: string (IATA code)
    destination: string (IATA code)
    targetPrice: number
    currency: string
    active: boolean
    createdAt: timestamp
    lastChecked: timestamp (opcional)
    lastNotified: timestamp (opcional)

priceHistory/
  {origin}-{destination}-{date}/
    origin: string
    destination: string
    date: string (YYYY-MM-DD)
    prices: array of {price, currency, timestamp, airline}
```

## 5. Reiniciar el servidor

```bash
cd flight-api
./venv/bin/python main.py
```

El scheduler se iniciará automáticamente y verificará precios cada hora.

## Funciones disponibles

### API Endpoints:

- `POST /api/alerts` - Crear alerta
- `GET /api/alerts?userId={userId}` - Listar alertas del usuario
- `DELETE /api/alerts/{alertId}` - Eliminar alerta
- `GET /api/alerts/{alertId}/history` - Ver histórico de precios

### Notificaciones:

- El sistema verifica precios cada hora
- Envía email cuando el precio está por debajo del objetivo
- Solo notifica una vez cada 24 horas por alerta
