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

/** 1080×1080 magazine-style mosaic: hero photo on top, 4 thumbnails below,
 *  trip title overlaid on hero. Tuned for Instagram/WhatsApp sharing. */
const MosaicMagazine = forwardRef<HTMLDivElement, Props>(function MosaicMagazine(
  { photos, tripTitle, destination, dateRange },
  ref,
) {
  const hero = photos[0];
  const thumbs = photos.slice(1, 5);
  while (thumbs.length < 4 && photos.length > 0) {
    thumbs.push(photos[thumbs.length % photos.length]);
  }

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: 'linear-gradient(135deg, #0a1628 0%, #07101f 100%)',
      }}
      className="relative overflow-hidden font-sans"
    >
      {/* Hero photo — top 62% */}
      <div className="relative" style={{ height: 670 }}>
        {hero?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxied(hero.url)}
            alt=""
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Bottom gradient for title legibility */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(7,16,31,0.88) 0%, rgba(7,16,31,0.45) 35%, transparent 70%)',
          }}
        />
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 36 }}>
          <p style={{ color: '#f59e0b', fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 800, marginBottom: 10 }}>
            {destination || 'Mi viaje'}
          </p>
          <h1 style={{ color: '#fff', fontSize: 72, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0 }}>
            {tripTitle}
          </h1>
          {dateRange && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, marginTop: 12, fontWeight: 500 }}>
              {dateRange}
            </p>
          )}
        </div>
      </div>

      {/* Thumbnails strip — bottom 38% */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: 14, height: 410 }}>
        {thumbs.map((p, i) => (
          <div key={`${p.url}-${i}`} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#0d1424' }}>
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

      {/* Bottom watermark */}
      <div style={{ position: 'absolute', right: 24, bottom: 12, color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
        GusTrips
      </div>
    </div>
  );
});

export default MosaicMagazine;
