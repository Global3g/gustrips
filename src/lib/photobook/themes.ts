/**
 * Photo Book editor — visual themes.
 *
 * Each theme is shared between the HTML preview (using CSS) and the PDF
 * generator (which translates the same tokens into jsPDF colour/font calls).
 *
 * Keep tokens minimal — themes communicate a strong identity, not a kitchen
 * sink. Anything page-specific (e.g. per-page background) lives on the page
 * itself.
 */

import type { BookTheme, ThemeId } from './types';

export const THEMES: Record<ThemeId, BookTheme> = {
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    background: '#f1ece0',
    paper: '#fbf6e9',
    ink: '#1a1408',
    inkSoft: '#5b4630',
    accent: '#8e6a2a',
    rule: '#d8cdb0',
    fontFamily: {
      serif: '"Playfair Display", "Times New Roman", Times, serif',
      sans: '"Inter", system-ui, -apple-system, sans-serif',
      script: '"Pinyon Script", "Apple Chancery", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'serif',
    sepia: false,
    decorations: 'corner-flourish',
    swatches: ['#f1ece0', '#fbf6e9', '#e8dcc0', '#d4c9a8', '#bfa873'],
  },

  magazine: {
    id: 'magazine',
    label: 'Magazine',
    background: '#ffffff',
    paper: '#f5f5f5',
    ink: '#0a0a0a',
    inkSoft: '#5a5a5a',
    accent: '#dc2626',
    rule: '#e5e5e5',
    fontFamily: {
      serif: '"Times New Roman", Times, serif',
      sans: '"Bebas Neue", "Helvetica Neue", Helvetica, Arial, sans-serif',
      script: '"Brush Script MT", cursive',
    },
    titleFontKey: 'sans',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'none',
    swatches: ['#ffffff', '#f5f5f5', '#000000', '#dc2626', '#1f1f1f'],
  },

  vintage: {
    id: 'vintage',
    label: 'Vintage',
    background: '#e8d4a0',
    paper: '#f0dfae',
    ink: '#5a3a1a',
    inkSoft: '#8a6234',
    accent: '#b85c1f',
    rule: '#c5a872',
    fontFamily: {
      serif: '"Playfair Display", Georgia, "Times New Roman", serif',
      sans: '"Cormorant Garamond", Georgia, serif',
      script: '"Tangerine", "Apple Chancery", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'serif',
    sepia: true,
    decorations: 'paper-noise',
    swatches: ['#e8d4a0', '#f0dfae', '#d4b878', '#b89a5c', '#8a6234'],
  },

  modern: {
    id: 'modern',
    label: 'Modern',
    background: '#ffffff',
    paper: '#fafafa',
    ink: '#1f2937',
    inkSoft: '#6b7280',
    accent: '#4f46e5',
    rule: '#e5e7eb',
    fontFamily: {
      serif: '"Source Serif Pro", Georgia, serif',
      sans: '"Inter", system-ui, sans-serif',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'sans',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'geometric-bars',
    swatches: ['#ffffff', '#fafafa', '#4f46e5', '#1f2937', '#e0e7ff'],
  },
};

export const THEME_LIST: BookTheme[] = [
  THEMES.editorial,
  THEMES.magazine,
  THEMES.vintage,
  THEMES.modern,
];

export function getTheme(id: ThemeId): BookTheme {
  return THEMES[id] ?? THEMES.editorial;
}

/**
 * Resolve a "title" or "body" font family CSS string from a theme. Decoupled
 * so the preview can call it the same way both for title and body zones.
 */
export function fontForKind(
  theme: BookTheme,
  kind: 'title' | 'subtitle' | 'caption' | 'body' | 'date' | 'location',
): string {
  if (kind === 'title' || kind === 'subtitle') {
    return theme.fontFamily[theme.titleFontKey];
  }
  return theme.fontFamily[theme.bodyFontKey];
}
