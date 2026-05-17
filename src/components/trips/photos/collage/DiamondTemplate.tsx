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

/** 1080×1080 — Diamond grid. Square photos rotated 45° tile together
 *  to form a diamond/argyle pattern. Title at top in slim band.
 *  Best at 4, 6, 9, 12, 16 photos (square numbers and triangular). */
const DiamondTemplate = forwardRef<HTMLDivElement, Props>(function DiamondTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 12 },
  ref,
) {
  const HEADER = 120;
  const CANVAS = 1080;
  const NUM = Math.max(4, Math.min(24, count));

  // Diamonds tile in a brick-like pattern: alternate rows are shifted by
  // half a diamond. cellSize = full diagonal of each diamond.
  const cols = NUM <= 6 ? 3 : NUM <= 12 ? 4 : NUM <= 18 ? 5 : 6;
  // 1.5 because alternating rows shift up by half: tile vertical spacing = 0.5 * size.
  const rowsNeeded = Math.ceil(NUM / cols);
  // Available area (post-header)
  const availW = CANVAS;
  const availH = CANVAS - HEADER;
  // Each row's vertical advance is cellH * 0.5 because diamonds interlock.
  const cellH = availH / (rowsNeeded * 0.5 + 0.5);
  const cellW = availW / (cols + 0.5);
  const cellSize = Math.min(cellW, cellH) * 0.92;

  const items = useMemo(() => {
    const out: { url: string; cx: number; cy: number }[] = [];
    void seed;
    const usable: AlbumPhoto[] = [];
    while (usable.length < NUM && photos.length > 0) {
      usable.push(photos[usable.length % photos.length]);
    }
    let idx = 0;
    const startX = (CANVAS - cols * cellSize) / 2 + cellSize / 2;
    const startY = HEADER + cellSize / 2 + 10;
    for (let r = 0; r < rowsNeeded; r++) {
      const isOdd = r % 2 === 1;
      const colsThisRow = isOdd ? cols - 1 : cols;
      const xOffset = isOdd ? cellSize / 2 : 0;
      for (let c = 0; c < colsThisRow; c++) {
        if (idx >= usable.length) break;
        const cx = startX + xOffset + c * cellSize;
        const cy = startY + r * cellSize * 0.5;
        out.push({ url: usable[idx].url, cx, cy });
        idx++;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, NUM, cellSize]);

  return (
    <div ref={ref} style={{ width: CANVAS, height: CANVAS, background: '#050a14', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER,
          background: '#050a14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          zIndex: 30,
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 16, letterSpacing: 6, color: '#f59e0b', margin: 0, textTransform: 'uppercase' }}>
            ◆ {destination || 'Mi viaje'} ◆
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 56, fontWeight: 900, color: '#fff', margin: 0, marginTop: -4, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {tripTitle}
          </h1>
        </div>
        {dateRange && (
          <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontStyle: 'italic', fontSize: 16, color: 'rgba(255,255,255,0.75)', margin: 0, textAlign: 'right', maxWidth: 260 }}>
            {dateRange}
          </p>
        )}
      </div>

      {/* Diamonds */}
      {items.map((item, i) => (
        <div
          key={`${item.url}-${i}-${seed}`}
          style={{
            position: 'absolute',
            left: item.cx - cellSize / 2,
            top: item.cy - cellSize / 2,
            width: cellSize,
            height: cellSize,
            transform: 'rotate(45deg)',
            overflow: 'hidden',
            background: '#0d1424',
            boxShadow: '0 8px 18px rgba(0,0,0,0.55)',
          }}
        >
          {/* Inner image is counter-rotated so it appears upright inside
              the diamond. Slightly oversized to cover corners cleanly. */}
          <div style={{ width: '100%', height: '100%', transform: 'rotate(-45deg) scale(1.42)', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxied(item.url)}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      ))}

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 14,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 13,
          letterSpacing: 4,
          color: 'rgba(255,255,255,0.45)',
          zIndex: 80,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default DiamondTemplate;
