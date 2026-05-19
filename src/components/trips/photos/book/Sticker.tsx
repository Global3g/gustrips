'use client';

/**
 * Sticker — renders a single Sticker on the page preview.
 *
 * In interactive mode it's draggable (pointer events update x/y) and
 * selectable (click → onSelect). In thumbnail mode it's static.
 *
 * Position math: we receive the parent's full pixel dimensions so the
 * sticker can position itself absolutely. Sticker x/y are 0-1 of the
 * page and represent the CENTER of the sticker.
 */

import { memo, useCallback, useRef } from 'react';
import { STICKER_LIBRARY, stickerSvgInner } from '@/lib/photobook/stickers';
import type { Sticker } from '@/lib/photobook/types';

interface StickerProps {
  sticker: Sticker;
  pageWidth: number;
  pageHeight: number;
  interactive?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onMove?: (x: number, y: number) => void;
}

/** Base sticker rendered size (the 100×100 viewBox in CSS px before scale). */
const BASE_PX = 64;

function StickerImpl({
  sticker,
  pageWidth,
  pageHeight,
  interactive = false,
  selected = false,
  onSelect,
  onMove,
}: StickerProps) {
  const def = STICKER_LIBRARY[sticker.kind];
  const color = sticker.color ?? def?.defaultColor ?? '#0f172a';
  const inner = stickerSvgInner(sticker.kind, color);

  const dragStart = useRef<{ px: number; py: number; sx: number; sy: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      e.stopPropagation();
      onSelect?.();
      const tgt = e.currentTarget;
      tgt.setPointerCapture(e.pointerId);
      dragStart.current = {
        px: e.clientX,
        py: e.clientY,
        sx: sticker.x,
        sy: sticker.y,
      };
    },
    [interactive, onSelect, sticker.x, sticker.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !dragStart.current || !onMove) return;
      const dx = (e.clientX - dragStart.current.px) / pageWidth;
      const dy = (e.clientY - dragStart.current.py) / pageHeight;
      const nx = Math.max(0, Math.min(1, dragStart.current.sx + dx));
      const ny = Math.max(0, Math.min(1, dragStart.current.sy + dy));
      onMove(nx, ny);
    },
    [interactive, onMove, pageWidth, pageHeight],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragStart.current = null;
    },
    [interactive],
  );

  // Compute centred top/left.
  const renderSize = BASE_PX * sticker.scale;
  const cx = sticker.x * pageWidth;
  const cy = sticker.y * pageHeight;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${renderSize}" height="${renderSize}">${inner}</svg>`;
  const dataUrl =
    'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

  return (
    <div
      role={interactive ? 'button' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        left: cx - renderSize / 2,
        top: cy - renderSize / 2,
        width: renderSize,
        height: renderSize,
        transform: `rotate(${sticker.rotation}deg)`,
        cursor: interactive ? (dragStart.current ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none',
        touchAction: 'none',
        // Subtle outline when selected.
        boxShadow: selected
          ? '0 0 0 2px rgba(245,158,11,0.85), 0 0 0 4px rgba(245,158,11,0.25)'
          : undefined,
        borderRadius: 6,
        // Light shadow under stickers for that "stuck onto paper" feel.
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
      }}
    >
      <img
        src={dataUrl}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      />
    </div>
  );
}

export default memo(StickerImpl);
