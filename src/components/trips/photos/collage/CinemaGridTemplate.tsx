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

/** 1080×1080 — clean symmetric grid like a contact sheet. Tight black
 *  gaps, soft inner shadow on each cell, no rotation. Title in slim
 *  header band. Best aesthetic with 12, 24, 36, 48 photos. */
const CinemaGridTemplate = forwardRef<HTMLDivElement, Props>(function CinemaGridTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 24 },
  ref,
) {
  const HEADER = 130;
  const CANVAS = 1080;
  const GAP = 4;
  const NUM = Math.max(4, Math.min(48, count));
  // Pick a grid shape whose cells are close to SQUARE for the given canvas.
  // Previous heuristic optimized only for "no empty cells", which gave 3×8
  // grids for 24 photos — ugly tall sliver cells. Now we score each
  // candidate by how close its cell aspect ratio gets to 1, with a small
  // penalty for empty trailing cells.
  const { cols, rows } = useMemo(() => {
    const canvasW = 1080;
    const canvasH = 1080 - HEADER;
    let bestCols = Math.ceil(Math.sqrt(NUM));
    let bestRows = Math.ceil(NUM / bestCols);
    let bestScore = Infinity;
    for (let c = 2; c <= NUM; c++) {
      const r = Math.ceil(NUM / c);
      const cellW = canvasW / c;
      const cellH = canvasH / r;
      // log(aspect) measures distance from square in both directions equally.
      const aspectPenalty = Math.abs(Math.log(cellW / cellH));
      const emptyPenalty = (c * r - NUM) * 0.18;
      const score = aspectPenalty + emptyPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestCols = c;
        bestRows = r;
      }
    }
    return { cols: bestCols, rows: bestRows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [NUM]);

  const usable = useMemo(() => {
    const out: AlbumPhoto[] = [];
    void seed;
    while (out.length < NUM && photos.length > 0) {
      out.push(photos[out.length % photos.length]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, NUM]);

  return (
    <div
      ref={ref}
      style={{ width: CANVAS, height: CANVAS, background: '#050a14', position: 'relative', overflow: 'hidden' }}
    >
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
            CONTACT SHEET · {NUM}
          </p>
        </div>
      </div>

      {/* Grid — 1fr on both axes so cells divide the available area exactly,
          regardless of how many photos. No overflow ever. */}
      <div
        style={{
          position: 'absolute',
          top: HEADER,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: GAP,
        }}
      >
        {usable.map((p, i) => (
          <div
            key={`${p.url}-${i}-${seed}`}
            data-photo-url={p.url}
            style={{
              width: '100%',
              height: '100%',
              background: '#0d1424',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
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
        ))}
      </div>
    </div>
  );
});

export default CinemaGridTemplate;
