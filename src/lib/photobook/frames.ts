/**
 * Photo Book — per-photo frame library.
 *
 * Frames wrap a single slot. They affect:
 *  - HTML preview: borders, border-radius, clip-path, decorative tape strips.
 *  - PDF output: stroked rectangle / polygon / circle around the photo,
 *    or in the case of polaroid an extra white pad.
 *
 * Frames vs filters: the FILTER changes pixels (e.g. sepia, b&w). The FRAME
 * changes the geometry/border of the slot but leaves the pixels alone.
 */

import type { PhotoFrame } from './types';

export interface FrameDef {
  id: PhotoFrame;
  label: string;
}

export const PHOTO_FRAMES: Record<PhotoFrame, FrameDef> = {
  none: { id: 'none', label: 'Sin marco' },
  polaroid: { id: 'polaroid', label: 'Polaroid' },
  rounded: { id: 'rounded', label: 'Redondeado' },
  circle: { id: 'circle', label: 'Círculo' },
  hexagon: { id: 'hexagon', label: 'Hexágono' },
  tape: { id: 'tape', label: 'Cinta washi' },
  'vintage-edge': { id: 'vintage-edge', label: 'Borde vintage' },
};

export const FRAME_LIST: FrameDef[] = [
  PHOTO_FRAMES.none,
  PHOTO_FRAMES.polaroid,
  PHOTO_FRAMES.rounded,
  PHOTO_FRAMES.circle,
  PHOTO_FRAMES.hexagon,
  PHOTO_FRAMES.tape,
  PHOTO_FRAMES['vintage-edge'],
];

/**
 * Compute the inner rectangle (in 0-1 units relative to a slot's own box)
 * where the actual photo sits, given a frame style.
 *
 * For example, a polaroid leaves a 6% border at top/sides and an extra 18%
 * at the bottom for the caption strip — so the photo box shrinks
 * accordingly.
 */
export function framePhotoInset(frame: PhotoFrame | null | undefined): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  switch (frame) {
    case 'polaroid':
      return { top: 0.06, right: 0.06, bottom: 0.22, left: 0.06 };
    default:
      return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

/** CSS clip-path / border-radius for the inner photo image. */
export function frameClipCss(frame: PhotoFrame | null | undefined): {
  borderRadius?: string;
  clipPath?: string;
} {
  switch (frame) {
    case 'rounded':
      return { borderRadius: '14px' };
    case 'circle':
      return { borderRadius: '50%' };
    case 'hexagon':
      return {
        clipPath:
          'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
      };
    default:
      return {};
  }
}

/** Hexagon vertex offsets used by the PDF renderer (relative 0-1 in slot). */
export const HEX_POLY: ReadonlyArray<[number, number]> = [
  [0.5, 0],
  [1, 0.25],
  [1, 0.75],
  [0.5, 1],
  [0, 0.75],
  [0, 0.25],
];
