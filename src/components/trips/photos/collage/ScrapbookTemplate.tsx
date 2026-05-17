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

/** 1080×1080 — Scrapbook page. Aged cream paper, washi tape on each
 *  photo, hand-drawn arrows/doodles, handwritten title and date stamp.
 *  Inspired by physical travel journals. */
const ScrapbookTemplate = forwardRef<HTMLDivElement, Props>(function ScrapbookTemplate(
  { photos, tripTitle, destination, dateRange },
  ref,
) {
  const p1 = photos[0];
  const p2 = photos[1] || photos[0];
  const p3 = photos[2] || photos[0];
  const p4 = photos[3] || photos[0];

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        // Aged paper — warm cream with subtle mottling
        background:
          'radial-gradient(circle at 30% 25%, #faf2dc 0%, #f0e3c3 50%, #d9c8a0 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-caveat), cursive',
      }}
    >
      {/* Paper texture noise */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle, rgba(160,130,80,0.07) 1px, transparent 2px), radial-gradient(circle, rgba(120,90,60,0.05) 1px, transparent 2px)',
          backgroundSize: '8px 8px, 14px 14px',
          backgroundPosition: '0 0, 4px 7px',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Top decorative dashed border */}
      <div
        style={{
          position: 'absolute',
          left: 36,
          right: 36,
          top: 36,
          borderTop: '2px dashed rgba(120,80,30,0.4)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 36,
          right: 36,
          bottom: 36,
          borderBottom: '2px dashed rgba(120,80,30,0.4)',
        }}
      />

      {/* Big handwritten title — top left */}
      <div style={{ position: 'absolute', left: 60, top: 70, maxWidth: 600, zIndex: 30 }}>
        {destination && (
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 24,
              letterSpacing: 8,
              color: '#7a5028',
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
            fontSize: 120,
            fontWeight: 700,
            color: '#2a1a08',
            margin: 0,
            marginTop: -8,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            transform: 'rotate(-2deg)',
            transformOrigin: 'left',
          }}
        >
          {tripTitle}
        </h1>
        {dateRange && (
          <p
            style={{
              fontFamily: 'var(--font-caveat), cursive',
              fontSize: 30,
              color: '#5a4020',
              margin: 0,
              marginTop: 8,
              fontWeight: 400,
            }}
          >
            ~ {dateRange} ~
          </p>
        )}
      </div>

      {/* Photo 1 — top right with washi tape */}
      <div style={{ position: 'absolute', top: 100, right: 60, transform: 'rotate(4deg)', zIndex: 20 }}>
        <div
          style={{
            position: 'absolute',
            top: -16,
            left: 40,
            width: 120,
            height: 24,
            background: 'repeating-linear-gradient(45deg, rgba(255,180,180,0.9) 0 8px, rgba(255,220,220,0.9) 8px 16px)',
            transform: 'rotate(-6deg)',
            zIndex: 5,
            boxShadow: '0 3px 6px rgba(0,0,0,0.15)',
          }}
        />
        <div
          style={{
            width: 280,
            height: 280,
            background: '#fff',
            padding: 10,
            boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
            borderRadius: 2,
          }}
        >
          <div style={{ width: 260, height: 260, overflow: 'hidden' }}>
            {p1?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxied(p1.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Photo 2 — middle left */}
      <div style={{ position: 'absolute', top: 470, left: 80, transform: 'rotate(-5deg)', zIndex: 22 }}>
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: 30,
            width: 110,
            height: 22,
            background: 'repeating-linear-gradient(45deg, rgba(180,220,255,0.9) 0 8px, rgba(220,240,255,0.9) 8px 16px)',
            transform: 'rotate(5deg)',
            zIndex: 5,
            boxShadow: '0 3px 6px rgba(0,0,0,0.15)',
          }}
        />
        <div
          style={{
            width: 240,
            height: 300,
            background: '#fff',
            padding: 10,
            paddingBottom: 36,
            boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
            borderRadius: 2,
          }}
        >
          <div style={{ width: 220, height: 220, overflow: 'hidden' }}>
            {p2?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxied(p2.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
          {p2?.caption && (
            <p
              style={{
                fontFamily: 'var(--font-caveat), cursive',
                fontSize: 20,
                color: '#1a1408',
                margin: 0,
                marginTop: 6,
                textAlign: 'center',
                lineHeight: 1.1,
                maxHeight: 26,
                overflow: 'hidden',
              }}
            >
              {p2.caption}
            </p>
          )}
        </div>
      </div>

      {/* Photo 3 — middle right */}
      <div style={{ position: 'absolute', top: 500, right: 100, transform: 'rotate(6deg)', zIndex: 23 }}>
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: 45,
            width: 100,
            height: 22,
            background: 'repeating-linear-gradient(45deg, rgba(255,220,160,0.9) 0 8px, rgba(255,240,200,0.9) 8px 16px)',
            transform: 'rotate(-8deg)',
            zIndex: 5,
            boxShadow: '0 3px 6px rgba(0,0,0,0.15)',
          }}
        />
        <div
          style={{
            width: 220,
            height: 280,
            background: '#fff',
            padding: 10,
            boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
            borderRadius: 2,
          }}
        >
          <div style={{ width: 200, height: 260, overflow: 'hidden' }}>
            {p3?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxied(p3.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Photo 4 — bottom center */}
      <div style={{ position: 'absolute', bottom: 110, left: 360, transform: 'rotate(-3deg)', zIndex: 21 }}>
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: 60,
            width: 100,
            height: 22,
            background: 'repeating-linear-gradient(45deg, rgba(200,220,180,0.9) 0 8px, rgba(220,235,200,0.9) 8px 16px)',
            transform: 'rotate(4deg)',
            zIndex: 5,
            boxShadow: '0 3px 6px rgba(0,0,0,0.15)',
          }}
        />
        <div
          style={{
            width: 240,
            height: 240,
            background: '#fff',
            padding: 10,
            boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
            borderRadius: 2,
          }}
        >
          <div style={{ width: 220, height: 220, overflow: 'hidden' }}>
            {p4?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxied(p4.url)}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Hand-drawn doodles — SVG */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }} viewBox="0 0 1080 1080">
        {/* Arrow doodle pointing to bottom-center photo */}
        <path
          d="M 700 450 Q 600 480 510 540"
          stroke="#3a2a18"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="6 6"
          opacity="0.55"
        />
        <path d="M 514 538 L 504 542 L 510 533 Z" fill="#3a2a18" opacity="0.55" />

        {/* Heart doodle */}
        <path
          d="M 380 380 c -6 -12 -22 -12 -22 4 c 0 12 22 24 22 24 c 0 0 22 -12 22 -24 c 0 -16 -16 -16 -22 -4 z"
          fill="rgba(244,63,94,0.6)"
        />

        {/* Star doodle bottom-left */}
        <path
          d="M 110 800 l 8 16 l 18 2 l -13 13 l 3 18 l -16 -8 l -16 8 l 3 -18 l -13 -13 l 18 -2 z"
          fill="rgba(245,158,11,0.6)"
        />

        {/* Sun doodle top-right */}
        <circle cx="980" cy="100" r="18" fill="none" stroke="#7a5028" strokeWidth="2.5" opacity="0.5" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={980 + Math.cos(a) * 26}
              y1={100 + Math.sin(a) * 26}
              x2={980 + Math.cos(a) * 36}
              y2={100 + Math.sin(a) * 36}
              stroke="#7a5028"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.5"
            />
          );
        })}
      </svg>

      {/* "Postmark" stamp bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 90,
          right: 70,
          width: 130,
          height: 130,
          borderRadius: '50%',
          border: '3px solid rgba(80,30,30,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'rotate(-14deg)',
          background: 'rgba(245,235,210,0.3)',
          zIndex: 28,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 14,
              letterSpacing: 3,
              color: 'rgba(80,30,30,0.85)',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            Travel
          </p>
          <p
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: 22,
              fontWeight: 900,
              color: 'rgba(80,30,30,0.85)',
              margin: 0,
              marginTop: -2,
              fontStyle: 'italic',
            }}
          >
            ★
          </p>
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 14,
              letterSpacing: 3,
              color: 'rgba(80,30,30,0.85)',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            Memory
          </p>
        </div>
      </div>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          bottom: 50,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 14,
          letterSpacing: 4,
          color: 'rgba(80,50,20,0.55)',
          zIndex: 30,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default ScrapbookTemplate;
