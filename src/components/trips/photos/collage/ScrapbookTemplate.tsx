'use client';

import { forwardRef, useMemo } from 'react';
import type { AlbumPhoto } from '@/types';

interface Props {
  photos: AlbumPhoto[];
  tripTitle: string;
  destination?: string;
  dateRange?: string;
  seed?: number;
  /** Scrapbook is hand-laid to 10 slots; higher values clamp. The
   *  template advertises max=10 to the page UI. */
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

// Hand-laid slots — give a real scrapbook page feel with mixed sizes.
// All slots live BELOW the header band so the title never overlaps.
const SLOTS = [
  // big-medium-medium top row
  { x: 60,  y: 160, w: 320, h: 320, rot: -3, tape: 0, size: 'big' },
  { x: 420, y: 180, w: 240, h: 280, rot: 4,  tape: 1, size: 'med' },
  { x: 700, y: 170, w: 240, h: 240, rot: -5, tape: 2, size: 'med' },
  // small row
  { x: 80,  y: 510, w: 200, h: 200, rot: 6,  tape: 3, size: 'small' },
  { x: 320, y: 530, w: 180, h: 220, rot: -4, tape: 4, size: 'small' },
  { x: 540, y: 510, w: 210, h: 210, rot: 5,  tape: 0, size: 'small' },
  { x: 790, y: 530, w: 180, h: 220, rot: -3, tape: 1, size: 'small' },
  // bottom row
  { x: 100, y: 770, w: 220, h: 220, rot: -6, tape: 2, size: 'small' },
  { x: 360, y: 780, w: 240, h: 210, rot: 3,  tape: 3, size: 'med' },
  { x: 640, y: 770, w: 220, h: 220, rot: -4, tape: 4, size: 'small' },
] as const;

const TAPES = [
  'repeating-linear-gradient(45deg, rgba(255,180,180,0.9) 0 8px, rgba(255,220,220,0.9) 8px 16px)',
  'repeating-linear-gradient(45deg, rgba(180,220,255,0.9) 0 8px, rgba(220,240,255,0.9) 8px 16px)',
  'repeating-linear-gradient(45deg, rgba(255,220,160,0.9) 0 8px, rgba(255,240,200,0.9) 8px 16px)',
  'repeating-linear-gradient(45deg, rgba(200,220,180,0.9) 0 8px, rgba(220,235,200,0.9) 8px 16px)',
  'repeating-linear-gradient(90deg, rgba(220,180,230,0.9) 0 7px, rgba(240,220,245,0.9) 7px 14px)',
];

/** 1080×1080 — Scrapbook page. 10 photos in a magazine-style hand-laid
 *  grid, washi tape, dashed borders, doodles. Title in a slim band at
 *  the top so it never sits on top of photos. */
const ScrapbookTemplate = forwardRef<HTMLDivElement, Props>(function ScrapbookTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = SLOTS.length },
  ref,
) {
  const targetCount = Math.min(SLOTS.length, Math.max(4, count));
  const usable = useMemo(() => {
    const out: AlbumPhoto[] = [];
    const rand = mulberry32(seed);
    void rand;
    while (out.length < targetCount && photos.length > 0) {
      out.push(photos[out.length % photos.length]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, targetCount]);

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background:
          'radial-gradient(circle at 30% 25%, #faf2dc 0%, #f0e3c3 50%, #d9c8a0 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Paper noise */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle, rgba(160,130,80,0.07) 1px, transparent 2px), radial-gradient(circle, rgba(120,90,60,0.05) 1px, transparent 2px)',
          backgroundSize: '8px 8px, 14px 14px',
          backgroundPosition: '0 0, 4px 7px',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Dashed border frame */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          right: 32,
          top: 32,
          bottom: 32,
          border: '2px dashed rgba(120,80,30,0.4)',
          borderRadius: 6,
          pointerEvents: 'none',
        }}
      />

      {/* Title header band */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 60,
          right: 60,
          paddingBottom: 12,
          borderBottom: '2px dashed rgba(120,80,30,0.45)',
          zIndex: 30,
        }}
      >
        {destination && (
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 18,
              letterSpacing: 7,
              color: '#7a5028',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {destination}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
          <h1
            style={{
              fontFamily: 'var(--font-caveat), cursive',
              fontSize: 78,
              fontWeight: 700,
              color: '#2a1a08',
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              transform: 'rotate(-1deg)',
              transformOrigin: 'left',
            }}
          >
            {tripTitle}
          </h1>
          {dateRange && (
            <p
              style={{
                fontFamily: 'var(--font-caveat), cursive',
                fontSize: 26,
                color: '#5a4020',
                margin: 0,
                fontWeight: 400,
              }}
            >
              ~ {dateRange} ~
            </p>
          )}
        </div>
      </div>

      {/* Photos */}
      {SLOTS.slice(0, targetCount).map((slot, i) => {
        const p = usable[i];
        if (!p) return null;
        return (
          <div
            key={`${p.url}-${i}-${seed}`}
            data-photo-url={p.url}
            style={{
              position: 'absolute',
              left: slot.x,
              top: slot.y,
              width: slot.w,
              height: slot.h,
              transform: `rotate(${slot.rot}deg)`,
              zIndex: 10 + i,
            }}
          >
            {/* Washi tape on top */}
            <div
              style={{
                position: 'absolute',
                top: -14,
                left: slot.w / 2 - 45,
                width: 90,
                height: 22,
                background: TAPES[slot.tape % TAPES.length],
                transform: `rotate(${i % 2 === 0 ? -5 : 5}deg)`,
                boxShadow: '0 3px 6px rgba(0,0,0,0.15)',
                zIndex: 5,
              }}
            />
            {/* Print */}
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#fff',
                padding: 8,
                boxShadow: '0 14px 28px rgba(0,0,0,0.30)',
                borderRadius: 2,
              }}
            >
              <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0d1424' }}>
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
        );
      })}

      {/* Doodles overlay */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }} viewBox="0 0 1080 1080">
        {/* Heart doodle */}
        <path
          d="M 980 230 c -6 -14 -26 -14 -26 6 c 0 14 26 28 26 28 c 0 0 26 -14 26 -28 c 0 -20 -20 -20 -26 -6 z"
          fill="rgba(244,63,94,0.55)"
        />
        {/* Star bottom-left */}
        <path
          d="M 60 1020 l 8 16 l 18 2 l -13 13 l 3 18 l -16 -8 l -16 8 l 3 -18 l -13 -13 l 18 -2 z"
          fill="rgba(245,158,11,0.55)"
        />
        {/* Sun top-left near border */}
        <circle cx="60" cy="120" r="14" fill="none" stroke="#7a5028" strokeWidth="2" opacity="0.5" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={60 + Math.cos(a) * 22}
              y1={120 + Math.sin(a) * 22}
              x2={60 + Math.cos(a) * 30}
              y2={120 + Math.sin(a) * 30}
              stroke="#7a5028"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
          );
        })}
      </svg>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 50,
          bottom: 50,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 13,
          letterSpacing: 4,
          color: 'rgba(80,50,20,0.55)',
          zIndex: 60,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default ScrapbookTemplate;
