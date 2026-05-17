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

// Faux color palette derived from the destination string — gives every
// trip a unique-feeling moodboard palette without actually sampling
// pixels (which would be expensive).
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

function paletteFor(s: string): string[] {
  const h = hashStr(s || 'gus');
  // Generate 6 hsl swatches around a base hue.
  const base = h % 360;
  return [
    `hsl(${base}, 55%, 32%)`,
    `hsl(${(base + 30) % 360}, 45%, 55%)`,
    `hsl(${(base + 180) % 360}, 50%, 60%)`,
    `hsl(${(base + 210) % 360}, 35%, 75%)`,
    `hsl(${(base + 60) % 360}, 50%, 85%)`,
    `hsl(${(base + 90) % 360}, 30%, 90%)`,
  ];
}

const SNIPPETS = [
  'a vibe.',
  'these days, forever.',
  'wherever we go.',
  'the in-between.',
  'felt like home.',
  'small things.',
  'mood: cinema.',
  'we paused.',
];

/** 1080×1080 — Pinterest moodboard editorial. Cream paper background,
 *  mix of photos (some borderless, some with white frame, varied sizes),
 *  text snippets in serif italic, color palette strip, dashed arrows,
 *  small handwritten notes. */
const MoodBoardTemplate = forwardRef<HTMLDivElement, Props>(function MoodBoardTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 12 },
  ref,
) {
  const CANVAS = 1080;
  const NUM = Math.max(4, Math.min(18, count));
  const palette = useMemo(() => paletteFor((destination || tripTitle) ?? ''), [destination, tripTitle]);

  const items = useMemo(() => {
    const rand = mulberry32(seed);
    const cols = NUM <= 6 ? 3 : NUM <= 12 ? 4 : 5;
    const rows = Math.ceil(NUM / cols);
    const photoArea = { x: 60, y: 250, w: CANVAS - 120, h: CANVAS - 320 };
    const cellW = photoArea.w / cols;
    const cellH = photoArea.h / rows;
    const cardSize = Math.min(cellW, cellH) * 0.92;
    const out: { url: string; cx: number; cy: number; rot: number; size: number; framed: boolean; isRound?: boolean }[] = [];
    const usable: AlbumPhoto[] = [];
    while (usable.length < NUM && photos.length > 0) {
      usable.push(photos[usable.length % photos.length]);
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= usable.length) break;
        const cx = photoArea.x + c * cellW + cellW / 2 + (rand() - 0.5) * 16;
        const cy = photoArea.y + r * cellH + cellH / 2 + (rand() - 0.5) * 16;
        const rot = (rand() - 0.5) * 8;
        const size = cardSize * (0.85 + rand() * 0.25);
        const framed = rand() < 0.55;
        const isRound = rand() < 0.2; // few photos as circular cutouts — moodboard signature
        out.push({ url: usable[idx].url, cx, cy, rot, size, framed, isRound });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, NUM]);

  const snippet = useMemo(() => {
    const rand = mulberry32(seed + 42);
    return SNIPPETS[Math.floor(rand() * SNIPPETS.length)];
  }, [seed]);

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS,
        height: CANVAS,
        background:
          'radial-gradient(circle at 30% 25%, #fbf6ea 0%, #f3ebd8 55%, #e3d8be 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header text */}
      <div style={{ position: 'absolute', top: 50, left: 60, right: 60, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            {destination && (
              <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 18, letterSpacing: 9, color: palette[0], margin: 0, textTransform: 'uppercase' }}>
                — {destination}
              </p>
            )}
            <h1
              style={{
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontSize: 80,
                fontWeight: 900,
                fontStyle: 'italic',
                color: '#1f1408',
                margin: 0,
                marginTop: 2,
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
              }}
            >
              {tripTitle}
            </h1>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-caveat), cursive',
              fontSize: 28,
              color: '#3a2a18',
              margin: 0,
              transform: 'rotate(2deg)',
            }}
          >
            {snippet}
          </p>
        </div>
        {/* Color palette strip */}
        <div style={{ display: 'flex', gap: 0, marginTop: 18, height: 18, borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {palette.map((c, i) => (
            <div key={i} style={{ flex: 1, background: c }} />
          ))}
        </div>
        {dateRange && (
          <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontStyle: 'italic', fontSize: 14, color: '#5a4020', margin: 0, marginTop: 8 }}>
            {dateRange}
          </p>
        )}
      </div>

      {/* Photos */}
      {items.map((item, i) => (
        <div
          key={`${item.url}-${i}-${seed}`}
          data-photo-url={item.url}
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
          {item.isRound ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                border: `6px solid ${palette[i % palette.length]}`,
                boxShadow: '0 14px 28px rgba(0,0,0,0.28)',
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
          ) : item.framed ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#fff',
                padding: 8,
                paddingBottom: 22,
                boxShadow: '0 14px 28px rgba(0,0,0,0.28)',
                borderRadius: 2,
              }}
            >
              <div style={{ width: '100%', height: 'calc(100% - 14px)', overflow: 'hidden', background: '#0d1424' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxied(item.url)}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                background: '#0d1424',
                boxShadow: '0 12px 24px rgba(0,0,0,0.22)',
                borderRadius: 6,
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
          )}
        </div>
      ))}

      {/* Dashed arrow doodle */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }} viewBox="0 0 1080 1080">
        <path d="M 90 730 Q 200 700 320 750" stroke="#3a2a18" strokeWidth="2.5" fill="none" strokeDasharray="6 5" opacity="0.5" />
        <path d="M 320 750 L 310 745 L 316 755 Z" fill="#3a2a18" opacity="0.5" />
      </svg>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 40,
          bottom: 30,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 13,
          letterSpacing: 4,
          color: 'rgba(60,40,20,0.55)',
          zIndex: 60,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default MoodBoardTemplate;
