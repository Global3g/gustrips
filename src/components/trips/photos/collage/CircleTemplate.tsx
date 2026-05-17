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

/** 1080×1080 — 8 photos arranged around a central title.
 *  Polaroid-style cards rotate gently outward so the eye follows
 *  the circle. Title and date occupy the negative space in the middle. */
const CircleTemplate = forwardRef<HTMLDivElement, Props>(function CircleTemplate(
  { photos, tripTitle, destination, dateRange },
  ref,
) {
  const COUNT = 8;
  const RADIUS = 360;
  const CENTER = 540;
  const CARD = 200;
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
          'radial-gradient(circle at 50% 50%, #142841 0%, #0a1628 55%, #050a14 100%)',
      }}
      className="relative overflow-hidden"
    >
      {/* Outer ambient glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.10) 0%, transparent 60%)' }} />

      {/* Photos */}
      {picked.map((p, i) => {
        const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2; // start at top
        const cx = CENTER + RADIUS * Math.cos(angle);
        const cy = CENTER + RADIUS * Math.sin(angle);
        // Cards point slightly outward (rotation aligned with radius)
        const rotDeg = ((angle * 180) / Math.PI + 90) * 0.15;
        return (
          <div
            key={`${p.url}-${i}`}
            style={{
              position: 'absolute',
              left: cx - CARD / 2,
              top: cy - CARD / 2,
              width: CARD,
              height: CARD,
              transform: `rotate(${rotDeg}deg)`,
              background: '#fff',
              padding: 10,
              boxShadow: '0 18px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)',
              borderRadius: 4,
              zIndex: 10 + i,
            }}
          >
            <div style={{ width: CARD - 20, height: CARD - 20, overflow: 'hidden', background: '#0d1424', borderRadius: 2 }}>
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

      {/* Center title */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          textAlign: 'center',
          zIndex: 30,
          padding: '0 60px',
        }}
      >
        {destination && (
          <p style={{ color: '#f59e0b', fontSize: 16, letterSpacing: 5, textTransform: 'uppercase', fontWeight: 800, margin: 0 }}>
            {destination}
          </p>
        )}
        <h1
          style={{
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginTop: 14,
            marginBottom: 0,
            lineHeight: 1.05,
          }}
        >
          {tripTitle}
        </h1>
        {dateRange && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, marginTop: 12, fontWeight: 500 }}>
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

export default CircleTemplate;
