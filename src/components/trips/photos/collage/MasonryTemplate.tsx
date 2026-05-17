'use client';

import { forwardRef, useMemo } from 'react';
import { MasonryPhotoAlbum } from 'react-photo-album';
import 'react-photo-album/masonry.css';
import type { AlbumPhoto } from '@/types';
import { useImageDimensions } from './useImageDimensions';

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

/** 1080×1080 — magazine-style masonry layout. Photos arrange themselves by
 *  aspect ratio so portrait + landscape mix nicely. Uses react-photo-album. */
const MasonryTemplate = forwardRef<HTMLDivElement, Props>(function MasonryTemplate(
  { photos, tripTitle, destination, dateRange },
  ref,
) {
  const COUNT = 9;
  const urls = useMemo(
    () => photos.slice(0, COUNT).map((p) => proxied(p.url)),
    [photos],
  );
  const { sized } = useImageDimensions(urls);

  // While we wait for natural dimensions to land, fall back to assumed 4:3
  // landscape — closer to most phone-camera photos than 1:1 and gives the
  // masonry layout some variety even on first paint.
  const photosForAlbum = useMemo(() => {
    if (sized.length > 0) {
      return sized.map((s) => ({ src: s.src, width: s.width, height: s.height }));
    }
    return urls.map((u) => ({ src: u, width: 1200, height: 900 }));
  }, [sized, urls]);

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: 'linear-gradient(135deg, #0a1628 0%, #07101f 100%)',
      }}
      className="relative overflow-hidden"
    >
      {/* Title header — fixed band at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '36px 48px 28px',
          background: 'linear-gradient(to bottom, rgba(7,16,31,0.85), transparent)',
          zIndex: 30,
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
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            marginTop: 8,
            marginBottom: 0,
            lineHeight: 1.05,
          }}
        >
          {tripTitle}
        </h1>
        {dateRange && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 6, fontWeight: 500 }}>
            {dateRange}
          </p>
        )}
      </div>

      {/* Masonry grid */}
      <div style={{ position: 'absolute', top: 200, left: 24, right: 24, bottom: 60 }}>
        <MasonryPhotoAlbum
          photos={photosForAlbum}
          columns={3}
          spacing={10}
          render={{
            image: (props) => (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img {...props} crossOrigin="anonymous" style={{ ...props.style, borderRadius: 10 }} />
            ),
          }}
        />
      </div>

      <div style={{ position: 'absolute', right: 24, bottom: 14, color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
        GusTrips
      </div>
    </div>
  );
});

export default MasonryTemplate;
