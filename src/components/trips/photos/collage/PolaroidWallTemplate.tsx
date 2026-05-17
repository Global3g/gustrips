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

// Washi tape variants — colored translucent rectangles that anchor the
// polaroids to the "wall". Each entry is a CSS gradient so they look
// patterned but don't need external images.
const TAPES = [
  'repeating-linear-gradient(45deg, rgba(255,180,180,0.85) 0 10px, rgba(255,220,220,0.85) 10px 20px)',
  'repeating-linear-gradient(45deg, rgba(180,220,255,0.85) 0 10px, rgba(220,240,255,0.85) 10px 20px)',
  'repeating-linear-gradient(45deg, rgba(255,220,160,0.85) 0 10px, rgba(255,240,200,0.85) 10px 20px)',
  'repeating-linear-gradient(45deg, rgba(200,220,180,0.85) 0 10px, rgba(220,235,200,0.85) 10px 20px)',
  'repeating-linear-gradient(90deg, rgba(220,180,230,0.85) 0 8px, rgba(240,220,245,0.85) 8px 16px)',
  'repeating-linear-gradient(45deg, rgba(255,200,160,0.85) 0 12px, rgba(255,225,200,0.85) 12px 24px)',
];

// Hand-tuned slot positions so polaroids feel scattered but framed.
const SLOTS = [
  { x: 70,  y: 200, rot: -8, w: 240 },
  { x: 380, y: 140, rot: 5,  w: 260 },
  { x: 720, y: 210, rot: -3, w: 230 },
  { x: 100, y: 540, rot: 7,  w: 250 },
  { x: 420, y: 590, rot: -6, w: 240 },
  { x: 730, y: 560, rot: 9,  w: 250 },
];

/** 1080×1080 — improved Polaroid wall: cork-board background, real
 *  drop-shadows, washi tape per photo, handwritten captions in Caveat,
 *  hand-lettered title in script. */
const PolaroidWallTemplate = forwardRef<HTMLDivElement, Props>(function PolaroidWallTemplate(
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
        // Warm cork-board vibe with subtle radial gradient
        background:
          'radial-gradient(circle at 50% 50%, #c39e6d 0%, #9d7244 70%, #6f4f2c 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Cork texture — repeating tiny dots */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle, rgba(80,50,20,0.15) 1px, transparent 1.5px), radial-gradient(circle, rgba(60,40,15,0.10) 1px, transparent 1.5px)',
          backgroundSize: '12px 12px, 18px 18px',
          backgroundPosition: '0 0, 6px 9px',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Big script title at top */}
      <div style={{ position: 'relative', textAlign: 'center', paddingTop: 36, zIndex: 50 }}>
        <h1
          style={{
            fontFamily: 'var(--font-caveat), cursive',
            fontSize: 110,
            fontWeight: 700,
            color: '#fff',
            margin: 0,
            lineHeight: 1,
            textShadow: '0 4px 12px rgba(0,0,0,0.35)',
            letterSpacing: '-0.01em',
          }}
        >
          {tripTitle}
        </h1>
        {destination && (
          <p
            style={{
              fontFamily: 'var(--font-bebas), Impact, sans-serif',
              fontSize: 22,
              letterSpacing: 8,
              color: 'rgba(255,255,255,0.9)',
              textTransform: 'uppercase',
              margin: 0,
              marginTop: -4,
            }}
          >
            {destination}
          </p>
        )}
      </div>

      {/* Polaroids with washi tape */}
      {picked.map((p, i) => {
        const slot = SLOTS[i];
        const cardH = slot.w + 60; // photo+caption strip
        const tapeBg = TAPES[i % TAPES.length];
        // Show only short captions; long ones get truncated by maxHeight
        const caption = (p.caption || '').trim();
        return (
          <div
            key={`${p.url}-${i}`}
            style={{
              position: 'absolute',
              top: slot.y,
              left: slot.x,
              transform: `rotate(${slot.rot}deg)`,
              transformOrigin: 'center center',
              zIndex: 10 + i,
            }}
          >
            {/* Washi tape — sits behind+above polaroid */}
            <div
              style={{
                position: 'absolute',
                top: -18,
                left: slot.w / 2 - 50,
                width: 100,
                height: 30,
                background: tapeBg,
                transform: `rotate(${i % 2 === 0 ? -4 : 4}deg)`,
                boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                zIndex: 5,
              }}
            />
            {/* Polaroid card */}
            <div
              style={{
                width: slot.w,
                height: cardH,
                background: '#fff',
                padding: 14,
                paddingBottom: 0,
                boxShadow: '0 22px 48px rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.35)',
                borderRadius: 2,
              }}
            >
              <div style={{ width: slot.w - 28, height: slot.w - 28, overflow: 'hidden', background: '#0d1424' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxied(p.url)}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div
                style={{
                  height: 46,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-caveat), cursive',
                    fontSize: 24,
                    color: '#1a1408',
                    margin: 0,
                    textAlign: 'center',
                    lineHeight: 1.1,
                    maxHeight: 38,
                    overflow: 'hidden',
                  }}
                >
                  {caption || (p.date || '').replace(/-/g, '/')}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Bottom date "tag" */}
      {dateRange && (
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%) rotate(-2deg)',
            background: 'rgba(255,255,255,0.95)',
            padding: '8px 22px',
            borderRadius: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            zIndex: 30,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-caveat), cursive',
              fontSize: 28,
              color: '#1a1408',
              margin: 0,
              fontWeight: 700,
              letterSpacing: '0.5px',
            }}
          >
            {dateRange}
          </p>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 14,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 13,
          letterSpacing: 4,
          color: 'rgba(255,255,255,0.65)',
          zIndex: 50,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default PolaroidWallTemplate;
