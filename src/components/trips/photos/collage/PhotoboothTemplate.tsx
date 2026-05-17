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

/** 1080×1080 — Retro photo booth strip(s). Vertical strips of 4-6 photos
 *  each, white frames, dates handwritten beneath. Strips arrange side-by-
 *  side as count grows. Soft dark background like an old leather album. */
const PhotoboothTemplate = forwardRef<HTMLDivElement, Props>(function PhotoboothTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 6 },
  ref,
) {
  const CANVAS = 1080;
  const NUM = Math.max(4, Math.min(24, count));
  // Decide strip count + photos per strip
  const PHOTOS_PER_STRIP = NUM <= 6 ? NUM : NUM <= 10 ? 5 : NUM <= 16 ? 4 : 4;
  const STRIPS = Math.ceil(NUM / PHOTOS_PER_STRIP);

  const usable = useMemo(() => {
    const out: AlbumPhoto[] = [];
    void seed;
    while (out.length < NUM && photos.length > 0) {
      out.push(photos[out.length % photos.length]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, seed, NUM]);

  // Strip dimensions
  const stripWMax = (CANVAS - 40 - (STRIPS - 1) * 20) / STRIPS;
  const photoSize = Math.min(stripWMax - 24, (CANVAS - 200) / PHOTOS_PER_STRIP - 12);
  const stripW = photoSize + 24;
  const stripH = (photoSize + 16) * PHOTOS_PER_STRIP + 70;
  // Center the strips horizontally
  const totalStripsW = STRIPS * stripW + (STRIPS - 1) * 20;
  const stripsStartX = (CANVAS - totalStripsW) / 2;
  const stripStartY = (CANVAS - stripH) / 2 + 30;

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS,
        height: CANVAS,
        background:
          'radial-gradient(circle at 50% 40%, #2a1f15 0%, #1a120a 60%, #0a0604 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle leather grain via repeating-radial-gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle, rgba(80,50,20,0.18) 1px, transparent 2px), radial-gradient(circle, rgba(60,40,15,0.12) 1px, transparent 2px)',
          backgroundSize: '10px 10px, 18px 18px',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />

      {/* Top title — small, centered, retro */}
      <div style={{ position: 'absolute', top: 50, left: 0, right: 0, textAlign: 'center', zIndex: 30 }}>
        {destination && (
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 16,
              letterSpacing: 8,
              color: '#f5d089',
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
            fontSize: 56,
            color: '#fff',
            margin: 0,
            marginTop: -2,
            lineHeight: 1,
            textShadow: '0 4px 12px rgba(0,0,0,0.45)',
            letterSpacing: '-0.01em',
          }}
        >
          {tripTitle}
        </h1>
      </div>

      {/* Photo booth strips */}
      {Array.from({ length: STRIPS }).map((_, s) => {
        const stripPhotos = usable.slice(s * PHOTOS_PER_STRIP, (s + 1) * PHOTOS_PER_STRIP);
        const stripX = stripsStartX + s * (stripW + 20);
        return (
          <div
            key={`strip-${s}`}
            style={{
              position: 'absolute',
              left: stripX,
              top: stripStartY,
              width: stripW,
              height: stripH,
              background: '#fff',
              padding: 12,
              boxShadow: '0 28px 60px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.45)',
              transform: `rotate(${(s - (STRIPS - 1) / 2) * 1.2}deg)`,
              zIndex: 10 + s,
              borderRadius: 4,
            }}
          >
            {stripPhotos.map((p, i) => (
              <div
                key={`${p.url}-${s}-${i}-${seed}`}
                data-photo-url={p.url}
                style={{
                  width: photoSize,
                  height: photoSize,
                  overflow: 'hidden',
                  background: '#0d1424',
                  marginBottom: i < stripPhotos.length - 1 ? 6 : 10,
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
            ))}
            {/* Footer with date in handwriting */}
            <div style={{ textAlign: 'center', paddingTop: 4 }}>
              <p
                style={{
                  fontFamily: 'var(--font-caveat), cursive',
                  fontSize: 22,
                  color: '#1a1408',
                  margin: 0,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {dateRange ? dateRange.split('—')[0]?.trim() : '★'}
              </p>
            </div>
          </div>
        );
      })}

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

export default PhotoboothTemplate;
