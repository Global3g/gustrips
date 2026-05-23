'use client';

/**
 * Live subscription to a trip's diary subcollection. Returns entries
 * sorted descending by date (newest day first) so the "Historia" tab
 * reads like a journal — today on top, scroll down to revisit older
 * days.
 *
 * Doc shape (written by DailyDiaryCard):
 *   trips/<tripId>/diary/<YYYY-MM-DD>
 *     { content, generatedAt, source, updatedAt }
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';

export interface DiaryEntry {
  date: string; // YYYY-MM-DD (the doc id)
  content: string;
  generatedAt?: string;
  source?: 'ai' | 'manual';
}

export function useTripDiary(tripId: string): { entries: DiaryEntry[]; loading: boolean } {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const db = getClientDb();
    // Order by document id (which is the date) descending. Firestore
    // orders strings lexicographically, and YYYY-MM-DD strings sort
    // chronologically as-is, so this works without a secondary field.
    const ref = collection(db, `trips/${tripId}/diary`);
    const q = query(ref, orderBy('__name__', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: DiaryEntry[] = snap.docs.map((d) => {
          const data = d.data() as Omit<DiaryEntry, 'date'>;
          return {
            date: d.id,
            content: data.content || '',
            generatedAt: data.generatedAt,
            source: data.source,
          };
        });
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[useTripDiary] subscription error', err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [tripId]);

  return { entries, loading };
}
