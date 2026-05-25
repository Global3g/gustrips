/**
 * Which Storage URL to use for a photo depending on context. New uploads have
 * WebP derivatives (tiny) plus an archived original; older photos only have the
 * legacy url/fullUrl. Every helper falls back gracefully so both work.
 */

import type { AlbumPhoto } from '@/types';

/** Grid / gallery thumbnail — smallest. */
export function gridSrc(p: AlbumPhoto): string {
  return p.thumbWebpUrl || p.url;
}

/** Full-screen / lightbox view — the light 1280px WebP when available. */
export function viewSrc(p: AlbumPhoto): string {
  return p.viewUrl || p.fullUrl || p.url;
}

/** Full-resolution original — downloads, printing, photobook, collage export. */
export function originalSrc(p: AlbumPhoto): string {
  return p.originalUrl || p.fullUrl || p.url;
}
