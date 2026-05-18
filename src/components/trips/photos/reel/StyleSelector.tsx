'use client';

/**
 * StyleSelector — three-card radio for picking the reel's pacing/vibe.
 *
 * Each option corresponds to a `ReelStyle` preset in `@/lib/shotstack`,
 * which controls clip duration, transition speed, and the rotation of
 * Ken-Burns-style effects on the rendered video.
 */

import { Film, Sparkles, Moon } from 'lucide-react';
import type { ReelStyle } from '@/lib/shotstack';
import { classNames } from '@/lib/utils/helpers';

interface StyleSelectorProps {
  value: ReelStyle;
  onChange: (style: ReelStyle) => void;
}

const STYLE_OPTIONS: {
  id: ReelStyle;
  label: string;
  description: string;
  icon: typeof Film;
  accent: string;
}[] = [
  {
    id: 'cinematic',
    label: 'Cinemático',
    description: '2.5s por foto · transiciones suaves',
    icon: Film,
    accent: 'from-indigo-400/20 to-purple-500/20 border-indigo-300/40 text-indigo-100',
  },
  {
    id: 'vibrant',
    label: 'Vibrante',
    description: '1.8s por foto · ritmo rápido',
    icon: Sparkles,
    accent: 'from-amber-400/20 to-rose-500/20 border-amber-300/40 text-amber-100',
  },
  {
    id: 'slow',
    label: 'Lento',
    description: '3.5s por foto · contemplativo',
    icon: Moon,
    accent: 'from-sky-400/20 to-cyan-500/20 border-sky-300/40 text-sky-100',
  },
];

export default function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {STYLE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={classNames(
              'relative text-left p-3 rounded-xl border-2 transition-all',
              active
                ? `bg-gradient-to-br ${opt.accent} shadow-lg scale-[0.98]`
                : 'bg-white/[0.04] border-white/[0.08] text-white/75 hover:bg-white/[0.07] hover:border-white/20',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" strokeWidth={2.2} />
              <span className="text-sm font-bold">{opt.label}</span>
            </div>
            <p className={classNames('text-[11px] leading-snug', active ? 'opacity-90' : 'text-white/55')}>
              {opt.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
