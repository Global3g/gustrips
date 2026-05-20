'use client';

import { forwardRef, useMemo } from 'react';
import type { AlbumPhoto } from '@/types';

interface Props {
  photos: AlbumPhoto[];
  tripTitle: string;
  destination?: string;
  dateRange?: string;
  /** Re-render the layout when this changes (the parent shuffle button
   *  bumps it). Without this the useMemo would never recompute. */
  seed?: number;
  /** How many photo slots to generate. Defaults to 26. Common values:
   *  6, 12, 24, 36, 48. */
  count?: number;
}

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

function proxied(url: string): string {
  if (!url.startsWith('https://firebasestorage.googleapis.com')) return url;
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

/** Deterministic PRNG based on a single integer seed. Lets the layout
 *  stay stable per seed while still feeling random. */
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

/** Recursive split layout — same idea as the open-source PhotoCollage
 *  poster generator. Repeatedly pick the largest remaining slot and split
 *  it down its long axis at ~40-60% to keep aspect ratios sane. Result:
 *  every photo gets a chunky slot, the whole canvas is filled, no two
 *  layouts look the same. */
function generateMosaicSlots(
  targetCount: number,
  totalW: number,
  totalH: number,
  seed: number,
): Slot[] {
  const rand = mulberry32(seed);
  const slots: Slot[] = [{ x: 0, y: 0, w: totalW, h: totalH }];
  while (slots.length < targetCount) {
    // Pop the largest slot (by area) — splitting bigger boxes first keeps
    // the final mosaic relatively uniform.
    slots.sort((a, b) => b.w * b.h - a.w * a.h);
    const big = slots.shift() as Slot;
    const splitVertical = big.w > big.h;
    const ratio = 0.4 + rand() * 0.2; // 40-60%
    if (splitVertical) {
      const w1 = Math.round(big.w * ratio);
      slots.push({ x: big.x, y: big.y, w: w1, h: big.h });
      slots.push({ x: big.x + w1, y: big.y, w: big.w - w1, h: big.h });
    } else {
      const h1 = Math.round(big.h * ratio);
      slots.push({ x: big.x, y: big.y, w: big.w, h: h1 });
      slots.push({ x: big.x, y: big.y + h1, w: big.w, h: big.h - h1 });
    }
  }
  return slots;
}

/** 1080×1080 — magazine mosaic. ~26 photos auto-arranged to fill the
 *  whole canvas via recursive binary partition. Small header band at the
 *  top holds the title (no overlap). Tight 3px gutters between photos. */
const MosaicAutoTemplate = forwardRef<HTMLDivElement, Props>(function MosaicAutoTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 26 },
  ref,
) {
  const HEADER = 130;
  const CANVAS = 1080;
  const GAP = count <= 12 ? 6 : count <= 24 ? 4 : 3;
  const NUM = Math.max(2, Math.min(64, count));
  const usable: AlbumPhoto[] = [];
  while (usable.length < NUM && photos.length > 0) {
    usable.push(photos[usable.length % photos.length]);
  }

  const slots = useMemo(
    () => generateMosaicSlots(NUM, CANVAS, CANVAS - HEADER, seed),
     
    [seed, NUM],
  );

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
      {/* Title header band — only place text lives, never overlaps photos */}
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
          borderBottom: '1px solid rgba(255,255,255,0.10)',
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
              fontSize: 60,
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
        <div style={{ textAlign: 'right' }}>
          {dateRange && (
            <p
              style={{
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontStyle: 'italic',
                fontSize: 18,
                color: 'rgba(255,255,255,0.75)',
                margin: 0,
              }}
            >
              {dateRange}
            </p>
          )}
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 13,
              letterSpacing: 4,
              color: 'rgba(255,255,255,0.45)',
              margin: 0,
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            GusTrips · {usable.length} fotos
          </p>
        </div>
      </div>

      {/* Mosaic — every photo gets a slot from the partition */}
      <div style={{ position: 'absolute', top: HEADER, left: 0, right: 0, bottom: 0 }}>
        {slots.map((slot, i) => {
          const p = usable[i];
          if (!p) return null;
          return (
            <div
              key={`${p.url}-${i}-${seed}`}
              data-photo-url={p.url}
              style={{
                position: 'absolute',
                left: slot.x + GAP / 2,
                top: slot.y + GAP / 2,
                width: slot.w - GAP,
                height: slot.h - GAP,
                background: '#0d1424',
                overflow: 'hidden',
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

export default MosaicAutoTemplate;
