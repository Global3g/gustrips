'use client';

/**
 * Vertical scrollable list of every diary entry in the trip. Used as the
 * "Historia" tab on /today. Pure read view — editing happens in the
 * Today tab's DailyDiaryCard.
 *
 * Design intent: should feel like reading a journal, not a list of rows.
 * Big date headers, italic editorial body, generous whitespace between
 * days.
 */

import { useMemo } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { useTripDiary } from '@/hooks/useTripDiary';

interface Props {
  tripId: string;
  /** Trip start/end so we can offer empty-state copy tailored to the stage. */
  tripStartDate?: string;
  tripEndDate?: string;
}

function formatDateHeader(iso: string): { day: string; rest: string } {
  // iso = YYYY-MM-DD. Parse as local so the day name matches the user's
  // expectation regardless of UTC offset.
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const weekday = date.toLocaleDateString('es', { weekday: 'long' });
  const dayNum = date.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  return {
    day: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    rest: dayNum,
  };
}

function relativeLabel(iso: string): string | null {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (iso === todayIso) return 'Hoy';
  const [y, m, d] = iso.split('-').map(Number);
  const entryDate = new Date(y, (m || 1) - 1, d || 1);
  const diff = Math.round((today.getTime() - entryDate.getTime()) / 86_400_000);
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) return `Hace ${diff} días`;
  return null;
}

export default function TripDiaryHistory({ tripId }: Props) {
  const { entries, loading } = useTripDiary(tripId);

  // Group entries so we can render headers / spacing per day with stable keys.
  const grouped = useMemo(() => entries, [entries]);

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white/60 p-5 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="rounded-2xl border p-8 flex flex-col items-center text-center"
        style={{
          background: 'linear-gradient(135deg, #fafaf7 0%, #f4ecd8 100%)',
          borderColor: '#dad5cc',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: '#480003', color: '#fff' }}
        >
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="text-editorial text-xl mb-1.5" style={{ color: '#1a1a1a' }}>
          Tu diario está vacío
        </h3>
        <p className="text-sm leading-relaxed max-w-sm" style={{ color: '#5c5247' }}>
          Andá a la pestaña <strong>Hoy</strong> y tocá &ldquo;Escribir el diario de hoy&rdquo;.
          Cada párrafo va a quedar acá guardado como bitácora del viaje.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map((entry) => {
        const header = formatDateHeader(entry.date);
        const rel = relativeLabel(entry.date);
        return (
          <article
            key={entry.date}
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              background: 'linear-gradient(135deg, #fafaf7 0%, #f4ecd8 100%)',
              borderColor: '#dad5cc',
            }}
          >
            <header className="flex items-baseline justify-between gap-3 mb-3">
              <div>
                <div className="text-eyebrow" style={{ color: '#480003' }}>
                  {rel || header.day}
                </div>
                <h3
                  className="text-editorial text-xl mt-0.5"
                  style={{ color: '#1a1a1a' }}
                >
                  {rel ? header.rest : `${header.day}, ${header.rest}`}
                </h3>
              </div>
              {entry.source === 'ai' && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: 'rgba(72,0,3,0.08)', color: '#480003' }}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  AI
                </span>
              )}
            </header>
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
          </article>
        );
      })}

      {/* Footer hint so the user knows there's nothing else below */}
      <p
        className="text-center text-xs pt-4"
        style={{ color: '#776b63' }}
      >
        Llegaste al inicio del diario.
      </p>
    </div>
  );
}
