'use client';

import { formatDateES } from '@/lib/utils/helpers';
import type { CaptionMode, OverlayThemeId, SlideshowPhoto } from '@/lib/slideshow/types';
import type { TripEvent } from '@/types';

interface CaptionOverlayProps {
  photo: SlideshowPhoto;
  event?: TripEvent;
  mode: CaptionMode;
  theme: OverlayThemeId;
  /** When true (mini preview) we shrink everything down so the
   *  thumbnail isn't drowned in giant text. */
  compact?: boolean;
}

/**
 * Caption overlay shared between the fullscreen viewer and the mini
 * preview card in the settings screen.
 *
 * Three themes:
 *  - `auto`    → gradient on the bottom edge + white text. Cinematic-ish.
 *  - `cinema`  → letterbox bars top & bottom; text centered in the lower bar.
 *  - `minimal` → tiny, fixed-corner stamp. Nothing else.
 *
 * Returns `null` for `mode === 'none'` so the parent doesn't reserve any
 * space for it; the photo gets the whole frame.
 */
export default function CaptionOverlay({
  photo,
  event,
  mode,
  theme,
  compact = false,
}: CaptionOverlayProps) {
  if (mode === 'none') return null;

  const dateText = photo.date ? formatDateES(photo.date) : '';
  const eventTitle = event?.title || photo.eventTitle;
  const location = event ? [event.city, event.country].filter(Boolean).join(', ') : '';
  const caption = photo.caption;

  // `dateOnly` short-circuits all themes — just a stamp.
  if (mode === 'dateOnly') {
    return (
      <div
        className={
          'pointer-events-none absolute z-20 ' +
          (compact ? 'left-2 bottom-2' : 'left-4 bottom-4 sm:left-6 sm:bottom-6')
        }
      >
        <span
          className={
            'inline-flex items-center rounded-full bg-black/45 backdrop-blur-sm font-medium capitalize text-white ' +
            (compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs sm:text-sm')
          }
        >
          {dateText || '—'}
        </span>
      </div>
    );
  }

  // mode === 'all' — full caption block. Theme controls the chrome.
  if (theme === 'cinema') {
    return (
      <>
        {/* Top letterbox bar — purely decorative. */}
        <div
          aria-hidden="true"
          className={
            'pointer-events-none absolute inset-x-0 top-0 z-20 bg-black ' +
            (compact ? 'h-4' : 'h-10 sm:h-14')
          }
        />
        {/* Bottom letterbox bar + centered text. */}
        <div
          className={
            'pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black flex flex-col items-center justify-center ' +
            (compact ? 'h-10 px-2' : 'h-20 sm:h-24 px-6')
          }
        >
          {caption ? (
            <p
              className={
                'text-center font-medium text-white leading-tight ' +
                (compact ? 'text-[10px] line-clamp-1' : 'text-sm sm:text-base line-clamp-2')
              }
            >
              {caption}
            </p>
          ) : null}
          <p
            className={
              'flex flex-wrap items-center justify-center gap-x-2 text-zinc-400 ' +
              (compact ? 'text-[9px] mt-0.5' : 'text-[11px] sm:text-xs mt-1')
            }
          >
            {dateText ? <span className="capitalize text-amber-200/90">{dateText}</span> : null}
            {eventTitle ? <span className="text-rose-200/85">· {eventTitle}</span> : null}
            {location ? <span>· {location}</span> : null}
          </p>
        </div>
      </>
    );
  }

  if (theme === 'minimal') {
    return (
      <div
        className={
          'pointer-events-none absolute z-20 ' +
          (compact ? 'left-2 bottom-2 max-w-[80%]' : 'left-4 bottom-4 sm:left-6 sm:bottom-6 max-w-[60%]')
        }
      >
        {caption ? (
          <p
            className={
              'font-semibold text-white drop-shadow truncate ' +
              (compact ? 'text-[10px]' : 'text-sm sm:text-base')
            }
          >
            {caption}
          </p>
        ) : null}
        <p
          className={
            'text-zinc-300 truncate capitalize ' +
            (compact ? 'text-[9px]' : 'text-[11px] sm:text-xs')
          }
        >
          {[dateText, eventTitle].filter(Boolean).join(' · ')}
        </p>
      </div>
    );
  }

  // theme === 'auto' (default)
  return (
    <div
      className={
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/55 to-transparent ' +
        (compact ? 'pb-3 pt-6 px-3' : 'pb-8 pt-16 sm:pb-10')
      }
    >
      <div className={compact ? '' : 'mx-auto max-w-3xl px-6'}>
        {caption ? (
          <p
            className={
              'font-medium leading-snug text-white drop-shadow ' +
              (compact ? 'text-[11px] line-clamp-2' : 'text-base sm:text-lg')
            }
          >
            {caption}
          </p>
        ) : null}
        <div
          className={
            'flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-300 ' +
            (compact ? 'text-[9px] mt-1' : 'text-xs sm:text-sm mt-2')
          }
        >
          {dateText ? <span className="capitalize text-amber-200/90">{dateText}</span> : null}
          {eventTitle ? (
            <span className="flex items-center gap-1.5 text-rose-200/90">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-rose-300/70" />
              {eventTitle}
            </span>
          ) : null}
          {location ? (
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-zinc-500" />
              {location}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
