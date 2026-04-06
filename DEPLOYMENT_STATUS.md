# 🚀 Status del Deployment - GusTrips

## ✅ Completado

### 1. Repositorio GitHub
- ✅ Repositorio creado: https://github.com/Global3g/gustrips
- ✅ Código pusheado y sincronizado
- ✅ Backend preparado con soporte para variables de entorno

### 2. Frontend en Vercel
- ✅ **Deployado y funcionando**: https://gustrips.vercel.app
- ✅ Build exitoso
- ✅ Proyecto conectado a GitHub para deployments automáticos

---

## 📋 Pendiente

### 3. Backend en Render

#### Pasos para crear el servicio:

1. **Ir a Render Dashboard**
   - Ve a: https://dashboard.render.com
   - Login con GitHub (usa la cuenta Global3g)

2. **Crear nuevo Web Service**
   - Click en **"New +"** → **"Web Service"**
   - Conectar repositorio: `Global3g/gustrips`
   - Branch: `main`

3. **Configuración del Servicio**
   ```
   Name: gustrips-backend
   Region: Oregon (US West) o el más cercano
   Root Directory: flight-api
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   Instance Type: Free
   ```

4. **Variables de Entorno en Render**

   Antes de hacer deploy, configura estas variables:

   ```bash
   # CORS - Importante: usar la URL de Vercel
   ALLOWED_ORIGINS=https://gustrips.vercel.app,http://localhost:3000

   # Frontend URL
   FRONTEND_URL=https://gustrips.vercel.app

   # Firebase Admin SDK (JSON completo)
   FIREBASE_SERVICE_ACCOUNT_JSON=<copiar contenido del archivo firebase-service-account.json>

   # Resend API Key (opcional, para alertas)
   RESEND_API_KEY=<tu_api_key_de_resend>
   ```

   **IMPORTANTE**: Para `FIREBASE_SERVICE_ACCOUNT_JSON`:
   - Ve a tu archivo local `firebase-service-account.json`
   - Copia TODO el contenido (debe empezar con `{` y terminar con `}`)
   - Pégalo completo en la variable de entorno

5. **Deploy**
   - Click en **"Create Web Service"**
   - Espera 3-5 minutos a que termine el build
   - Copia la URL del servicio (ej: `https://gustrips-backend.onrender.com`)

---

### 4. Configurar Variables de Entorno en Vercel

Una vez que tengas la URL del backend en Render:

1. **Ir a Vercel Dashboard**
   - Ve a: https://vercel.com/gustavos-projects-aad11bcd/gustrips/settings/environment-variables

2. **Agregar Variables**
   ```bash
   # Backend API - REEMPLAZAR con URL real de Render
   NEXT_PUBLIC_FLIGHT_API_URL=https://gustrips-backend.onrender.com

   # Firebase (si aún no están configuradas)
   NEXT_PUBLIC_FIREBASE_API_KEY=<tu_api_key>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<tu_auth_domain>
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<tu_project_id>
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<tu_storage_bucket>
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<tu_sender_id>
   NEXT_PUBLIC_FIREBASE_APP_ID=<tu_app_id>
   ```

3. **Redeploy**
   - Después de agregar las variables, Vercel re-deployará automáticamente
   - O puedes forzar un redeploy desde el dashboard

---

### 5. Actualizar CORS en Render

Después del primer deploy, si cambias algo o agregas dominios:

1. Ve a tu servicio en Render
2. Settings → Environment
3. Edita `ALLOWED_ORIGINS` para incluir todos los dominios necesarios
4. Save Changes (esto reiniciará el servicio automáticamente)

---

## 🧪 Verificación

### Health Checks

1. **Backend Health**
   ```
   https://gustrips-backend.onrender.com/api/health
   ```
   Debe responder:
   ```json
   {
     "status": "healthy",
     "fli_available": true,
     "firebase_available": true
   }
   ```

2. **Frontend**
   ```
   https://gustrips.vercel.app
   ```
   Debe cargar la aplicación

3. **Búsqueda de Vuelos**
   - Ir a "Buscar Vuelos" en el menu
   - Intentar buscar un vuelo
   - Verificar que cargue resultados

---

## 📱 URLs Finales

- **Frontend (Vercel)**: https://gustrips.vercel.app
- **Backend (Render)**: https://gustrips-backend.onrender.com (pendiente)
- **Repository**: https://github.com/Global3g/gustrips

---

## 🔧 Comandos Útiles

### Redeploy manual desde CLI

```bash
# Frontend
cd /Users/gusmac/Desktop/PROYECTOS\ WEB/GUSTRIPS
npx vercel --prod --scope gustavos-projects-aad11bcd

# Backend (solo si tienes Render CLI)
render deploy
```

### Ver logs

- **Vercel**: https://vercel.com/gustavos-projects-aad11bcd/gustrips
- **Render**: https://dashboard.render.com → Tu servicio → Logs

---

## 🐛 Troubleshooting

### "CORS error" en el frontend
- Verifica que `ALLOWED_ORIGINS` en Render incluya `https://gustrips.vercel.app`
- Asegúrate de incluir `https://` (no `http://`)

### "API no responde"
- Verifica que el servicio esté corriendo en Render
- Revisa los logs en Render para ver errores
- Verifica que `NEXT_PUBLIC_FLIGHT_API_URL` esté configurado en Vercel

### "Firebase error"
- Verifica que `FIREBASE_SERVICE_ACCOUNT_JSON` esté correctamente copiado
- Debe ser JSON válido (usa un validador online si tienes dudas)
- Asegúrate de tener los permisos correctos en Firebase Console

### Backend tarda mucho en responder
- Render Free tier se "duerme" después de 15 minutos de inactividad
- La primera request después de despertar puede tardar 30-60 segundos
- Considera upgrade a plan pagado para mejor performance
