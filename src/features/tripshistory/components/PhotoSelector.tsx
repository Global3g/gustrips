'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, UploadCloud, X } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { extractPhotoMetadata } from '@/features/tripshistory/utils/photoMetadata';
import { uploadPhotoToStory } from '@/features/tripshistory/utils/photoUpload';
import type { PhotoMetadata } from '@/features/tripshistory/types';

interface PhotoSelectorProps {
  /**
   * Required for upload. The component will upload to:
   *   users/{userId}/tripstories/{storyId}/photos/...
   */
  storyId: string;
  /**
   * Called once all selected files have been processed (EXIF + pHash + upload).
   * The parent is responsible for POSTing the resulting metadata to the engine.
   */
  onPhotosReady: (photos: PhotoMetadata[]) => void;
  /** Optional file-selection callback (raw File objects). */
  onSelect?: (files: File[]) => void;
  disabled?: boolean;
  minPhotos?: number;
  maxPhotos?: number;
}

interface SelectedItem {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const PROCESSING_CONCURRENCY = 4;

/**
 * File picker + drag-drop surface. When the user hits "Procesar fotos" we:
 *   1. extract EXIF + dimensions
 *   2. compute perceptual hash + blur score
 *   3. upload thumb/medium/full to Firebase Storage
 *   4. emit the resulting PhotoMetadata[] via `onPhotosReady`
 *
 * Items are processed in parallel batches of {@link PROCESSING_CONCURRENCY}
 * to avoid melting the device on a 500-photo drop.
 */
export default function PhotoSelector({
  storyId,
  onPhotosReady,
  onSelect,
  disabled = false,
  minPhotos = 1,
  maxPhotos = 500,
}: PhotoSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [globalError, setGlobalError] = useState<string | null>(null);

  const { firebaseUser } = useAuthContext();

  // Accept any image extension we know, OR any MIME starting with image/.
  // Some sources (Apple Photos drag, Drive web, Outlook attachments) hand us
  // files with empty/octet-stream MIME types, so we can't rely on MIME alone.
  const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif)$/i;

  const isImageFile = useCallback((f: File): boolean => {
    if (f.type && f.type.startsWith('image/')) return true;
    if (IMAGE_EXT_RE.test(f.name)) return true;
    // Some shares give us no name + no type but a hint via lastModified.
    // Last resort: treat anything labeled type 'application/octet-stream'
    // with a non-empty name as a possible image and let downstream EXIF
    // extraction reject it cleanly.
    if (f.type === 'application/octet-stream' && f.name.length > 0) return true;
    return false;
  }, []);

  // Stable identity for a File — used to dedup across drop paths AND
  // against items already in the list. Apple Photos can ship the same
  // photo through `.files` AND `.items`, so we have to fold both.
  const fileKey = (f: File): string => `${f.name}|${f.size}|${f.lastModified}`;

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const onlyImages = incoming.filter(isImageFile);
      const rejected = incoming.length - onlyImages.length;
      if (incoming.length > 0 && onlyImages.length === 0) {
        setGlobalError(
          `No reconocimos ninguno de los ${incoming.length} archivos como imagen. ` +
            'Si los arrastraste desde una galería, probá usar el botón para elegirlas.',
        );
      } else if (rejected > 0) {
        setGlobalError(`Ignoramos ${rejected} archivo${rejected === 1 ? '' : 's'} que no parecían fotos.`);
      } else {
        setGlobalError(null);
      }
      setItems((prev) => {
        // Dedup against items already in the list AND within the incoming
        // batch itself. Same fingerprint twice → one item.
        const seen = new Set<string>(prev.map((it) => fileKey(it.file)));
        const additions: SelectedItem[] = [];
        for (const file of onlyImages) {
          const key = fileKey(file);
          if (seen.has(key)) continue;
          seen.add(key);
          additions.push({ file, status: 'pending' });
        }
        const merged = [...prev, ...additions].slice(0, maxPhotos);
        onSelect?.(merged.map((m) => m.file));
        return merged;
      });
    },
    [maxPhotos, onSelect, isImageFile],
  );

  // NOTE: previously had a window-level drop listener as a fallback. It
  // caused double-processing on Apple Photos drags (both the div handler
  // AND the window handler fired). The div-level handler is sufficient
  // on every browser we support; if a parent component ever swallows
  // drop events again we'll rediscover it through a missing-callback bug,
  // which is far less harmful than silent duplicates.

  /**
   * Extract files from a DataTransfer. Reads both `.files` and `.items`
   * because Apple Photos / iCloud / some browser drags only populate one
   * or the other. Deduplicates by name+size+lastModified.
   */
  const collectFromDataTransfer = (dt: DataTransfer): File[] => {
    const out: File[] = [];
    const seen = new Set<string>();
    const pushUnique = (f: File | null | undefined): void => {
      if (!f) return;
      const key = `${f.name}|${f.size}|${f.lastModified}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(f);
    };
    // 1. The classic path.
    if (dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) pushUnique(dt.files.item(i));
    }
    // 2. DataTransferItemList — covers Apple Photos and similar.
    if (dt.items && dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          pushUnique(item.getAsFile());
        }
      }
    }
    return out;
  };

  /**
   * Detect drags coming from Apple Photos / iCloud Photos.
   * Photos.app sets distinctive UTIs and almost never delivers the actual
   * bytes — the OS owes the file to the browser via a "promised file"
   * mechanism that browsers don't resolve. We detect it up-front so we can
   * give the user a clear path (click to pick instead).
   */
  const isApplePhotosDrag = (dt: DataTransfer): boolean => {
    const types = Array.from(dt.types || []);
    const lower = types.map((t) => t.toLowerCase());
    return lower.some(
      (t) =>
        t.includes('apple.photos') ||
        t.includes('apple.icloud.photos') ||
        t === 'com.apple.pasteboard.promised-file-content-type' ||
        t === 'com.apple.pasteboard.promised-file-url',
    );
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || processing) return;
    const files = collectFromDataTransfer(e.dataTransfer);
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        '[PhotoSelector] drop:',
        files.length,
        'files,',
        'types:',
        Array.from(e.dataTransfer.types || []),
        files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      );
    }
    if (files.length === 0) {
      if (isApplePhotosDrag(e.dataTransfer)) {
        setGlobalError(
          'Apple Photos no entrega las fotos al arrastrar al navegador (es una limitación de macOS). ' +
            'Tocá el área para abrir el selector — desde ahí podés elegir fotos de "Photos" en el sidebar y macOS las exporta.',
        );
      } else {
        setGlobalError(
          'No pudimos leer las fotos arrastradas. Probá tocar el área para abrir el selector.',
        );
      }
      return;
    }
    handleFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeOne = (idx: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      onSelect?.(next.map((m) => m.file));
      return next;
    });
  };

  const clearAll = () => {
    setItems([]);
    setProgress({ done: 0, total: 0 });
    setGlobalError(null);
    onSelect?.([]);
  };

  const processAll = useCallback(async () => {
    if (!firebaseUser) {
      setGlobalError('Necesitás iniciar sesión para subir fotos.');
      return;
    }
    if (!storyId) {
      setGlobalError('Falta el ID de la historia.');
      return;
    }
    if (items.length === 0) return;

    setProcessing(true);
    setGlobalError(null);
    setProgress({ done: 0, total: items.length });
    setItems((prev) => prev.map((it) => ({ ...it, status: 'pending', error: undefined })));

    const userId = firebaseUser.uid;
    const photos: PhotoMetadata[] = new Array(items.length);
    let cursor = 0;

    const updateStatus = (
      idx: number,
      status: SelectedItem['status'],
      error?: string,
    ) => {
      setItems((prev) => {
        const next = prev.slice();
        if (next[idx]) next[idx] = { ...next[idx], status, error };
        return next;
      });
    };

    const errors: string[] = [];

    const worker = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) return;
        const { file } = items[idx];
        updateStatus(idx, 'processing');
        try {
          const metadata = await extractPhotoMetadata(file);
          const urls = await uploadPhotoToStory(
            file,
            storyId,
            userId,
            metadata.clientId,
          );
          photos[idx] = {
            ...metadata,
            thumbnailUrl: urls.thumbnailUrl,
            mediumUrl: urls.mediumUrl,
            fullUrl: urls.fullUrl,
            sizeBytes: urls.sizeBytes || metadata.sizeBytes,
          };
          updateStatus(idx, 'done');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Surface the underlying error in the console for debugging. The
          // per-item chip shows the same `msg` so you can hover it too.
          // eslint-disable-next-line no-console
          console.error('[PhotoSelector] failed processing', file.name, err);
          errors.push(`${file.name}: ${msg}`);
          updateStatus(idx, 'error', msg);
        } finally {
          setProgress((p) => ({ done: p.done + 1, total: p.total }));
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(PROCESSING_CONCURRENCY, items.length) },
      () => worker(),
    );
    await Promise.all(workers);

    const successful = photos.filter((p): p is PhotoMetadata => Boolean(p));
    setProcessing(false);

    if (successful.length === 0) {
      // If most failures look like HEIC decoding errors, point the user at
      // the iPhone setting that fixes it permanently. libheif-js in the
      // browser doesn't decode HEVC 10-bit HEIC (the default since iPhone 12).
      const allHeic = items.every((it) => /\.(heic|heif)$/i.test(it.file.name));
      const looksLikeDecode = errors.some((e) =>
        /failed to decode|could not parse heif/i.test(e),
      );
      if (allHeic && looksLikeDecode) {
        setGlobalError(
          'Tus fotos son HEIC del iPhone y el navegador no puede decodificarlas. ' +
            'Solución (una sola vez): en tu iPhone → Ajustes → Cámara → Formatos → ' +
            'elegí "Más compatible". Las fotos nuevas saldrán como JPEG y van a subir bien. ' +
            'Para las HEIC viejas: en Mac, Photos.app → File → Export → Export Photos → JPEG.',
        );
        return;
      }
      const firstError = errors[0];
      setGlobalError(
        firstError
          ? `No pudimos procesar ninguna foto. Primer error: ${firstError}`
          : 'No pudimos procesar ninguna foto. Revisá los archivos y volvé a intentar.',
      );
      return;
    }

    onPhotosReady(successful);
  }, [firebaseUser, storyId, items, onPhotosReady]);

  const isBusy = disabled || processing;
  const canSubmit = items.length >= minPhotos && !processing;

  // Mirror the exact handler shape used by /trips/[tripId]/photos which works
  // reliably across Chrome / Safari / Firefox. The drop zone has to be a plain
  // <div> — wrapping it in <motion.div> with whileHover/whileTap intercepts
  // pointer events on some browsers and the drag never fires.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isBusy) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };


  return (
    <div className="space-y-3">
      <div
        data-tripshistory-dropzone="true"
        onDragEnter={(e) => {
          e.preventDefault();
          if (!isBusy) setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) {
            try {
              e.dataTransfer.dropEffect = 'copy';
            } catch {
              /* no-op */
            }
            setIsDragging(true);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => !isBusy && inputRef.current?.click()}
        className={`relative rounded-3xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200 ${
          isBusy
            ? 'border-white/10 bg-white/[0.02] cursor-not-allowed opacity-60'
            : isDragging
              ? 'border-amber-400/60 bg-amber-500/10 scale-[1.005] shadow-[0_0_32px_rgba(245,158,11,0.25)]'
              : 'border-white/15 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={handleChange}
          disabled={isBusy}
        />
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 flex items-center justify-center">
            <UploadCloud className="w-7 h-7 text-amber-200" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              Arrastrá tus fotos o tocá acá para elegir
            </p>
            <p className="text-sm text-white/60 mt-1">
              Subí las fotos del viaje. Cuantas más, mejor agrupamos los eventos.
            </p>
            <p className="text-[11px] text-white/45 mt-2 max-w-md mx-auto">
              ¿Mac con app Photos? Tocá el área y, en el selector, elegí
              <span className="font-semibold text-white/70"> Photos </span>
              del sidebar — macOS no permite arrastrar directo desde la app.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isBusy) inputRef.current?.click();
            }}
            disabled={isBusy}
            className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white text-sm font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-shadow disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4" />
            Elegir fotos de la galería
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              {items.length} {items.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}
              {processing && progress.total > 0 && (
                <span className="ml-2 text-amber-200 normal-case tracking-normal">
                  · Procesando {progress.done}/{progress.total}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-40"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Agregar más
              </button>
              {!processing && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-semibold text-white/50 hover:text-white/80"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <ul className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {items.slice(0, 24).map((it, i) => (
              <li
                key={`${it.file.name}-${i}`}
                className={`group inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${
                  it.status === 'error'
                    ? 'bg-rose-500/10 border-rose-400/30 text-rose-200'
                    : it.status === 'done'
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                      : it.status === 'processing'
                        ? 'bg-amber-500/10 border-amber-400/30 text-amber-100'
                        : 'bg-white/[0.05] border-white/[0.08] text-white/85'
                }`}
                title={it.error || it.file.name}
              >
                {it.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                <span className="truncate max-w-[140px]">{it.file.name}</span>
                {!processing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOne(i);
                    }}
                    className="opacity-60 hover:opacity-100 hover:text-rose-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </li>
            ))}
            {items.length > 24 && (
              <li className="text-xs text-white/50 self-center">
                + {items.length - 24} más
              </li>
            )}
          </ul>

          {globalError && (
            <p className="mt-2 text-xs text-rose-300">{globalError}</p>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={processAll}
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white text-sm font-bold shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando {progress.done}/{progress.total}...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Procesar {items.length} {items.length === 1 ? 'foto' : 'fotos'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
