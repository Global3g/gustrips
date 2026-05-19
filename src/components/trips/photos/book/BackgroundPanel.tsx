'use client';

/**
 * BackgroundPanel — page background color + pattern overlay picker.
 *
 * The color swatches come from the active theme (so suggestions feel
 * curated). A native color input lets users go arbitrary. The pattern
 * grid below applies a CSS-only overlay drawn from the patterns library.
 */

import { memo } from 'react';
import { PATTERN_LIST, patternBackgroundStyle } from '@/lib/photobook/patterns';
import { getTheme } from '@/lib/photobook/themes';
import type { BookPatternId, ThemeId } from '@/lib/photobook/types';

interface BackgroundPanelProps {
  themeId: ThemeId;
  backgroundColor: string | undefined;
  pattern: BookPatternId | undefined;
  onColorChange: (color: string | undefined) => void;
  onPatternChange: (pattern: BookPatternId | undefined) => void;
}

function BackgroundPanelImpl({
  themeId,
  backgroundColor,
  pattern,
  onColorChange,
  onPatternChange,
}: BackgroundPanelProps) {
  const theme = getTheme(themeId);
  const resolvedBg = backgroundColor || theme.background;

  return (
    <div className="space-y-3">
      {/* Color swatches + custom */}
      <div>
        <div className="text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1.5">
          Color
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {theme.swatches.map((sw) => {
            const active = resolvedBg === sw;
            return (
              <button
                key={sw}
                type="button"
                onClick={() => onColorChange(sw === theme.background ? undefined : sw)}
                className={
                  'w-7 h-7 rounded-full border-2 transition-transform ' +
                  (active ? 'border-amber-300 scale-110' : 'border-white/20')
                }
                style={{ background: sw }}
                aria-pressed={active}
                aria-label={`Fondo ${sw}`}
              />
            );
          })}
          <label
            className="w-7 h-7 rounded-full border-2 border-white/20 overflow-hidden cursor-pointer flex items-center justify-center"
            title="Color personalizado"
          >
            <input
              type="color"
              value={backgroundColor || (theme.background.startsWith('#') ? theme.background : '#ffffff')}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-12 h-12 -m-2 cursor-pointer"
            />
          </label>
          {backgroundColor && (
            <button
              type="button"
              onClick={() => onColorChange(undefined)}
              className="text-[10px] text-white/60 hover:text-white underline ml-1"
            >
              Restaurar
            </button>
          )}
        </div>
      </div>

      {/* Pattern picker */}
      <div>
        <div className="text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1.5">
          Patrón
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {PATTERN_LIST.map((p) => {
            const active = (pattern ?? 'none') === p.id;
            const patternStyle = patternBackgroundStyle(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPatternChange(p.id === 'none' ? undefined : p.id)}
                aria-pressed={active}
                className={
                  'flex flex-col items-center gap-1 p-1 rounded-md border transition-colors ' +
                  (active
                    ? 'bg-amber-300/15 border-amber-300/60'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]')
                }
                title={p.label}
              >
                <div
                  className="w-full aspect-square rounded overflow-hidden border border-white/10"
                  style={{
                    background: resolvedBg,
                    ...patternStyle,
                  }}
                />
                <span
                  className={
                    'text-[9px] leading-tight text-center ' +
                    (active ? 'text-amber-100' : 'text-white/65')
                  }
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(BackgroundPanelImpl);
