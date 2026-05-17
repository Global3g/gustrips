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

interface Tile {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

// Hand-tuned bento layouts. Each entry is a CSS grid placement (1-based).
// Grids are sized so the cells stay roughly square against the post-header
// canvas (1080 × 950). For counts >24 we fall back to the algorithm in
// generateBento.
const PATTERNS: Record<number, { cols: number; rows: number; tiles: Tile[] }> = {
  6: {
    cols: 4, rows: 3,
    tiles: [
      { col: 1, row: 1, colSpan: 2, rowSpan: 2 }, // hero
      { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 4, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 3, row: 2, colSpan: 2, rowSpan: 1 },
      { col: 1, row: 3, colSpan: 2, rowSpan: 1 },
      { col: 3, row: 3, colSpan: 2, rowSpan: 1 },
    ],
  },
  12: {
    cols: 6, rows: 5,
    tiles: [
      { col: 1, row: 1, colSpan: 3, rowSpan: 3 }, // hero
      { col: 4, row: 1, colSpan: 2, rowSpan: 1 },
      { col: 6, row: 1, colSpan: 1, rowSpan: 2 },
      { col: 4, row: 2, colSpan: 2, rowSpan: 2 },
      { col: 6, row: 3, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 4, colSpan: 2, rowSpan: 2 },
      { col: 3, row: 4, colSpan: 1, rowSpan: 1 },
      { col: 4, row: 4, colSpan: 1, rowSpan: 1 },
      { col: 5, row: 4, colSpan: 2, rowSpan: 1 },
      { col: 3, row: 5, colSpan: 1, rowSpan: 1 },
      { col: 4, row: 5, colSpan: 2, rowSpan: 1 },
      { col: 6, row: 5, colSpan: 1, rowSpan: 1 },
    ],
  },
  24: {
    cols: 6, rows: 6,
    tiles: [
      { col: 1, row: 1, colSpan: 2, rowSpan: 2 }, // hero
      { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 4, row: 1, colSpan: 2, rowSpan: 2 }, // medium
      { col: 6, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 3, row: 2, colSpan: 1, rowSpan: 1 },
      { col: 6, row: 2, colSpan: 1, rowSpan: 1 },
      // row 3
      { col: 1, row: 3, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 3, colSpan: 1, rowSpan: 1 },
      { col: 3, row: 3, colSpan: 1, rowSpan: 1 },
      { col: 4, row: 3, colSpan: 2, rowSpan: 2 }, // medium
      { col: 6, row: 3, colSpan: 1, rowSpan: 1 },
      // row 4
      { col: 1, row: 4, colSpan: 2, rowSpan: 2 }, // medium
      { col: 3, row: 4, colSpan: 1, rowSpan: 1 },
      { col: 6, row: 4, colSpan: 1, rowSpan: 1 },
      // row 5
      { col: 3, row: 5, colSpan: 1, rowSpan: 1 },
      { col: 4, row: 5, colSpan: 1, rowSpan: 1 },
      { col: 5, row: 5, colSpan: 1, rowSpan: 1 },
      { col: 6, row: 5, colSpan: 1, rowSpan: 1 },
      // row 6
      { col: 1, row: 6, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 6, colSpan: 1, rowSpan: 1 },
      { col: 3, row: 6, colSpan: 1, rowSpan: 1 },
      { col: 4, row: 6, colSpan: 1, rowSpan: 1 },
      { col: 5, row: 6, colSpan: 1, rowSpan: 1 },
      { col: 6, row: 6, colSpan: 1, rowSpan: 1 },
    ],
  },
};

/** 1080×1080 — Apple-style bento grid. Hand-tuned asymmetric tile
 *  compositions for 6 / 12 / 24 photos, biggest hero at top-left.
 *  Title in slim header band so it never overlaps photos. */
const BentoTemplate = forwardRef<HTMLDivElement, Props>(function BentoTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 12 },
  ref,
) {
  const HEADER = 130;
  const CANVAS = 1080;
  const GAP = 8;

  // Pick the pattern whose tile-count is closest to `count` (not exceeding).
  const chosen = useMemo(() => {
    if (PATTERNS[count]) return PATTERNS[count];
    const keys = Object.keys(PATTERNS).map(Number).sort((a, b) => a - b);
    let pick = keys[0];
    for (const k of keys) {
      if (k <= count) pick = k;
    }
    return PATTERNS[pick];
  }, [count]);

  const usable = useMemo(() => {
    const out: AlbumPhoto[] = [];
    void seed;
    while (out.length < chosen.tiles.length && photos.length > 0) {
      out.push(photos[out.length % photos.length]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, chosen]);

  return (
    <div ref={ref} style={{ width: CANVAS, height: CANVAS, background: '#0a1628', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER,
          background: '#0a1628',
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
            {destination || 'Mi viaje'}
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 60, fontWeight: 900, color: '#fff', margin: 0, marginTop: -4, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {tripTitle}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          {dateRange && (
            <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontStyle: 'italic', fontSize: 18, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
              {dateRange}
            </p>
          )}
          <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 13, letterSpacing: 4, color: 'rgba(255,255,255,0.40)', margin: 0, marginTop: 4 }}>
            BENTO · {chosen.tiles.length}
          </p>
        </div>
      </div>

      {/* Bento grid */}
      <div
        style={{
          position: 'absolute',
          top: HEADER + GAP,
          left: GAP,
          right: GAP,
          bottom: GAP,
          display: 'grid',
          gridTemplateColumns: `repeat(${chosen.cols}, 1fr)`,
          gridTemplateRows: `repeat(${chosen.rows}, 1fr)`,
          gap: GAP,
        }}
      >
        {chosen.tiles.map((tile, i) => {
          const p = usable[i];
          if (!p) return null;
          return (
            <div
              key={`${p.url}-${i}-${seed}`}
              data-photo-url={p.url}
              style={{
                gridColumn: `${tile.col} / span ${tile.colSpan}`,
                gridRow: `${tile.row} / span ${tile.rowSpan}`,
                background: '#0d1424',
                overflow: 'hidden',
                borderRadius: 14,
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxied(p.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default BentoTemplate;
