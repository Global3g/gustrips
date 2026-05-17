'use client';

import { forwardRef, useMemo } from 'react';
import type { AlbumPhoto } from '@/types';

interface Props {
  photos: AlbumPhoto[];
  tripTitle: string;
  destination?: string;
  dateRange?: string;
  seed?: number;
  count?: number;
}

function proxied(url: string): string {
  if (!url.startsWith('https://firebasestorage.googleapis.com')) return url;
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

/** 1080×1080 — One hero photo dominating the top half, the rest of the
 *  photos as a tight grid below. Title baked into the bottom-left of
 *  the hero (legible because the gradient overlay darkens that corner). */
const BigHeroTemplate = forwardRef<HTMLDivElement, Props>(function BigHeroTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 13 },
  ref,
) {
  const CANVAS = 1080;
  const HERO_H = 540;
  const NUM = Math.max(4, Math.min(48, count));
  const GAP = NUM <= 12 ? 5 : NUM <= 24 ? 4 : 3;

  const usable = useMemo(() => {
    const out: AlbumPhoto[] = [];
    void seed;
    while (out.length < NUM && photos.length > 0) {
      out.push(photos[out.length % photos.length]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, NUM]);

  const hero = usable[0];
  const rest = usable.slice(1);
  // Bottom grid: pick cols so cells stay roughly square.
  const restCount = rest.length;
  const cols = restCount <= 6 ? 3 : restCount <= 12 ? 4 : restCount <= 24 ? 6 : restCount <= 36 ? 8 : 10;
  const rows = Math.ceil(restCount / cols);
  const cellW = (CANVAS - GAP * (cols - 1)) / cols;
  const cellH = (CANVAS - HERO_H - GAP * (rows - 1)) / rows;

  return (
    <div
      ref={ref}
      style={{ width: CANVAS, height: CANVAS, background: '#050a14', position: 'relative', overflow: 'hidden' }}
    >
      {/* Hero */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO_H, overflow: 'hidden' }}>
        {hero?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxied(hero.url)}
            alt=""
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Bottom gradient for title contrast */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '60%',
            background: 'linear-gradient(to top, rgba(5,10,20,0.95) 0%, rgba(5,10,20,0.6) 40%, transparent 100%)',
          }}
        />
        {/* Title */}
        <div style={{ position: 'absolute', left: 48, right: 48, bottom: 36, zIndex: 10 }}>
          {destination && (
            <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 18, letterSpacing: 8, color: '#f59e0b', margin: 0, textTransform: 'uppercase' }}>
              {destination}
            </p>
          )}
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 88, fontWeight: 900, color: '#fff', margin: 0, marginTop: 4, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {tripTitle}
          </h1>
          {dateRange && (
            <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontStyle: 'italic', fontSize: 20, color: 'rgba(255,255,255,0.8)', margin: 0, marginTop: 10 }}>
              {dateRange}
            </p>
          )}
        </div>
      </div>

      {/* Grid below */}
      <div
        style={{
          position: 'absolute',
          top: HERO_H,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: `${cellH}px`,
          gap: GAP,
        }}
      >
        {rest.map((p, i) => (
          <div key={`${p.url}-${i}-${seed}`} style={{ background: '#0d1424', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxied(p.url)}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 18,
          bottom: 8,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 11,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.6)',
          zIndex: 20,
          textShadow: '0 1px 4px rgba(0,0,0,0.7)',
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default BigHeroTemplate;
