'use client';

/**
 * Daily diary card — surfaces (or generates) the trip's diary entry for a
 * given day. Lives at the bottom of /today during an active trip so the
 * user can close the day with a tap.
 *
 *   - If no entry exists in Firestore yet: shows a CTA "Escribir el
 *     diario de hoy". Tap → calls /api/diary, persists the result.
 *   - If an entry exists: renders it as italic editorial text. The user
 *     can tap "Editar" to switch to a textarea + Save / "Regenerar" to
 *     ask Gemini for a new draft (the existing text gets replaced after
 *     a confirm).
 *
 * Persistence path: trips/<tripId>/diary/<YYYY-MM-DD>
 *   { content: string, generatedAt: string (ISO), source: 'ai' | 'manual' }
 */

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Sparkles, Loader2, BookOpen, Pencil, RefreshCw, Save, X } from 'lucide-react';
import { getClientDb, getClientAuth } from '@/lib/firebase/client';

interface DiaryEntry {
  content: string;
  generatedAt?: string;
  source?: 'ai' | 'manual';
}

interface Props {
  tripId: string;
  date: string; // YYYY-MM-DD
}

export default function DailyDiaryCard({ tripId, date }: Props) {
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Load whatever's persisted in Firestore for today. Done client-side
  // so the read uses the user's own creds (rules enforce access).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getClientDb();
        const ref = doc(db, 'trips', tripId, 'diary', date);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as DiaryEntry;
          setEntry(data);
          setDraft(data.content || '');
        }
      } catch (err) {
        console.warn('[diary] load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId, date]);

  const generate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const user = getClientAuth().currentUser;
      if (!user) throw new Error('no-user');
      const token = await user.getIdToken();
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tripId, date }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Error ${res.status}`);
      }
      const newEntry: DiaryEntry = {
        content: json.content,
        generatedAt: new Date().toISOString(),
        source: 'ai',
      };
      // Persist immediately.
      const db = getClientDb();
      await setDoc(doc(db, 'trips', tripId, 'diary', date), {
        ...newEntry,
        updatedAt: serverTimestamp(),
      });
      setEntry(newEntry);
      setDraft(newEntry.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido';
      setError(`No pude generar el diario: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const newEntry: DiaryEntry = {
        content: draft.trim(),
        generatedAt: entry?.generatedAt || new Date().toISOString(),
        source: 'manual',
      };
      const db = getClientDb();
      await setDoc(doc(db, 'trips', tripId, 'diary', date), {
        ...newEntry,
        updatedAt: serverTimestamp(),
      });
      setEntry(newEntry);
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido';
      setError(`No pude guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    // Compact placeholder so the card slot doesn't jump on load
    return (
      <div className="rounded-2xl border border-gray-200 bg-white/60 p-5 animate-pulse h-32" />
    );
  }

  // ── Empty state: invite generation ──
  if (!entry) {
    return (
      <div
        className="rounded-2xl border p-5 flex items-start gap-4"
        style={{
          background: 'linear-gradient(135deg, #fafaf7 0%, #f4ecd8 100%)',
          borderColor: '#dad5cc',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#480003', color: '#fff' }}
        >
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-eyebrow" style={{ color: '#480003' }}>
            Diario del día
          </div>
          <h3 className="text-editorial text-xl mt-1" style={{ color: '#1a1a1a' }}>
            Cerremos el día con un párrafo
          </h3>
          <p className="text-sm leading-relaxed mt-1 mb-4" style={{ color: '#5c5247' }}>
            Tomamos los eventos, gastos y fotos de hoy y armamos una nota corta
            con tono cálido. Después la podés editar o regenerar.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#480003', color: '#fff' }}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Escribiendo…' : 'Escribir el diario de hoy'}
          </button>
          {error && (
            <p className="mt-3 text-xs" style={{ color: '#dc2626' }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Render existing entry, with edit / regenerate affordances ──
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        background: 'linear-gradient(135deg, #fafaf7 0%, #f4ecd8 100%)',
        borderColor: '#dad5cc',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" style={{ color: '#480003' }} />
          <span className="text-eyebrow" style={{ color: '#480003' }}>
            Diario del día
          </span>
          {entry.source === 'ai' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(72,0,3,0.08)', color: '#480003' }}>
              <Sparkles className="w-2.5 h-2.5" />
              AI
            </span>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setDraft(entry.content); setEditing(true); }}
              aria-label="Editar"
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/5 text-gray-600"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              aria-label="Regenerar"
              title="Reemplazar con un nuevo borrador AI"
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/5 text-gray-600 disabled:opacity-40"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-base leading-relaxed outline-none focus:border-amber-400"
            style={{ fontFamily: 'var(--font-fraunces), serif', fontStyle: 'italic' }}
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => { setDraft(entry.content); setEditing(false); }}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-black/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving || !draft.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: '#480003' }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </>
      ) : (
        <p
          className="text-base leading-relaxed"
          style={{
            color: '#1a1a1a',
            fontFamily: 'var(--font-fraunces), serif',
            fontStyle: 'italic',
            fontVariationSettings: '"opsz" 96',
          }}
        >
          {entry.content}
        </p>
      )}

      {error && (
        <p className="mt-3 text-xs" style={{ color: '#dc2626' }}>{error}</p>
      )}
    </div>
  );
}
