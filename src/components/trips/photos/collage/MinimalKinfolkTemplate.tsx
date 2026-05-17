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

/** 1080×1080 — Kinfolk-style minimalism. Cream / off-white background,
 *  3-6 photos placed with generous breathing room, massive serif title
 *  with open tracking. Opposite end of the spectrum from Y2K. */
const MinimalKinfolkTemplate = forwardRef<HTMLDivElement, Props>(function MinimalKinfolkTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 6 },
  ref,
) {
  const CANVAS = 1080;
  // Minimalism caps the count — past 8 the whitespace is gone.
  const NUM = Math.max(2, Math.min(8, count));

  // Hand-tuned slot positions per count. Aim for negative space top + bottom,
  // photos grouped without a strict grid.
  const SLOTS = useMemo(() => {
    switch (NUM) {
      case 2:
        return [
          { x: 180, y: 380, w: 320, h: 400 },
          { x: 580, y: 480, w: 320, h: 400 },
        ];
      case 3:
        return [
          { x: 140, y: 340, w: 280, h: 360 },
          { x: 440, y: 460, w: 220, h: 280 },
          { x: 700, y: 320, w: 240, h: 380 },
        ];
      case 4:
        return [
          { x: 110, y: 330, w: 280, h: 360 },
          { x: 420, y: 360, w: 200, h: 260 },
          { x: 640, y: 320, w: 200, h: 280 },
          { x: 420, y: 640, w: 420, h: 200 },
        ];
      case 5:
        return [
          { x: 90,  y: 320, w: 240, h: 320 },
          { x: 370, y: 360, w: 180, h: 230 },
          { x: 580, y: 320, w: 180, h: 240 },
          { x: 790, y: 360, w: 200, h: 280 },
          { x: 250, y: 690, w: 580, h: 200 },
        ];
      case 6:
      default:
        return [
          { x: 70,  y: 340, w: 260, h: 340 },
          { x: 370, y: 360, w: 170, h: 220 },
          { x: 570, y: 340, w: 200, h: 250 },
          { x: 800, y: 380, w: 200, h: 280 },
          { x: 200, y: 720, w: 280, h: 200 },
          { x: 520, y: 720, w: 360, h: 200 },
        ];
      case 7:
      case 8:
        return [
          { x: 60,  y: 320, w: 200, h: 270 },
          { x: 300, y: 350, w: 180, h: 220 },
          { x: 520, y: 320, w: 170, h: 240 },
          { x: 720, y: 350, w: 180, h: 230 },
          { x: 900, y: 320, w: 130, h: 260 },
          { x: 120, y: 660, w: 220, h: 220 },
          { x: 380, y: 700, w: 320, h: 200 },
          { x: 740, y: 660, w: 240, h: 220 },
        ].slice(0, NUM);
    }
  }, [NUM]);

  const usable = useMemo(() => {
    const out: AlbumPhoto[] = [];
    void seed;
    while (out.length < SLOTS.length && photos.length > 0) {
      out.push(photos[out.length % photos.length]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, SLOTS]);

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS,
        height: CANVAS,
        background: 'radial-gradient(circle at 50% 30%, #f9f5ec 0%, #f1ebd9 70%, #e8e0c8 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top: destination caps + title — open tracking */}
      <div style={{ position: 'absolute', top: 100, left: 0, right: 0, textAlign: 'center', zIndex: 30 }}>
        {destination && (
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 14,
              letterSpacing: 14,
              color: '#7a6a4a',
              margin: 0,
              marginLeft: 14, // compensate the tracking
              textTransform: 'uppercase',
            }}
          >
            {destination}
          </p>
        )}
        <h1
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: 96,
            fontWeight: 400,
            color: '#2a1f10',
            margin: 0,
            marginTop: 16,
            lineHeight: 0.95,
            letterSpacing: '0.02em',
            fontStyle: 'italic',
          }}
        >
          {tripTitle}
        </h1>
        {/* Thin separator line */}
        <div
          style={{
            width: 60,
            height: 1,
            background: '#7a6a4a',
            margin: '24px auto 0',
          }}
        />
      </div>

      {/* Photos — clean rectangles, no frames, soft shadows */}
      {SLOTS.map((slot, i) => {
        const p = usable[i];
        if (!p) return null;
        return (
          <div
            key={`${p.url}-${i}-${seed}`}
            style={{
              position: 'absolute',
              left: slot.x,
              top: slot.y,
              width: slot.w,
              height: slot.h,
              overflow: 'hidden',
              boxShadow: '0 22px 44px rgba(60,40,20,0.18), 0 6px 14px rgba(60,40,20,0.08)',
              background: '#fff',
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

      {/* Bottom date */}
      {dateRange && (
        <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center', zIndex: 30 }}>
          <p
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontStyle: 'italic',
              fontSize: 18,
              color: '#5a4020',
              margin: 0,
            }}
          >
            — {dateRange} —
          </p>
        </div>
      )}

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 40,
          bottom: 20,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 11,
          letterSpacing: 5,
          color: 'rgba(60,40,20,0.45)',
          zIndex: 60,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default MinimalKinfolkTemplate;
