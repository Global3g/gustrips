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

/** 1080×1080 — Photos rendered as overlapping cards, each tilted by a
 *  small random angle. White borders, real drop shadows. Gives a
 *  thrown-on-the-table editorial feel. */
const TiltedStackTemplate = forwardRef<HTMLDivElement, Props>(function TiltedStackTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 18 },
  ref,
) {
  const HEADER = 130;
  const CANVAS = 1080;
  const NUM = Math.max(6, Math.min(48, count));
  const COLS = NUM <= 6 ? 3 : NUM <= 12 ? 4 : NUM <= 24 ? 5 : NUM <= 36 ? 6 : 7;
  const ROWS = Math.ceil(NUM / COLS);

  const items = useMemo(() => {
    const rand = mulberry32(seed);
    const photoArea = { x: 30, y: HEADER + 15, w: CANVAS - 60, h: CANVAS - HEADER - 30 };
    const cellW = photoArea.w / COLS;
    const cellH = photoArea.h / ROWS;
    // Cards span ~110% of the cell so neighbors overlap nicely.
    const cardSize = Math.min(cellW, cellH) * 1.05;
    const out: { url: string; cx: number; cy: number; rot: number; size: number }[] = [];
    const usable: AlbumPhoto[] = [];
    while (usable.length < NUM && photos.length > 0) {
      usable.push(photos[usable.length % photos.length]);
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        if (idx >= usable.length) break;
        const cx = photoArea.x + c * cellW + cellW / 2 + (rand() - 0.5) * (cellW * 0.18);
        const cy = photoArea.y + r * cellH + cellH / 2 + (rand() - 0.5) * (cellH * 0.18);
        const rot = (rand() - 0.5) * (NUM <= 12 ? 14 : NUM <= 24 ? 8 : 5);
        const size = cardSize * (0.92 + rand() * 0.18);
        out.push({ url: usable[idx].url, cx, cy, rot, size });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, NUM]);

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS,
        height: CANVAS,
        background:
          'radial-gradient(circle at 50% 40%, #1f2940 0%, #0a1628 60%, #050a14 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER,
          padding: '24px 40px 0',
          zIndex: 60,
          color: '#fff',
          background: 'linear-gradient(180deg, rgba(5,10,20,0.9) 0%, transparent 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {destination && (
              <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 16, letterSpacing: 6, color: '#f59e0b', margin: 0, textTransform: 'uppercase' }}>
                {destination}
              </p>
            )}
            <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 60, fontWeight: 900, margin: 0, marginTop: -4, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {tripTitle}
            </h1>
          </div>
          {dateRange && (
            <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontStyle: 'italic', fontSize: 18, color: 'rgba(255,255,255,0.7)', margin: 0, textAlign: 'right', maxWidth: 280 }}>
              {dateRange}
            </p>
          )}
        </div>
      </div>

      {/* Tilted photo cards */}
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
            background: '#fff',
            padding: 8,
            boxShadow: '0 18px 36px rgba(0,0,0,0.55), 0 6px 12px rgba(0,0,0,0.35)',
            borderRadius: 2,
            zIndex: 10 + i,
          }}
        >
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0d1424' }}>
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

export default TiltedStackTemplate;
