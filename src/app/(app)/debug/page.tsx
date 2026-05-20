'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { getClientAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

const MIGRATE_FN_URL =
  'https://us-central1-gustrips-a317e.cloudfunctions.net/migrateAlbumPhotos';

export default function DebugPage() {
  const { user } = useAuth();
  const [allTrips, setAllTrips] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [myTrips, setMyTrips] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Album photos backfill (legacy array → subcollection)
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{
    totalCopied?: number;
    tripsProcessed?: number;
    durationMs?: number;
    perTrip?: unknown;
  } | null>(null);
  const [migrateError, setMigrateError] = useState<string | null>(null);

  const runMigration = async (): Promise<void> => {
    setMigrating(true);
    setMigrateError(null);
    setMigrateResult(null);
    try {
      const auth = getClientAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No hay sesión activa');
      const token = await currentUser.getIdToken();
      const res = await fetch(MIGRATE_FN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok) {
        setMigrateError(json.message || json.error || `HTTP ${res.status}`);
      } else {
        setMigrateResult(json);
      }
    } catch (err) {
      setMigrateError(err instanceof Error ? err.message : String(err));
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchTrips = async () => {
      try {
        const db = getClientDb();
        const tripsRef = collection(db, 'trips');

        // Query 1: Todos los viajes ordenados
        const q1 = query(tripsRef, orderBy('createdAt', 'desc'));
        const snapshot1 = await getDocs(q1);
        const all = snapshot1.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllTrips(all);

        // Query 2: Solo mis viajes
        const q2 = query(
          tripsRef,
          where('createdBy', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot2 = await getDocs(q2);
        const mine = snapshot2.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMyTrips(mine);

        setLoading(false);
      } catch (err: unknown) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchTrips();
  }, [user?.uid]);

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug - Trips</h1>
        <p className="text-red-400">No autenticado</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Debug - Trips Query</h1>

      <div className="bg-white/5 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Usuario actual:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify({ uid: user.uid, email: user.email }, null, 2)}
        </pre>
      </div>

      <div className="bg-gradient-to-br from-amber-500/15 to-fuchsia-500/10 border border-amber-400/30 p-4 rounded-lg space-y-3">
        <div>
          <h2 className="font-bold text-base text-white">
            Migrar fotos al nuevo almacenamiento
          </h2>
          <p className="text-xs text-white/65 mt-1 max-w-2xl">
            Copia todas las fotos viejas que están dentro del doc del viaje a
            la nueva subcolección. Esto aliviana cada viaje en mobile y mata
            el problema de &quot;tarda horas en cargar&quot;. Es idempotente —
            podés correrlo varias veces sin duplicar nada.
          </p>
        </div>
        <button
          type="button"
          onClick={runMigration}
          disabled={migrating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white text-sm font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-shadow disabled:opacity-50"
        >
          {migrating ? 'Migrando...' : 'Migrar todas mis fotos'}
        </button>
        {migrateError && (
          <pre className="text-xs text-rose-300 bg-rose-500/10 p-2 rounded overflow-auto max-h-40">
            {migrateError}
          </pre>
        )}
        {migrateResult && (
          <div className="space-y-1">
            <p className="text-xs text-emerald-300 font-semibold">
              ✓ Migración OK · {migrateResult.totalCopied} fotos copiadas en{' '}
              {migrateResult.tripsProcessed} viajes · {migrateResult.durationMs}ms
            </p>
            <pre className="text-[10px] text-white/60 bg-white/5 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(migrateResult.perTrip, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {loading && <p>Cargando...</p>}

      {error && (
        <div className="bg-red-500/20 p-4 rounded-lg">
          <h2 className="font-semibold text-red-400 mb-2">Error:</h2>
          <pre className="text-xs">{error}</pre>
        </div>
      )}

      <div className="bg-white/5 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">
          Todos los viajes (orderBy createdAt): {allTrips.length}
        </h2>
        <pre className="text-xs overflow-auto max-h-96">
          {JSON.stringify(allTrips, null, 2)}
        </pre>
      </div>

      <div className="bg-white/5 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">
          Mis viajes (where createdBy): {myTrips.length}
        </h2>
        <pre className="text-xs overflow-auto max-h-96">
          {JSON.stringify(myTrips, null, 2)}
        </pre>
      </div>

      <div className="bg-white/5 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">
          Filtrado en cliente:
        </h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(
            allTrips.filter(trip => trip.createdBy === user.uid),
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}
