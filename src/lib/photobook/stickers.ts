/**
 * Photo Book — sticker library.
 *
 * Each sticker is a tiny SVG drawn from primitive shapes/paths, sized inside
 * a 100×100 viewBox. The `Sticker` component (see components/.../book)
 * positions and scales them on the page.
 *
 * Stickers fall into three buckets visually:
 *  - Travel icons: airplane, suitcase, camera, passport, compass, globe…
 *  - Decorations: heart, star, arrow, route-dashed
 *  - Text "labels": ADVENTURES, MEMORIES, WANDERLUST — purely typographic
 *    stickers that work great as page accents.
 */

import type { StickerKind } from './types';

export interface StickerDef {
  kind: StickerKind;
  label: string;
  /** A default fill/stroke colour when the user hasn't picked one. */
  defaultColor: string;
  /** Sticker category — used to group the picker. */
  category: 'travel' | 'deco' | 'label';
}

export const STICKER_LIBRARY: Record<StickerKind, StickerDef> = {
  airplane: { kind: 'airplane', label: 'Avión', defaultColor: '#0f172a', category: 'travel' },
  suitcase: { kind: 'suitcase', label: 'Valija', defaultColor: '#7c2d12', category: 'travel' },
  camera: { kind: 'camera', label: 'Cámara', defaultColor: '#1f2937', category: 'travel' },
  passport: { kind: 'passport', label: 'Pasaporte', defaultColor: '#7f1d1d', category: 'travel' },
  compass: { kind: 'compass', label: 'Brújula', defaultColor: '#1e3a8a', category: 'travel' },
  globe: { kind: 'globe', label: 'Globo', defaultColor: '#0e7490', category: 'travel' },
  'map-pin': { kind: 'map-pin', label: 'Pin', defaultColor: '#dc2626', category: 'travel' },
  'palm-tree': { kind: 'palm-tree', label: 'Palmera', defaultColor: '#15803d', category: 'travel' },
  mountain: { kind: 'mountain', label: 'Montaña', defaultColor: '#475569', category: 'travel' },
  sun: { kind: 'sun', label: 'Sol', defaultColor: '#f59e0b', category: 'travel' },
  'stamp-postal': { kind: 'stamp-postal', label: 'Sello', defaultColor: '#b91c1c', category: 'travel' },
  'ticket-stub': { kind: 'ticket-stub', label: 'Ticket', defaultColor: '#92400e', category: 'travel' },
  heart: { kind: 'heart', label: 'Corazón', defaultColor: '#e11d48', category: 'deco' },
  star: { kind: 'star', label: 'Estrella', defaultColor: '#f59e0b', category: 'deco' },
  arrow: { kind: 'arrow', label: 'Flecha', defaultColor: '#0f172a', category: 'deco' },
  'route-dashed': { kind: 'route-dashed', label: 'Ruta', defaultColor: '#0f172a', category: 'deco' },
  'text-adventures': { kind: 'text-adventures', label: 'ADVENTURES', defaultColor: '#dc2626', category: 'label' },
  'text-memories': { kind: 'text-memories', label: 'MEMORIES', defaultColor: '#0f172a', category: 'label' },
  'text-wanderlust': { kind: 'text-wanderlust', label: 'WANDERLUST', defaultColor: '#7c3aed', category: 'label' },
};

export const STICKER_LIST: StickerDef[] = (
  Object.values(STICKER_LIBRARY) as StickerDef[]
);

/**
 * Return the SVG inner markup for a sticker kind. Always rendered inside a
 * 100×100 viewBox.
 *
 * Kept as a function (not a JSX component) so it works from both the React
 * preview and the PDF rasteriser (which renders the SVG to canvas).
 */
export function stickerSvgInner(kind: StickerKind, color: string): string {
  switch (kind) {
    case 'airplane':
      return `<g fill="${color}"><path d="M50 8 L55 38 L92 50 L55 56 L52 88 L46 76 L40 88 L37 56 L8 50 L37 38 Z"/></g>`;
    case 'suitcase':
      return `<g><rect x="18" y="34" width="64" height="50" rx="6" fill="${color}"/><rect x="34" y="22" width="32" height="14" rx="3" fill="${color}"/><rect x="14" y="60" width="72" height="3" fill="#fff" opacity="0.4"/><circle cx="32" cy="62" r="2.5" fill="#fff" opacity="0.5"/><circle cx="68" cy="62" r="2.5" fill="#fff" opacity="0.5"/></g>`;
    case 'camera':
      return `<g><rect x="10" y="28" width="80" height="56" rx="6" fill="${color}"/><circle cx="50" cy="56" r="18" fill="#fff" opacity="0.18"/><circle cx="50" cy="56" r="13" fill="#fff" opacity="0.85" stroke="${color}" stroke-width="3"/><rect x="40" y="20" width="20" height="10" rx="2" fill="${color}"/><circle cx="78" cy="38" r="3" fill="#fff" opacity="0.7"/></g>`;
    case 'passport':
      return `<g><rect x="22" y="12" width="56" height="76" rx="4" fill="${color}"/><circle cx="50" cy="42" r="12" fill="none" stroke="#fff" stroke-width="2" opacity="0.9"/><circle cx="50" cy="42" r="6" fill="none" stroke="#fff" stroke-width="2" opacity="0.9"/><text x="50" y="74" font-family="Georgia, serif" font-size="9" font-weight="bold" fill="#fff" text-anchor="middle" opacity="0.95">PASSPORT</text></g>`;
    case 'compass':
      return `<g><circle cx="50" cy="50" r="40" fill="#fff" stroke="${color}" stroke-width="4"/><polygon points="50,18 58,50 50,82 42,50" fill="${color}"/><polygon points="50,18 58,50 50,50" fill="${color}" opacity="0.7"/><circle cx="50" cy="50" r="4" fill="${color}"/><text x="50" y="14" font-family="Georgia, serif" font-size="9" font-weight="bold" fill="${color}" text-anchor="middle">N</text></g>`;
    case 'globe':
      return `<g><circle cx="50" cy="50" r="40" fill="${color}"/><ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="#fff" stroke-width="2" opacity="0.7"/><line x1="50" y1="10" x2="50" y2="90" stroke="#fff" stroke-width="2" opacity="0.7"/><ellipse cx="50" cy="50" rx="22" ry="40" fill="none" stroke="#fff" stroke-width="2" opacity="0.7"/></g>`;
    case 'map-pin':
      return `<g><path d="M50 6 C32 6 20 20 20 36 C20 56 50 92 50 92 C50 92 80 56 80 36 C80 20 68 6 50 6 Z" fill="${color}"/><circle cx="50" cy="36" r="11" fill="#fff"/></g>`;
    case 'palm-tree':
      return `<g><path d="M48 90 L52 90 L54 50 L46 50 Z" fill="#7c2d12"/><path d="M50 50 C30 38 14 42 8 30 C18 30 30 32 50 46" fill="${color}"/><path d="M50 50 C70 38 86 42 92 30 C82 30 70 32 50 46" fill="${color}"/><path d="M50 50 C36 30 32 14 22 8 C28 22 30 32 50 46" fill="${color}"/><path d="M50 50 C64 30 68 14 78 8 C72 22 70 32 50 46" fill="${color}"/></g>`;
    case 'mountain':
      return `<g><polygon points="6,86 36,32 54,60 70,42 94,86" fill="${color}"/><polygon points="36,32 30,42 38,42" fill="#fff"/><polygon points="70,42 65,52 73,52" fill="#fff"/></g>`;
    case 'sun':
      return `<g><circle cx="50" cy="50" r="20" fill="${color}"/><g stroke="${color}" stroke-width="4" stroke-linecap="round"><line x1="50" y1="6" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="94"/><line x1="6" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="94" y2="50"/><line x1="18" y1="18" x2="28" y2="28"/><line x1="72" y1="72" x2="82" y2="82"/><line x1="18" y1="82" x2="28" y2="72"/><line x1="72" y1="28" x2="82" y2="18"/></g></g>`;
    case 'stamp-postal':
      return `<g><rect x="14" y="14" width="72" height="72" fill="${color}" stroke="#fff" stroke-width="3" stroke-dasharray="3 2"/><rect x="22" y="22" width="56" height="56" fill="none" stroke="#fff" stroke-width="1" opacity="0.7"/><text x="50" y="56" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">2026</text></g>`;
    case 'ticket-stub':
      return `<g><path d="M8 28 L92 28 L92 44 C92 47 88 50 84 50 C80 50 76 53 76 56 C76 59 80 62 84 62 C88 62 92 65 92 68 L92 84 L8 84 L8 68 C8 65 12 62 16 62 C20 62 24 59 24 56 C24 53 20 50 16 50 C12 50 8 47 8 44 Z" fill="${color}"/><line x1="50" y1="32" x2="50" y2="80" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.7"/><text x="28" y="62" font-family="monospace" font-size="9" fill="#fff" text-anchor="middle">001</text></g>`;
    case 'heart':
      return `<g><path d="M50 84 C50 84 8 56 8 32 C8 18 20 8 32 8 C42 8 48 14 50 20 C52 14 58 8 68 8 C80 8 92 18 92 32 C92 56 50 84 50 84 Z" fill="${color}"/></g>`;
    case 'star':
      return `<g><polygon points="50,6 60,40 96,40 67,60 78,94 50,74 22,94 33,60 4,40 40,40" fill="${color}"/></g>`;
    case 'arrow':
      return `<g fill="${color}"><path d="M10 50 L70 50 L70 30 L94 50 L70 70 L70 50 Z"/></g>`;
    case 'route-dashed':
      return `<g><path d="M8 80 C 24 60, 36 70, 48 50 S 76 36, 92 16" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="6 5" stroke-linecap="round"/><circle cx="8" cy="80" r="5" fill="${color}"/><circle cx="92" cy="16" r="5" fill="${color}"/></g>`;
    case 'text-adventures':
      return `<g><text x="50" y="62" font-family="Georgia, serif" font-size="22" font-weight="900" fill="${color}" text-anchor="middle" letter-spacing="2" font-style="italic">Adventures</text><line x1="14" y1="72" x2="86" y2="72" stroke="${color}" stroke-width="2"/></g>`;
    case 'text-memories':
      return `<g><text x="50" y="60" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="900" fill="${color}" text-anchor="middle" letter-spacing="4">MEMORIES</text></g>`;
    case 'text-wanderlust':
      return `<g><text x="50" y="62" font-family="Georgia, serif" font-size="18" font-style="italic" font-weight="800" fill="${color}" text-anchor="middle">~ wanderlust ~</text></g>`;
    default:
      return '';
  }
}

/** Render a sticker to a data URL via an offscreen SVG → canvas pipeline.
 *  Used by the PDF generator to embed complex stickers as raster images. */
export async function rasterStickerToCanvas(
  kind: StickerKind,
  color: string,
  pxSize: number,
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null;
  const inner = stickerSvgInner(kind, color);
  if (!inner) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${pxSize}" height="${pxSize}">${inner}</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('svg load failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = pxSize;
    canvas.height = pxSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, pxSize, pxSize);
    return canvas;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pure jsPDF primitives can draw these — no rasterisation needed. */
export const PRIMITIVE_STICKERS: ReadonlySet<StickerKind> = new Set<StickerKind>([
  'map-pin',
  'heart',
  'star',
  'arrow',
  'route-dashed',
  'sun',
]);

/** Generate a stable-ish id for newly-spawned stickers. */
export function newStickerId(): string {
  return `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
