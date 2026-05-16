'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AlbumPhoto } from '@/types';

interface PhotoFilmstripProps {
  photos: AlbumPhoto[];
  /** Max distinct photos to show — duplicates fill the rest of the strip. */
  maxPhotos?: number;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Movie-reel banner: photos drift right→left forever, framed by sprocket
 *  holes on top and bottom and a soft fade at each edge. Hover pauses the
 *  motion via group-hover; the duplicated photo array makes the loop seamless. */
export default function PhotoFilmstrip({ photos, maxPhotos = 18 }: PhotoFilmstripProps) {
  const strip = useMemo(() => {
    const withUrls = photos.filter((p) => !!p.url);
    if (withUrls.length < 4) return [];
    const shuffled = shuffleArray(withUrls).slice(0, Math.min(maxPhotos, withUrls.length));
    // Duplicate so the linear translate animation wraps without a visible jump.
    return [...shuffled, ...shuffled];
  }, [photos, maxPhotos]);

  if (strip.length === 0) return null;

  // Half of the strip = one full cycle of unique photos.
  const cycleDuration = Math.max(20, (strip.length / 2) * 3);

  return (
    <div className="mb-8 relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)] group">
      {/* Sprocket holes (top) */}
      <div className="h-5 bg-[#0d1424] flex items-center justify-around px-3">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={`top-${i}`} className="w-3 h-2 rounded-sm bg-white/10" />
        ))}
      </div>

      <div className="relative bg-[#0d1424] py-3 overflow-hidden">
        <motion.div
          className="flex gap-3 will-change-transform group-hover:[animation-play-state:paused]"
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: cycleDuration,
              ease: 'linear',
            },
          }}
          style={{ width: 'fit-content' }}
        >
          {strip.map((photo, i) => (
            <div
              key={`strip-${i}-${photo.url}`}
              className="flex-shrink-0 w-44 h-28 sm:w-56 sm:h-36 md:w-64 md:h-40 rounded-xl overflow-hidden relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || 'Foto del viaje'}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
              {photo.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white/85 truncate font-medium">
                    {photo.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Sprocket holes (bottom) */}
      <div className="h-5 bg-[#0d1424] flex items-center justify-around px-3">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={`bot-${i}`} className="w-3 h-2 rounded-sm bg-white/10" />
        ))}
      </div>

      {/* Edge fades */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#07101f] to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#07101f] to-transparent pointer-events-none z-10" />
    </div>
  );
}
