'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

export default function DebugPage() {
  const { user } = useAuth();
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [myTrips, setMyTrips] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch (err: any) {
        console.error('Error:', err);
        setError(err.message);
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
