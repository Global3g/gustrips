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

/** 1080×1080 — Vintage postcard / passport. Aged sepia paper, a hero
 *  photo with white border like an old print, "GREETINGS FROM" lettering
 *  across the top, ornate stamp in the corner, postmark circle, dashed
 *  vertical line splitting the address-style metadata. */
const PostcardTemplate = forwardRef<HTMLDivElement, Props>(function PostcardTemplate(
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
        background:
          'radial-gradient(circle at 50% 40%, #f5e6c0 0%, #e8d4a0 60%, #c8a872 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Sepia texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle, rgba(120,80,30,0.10) 1px, transparent 2px), radial-gradient(circle, rgba(80,50,20,0.06) 1px, transparent 2px)',
          backgroundSize: '8px 8px, 14px 14px',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Inner border */}
      <div
        style={{
          position: 'absolute',
          left: 28,
          top: 28,
          right: 28,
          bottom: 28,
          border: '4px double rgba(80,40,20,0.55)',
          borderRadius: 6,
          pointerEvents: 'none',
        }}
      />

      {/* "GREETINGS FROM" lettering — arched feel via mixed sizes */}
      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center', zIndex: 30 }}>
        <p
          style={{
            fontFamily: 'var(--font-bebas), Impact, sans-serif',
            fontSize: 32,
            letterSpacing: 12,
            color: 'rgba(80,30,15,0.85)',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          Greetings from
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: 130,
            color: '#3a1a08',
            margin: 0,
            marginTop: -8,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            textShadow: '2px 2px 0 rgba(255,255,255,0.4)',
          }}
        >
          {destination || tripTitle}
        </h1>
      </div>

      {/* Hero photo as a big "print" with white border */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 320,
          width: 600,
          height: 420,
          background: '#fff',
          padding: 18,
          paddingBottom: 56,
          boxShadow: '0 22px 42px rgba(80,40,20,0.35)',
          transform: 'rotate(-2deg)',
          zIndex: 20,
        }}
      >
        <div style={{ width: 564, height: 346, overflow: 'hidden' }}>
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
        <p
          style={{
            fontFamily: 'var(--font-caveat), cursive',
            fontSize: 26,
            color: '#1a1408',
            margin: 0,
            marginTop: 12,
            textAlign: 'center',
            lineHeight: 1,
          }}
        >
          {hero?.caption || tripTitle}
        </p>
      </div>

      {/* Two stacked thumbnails on the right */}
      <div style={{ position: 'absolute', right: 100, top: 360, transform: 'rotate(3deg)', zIndex: 21 }}>
        <div
          style={{
            width: 220,
            height: 220,
            background: '#fff',
            padding: 12,
            paddingBottom: 36,
            boxShadow: '0 16px 30px rgba(80,40,20,0.35)',
            marginBottom: 24,
          }}
        >
          <div style={{ width: 196, height: 172, overflow: 'hidden' }}>
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
        </div>
      </div>
      <div style={{ position: 'absolute', right: 130, top: 610, transform: 'rotate(-4deg)', zIndex: 22 }}>
        <div
          style={{
            width: 200,
            height: 200,
            background: '#fff',
            padding: 12,
            paddingBottom: 32,
            boxShadow: '0 16px 30px rgba(80,40,20,0.35)',
          }}
        >
          <div style={{ width: 176, height: 156, overflow: 'hidden' }}>
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
        </div>
      </div>

      {/* Postage stamp top-right with airplane silhouette */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 80,
          width: 140,
          height: 170,
          background: '#fff',
          padding: 8,
          transform: 'rotate(6deg)',
          boxShadow: '0 12px 24px rgba(80,40,20,0.35)',
          zIndex: 30,
          // Perforated edges via radial-gradient dots
          backgroundImage:
            'radial-gradient(circle at 0 8px, transparent 4px, #fff 4px), radial-gradient(circle at 100% 8px, transparent 4px, #fff 4px)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: 110,
            background: 'linear-gradient(135deg, #3a2a18, #6b4820)',
            border: '2px solid #1a1408',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e8d4a0',
            fontSize: 50,
          }}
        >
          ✈
        </div>
        <p
          style={{
            fontFamily: 'var(--font-bebas), Impact, sans-serif',
            fontSize: 14,
            letterSpacing: 3,
            color: '#1a1408',
            margin: 0,
            marginTop: 4,
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          Air Mail
        </p>
        <p
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontWeight: 900,
            fontSize: 12,
            color: '#1a1408',
            margin: 0,
            textAlign: 'center',
          }}
        >
          ★ 2026 ★
        </p>
      </div>

      {/* Postmark circles bottom-left */}
      <svg
        style={{ position: 'absolute', left: 70, bottom: 100, width: 200, height: 200, zIndex: 25 }}
        viewBox="0 0 200 200"
      >
        <g transform="rotate(-12 100 100)">
          <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(80,30,15,0.7)" strokeWidth="3" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(80,30,15,0.7)" strokeWidth="2" strokeDasharray="6 4" />
          <text x="100" y="78" textAnchor="middle" style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 16, letterSpacing: 3, fill: 'rgba(80,30,15,0.85)' }}>
            POSTED
          </text>
          <text x="100" y="108" textAnchor="middle" style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 22, fontWeight: 900, fill: 'rgba(80,30,15,0.85)' }}>
            {(destination || 'TRAVEL').slice(0, 10).toUpperCase()}
          </text>
          <text x="100" y="135" textAnchor="middle" style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 14, letterSpacing: 2, fill: 'rgba(80,30,15,0.85)' }}>
            2026
          </text>
        </g>
      </svg>

      {/* Date stamp / "from gus" */}
      {dateRange && (
        <div
          style={{
            position: 'absolute',
            bottom: 70,
            right: 100,
            transform: 'rotate(2deg)',
            zIndex: 30,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-caveat), cursive',
              fontSize: 28,
              color: '#3a1a08',
              margin: 0,
              fontWeight: 700,
            }}
          >
            ~ {dateRange} ~
          </p>
        </div>
      )}

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 40,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 13,
          letterSpacing: 4,
          color: 'rgba(80,30,15,0.6)',
          zIndex: 30,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default PostcardTemplate;
