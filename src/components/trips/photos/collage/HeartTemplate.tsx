'use client';

import { forwardRef } from 'react';
import type { AlbumPhoto } from '@/types';

interface Props {
  photos: AlbumPhoto[];
  tripTitle: string;
  destination?: string;
  dateRange?: string;
}

function proxied(url: string): string {
  if (!url.startsWith('https://firebasestorage.googleapis.com')) return url;
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

/** Parametric heart curve. t ∈ [0, 2π].
 *  Classic equation: x = 16 sin³(t), y = 13cos(t) − 5cos(2t) − 2cos(3t) − cos(4t).
 *  We flip Y because screen coordinates grow downward. */
function heartPoint(t: number): { x: number; y: number } {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x, y };
}

/** 1080×1080 — small photos placed along the contour of a heart shape.
 *  Title sits below; works great for family / romantic trip recaps. */
const HeartTemplate = forwardRef<HTMLDivElement, Props>(function HeartTemplate(
  { photos, tripTitle, destination, dateRange },
  ref,
) {
  const COUNT = 14;
  const CARD = 120;
  const SCALE = 31; // scales the parametric output to ~620px wide
  const CX = 540;
  const CY = 470;
  const picked: AlbumPhoto[] = [];
  while (picked.length < COUNT && photos.length > 0) {
    picked.push(photos[picked.length % photos.length]);
  }

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background:
          'radial-gradient(ellipse at 50% 30%, #2a1b3d 0%, #1a0f24 55%, #0a0610 100%)',
      }}
      className="relative overflow-hidden"
    >
      {/* Soft heart-shaped glow underneath */}
      <div
        style={{
          position: 'absolute',
          left: CX - 280,
          top: CY - 200,
          width: 560,
          height: 480,
          background: 'radial-gradient(ellipse, rgba(244,63,94,0.25), transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Photos arranged along the heart contour */}
      {picked.map((p, i) => {
        // Sample at evenly spaced t. Offset π/2 so the "cleft" sits at top.
        const t = (i / COUNT) * Math.PI * 2 + Math.PI / 2;
        const { x, y } = heartPoint(t);
        const px = CX + x * SCALE - CARD / 2;
        const py = CY + y * SCALE - CARD / 2;
        // Slight rotation following the local angle of the curve
        const rotDeg = (Math.sin(t) * 12).toFixed(1);
        return (
          <div
            key={`${p.url}-${i}`}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: CARD,
              height: CARD,
              transform: `rotate(${rotDeg}deg)`,
              background: '#fff',
              padding: 6,
              boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
              borderRadius: 3,
              zIndex: 10 + i,
            }}
          >
            <div style={{ width: CARD - 12, height: CARD - 12, overflow: 'hidden', background: '#0d1424', borderRadius: 2 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxied(p.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        );
      })}

      {/* Title under the heart */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 80,
          textAlign: 'center',
          zIndex: 30,
          padding: '0 60px',
        }}
      >
        {destination && (
          <p style={{ color: '#f43f5e', fontSize: 15, letterSpacing: 5, textTransform: 'uppercase', fontWeight: 800, margin: 0 }}>
            {destination}
          </p>
        )}
        <h1
          style={{
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginTop: 10,
            marginBottom: 0,
            lineHeight: 1.05,
          }}
        >
          {tripTitle}
        </h1>
        {dateRange && (
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, marginTop: 10, fontWeight: 500 }}>
            {dateRange}
          </p>
        )}
      </div>

      <div style={{ position: 'absolute', right: 24, bottom: 14, color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
        GusTrips
      </div>
    </div>
  );
});

export default HeartTemplate;
