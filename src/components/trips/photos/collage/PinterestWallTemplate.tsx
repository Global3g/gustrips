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

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1080×1080 — Pinterest-style 4-column masonry. ~20 photos at mixed
 *  aspect-ratios (1:1, 3:4, 4:3) packed into the column with the smallest
 *  current height. Title sits in a slim header band — never on top of
 *  photos. */
const PinterestWallTemplate = forwardRef<HTMLDivElement, Props>(function PinterestWallTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 20 },
  ref,
) {
  const HEADER = 130;
  const CANVAS = 1080;
  const PAD = 12;
  const GAP = 8;
  const COLUMNS = 4;
  const colWidth = (CANVAS - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  // Aspect-ratio pool — varied so columns end up at different heights.
  const ASPECTS = [1, 4 / 5, 3 / 4, 1, 5 / 4, 4 / 3, 1] as const;

  const layout = useMemo(() => {
    const rand = mulberry32(seed);
    // Greedy: keep adding photos to the shortest column until we run out
    // of vertical room. Cap at ~20 photos so each one is readable.
    const columns: { items: { url: string; aspect: number; h: number }[]; total: number }[] = [];
    for (let i = 0; i < COLUMNS; i++) columns.push({ items: [], total: 0 });
    const maxItems = photos.length === 0 ? 0 : Math.max(4, Math.min(48, count));
    const usable: AlbumPhoto[] = [];
    while (usable.length < maxItems && photos.length > 0) {
      usable.push(photos[usable.length % photos.length]);
    }
    for (const p of usable) {
      // shortest column
      columns.sort((a, b) => a.total - b.total);
      const target = columns[0];
      const aspect = ASPECTS[Math.floor(rand() * ASPECTS.length)];
      const h = Math.round(colWidth / aspect);
      target.items.push({ url: p.url, aspect, h });
      target.total += h + GAP;
    }
    // Return columns in their original left-to-right order.
    columns.sort((a, b) => a.items.length === 0 ? 1 : b.items.length === 0 ? -1 : 0);
    return columns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed]);

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS,
        height: CANVAS,
        background: '#0a1628',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header band */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER,
          background: 'linear-gradient(180deg, #0a1628 0%, #122742 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          zIndex: 30,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 16,
              letterSpacing: 6,
              color: '#f59e0b',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {destination || 'Mi viaje'}
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: 64,
              fontWeight: 900,
              color: '#fff',
              margin: 0,
              marginTop: -4,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {tripTitle}
          </h1>
        </div>
        {dateRange && (
          <p
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontStyle: 'italic',
              fontSize: 18,
              color: 'rgba(255,255,255,0.75)',
              margin: 0,
              textAlign: 'right',
              maxWidth: 260,
            }}
          >
            {dateRange}
          </p>
        )}
      </div>

      {/* Columns — clip overflow so photos that don't fit just get cut at the bottom */}
      <div
        style={{
          position: 'absolute',
          top: HEADER,
          left: PAD,
          right: PAD,
          bottom: 0,
          display: 'flex',
          gap: GAP,
          overflow: 'hidden',
        }}
      >
        {layout.map((col, ci) => (
          <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP }}>
            {col.items.map((item, i) => (
              <div
                key={`${item.url}-${ci}-${i}-${seed}`}
                data-photo-url={item.url}
                style={{
                  width: '100%',
                  height: item.h,
                  background: '#0d1424',
                  borderRadius: 12,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxied(item.url)}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

export default PinterestWallTemplate;
