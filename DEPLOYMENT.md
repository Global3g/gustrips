# Guía de Deployment - GusTrips

## 📦 Backend (Render)

### 1. Crear cuenta en Render
- Ve a [render.com](https://render.com) y crea una cuenta (puedes usar GitHub)

### 2. Crear nuevo Web Service
1. Click en **"New +"** → **"Web Service"**
2. Conecta tu repositorio de GitHub: `Global3g/gustrips`
3. Configuración del servicio:
   - **Name**: `gustrips-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `flight-api`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

### 3. Configurar Variables de Entorno en Render
En la sección **Environment**, agrega:

```bash
# CORS (usar la URL de Vercel una vez deployada)
ALLOWED_ORIGINS=https://tu-app.vercel.app,http://localhost:3000

# Frontend URL
FRONTEND_URL=https://tu-app.vercel.app

# Firebase Service Account (JSON completo)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
# 👆 Copia el contenido COMPLETO de tu archivo firebase-service-account.json

# Resend API Key (opcional, para alertas de precios)
RESEND_API_KEY=re_tu_api_key
```

### 4. Deploy
- Click en **"Create Web Service"**
- Espera a que termine el build (~5 minutos)
- Copia la URL del servicio (ej: `https://gustrips-backend.onrender.com`)

---

## 🚀 Frontend (Vercel)

### Variables de Entorno Necesarias:

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Backend API (URL de Render)
NEXT_PUBLIC_FLIGHT_API_URL=https://gustrips-backend.onrender.com
```

### Deploy automático
El frontend se deployará automáticamente en Vercel conectando el repositorio de GitHub.

---

## 🔄 Actualizar CORS después del deployment

Una vez que tengas la URL de Vercel, actualiza la variable `ALLOWED_ORIGINS` en Render:

```bash
ALLOWED_ORIGINS=https://tu-app.vercel.app,http://localhost:3000
```

---

## ✅ Verificación

1. **Backend Health Check**: `https://gustrips-backend.onrender.com/api/health`
2. **Frontend**: `https://tu-app.vercel.app`
3. **Test de búsqueda de vuelos**: Ve a la sección "Buscar Vuelos"

---

## 📱 Acceso desde cualquier dispositivo

Una vez deployado:
- **URL de producción**: Tu app estará disponible en la URL de Vercel
- **Móvil**: Abre la URL en cualquier navegador móvil
- **Desktop**: Accede desde cualquier computadora

---

## 🐛 Troubleshooting

### Backend no responde
- Verifica que el servicio esté corriendo en Render
- Revisa los logs en Render Dashboard
- Verifica las variables de entorno

### CORS Error
- Actualiza `ALLOWED_ORIGINS` en Render con la URL correcta de Vercel
- No olvides incluir `https://` en la URL

### Firebase Error
- Verifica que `FIREBASE_SERVICE_ACCOUNT_JSON` esté en formato JSON válido
- Asegúrate de copiar TODO el contenido del archivo

### Fli no disponible
- Render instala automáticamente `flights` desde requirements.txt
- Si falla, verifica los logs de build
