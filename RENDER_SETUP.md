# 🚀 Setup Rápido de Render - Backend GusTrips

## Opción 1: Deploy Automático con Blueprint (Recomendado) ⚡

El repositorio incluye un archivo `render.yaml` que configura todo automáticamente.

### Pasos:

1. **Ir a Render**
   - Ya abrí el navegador con: https://dashboard.render.com
   - Si no tienes cuenta, haz login con GitHub (usuario: Global3g)

2. **Crear servicio desde Blueprint**
   - Click en **"New +"** (botón azul arriba a la derecha)
   - Selecciona **"Blueprint"**
   - Conecta tu cuenta de GitHub si no lo has hecho
   - Busca y selecciona el repositorio: **`Global3g/gustrips`**
   - Render detectará automáticamente el archivo `render.yaml`
   - Click en **"Apply"**

3. **Agregar Variables de Entorno Sensibles**

   Render creará el servicio pero necesitas agregar manualmente:

   a. Ve al servicio recién creado: `gustrips-backend`

   b. Click en **"Environment"** en el menú lateral

   c. Click en **"Add Environment Variable"**

   d. Agrega estas variables (IMPORTANTE para alertas de precios):

   ```bash
   # Firebase Admin SDK (JSON completo)
   FIREBASE_SERVICE_ACCOUNT_JSON
   ```

   **Valor**: Copia TODO el contenido de tu archivo `firebase-service-account.json`
   - Debe empezar con `{` y terminar con `}`
   - Es un JSON completo con type, project_id, private_key, etc.

   ```bash
   # Resend API Key (OPCIONAL - solo para alertas por email)
   RESEND_API_KEY
   ```

   **Valor**: Tu API key de Resend (https://resend.com/api-keys)
   - Formato: `re_xxxxxxxxxx`
   - Si no quieres alertas por email, puedes omitir esta variable

4. **Esperar el Deploy**
   - Render comenzará a hacer build automáticamente (~3-5 minutos)
   - Verás los logs en tiempo real
   - Cuando veas "Your service is live 🎉", está listo

5. **Copiar la URL del Servicio**
   - Arriba verás la URL: `https://gustrips-backend-xxxx.onrender.com`
   - Cópiala, la necesitaremos para el siguiente paso

---

## Opción 2: Configuración Manual (Si Blueprint falla)

### Pasos:

1. **Ir a Render Dashboard**
   - https://dashboard.render.com
   - Login con GitHub

2. **Crear nuevo Web Service**
   - Click en **"New +"** → **"Web Service"**
   - Click en **"Connect GitHub"** (si no está conectado)
   - Busca: **`Global3g/gustrips`**
   - Click en **"Connect"**

3. **Configurar el Servicio**

   Llena exactamente estos valores:

   ```
   Name: gustrips-backend
   Region: Oregon (US West)
   Branch: main
   Root Directory: flight-api
   Runtime: Python 3
   Python Version: 3.12.0
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   Instance Type: Free
   ```

4. **Configurar Variables de Entorno**

   Antes de hacer deploy, click en **"Advanced"** y agrega:

   ```bash
   ALLOWED_ORIGINS=https://gustrips.vercel.app,http://localhost:3000
   FRONTEND_URL=https://gustrips.vercel.app
   PYTHON_VERSION=3.12.0
   ```

   Y las opcionales (para alertas):

   ```bash
   FIREBASE_SERVICE_ACCOUNT_JSON=<pegar JSON completo aquí>
   RESEND_API_KEY=re_xxxxxxxxxx
   ```

5. **Crear el Servicio**
   - Click en **"Create Web Service"**
   - Espera 3-5 minutos

6. **Copiar URL**
   - Copia la URL del servicio cuando esté listo

---

## ✅ Verificación

Una vez que el servicio esté corriendo:

1. **Health Check**

   Abre en tu navegador:
   ```
   https://tu-backend-url.onrender.com/api/health
   ```

   Deberías ver:
   ```json
   {
     "status": "healthy",
     "cache_size": 0,
     "fli_available": true,
     "firebase_available": true,
     "scheduler_running": true
   }
   ```

2. **Documentación API**

   Abre:
   ```
   https://tu-backend-url.onrender.com/docs
   ```

   Deberías ver la interfaz de FastAPI con todos los endpoints.

---

## 🔄 Siguiente Paso

Una vez que tengas la URL del backend, necesitas actualizar Vercel:

```bash
# Desde la terminal
cd /Users/gusmac/Desktop/PROYECTOS\ WEB/GUSTRIPS
npx vercel env rm NEXT_PUBLIC_FLIGHT_API_URL production --yes
npx vercel env add NEXT_PUBLIC_FLIGHT_API_URL production
# Cuando te pregunte el valor, pega: https://tu-backend-real.onrender.com
```

O manualmente:
1. Ve a: https://vercel.com/gustavos-projects-aad11bcd/gustrips/settings/environment-variables
2. Edita `NEXT_PUBLIC_FLIGHT_API_URL`
3. Cambia el valor a tu URL real de Render
4. Save y espera el redeploy automático

---

## 📝 Notas Importantes

### ⚠️ Tiempo de Respuesta (Free Tier)

El plan gratuito de Render tiene "cold starts":
- Si el servicio no recibe requests por 15 minutos, se "duerme"
- La primera request después de despertar puede tardar 30-60 segundos
- Requests subsecuentes serán rápidas (< 1 segundo)

### 🔐 Seguridad

- `FIREBASE_SERVICE_ACCOUNT_JSON` contiene credenciales sensibles
- Nunca lo compartas ni lo subas a GitHub
- Render lo mantendrá encriptado y privado

### 💰 Costos

- Backend en Render: **$0/mes** (plan Free)
- Frontend en Vercel: **$0/mes** (plan Hobby)
- Firebase: **$0/mes** (plan Spark con límites generosos)
- **Total: $0/mes** 🎉

### 🚀 Upgrade Recomendado (Futuro)

Si quieres eliminar los cold starts:
- Render Starter: $7/mes
- Mantiene el servicio siempre activo
- 512 MB RAM, más que suficiente

---

## 🐛 Troubleshooting

### Error: "Build failed"
- Revisa los logs en Render
- Verifica que `Root Directory` sea `flight-api`
- Asegúrate que `requirements.txt` esté en `flight-api/`

### Error: "Firebase not available"
- Verifica que `FIREBASE_SERVICE_ACCOUNT_JSON` esté configurado
- Debe ser JSON válido (usa jsonlint.com para verificar)
- Asegúrate de copiar TODO el contenido del archivo

### Error: "Fli not available"
- Esto es normal si la librería `flights` no se instala
- Verifica los logs de build
- Puede que necesite reinstalar: agrega `--upgrade` al build command

### El servicio se cuelga
- Revisa los logs en tiempo real
- Puede ser un cold start (espera 60 segundos)
- Verifica que `$PORT` se esté usando correctamente

---

¡Listo! Una vez completado, avísame la URL del backend para actualizar Vercel. 🚀
