'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTrips } from '@/hooks/useTrips';
import {
  listInbox,
  removeInboxItem,
  itemToFile,
  type SharedInboxItem,
} from '@/lib/sharedInbox';
import { uploadPhoto } from '@/lib/photoUploader';
import { enqueuePhoto } from '@/lib/pendingPhotos';
import { isHeicFile, normalizeImageFile } from '@/lib/heic';
import { markMutation } from '@/components/SyncIndicator';
import { classNames } from '@/lib/utils/helpers';

interface Preview {
  id: string;
  name: string;
  url: string;
}

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Picks up files stashed by the service worker after a Web Share Target POST
 * (e.g. user shared photos from macOS/iOS Photos.app to GusTrips). Lets the
 * user pick a destination trip + date, then routes each file through the same
 * online/offline upload pipeline as the regular photo uploader.
 */
export default function PhotoShareFlow() {
  const router = useRouter();
  const { trips, loading: tripsLoading } = useTrips();
  const [items, setItems] = useState<SharedInboxItem[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [date, setDate] = useState<string>(todayISO());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [emptyChecked, setEmptyChecked] = useState(false);

  // Drain the shared-inbox IndexedDB on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listInbox();
      if (cancelled) return;
      setItems(list);
      setEmptyChecked(true);
      const urls: Preview[] = list.map((it) => ({
        id: it.id,
        name: it.fileName,
        url: URL.createObjectURL(it.fileBlob),
      }));
      setPreviews(urls);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default to the active or most-recent trip when the list loads.
  useEffect(() => {
    if (selectedTripId || trips.length === 0) return;
    const active = trips.find((t) => t.status === 'active') ?? trips[0];
    setSelectedTripId(active.id);
  }, [trips, selectedTripId]);

  const sortedTrips = useMemo(() => {
    const order: Record<string, number> = { active: 0, planning: 1, completed: 2, cancelled: 3 };
    return [...trips].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }, [trips]);

  if (emptyChecked && items.length === 0) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h1 className="text-2xl font-bold text-white mb-2">Sin fotos compartidas</h1>
        <p className="text-white/60 mb-6">
          No hay nada esperando en la bandeja. Comparte fotos desde la app de Photos
          al menú de GusTrips para que aparezcan aquí.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 transition border border-white/10"
        >
          Volver al dashboard
        </button>
      </div>
    );
  }

  const handleImport = async () => {
    if (!selectedTripId || items.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: items.length, failed: 0 });

    let done = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const baseFile = itemToFile(item);
        const file = isHeicFile(baseFile) ? await normalizeImageFile(baseFile) : baseFile;

        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (offline) {
          await enqueuePhoto({
            tripId: selectedTripId,
            date,
            fileBlob: file,
            fileType: file.type,
            fileName: file.name,
          });
          try { markMutation(); } catch { /* localStorage may be unavailable */ }
        } else {
          await uploadPhoto({
            tripId: selectedTripId,
            date,
            fileBlob: file,
            fileName: file.name,
            fileType: file.type,
          });
        }
        await removeInboxItem(item.id);
        done += 1;
      } catch (err) {
        console.warn('[share] import failed for', item.fileName, err);
        failed += 1;
      }
      setProgress({ done: done + failed, total: items.length, failed });
    }

    setBusy(false);
    if (failed > 0 && done === 0) {
      setError(`No se pudo importar ninguna foto (${failed} fallidas).`);
      return;
    }
    router.push(`/trips/${selectedTripId}/photos`);
  };

  const handleDiscard = async () => {
    if (busy) return;
    for (const item of items) await removeInboxItem(item.id);
    router.push('/dashboard');
  };

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
        Importar {items.length} {items.length === 1 ? 'foto' : 'fotos'}
      </h1>
      <p className="text-white/60 text-sm mb-6">
        Compartidas desde otra app. Elige a qué viaje y qué fecha pertenecen.
      </p>

      {/* Previews */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
        {previews.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-square rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
          </motion.div>
        ))}
      </div>

      {/* Trip picker */}
      <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
        Viaje
      </label>
      {tripsLoading ? (
        <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse mb-4" />
      ) : sortedTrips.length === 0 ? (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-white/60 text-sm mb-4">
          Aún no tienes viajes. Crea uno primero para poder importar fotos.
        </div>
      ) : (
        <div className="grid gap-2 mb-4">
          {sortedTrips.map((trip) => {
            const selected = trip.id === selectedTripId;
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => setSelectedTripId(trip.id)}
                className={classNames(
                  'flex items-center justify-between text-left px-4 py-3 rounded-xl border transition',
                  selected
                    ? 'bg-amber-500/15 border-amber-300/40 text-amber-50'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/85 hover:bg-white/[0.07]',
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{trip.title}</span>
                  <span className="text-xs opacity-70">{trip.destination}</span>
                </span>
                <span className="text-xs opacity-70">
                  {trip.startDate} → {trip.endDate}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Date picker */}
      <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
        Fecha
      </label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white mb-6 outline-none focus:border-amber-300/40"
      />

      {/* Status */}
      {busy && (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white/80 mb-4">
          Subiendo… {progress.done}/{progress.total}
          {progress.failed > 0 && (
            <span className="text-rose-300 ml-2">({progress.failed} fallidas)</span>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-300/30 px-4 py-3 text-sm text-rose-100 mb-4">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleDiscard}
          disabled={busy}
          className="flex-1 px-5 py-3 rounded-full text-sm font-medium text-white/85 bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] transition disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={busy || !selectedTripId || items.length === 0}
          className="flex-[2] px-5 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 transition disabled:opacity-50 disabled:from-white/10 disabled:to-white/10"
        >
          {busy
            ? 'Importando…'
            : `Importar ${items.length} ${items.length === 1 ? 'foto' : 'fotos'}`}
        </button>
      </div>
    </div>
  );
}
