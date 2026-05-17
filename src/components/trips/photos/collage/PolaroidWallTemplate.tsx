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

const TAPES = [
  'repeating-linear-gradient(45deg, rgba(255,180,180,0.9) 0 9px, rgba(255,220,220,0.9) 9px 18px)',
  'repeating-linear-gradient(45deg, rgba(180,220,255,0.9) 0 9px, rgba(220,240,255,0.9) 9px 18px)',
  'repeating-linear-gradient(45deg, rgba(255,220,160,0.9) 0 9px, rgba(255,240,200,0.9) 9px 18px)',
  'repeating-linear-gradient(45deg, rgba(200,220,180,0.9) 0 9px, rgba(220,235,200,0.9) 9px 18px)',
  'repeating-linear-gradient(90deg, rgba(220,180,230,0.9) 0 7px, rgba(240,220,245,0.9) 7px 14px)',
];

/** 1080×1080 — 12-polaroid wall. Title lives in a slim header band so it
 *  never overlaps photos. Polaroids are placed in a loose 4×3 grid with
 *  per-card rotation and washi tape — feels scattered without leaving big
 *  empty corners. */
const PolaroidWallTemplate = forwardRef<HTMLDivElement, Props>(function PolaroidWallTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 12 },
  ref,
) {
  const HEADER = 130;
  const CANVAS = 1080;
  // Pick grid dimensions that fit the chosen count cleanly.
  const COUNT = Math.max(4, Math.min(48, count));
  const COLS = COUNT <= 6 ? 3 : COUNT <= 12 ? 4 : COUNT <= 24 ? 6 : COUNT <= 36 ? 6 : 8;
  const ROWS = Math.ceil(COUNT / COLS);
  // Card size shrinks as the grid grows so everything fits.
  const baseW = (CANVAS - 40) / COLS;
  const baseH = (CANVAS - HEADER - 40) / ROWS;
  const CARD = Math.min(baseW, baseH) - 16;
  const photoArea = { x: 0, y: HEADER, w: CANVAS, h: CANVAS - HEADER };
  const cellW = photoArea.w / COLS;
  const cellH = photoArea.h / ROWS;
  // Jitter & rotation scale down as the grid gets denser, otherwise
  // higher counts overlap too much.
  const jitter = COUNT <= 12 ? 24 : COUNT <= 24 ? 12 : 6;
  const rotMax = COUNT <= 12 ? 9 : COUNT <= 24 ? 5 : 3;

  const placed = useMemo(() => {
    const rand = mulberry32(seed);
    const out: { url: string; cx: number; cy: number; rot: number; tape: number }[] = [];
    const usable: AlbumPhoto[] = [];
    while (usable.length < COUNT && photos.length > 0) {
      usable.push(photos[usable.length % photos.length]);
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const p = usable[idx];
        if (!p) continue;
        // Center jitter within the cell so polaroids feel hand-laid
        const cx = photoArea.x + c * cellW + cellW / 2 + (rand() - 0.5) * jitter;
        const cy = photoArea.y + r * cellH + cellH / 2 + (rand() - 0.5) * jitter;
        const rot = (rand() - 0.5) * rotMax * 2;
        out.push({ url: p.url, cx, cy, rot, tape: Math.floor(rand() * TAPES.length) });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed]);

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS,
        height: CANVAS,
        background:
          'radial-gradient(circle at 50% 50%, #c39e6d 0%, #9d7244 70%, #6f4f2c 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Cork dots */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle, rgba(80,50,20,0.15) 1px, transparent 1.5px), radial-gradient(circle, rgba(60,40,15,0.10) 1px, transparent 1.5px)',
          backgroundSize: '12px 12px, 18px 18px',
          backgroundPosition: '0 0, 6px 9px',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Header band — title NEVER overlaps photos */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER,
          background: 'linear-gradient(180deg, rgba(45,25,8,0.85) 0%, transparent 100%)',
          padding: '24px 40px 0',
          zIndex: 60,
          color: '#fff',
        }}
      >
        {destination && (
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 16,
              letterSpacing: 7,
              color: '#fde68a',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {destination}
          </p>
        )}
        <h1
          style={{
            fontFamily: 'var(--font-caveat), cursive',
            fontSize: 78,
            fontWeight: 700,
            margin: 0,
            marginTop: -6,
            lineHeight: 1,
            textShadow: '0 4px 12px rgba(0,0,0,0.4)',
            letterSpacing: '-0.01em',
          }}
        >
          {tripTitle}
        </h1>
        {dateRange && (
          <p
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontStyle: 'italic',
              fontSize: 16,
              color: 'rgba(255,255,255,0.75)',
              margin: 0,
              marginTop: 2,
            }}
          >
            {dateRange}
          </p>
        )}
      </div>

      {/* 12 Polaroids in a 4x3 grid (with jitter + rotation) */}
      {placed.map((p, i) => (
        <div
          key={`${p.url}-${i}-${seed}`}
          style={{
            position: 'absolute',
            left: p.cx - CARD / 2,
            top: p.cy - CARD / 2,
            width: CARD,
            height: CARD,
            transform: `rotate(${p.rot}deg)`,
            zIndex: 10 + i,
          }}
        >
          {/* Washi tape */}
          <div
            style={{
              position: 'absolute',
              top: -14,
              left: CARD / 2 - 40,
              width: 80,
              height: 22,
              background: TAPES[p.tape],
              transform: `rotate(${(i % 2 === 0 ? -5 : 5) + (i % 3) * 2}deg)`,
              boxShadow: '0 3px 6px rgba(0,0,0,0.18)',
              zIndex: 5,
            }}
          />
          {/* Polaroid */}
          <div
            style={{
              width: CARD,
              height: CARD,
              background: '#fff',
              padding: 10,
              boxShadow: '0 18px 40px rgba(0,0,0,0.55), 0 6px 12px rgba(0,0,0,0.35)',
              borderRadius: 2,
            }}
          >
            <div style={{ width: CARD - 20, height: CARD - 20, overflow: 'hidden', background: '#0d1424' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxied(p.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 14,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 13,
          letterSpacing: 4,
          color: 'rgba(255,255,255,0.55)',
          zIndex: 70,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default PolaroidWallTemplate;
