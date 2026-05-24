# Fotos: original + derivados (Opción A — Firebase Resize Images)

Objetivo: subir rápido (la app usa derivados WebP chiquitos) y conservar un
original en alta para descargar / imprimir / photobook / collages.

## Por qué JPEG full-res y no HEIC

La extensión `firebase/storage-resize-images` **no procesa HEIC** (Sharp/libvips
sin códec HEIF). Las fotos de iPhone son HEIC, así que el cliente convierte el
HEIC a **JPEG full-res alta calidad** y sube ESE como "original". Bonus: los
servicios de impresión/photobook prefieren JPEG, no HEIC.

## Arquitectura

```
Celular (background): HEIC → JPEG full-res (q~0.92, sin downscale) → Storage trips/{id}/album/originals/
Extensión (servidor): genera *_400x400.webp (grilla) y *_1280x1280.webp (pantalla)
App: carga los WebP (~30-200 KB) → rápido
Descargar/Imprimir/Photobook: usa el JPEG de /originals/
```

## Instalación de la extensión (acción del usuario — requiere plan Blaze)

https://extensions.dev/extensions/firebase/storage-resize-images → Install en el proyecto `gustrips`.

Config:
- Sizes of resized images: `400,1280`
- Paths that contain images you want to resize: `trips/*/album/originals`
- Output format: `webp`
- Image quality: `82`
- Delete original after resizing: **No**
- (Cloud Storage path for resized images: por defecto / sufijo en el mismo path)

## Pendiente de código (después de instalar la extensión)

- `photoUploader.ts`: dejar de comprimir a 3000px. Subir el JPEG full-res a
  `trips/{id}/album/originals/`. Encolar en background (reusar pendingPhotos).
- Mostrar preview local instantáneo al elegir la foto.
- Naming determinístico de derivados: `<name>_400x400.webp`, `<name>_1280x1280.webp`
  en el mismo path. El cliente arma esas URLs (getDownloadURL) y usa onError →
  fallback al original/preview hasta que el derivado exista (la función tarda
  unos segundos).
- Doc Firestore de la foto: guardar `originalPath` + url del original; los
  derivados se resuelven por convención.
- Album: grilla usa `_400`, pantalla completa usa `_1280`, botón
  Descargar/Imprimir usa el original.
- Migración: las fotos viejas siguen con thumb/full actuales; solo cambian las nuevas.

## Costo

Blaze: Cloud Functions (1 invocación por foto subida) + storage de los derivados.
Para 1-2 usuarios viajeros: centavos al mes.
