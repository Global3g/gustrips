'use client';

import { BookOpen, Newspaper, Coffee } from 'lucide-react';
import type { PhotoBookStyle } from '@/lib/utils/exportPhotoBookPdf';

/** Each preset gets a label, a one-liner description and an icon. The
 *  preview swatches in the right column are pure CSS — no images — to keep
 *  the bundle light. */
const STYLES: {
  id: PhotoBookStyle;
  label: string;
  description: string;
  icon: typeof BookOpen;
  swatch: { bg: string; accent: string };
}[] = [
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Serif elegante, mucho aire, paleta cálida.',
    icon: BookOpen,
    swatch: { bg: '#fdfaf6', accent: '#b4643c' },
  },
  {
    id: 'magazine',
    label: 'Magazine',
    description: 'Sans denso, hero + thumbnails, acento rojo.',
    icon: Newspaper,
    swatch: { bg: '#ffffff', accent: '#e84150' },
  },
  {
    id: 'vintage',
    label: 'Vintage',
    description: 'Sepia, decoraciones, papel envejecido.',
    icon: Coffee,
    swatch: { bg: '#f5ebd7', accent: '#965020' },
  },
];

interface StyleSelectorProps {
  value: PhotoBookStyle;
  onChange: (style: PhotoBookStyle) => void;
}

export default function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {STYLES.map((s) => {
        const Icon = s.icon;
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={
              'group relative flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ' +
              (active
                ? 'bg-gradient-to-br from-amber-400/20 to-rose-500/15 border-amber-300/50 ring-1 ring-amber-300/40'
                : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]')
            }
          >
            {/* Swatch preview */}
            <div
              className="flex-shrink-0 w-12 h-14 rounded-md border border-white/10 shadow-md overflow-hidden"
              style={{ background: s.swatch.bg }}
            >
              <div className="w-full h-1.5" style={{ background: s.swatch.accent }} />
              <div className="px-1 mt-1.5 space-y-0.5">
                <div className="h-1 rounded bg-black/20 w-3/4" />
                <div className="h-1 rounded bg-black/15 w-2/3" />
                <div className="h-1 rounded bg-black/10 w-1/2" />
              </div>
              <div
                className="mx-1 mt-1.5 h-4 rounded-sm"
                style={{ background: 'rgba(0,0,0,0.12)' }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Icon className={'w-3.5 h-3.5 ' + (active ? 'text-amber-200' : 'text-white/70')} />
                <span
                  className={
                    'text-sm font-semibold ' + (active ? 'text-white' : 'text-white/90')
                  }
                >
                  {s.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/55 leading-snug">{s.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
