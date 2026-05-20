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

/** 1080×1080 — Stacked filmstrips. Photos split into 3-4 horizontal
 *  filmstrips, each with sprocket holes top and bottom, on a dark
 *  background. Title in a slim band at top. */
const FilmstripGridTemplate = forwardRef<HTMLDivElement, Props>(function FilmstripGridTemplate(
  { photos, tripTitle, destination, dateRange, seed = 1, count = 24 },
  ref,
) {
  const HEADER = 130;
  const CANVAS = 1080;
  const NUM = Math.max(6, Math.min(48, count));
  // Number of strips based on count
  const STRIPS = NUM <= 12 ? 3 : NUM <= 24 ? 4 : NUM <= 36 ? 5 : 6;
  const PHOTOS_PER_STRIP = Math.ceil(NUM / STRIPS);

  const usable = useMemo(() => {
    const out: AlbumPhoto[] = [];
    void seed;
    while (out.length < NUM && photos.length > 0) {
      out.push(photos[out.length % photos.length]);
    }
    return out;
     
  }, [photos, seed, NUM]);

  const usableHeight = CANVAS - HEADER - 20;
  const stripHeight = usableHeight / STRIPS;
  const SPROCKET = Math.max(6, Math.min(14, stripHeight * 0.08));
  const photoHeight = stripHeight - SPROCKET * 2 - 6;
  const photoWidth = (CANVAS - 20 - 6 * (PHOTOS_PER_STRIP - 1)) / PHOTOS_PER_STRIP;

  return (
    <div ref={ref} style={{ width: CANVAS, height: CANVAS, background: '#050a14', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER,
          background: '#050a14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          zIndex: 30,
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 16, letterSpacing: 6, color: '#f59e0b', margin: 0, textTransform: 'uppercase' }}>
            {destination || 'Mi viaje'}
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 60, fontWeight: 900, color: '#fff', margin: 0, marginTop: -4, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {tripTitle}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          {dateRange && (
            <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontStyle: 'italic', fontSize: 18, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
              {dateRange}
            </p>
          )}
          <p style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', fontSize: 13, letterSpacing: 4, color: 'rgba(255,255,255,0.40)', margin: 0, marginTop: 4 }}>
            REEL · {NUM}
          </p>
        </div>
      </div>

      {/* Strips */}
      <div style={{ position: 'absolute', top: HEADER + 10, left: 10, right: 10, bottom: 10 }}>
        {Array.from({ length: STRIPS }).map((_, s) => {
          const stripPhotos = usable.slice(s * PHOTOS_PER_STRIP, (s + 1) * PHOTOS_PER_STRIP);
          return (
            <div key={`strip-${s}`} style={{ background: '#0d1424', height: stripHeight, marginBottom: 6, position: 'relative', borderRadius: 4 }}>
              {/* Top sprocket holes */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 6,
                  right: 6,
                  height: SPROCKET,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                {Array.from({ length: Math.floor(CANVAS / 36) }).map((_, i) => (
                  <div key={`top-${s}-${i}`} style={{ width: 14, height: SPROCKET * 0.5, background: '#050a14', borderRadius: 2 }} />
                ))}
              </div>
              {/* Photos */}
              <div
                style={{
                  position: 'absolute',
                  top: SPROCKET + 3,
                  left: 10,
                  right: 10,
                  height: photoHeight,
                  display: 'flex',
                  gap: 6,
                }}
              >
                {stripPhotos.map((p, i) => (
                  <div
                    key={`${p.url}-${s}-${i}-${seed}`}
                    data-photo-url={p.url}
                    style={{ width: photoWidth, height: '100%', overflow: 'hidden', background: '#000', borderRadius: 2 }}
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
              </div>
              {/* Bottom sprocket holes */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 6,
                  right: 6,
                  height: SPROCKET,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                {Array.from({ length: Math.floor(CANVAS / 36) }).map((_, i) => (
                  <div key={`bot-${s}-${i}`} style={{ width: 14, height: SPROCKET * 0.5, background: '#050a14', borderRadius: 2 }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 16,
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 11,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.4)',
          zIndex: 40,
        }}
      >
        GUSTRIPS
      </div>
    </div>
  );
});

export default FilmstripGridTemplate;
