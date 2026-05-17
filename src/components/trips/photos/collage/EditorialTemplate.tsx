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

/** 1080×1080 — Editorial / magazine cover. Massive serif title taking
 *  half the canvas, hero photo on the right bleeding edge-to-edge,
 *  small "issue" details + 2 thumbnails stacked below. Reminiscent of
 *  Vogue / Kinfolk covers. */
const EditorialTemplate = forwardRef<HTMLDivElement, Props>(function EditorialTemplate(
  { photos, tripTitle, destination, dateRange },
  ref,
) {
  const hero = photos[0];
  const thumb1 = photos[1] || photos[0];
  const thumb2 = photos[2] || photos[0];

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: '#f1ece0', // warm cream
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Right column: hero photo bleeding to the right edge */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: 600, height: 1080 }}>
        {hero?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxied(hero.url)}
            alt=""
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      {/* Vertical line of issue metadata */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          top: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          color: '#2a2418',
        }}
      >
        <div style={{ width: 36, height: 2, background: '#2a2418' }} />
        <span
          style={{
            fontFamily: 'var(--font-bebas), Impact, sans-serif',
            fontSize: 22,
            letterSpacing: 6,
            textTransform: 'uppercase',
          }}
        >
          Vol. 01 · Memoria
        </span>
      </div>

      {/* Massive serif title — overlaps the hero photo at the right edge */}
      <h1
        style={{
          position: 'absolute',
          left: 48,
          top: 130,
          right: 24,
          margin: 0,
          fontFamily: 'var(--font-playfair), Georgia, serif',
          fontWeight: 900,
          fontSize: 200,
          lineHeight: 0.92,
          letterSpacing: '-0.04em',
          color: '#1a1408',
          textTransform: 'none',
          zIndex: 5,
          mixBlendMode: 'multiply',
        }}
      >
        {tripTitle}
      </h1>

      {/* Subtitle / destination line */}
      {destination && (
        <p
          style={{
            position: 'absolute',
            left: 56,
            top: 730,
            margin: 0,
            fontFamily: 'var(--font-bebas), Impact, sans-serif',
            fontSize: 28,
            letterSpacing: 8,
            color: '#1a1408',
            textTransform: 'uppercase',
          }}
        >
          — {destination}
        </p>
      )}

      {/* Bottom: 2 small photo thumbnails stacked + date */}
      <div style={{ position: 'absolute', left: 56, bottom: 56, display: 'flex', gap: 14, alignItems: 'flex-end' }}>
        <div style={{ width: 160, height: 200, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
          {thumb1?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxied(thumb1.url)}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
        <div style={{ width: 160, height: 200, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
          {thumb2?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxied(thumb2.url)}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
        {dateRange && (
          <div style={{ marginLeft: 8, marginBottom: 12 }}>
            <p
              style={{
                fontFamily: 'var(--font-bebas), Impact, sans-serif',
                fontSize: 18,
                letterSpacing: 5,
                color: '#5a5040',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              Fecha
            </p>
            <p
              style={{
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontStyle: 'italic',
                fontSize: 20,
                color: '#1a1408',
                margin: 0,
                marginTop: 2,
                maxWidth: 240,
              }}
            >
              {dateRange}
            </p>
          </div>
        )}
      </div>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 18,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 14,
          letterSpacing: 4,
          color: 'rgba(255,255,255,0.85)',
          zIndex: 10,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default EditorialTemplate;
