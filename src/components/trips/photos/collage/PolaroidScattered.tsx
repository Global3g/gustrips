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

// Hand-tuned positions/rotations so the polaroids feel scattered but
// don't pile on top of each other. Coordinates are absolute (px) inside
// the 1080×1080 canvas — using a seed-style layout keeps the result
// deterministic per call. Each photo opening through the gallery is the
// same width (300) so caption length doesn't shift the layout.
const SLOTS = [
  { x: 90,  y: 220, rot: -7 },
  { x: 410, y: 130, rot: 4 },
  { x: 720, y: 215, rot: -3 },
  { x: 140, y: 580, rot: 6 },
  { x: 450, y: 620, rot: -5 },
  { x: 740, y: 560, rot: 8 },
];

/** 1080×1080 scattered Polaroid collage. White-framed photos with captions
 *  on a dark cinematic background; title in elegant serif at the top. */
const PolaroidScattered = forwardRef<HTMLDivElement, Props>(function PolaroidScattered(
  { photos, tripTitle, destination, dateRange },
  ref,
) {
  const picked = photos.slice(0, SLOTS.length);
  while (picked.length < SLOTS.length && photos.length > 0) {
    picked.push(photos[picked.length % photos.length]);
  }

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background:
          'radial-gradient(circle at 30% 20%, #1a2b47 0%, #0a1628 55%, #050a14 100%)',
      }}
      className="relative overflow-hidden"
    >
      {/* Decorative soft orbs */}
      <div style={{ position: 'absolute', top: -120, left: -120, width: 460, height: 460, borderRadius: '50%', background: 'rgba(245,158,11,0.10)', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -160, right: -120, width: 520, height: 520, borderRadius: '50%', background: 'rgba(244,63,94,0.10)', filter: 'blur(90px)' }} />

      {/* Title — top, in serif */}
      <div style={{ position: 'absolute', top: 48, left: 0, right: 0, textAlign: 'center', zIndex: 30 }}>
        {destination && (
          <p style={{ color: '#f59e0b', fontSize: 16, letterSpacing: 5, textTransform: 'uppercase', fontWeight: 800, margin: 0 }}>
            {destination}
          </p>
        )}
        <h1
          style={{
            color: '#fff',
            fontFamily: 'Georgia, serif',
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          {tripTitle}
        </h1>
        {dateRange && (
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, marginTop: 8, fontWeight: 500 }}>
            {dateRange}
          </p>
        )}
      </div>

      {/* Polaroids */}
      {picked.map((p, i) => {
        const slot = SLOTS[i];
        return (
          <div
            key={`${p.url}-${i}`}
            style={{
              position: 'absolute',
              top: slot.y,
              left: slot.x,
              transform: `rotate(${slot.rot}deg)`,
              background: '#fff',
              padding: 14,
              paddingBottom: p.caption ? 46 : 14,
              boxShadow: '0 18px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)',
              borderRadius: 4,
              width: 240,
              zIndex: 10 + i,
            }}
          >
            <div style={{ width: 212, height: 212, overflow: 'hidden', background: '#0d1424', borderRadius: 2 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxied(p.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            {p.caption && (
              <p
                style={{
                  color: '#1f2937',
                  fontFamily: 'Georgia, serif',
                  fontSize: 13,
                  fontStyle: 'italic',
                  margin: 0,
                  marginTop: 8,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  maxHeight: 32,
                  overflow: 'hidden',
                }}
              >
                {p.caption}
              </p>
            )}
          </div>
        );
      })}

      {/* Watermark */}
      <div style={{ position: 'absolute', right: 36, bottom: 28, color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
        GusTrips
      </div>
    </div>
  );
});

export default PolaroidScattered;
