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

/** 1080×1080 — Y2K maximalist pop. Vibrant cyan/magenta/lime gradient
 *  background, chunky tilted photo cards with thick colored borders,
 *  scattered SVG stars and sparkles, washi tape in candy colors,
 *  hand-drawn arrows. Loud and fun. */
const Y2KPopTemplate = forwardRef<HTMLDivElement, Props>(function Y2KPopTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 12 },
  ref,
) {
  const HEADER = 110;
  const CANVAS = 1080;
  const NUM = Math.max(4, Math.min(24, count));

  // Bright pop colors for borders, washi tape, stars, accents.
  const POP = ['#ff5ec4', '#5ee0ff', '#f1ff5e', '#ff7733', '#a45eff', '#5eff8d'];

  const items = useMemo(() => {
    const rand = mulberry32(seed);
    const cols = NUM <= 6 ? 3 : NUM <= 12 ? 4 : NUM <= 18 ? 5 : 6;
    const rows = Math.ceil(NUM / cols);
    const photoArea = { x: 30, y: HEADER + 30, w: CANVAS - 60, h: CANVAS - HEADER - 60 };
    const cellW = photoArea.w / cols;
    const cellH = photoArea.h / rows;
    const cardSize = Math.min(cellW, cellH) * 1.0;
    const out: { url: string; cx: number; cy: number; rot: number; size: number; color: string }[] = [];
    const usable: AlbumPhoto[] = [];
    while (usable.length < NUM && photos.length > 0) {
      usable.push(photos[usable.length % photos.length]);
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= usable.length) break;
        const cx = photoArea.x + c * cellW + cellW / 2 + (rand() - 0.5) * 14;
        const cy = photoArea.y + r * cellH + cellH / 2 + (rand() - 0.5) * 14;
        const rot = (rand() - 0.5) * 16;
        const size = cardSize * (0.92 + rand() * 0.16);
        const color = POP[Math.floor(rand() * POP.length)];
        out.push({ url: usable[idx].url, cx, cy, rot, size, color });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, NUM]);

  // Sparkles scattered over canvas
  const sparkles = useMemo(() => {
    const rand = mulberry32(seed + 99);
    return Array.from({ length: 22 }).map(() => ({
      x: rand() * 1080,
      y: rand() * 1080,
      size: 12 + rand() * 28,
      color: POP[Math.floor(rand() * POP.length)],
      rot: rand() * 360,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS,
        height: CANVAS,
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, #ff8fb1 0%, #ffe27a 25%, #98ffd8 55%, #8ec5ff 85%, #d18cff 100%)',
      }}
    >
      {/* Background grid texture for that Y2K poster feel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />

      {/* Sparkle stars */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }} viewBox="0 0 1080 1080">
        {sparkles.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}>
            <path
              d={`M 0 ${-s.size} L ${s.size * 0.22} ${-s.size * 0.22} L ${s.size} 0 L ${s.size * 0.22} ${s.size * 0.22} L 0 ${s.size} L ${-s.size * 0.22} ${s.size * 0.22} L ${-s.size} 0 L ${-s.size * 0.22} ${-s.size * 0.22} Z`}
              fill={s.color}
              opacity="0.7"
            />
          </g>
        ))}
      </svg>

      {/* BIG chunky title — fills the header band with attitude */}
      <div
        style={{
          position: 'absolute',
          top: 26,
          left: 40,
          right: 40,
          zIndex: 60,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          {destination && (
            <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 20, letterSpacing: 6, color: '#fff', textShadow: '3px 3px 0 #ff1493', margin: 0, textTransform: 'uppercase' }}>
              ★ {destination} ★
            </p>
          )}
          <h1
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 76,
              color: '#fff',
              textShadow: '5px 5px 0 #ff1493, 9px 9px 0 #1a1a8e',
              margin: 0,
              marginTop: -4,
              lineHeight: 1,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              transform: 'rotate(-2deg)',
              transformOrigin: 'left',
            }}
          >
            {tripTitle}
          </h1>
        </div>
        {dateRange && (
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 22,
              letterSpacing: 4,
              color: '#1a1a8e',
              background: '#fff',
              padding: '4px 12px',
              border: '3px solid #1a1a8e',
              boxShadow: '4px 4px 0 #ff1493',
              margin: 0,
              transform: 'rotate(3deg)',
              borderRadius: 6,
            }}
          >
            {dateRange}
          </p>
        )}
      </div>

      {/* Photos with chunky colored borders + washi tape */}
      {items.map((item, i) => (
        <div
          key={`${item.url}-${i}-${seed}`}
          style={{
            position: 'absolute',
            left: item.cx - item.size / 2,
            top: item.cy - item.size / 2,
            width: item.size,
            height: item.size,
            transform: `rotate(${item.rot}deg)`,
            zIndex: 10 + i,
          }}
        >
          {/* Washi tape */}
          <div
            style={{
              position: 'absolute',
              top: -16,
              left: item.size / 2 - 38,
              width: 76,
              height: 24,
              background: `repeating-linear-gradient(45deg, ${item.color} 0 9px, #fff 9px 18px)`,
              transform: `rotate(${i % 2 === 0 ? -6 : 6}deg)`,
              boxShadow: '0 3px 6px rgba(0,0,0,0.18)',
              zIndex: 5,
            }}
          />
          <div
            style={{
              width: '100%',
              height: '100%',
              background: item.color,
              padding: 10,
              boxShadow: `6px 6px 0 #1a1a8e, 0 12px 24px rgba(0,0,0,0.35)`,
              borderRadius: 4,
            }}
          >
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#1a1a8e' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxied(item.url)}
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
          right: 20,
          bottom: 12,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 13,
          letterSpacing: 4,
          color: '#1a1a8e',
          zIndex: 80,
          background: '#fff',
          padding: '2px 10px',
          borderRadius: 4,
          border: '2px solid #1a1a8e',
        }}
      >
        ★ GUSTRIPS
      </div>
    </div>
  );
});

export default Y2KPopTemplate;
