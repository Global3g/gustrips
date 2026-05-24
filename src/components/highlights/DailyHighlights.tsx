'use client';

/**
 * Daily highlights — surfaces the top 3 photos of the current day in a
 * horizontal carousel. Sits below the DailyDiaryCard in /today during an
 * active trip and asks /api/highlights to do the curation work.
 *
 * Lifecycle
 * ---------
 * - Mount with { tripId, date } → fire one fetch.
 * - On success: render the three cards. Each card shows the photo, an
 *   italic Fraunces caption, and a sotto-voce reason line.
 * - On empty / no photos for the date: render a quiet empty state.
 * - On error: keep silent (no destructive toast) but log to console — this
 *   component is a "nice to have", and a Gemini hiccup shouldn't shout at
 *   the user mid-day.
 *
 * We do NOT persist the result. Photos and captions can change throughout
 * the day; the user is better served by a fresh take each time they reopen
 * /today than by a stale snapshot from this morning.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Sparkles, Camera, Loader2 } from 'lucide-react';
import { getClientAuth } from '@/lib/firebase/client';

interface Highlight {
  photoUrl: string;
  caption: string;
  reason: string;
}

interface Props {
  tripId: string;
  date: string; // YYYY-MM-DD
}

export default function DailyHighlights({ tripId, date }: Props) {
  const [highlights, setHighlights] = useState<Highlight[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      setErrored(false);
      setHighlights(null);
      try {
        const user = getClientAuth().currentUser;
        if (!user) {
          // Auth not ready yet — bail quietly. The parent re-mounts us once
          // the page-level data resolves, so we'll get another chance.
          if (!cancelled) {
            setLoading(false);
            setHighlights([]);
          }
          return;
        }
        const token = await user.getIdToken();
        const res = await fetch('/api/highlights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tripId, date }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `HTTP ${res.status}`);
        }
        const list: Highlight[] = Array.isArray(json.highlights) ? json.highlights : [];
        setHighlights(list);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (cancelled) return;
        console.warn('[highlights] fetch failed', err);
        setErrored(true);
        setHighlights([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [tripId, date]);

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{
          background: 'linear-gradient(135deg, #fafaf7 0%, #f4ecd8 100%)',
          borderColor: '#dad5cc',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4" style={{ color: '#480003' }} />
          <span className="text-eyebrow" style={{ color: '#480003' }}>
            Highlights del día
          </span>
          <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" style={{ color: '#480003' }} />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-56 sm:w-64 h-72 rounded-xl animate-pulse"
              style={{
                background: 'rgba(72,0,3,0.06)',
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty: no photos for this date (or the model returned nothing).
  if (!highlights || highlights.length === 0) {
    if (errored) {
      // Don't spook the user with an error UI for an enhancement card;
      // render the same quiet empty state.
    }
    return (
      <div
        className="rounded-2xl border p-5 sm:p-6 flex items-start gap-4"
        style={{
          background: 'linear-gradient(135deg, #fafaf7 0%, #f4ecd8 100%)',
          borderColor: '#dad5cc',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(72,0,3,0.08)', color: '#480003' }}
        >
          <Camera className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-eyebrow" style={{ color: '#480003' }}>
            Highlights del día
          </div>
          <h3
            className="text-editorial-italic text-lg mt-1"
            style={{ color: '#1a1a1a' }}
          >
            Todavía no hay fotos de hoy
          </h3>
          <p className="text-sm mt-1.5" style={{ color: '#5c5247' }}>
            Cuando subas alguna, te elegimos las tres mejores acá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        background: 'linear-gradient(135deg, #fafaf7 0%, #f4ecd8 100%)',
        borderColor: '#dad5cc',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4" style={{ color: '#480003' }} />
        <span className="text-eyebrow" style={{ color: '#480003' }}>
          Highlights del día
        </span>
        <span
          className="inline-flex items-center gap-0.5 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ml-1"
          style={{ background: 'rgba(72,0,3,0.08)', color: '#480003' }}
        >
          AI
        </span>
      </div>

      {/* Horizontal carousel — snap on mobile, fluid on desktop */}
      <div
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin"
        style={{ scrollPaddingLeft: '0.25rem' }}
      >
        {highlights.map((h, i) => (
          <motion.div
            key={`${h.photoUrl}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.08 }}
            className="flex-shrink-0 w-56 sm:w-64 snap-start"
          >
            <div
              className="relative w-full h-72 rounded-xl overflow-hidden shadow-sm"
              style={{ background: 'rgba(72,0,3,0.08)' }}
            >
              {/* next/image with `unoptimized` so we don't have to whitelist
                  Firebase Storage hosts here; the URLs already come from
                  Storage which serves them efficiently. */}
              <Image
                src={h.photoUrl}
                alt={h.caption}
                fill
                sizes="(max-width: 640px) 14rem, 16rem"
                className="object-cover"
                unoptimized
              />
              {/* Subtle bottom gradient to anchor the caption block below */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)',
                }}
              />
            </div>

            <div className="mt-3 px-1">
              <p
                className="text-base leading-snug"
                style={{
                  color: '#1a1a1a',
                  fontFamily: 'var(--font-fraunces), Georgia, serif',
                  fontStyle: 'italic',
                  fontVariationSettings: '"opsz" 96',
                }}
              >
                {h.caption}
              </p>
              {h.reason && (
                <p
                  className="text-[11px] mt-1.5 leading-relaxed"
                  style={{ color: '#5c5247' }}
                >
                  {h.reason}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
