/**
 * Photo Book — background pattern library.
 *
 * Patterns are drawn ON TOP of the page background color, BELOW photos.
 * The HTML preview uses `background-image` CSS gradients; the PDF generator
 * walks the pattern's primitives and stamps them with jsPDF.
 */

import type { BookPatternId } from './types';

export interface PatternDef {
  id: BookPatternId;
  label: string;
  /** CSS background-image (or empty string for `none`). */
  css: string;
  /** Tile size in CSS px — sets `background-size`. */
  size?: string;
}

/** SVG-encoded squiggly "map" tile. Reused as both CSS bg and a PDF helper. */
const MAP_SVG_DATA =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <g fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1">
        <path d="M0 20 C 30 10, 60 30, 90 18 S 120 32, 140 22"/>
        <path d="M0 60 C 24 50, 52 72, 80 58 S 120 68, 130 60"/>
        <path d="M0 96 C 30 86, 60 104, 92 92 S 120 102, 140 96"/>
        <circle cx="30" cy="50" r="3" fill="rgba(0,0,0,0.18)"/>
        <circle cx="86" cy="34" r="3" fill="rgba(0,0,0,0.18)"/>
        <circle cx="68" cy="80" r="3" fill="rgba(0,0,0,0.18)"/>
      </g>
    </svg>`,
  );

export const PATTERNS: Record<BookPatternId, PatternDef> = {
  none: { id: 'none', label: 'Sin patrón', css: '' },
  paper: {
    id: 'paper',
    label: 'Papel',
    css:
      'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1.5px)',
    size: '6px 6px',
  },
  dots: {
    id: 'dots',
    label: 'Puntos',
    css:
      'radial-gradient(circle, rgba(0,0,0,0.15) 1.5px, transparent 2px)',
    size: '14px 14px',
  },
  'stripes-diagonal': {
    id: 'stripes-diagonal',
    label: 'Rayas',
    css:
      'repeating-linear-gradient(45deg, transparent 0 8px, rgba(0,0,0,0.06) 8px 10px)',
  },
  grid: {
    id: 'grid',
    label: 'Grilla',
    css:
      'linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)',
    size: '18px 18px',
  },
  map: {
    id: 'map',
    label: 'Mapa',
    css: `url("${MAP_SVG_DATA}")`,
    size: '120px 120px',
  },
  confetti: {
    id: 'confetti',
    label: 'Confetti',
    css:
      'radial-gradient(circle at 18% 22%, #fb923c 3px, transparent 4px),' +
      'radial-gradient(circle at 78% 32%, #8b5cf6 3px, transparent 4px),' +
      'radial-gradient(circle at 32% 64%, #f472b6 3px, transparent 4px),' +
      'radial-gradient(circle at 62% 84%, #38bdf8 3px, transparent 4px),' +
      'radial-gradient(circle at 12% 88%, #facc15 3px, transparent 4px),' +
      'radial-gradient(circle at 90% 68%, #34d399 3px, transparent 4px)',
    size: '90px 90px',
  },
};

export const PATTERN_LIST: PatternDef[] = [
  PATTERNS.none,
  PATTERNS.paper,
  PATTERNS.dots,
  PATTERNS['stripes-diagonal'],
  PATTERNS.grid,
  PATTERNS.map,
  PATTERNS.confetti,
];

/** Build the `style` properties needed to render a pattern on a div. */
export function patternBackgroundStyle(
  id: BookPatternId | null | undefined,
): { backgroundImage?: string; backgroundSize?: string; backgroundRepeat?: string } {
  if (!id || id === 'none') return {};
  const def = PATTERNS[id];
  if (!def || !def.css) return {};
  return {
    backgroundImage: def.css,
    backgroundSize: def.size ?? 'auto',
    backgroundRepeat: 'repeat',
  };
}
