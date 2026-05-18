'use client';

/**
 * ThemeSelector — four large cards, each showing a swatch + font sample
 * representative of the theme.
 */

import { memo } from 'react';
import { THEME_LIST, fontForKind } from '@/lib/photobook/themes';
import type { ThemeId } from '@/lib/photobook/types';

interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}

function ThemeSelectorImpl({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {THEME_LIST.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={
              'group relative overflow-hidden rounded-xl border text-left transition-all ' +
              (active
                ? 'border-amber-300/60 ring-1 ring-amber-300/40'
                : 'border-white/[0.08] hover:border-white/20')
            }
            style={{
              background: t.background,
            }}
          >
            <div className="p-2.5">
              <div
                style={{
                  fontFamily: fontForKind(t, 'title'),
                  color: t.ink,
                  fontSize: 18,
                  fontWeight: t.titleFontKey === 'sans' ? 800 : 600,
                  lineHeight: 1.05,
                }}
              >
                {t.label}
              </div>
              <div
                style={{
                  fontFamily: fontForKind(t, 'body'),
                  color: t.inkSoft,
                  fontSize: 9,
                  marginTop: 4,
                  letterSpacing: t.titleFontKey === 'sans' ? '0.04em' : 'normal',
                }}
              >
                AaBbCc 12345
              </div>
              <div className="mt-2 flex gap-1">
                {t.swatches.slice(0, 4).map((sw) => (
                  <span
                    key={sw}
                    className="w-3.5 h-3.5 rounded-full border"
                    style={{ background: sw, borderColor: t.rule }}
                  />
                ))}
              </div>
            </div>
            {active && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: t.accent }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default memo(ThemeSelectorImpl);
