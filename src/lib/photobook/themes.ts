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

  /* ── Vanguardia 2026 ──────────────────────────────────────
     Inspirados en research de Creative Boom, Kittl, Adobe Design Trends y
     el revival de Neo-Brutalism / Y2K / Punk Zine / Glassmorphism /
     Maximalist Psychedelia. Cada uno es deliberadamente diferente. */

  brutalist: {
    id: 'brutalist',
    label: 'Brutalist',
    background: '#ffffff',
    paper: '#ffffff',
    ink: '#000000',
    inkSoft: '#4a4a4a',
    accent: '#ff2200',
    rule: '#000000',
    fontFamily: {
      // System-mono + uppercase oversized look. We mix mono for body and
      // a heavy display sans for titles to land that "raw blueprint" vibe.
      serif: '"Space Mono", "JetBrains Mono", "Courier New", monospace',
      sans: '"Inter", "Helvetica Neue", system-ui, sans-serif',
      script: '"Space Mono", monospace',
    },
    titleFontKey: 'sans',
    bodyFontKey: 'serif',
    sepia: false,
    decorations: 'mono-borders',
    swatches: ['#ffffff', '#f1f1f1', '#000000', '#ff2200', '#1a1a1a'],
  },

  y2k: {
    id: 'y2k',
    label: 'Y2K Cyber',
    // Vibrant cyber gradient — pre-rendered as a CSS background; PDF picks
    // a flat fallback close to the average tone.
    background:
      'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)',
    paper: 'rgba(255,255,255,0.92)',
    ink: '#1a0e2a',
    inkSoft: '#3a2050',
    accent: '#ff0080',
    rule: '#a855f7',
    fontFamily: {
      serif: '"Orbitron", "Bebas Neue", "Impact", sans-serif',
      sans: '"Orbitron", "Bebas Neue", "Impact", sans-serif',
      script: '"Orbitron", sans-serif',
    },
    titleFontKey: 'sans',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'neon-glow',
    swatches: ['#06b6d4', '#8b5cf6', '#ec4899', '#ff0080', '#f0abfc'],
  },

  zine: {
    id: 'zine',
    label: 'Zine Punk',
    background: '#faf6e9',
    paper: '#fffaf0',
    ink: '#0a0a0a',
    inkSoft: '#5a3a1a',
    accent: '#ff0000',
    rule: '#000000',
    fontFamily: {
      // Punk zine mixes serif headlines (a la "RANSOM NOTE") with raw sans
      // for body. We pair Playfair (display) with Courier (typewriter).
      serif: '"Playfair Display", "Times New Roman", serif',
      sans: '"Space Mono", "Courier New", monospace',
      script: '"Permanent Marker", "Indie Flower", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'tape-strips',
    swatches: ['#faf6e9', '#ffffff', '#000000', '#ff0000', '#ffd400'],
  },

  glass: {
    id: 'glass',
    label: 'Glassmorphism',
    // Soft pastel gradient that supports CSS backdrop-blur in the preview.
    background: 'linear-gradient(135deg, #e0e7ff 0%, #fef3c7 50%, #ddd6fe 100%)',
    paper: 'rgba(255,255,255,0.55)',
    ink: '#1e293b',
    inkSoft: '#475569',
    accent: '#06b6d4',
    rule: 'rgba(15,23,42,0.18)',
    fontFamily: {
      serif: '"DM Serif Display", Georgia, serif',
      sans: '"Inter", system-ui, sans-serif',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'sans',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'glass-blur',
    swatches: ['#e0e7ff', '#fef3c7', '#ddd6fe', '#06b6d4', '#a5f3fc'],
  },

  psychedelic: {
    id: 'psychedelic',
    label: 'Psicodélico',
    // 70s-inspired vibrant gradient. Bold, dreamy, kitsch.
    background: 'linear-gradient(135deg, #fb923c 0%, #f472b6 35%, #a855f7 70%, #38bdf8 100%)',
    paper: '#fff7e6',
    ink: '#3a0a5e',
    inkSoft: '#7c3aed',
    accent: '#f97316',
    rule: '#a855f7',
    fontFamily: {
      // Groovy 70s feel via rounded display + script.
      serif: '"Fraunces", "Georgia", serif',
      sans: '"Fraunces", "Inter", system-ui, sans-serif',
      script: '"Tangerine", "Apple Chancery", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'psychedelic-frame',
    swatches: ['#fb923c', '#f472b6', '#a855f7', '#38bdf8', '#fde047'],
  },

  /* ── New "WOW" themes ────────────────────────────────────
     The previous batch leaned on color shifts and font swaps; these four
     bring strong visual signatures (symmetric crests, postage stamps,
     drop caps, halftone offsets) so each book feels unmistakably itself. */

  wes: {
    id: 'wes',
    label: 'Wes Anderson',
    // The Grand Budapest pastel palette: dusty pink with a dusty blue
    // counterpoint. Subtle so the photos read first, decorations second.
    background: '#f4d9d0',
    paper: '#fbeae3',
    ink: '#4a3c2f',
    inkSoft: '#7a6a55',
    accent: '#b85c1f',
    rule: '#c9a878',
    fontFamily: {
      // Futura is the canonical Wes typeface; we fall back through a stack
      // of geometric sans options so something good shows up everywhere.
      serif: '"Fraunces", "Playfair Display", Georgia, serif',
      sans: '"Futura", "Avenir Next", "Avenir", "Century Gothic", "Inter", system-ui, sans-serif',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'sans',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'wes-symmetry',
    swatches: ['#f4d9d0', '#b4c5d6', '#e8c87a', '#a8c4a2', '#4a3c2f'],
  },

  postal: {
    id: 'postal',
    label: 'Postal · Junk Drawer',
    // Kraft cream. Reads as a real travel journal with stamps AND
    // washi-tape scraps (added 2026 to lean into the "vintage junk drawer"
    // / European scrapbook revival flagged in industry trend reports).
    background: '#e8dcc0',
    paper: '#f1e7cf',
    ink: '#3d2818',
    inkSoft: '#6b4e2e',
    accent: '#b8472a',
    rule: '#d4a574',
    fontFamily: {
      // Stamped serif headline + typewriter for postmark text.
      serif: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
      sans: '"Special Elite", "Courier New", monospace',
      script: '"Tangerine", "Apple Chancery", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'sans',
    sepia: true,
    decorations: 'postal-junk',
    swatches: ['#e8dcc0', '#b8472a', '#3d2818', '#d4a574', '#1a2d3a'],
  },

  cinemagraph: {
    id: 'cinemagraph',
    label: 'Editorial Cinema',
    // Bone-white cream (Pantone "Cloud Dancer" 2026 territory) with a
    // single deep cherry accent — the Cereal / Kinfolk / Sight & Sound
    // luxury-magazine read. Photos breathe; the type carries the mood.
    background: '#f9f8f3',
    paper: '#fdfcf7',
    ink: '#1d1d1d',
    inkSoft: '#776b63',
    accent: '#480003',
    rule: '#dad5cc',
    fontFamily: {
      // High-contrast display serif (Canela / GT Sectra would be ideal —
      // Fraunces is the closest broadly-available stand-in). Neutral sans
      // body so captions read like footnotes, not headlines.
      serif: '"Fraunces", "Playfair Display", "Bodoni Moda", Georgia, serif',
      sans: '"Inter", system-ui, -apple-system, "Helvetica Neue", sans-serif',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'editorial-cinema',
    swatches: ['#f9f8f3', '#1d1d1d', '#480003', '#776b63', '#57372a'],
  },

  riso: {
    id: 'riso',
    label: 'Risograph',
    // Cream stock with two flat ink colors layered slightly off-register.
    // The vibrant fluo pink + cobalt blue is the most identifiable Riso
    // pairing.
    background: '#f4e8d8',
    paper: '#fdf6ea',
    ink: '#0a0a0a',
    inkSoft: '#3a3a3a',
    accent: '#ff3d8c',
    rule: '#1e40af',
    fontFamily: {
      serif: '"Fraunces", "Playfair Display", Georgia, serif',
      sans: '"Archivo Black", "Anton", "Impact", "Helvetica Neue", sans-serif',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'sans',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'riso-halftone',
    swatches: ['#f4e8d8', '#ff3d8c', '#1e40af', '#ffb800', '#0a0a0a'],
  },

  /* ── 2026 research-backed batch ─────────────────────────
     Added after looking at Mixbook / Artifact Uprising / Behance and the
     Designmantic + Kittl trend reports for 2026. Each one was picked for
     being clearly distinguishable from the others in the picker. */

  japandi: {
    id: 'japandi',
    label: 'Japandi',
    // Cloud Dancer cream (Pantone 2026) + Smokey Jade (2026 color trend)
    // + walnut. Whitespace and stillness are the actual decorations here.
    background: '#f4f0e6',
    paper: '#fbf8ef',
    ink: '#2a2620',
    inkSoft: '#5c4a3a',
    accent: '#4a635d',
    rule: '#d3cec3',
    fontFamily: {
      // Tenor Sans / Cormorant for the contemplative serif, Inter for any
      // sans. Shippori Mincho would be the JP accent but lazy-loaded fonts
      // aren't in scope today; Cormorant has the same calm proportions.
      serif: '"Cormorant Garamond", "Tenor Sans", Georgia, serif',
      sans: '"Inter", system-ui, -apple-system, sans-serif',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'serif',
    sepia: false,
    decorations: 'enso-accent',
    swatches: ['#f4f0e6', '#dfddda', '#4a635d', '#5c4a3a', '#e0e0ce'],
  },

  earthy: {
    id: 'earthy',
    label: 'Neo-Minimal Earthy',
    // Warm ivory + olive sage + chocolate, captions in mono. The 12-col
    // grid lives in the decoration layer — see drawDecorations.
    background: '#f5f0e1',
    paper: '#faf6e7',
    ink: '#2e2a26',
    inkSoft: '#6b5e4a',
    accent: '#5e6d3f',
    rule: '#d6cdb8',
    fontFamily: {
      // Confident weights for the title, mono for captions so they read
      // as photo metadata rather than chitchat.
      serif: '"Fraunces", "GT Super Display", Georgia, serif',
      sans: '"JetBrains Mono", "Space Mono", "Courier New", monospace',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'linen-grid',
    swatches: ['#f5f5dc', '#5e6d3f', '#4e342e', '#c8a887', '#2e2a26'],
  },

  botanical: {
    id: 'botanical',
    label: 'Botanical Press',
    // Herbarium-card palette: parchment cream, olive ink, brick red
    // accents for the latin name labels.
    background: '#f2ebdc',
    paper: '#f6f1e3',
    ink: '#1a1f16',
    inkSoft: '#5e6d3f',
    accent: '#884c42',
    rule: '#b5a98a',
    fontFamily: {
      serif: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
      sans: '"Cormorant Garamond", Georgia, serif',
      script: '"Tangerine", "Apple Chancery", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'serif',
    sepia: false,
    decorations: 'herbarium-press',
    swatches: ['#f2ebdc', '#5e6d3f', '#884c42', '#c9a66b', '#1a1f16'],
  },

  doodle: {
    id: 'doodle',
    label: 'Naive Doodle',
    // Notes-app chic / naive design — intentionally a little awkward,
    // primary-school-art palette. The doodles in the decoration layer
    // sell the rest.
    background: '#fffdf3',
    paper: '#ffffff',
    ink: '#1d1d1d',
    inkSoft: '#4d96ff',
    accent: '#ff6b6b',
    rule: '#ffd93d',
    fontFamily: {
      serif: '"Patrick Hand", "Caveat", "Comic Sans MS", cursive',
      sans: '"DM Sans", "Patrick Hand", system-ui, sans-serif',
      script: '"Caveat", cursive',
    },
    titleFontKey: 'serif',
    bodyFontKey: 'sans',
    sepia: false,
    decorations: 'doodle-marks',
    swatches: ['#ffd93d', '#ff6b6b', '#4d96ff', '#6bcb77', '#1d1d1d'],
  },
};

export const THEME_LIST: BookTheme[] = [
  THEMES.editorial,
  THEMES.magazine,
  THEMES.vintage,
  THEMES.modern,
  THEMES.brutalist,
  THEMES.y2k,
  THEMES.zine,
  THEMES.glass,
  THEMES.psychedelic,
  // Wow batch — keep these grouped so the picker tells them apart from
  // the older themes at a glance.
  THEMES.wes,
  THEMES.postal,
  THEMES.cinemagraph,
  THEMES.riso,
  // 2026 research-backed batch.
  THEMES.japandi,
  THEMES.earthy,
  THEMES.botanical,
  THEMES.doodle,
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
