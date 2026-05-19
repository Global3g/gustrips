'use client';

/**
 * StickerPanel — picker + list of stickers on the active page.
 *
 * Top section: grouped grid of all sticker kinds. Click → spawn a sticker
 * at the centre of the page with default scale/rotation.
 *
 * Bottom section: list of stickers currently on the page, each with a
 * delete button + a small SVG thumbnail. The selected sticker shows its
 * scale/rotation sliders.
 */

import { memo, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { STICKER_LIBRARY, STICKER_LIST, newStickerId, stickerSvgInner } from '@/lib/photobook/stickers';
import type { Sticker, StickerKind } from '@/lib/photobook/types';

interface StickerPanelProps {
  stickers: Sticker[];
  selectedStickerId: string | null;
  onAdd: (sticker: Sticker) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Sticker>) => void;
}

function StickerSvgThumb({ kind, color }: { kind: StickerKind; color: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${stickerSvgInner(kind, color)}</svg>`;
  const dataUrl =
    'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  return (
    <img
      src={dataUrl}
      alt=""
      draggable={false}
      className="w-7 h-7 pointer-events-none"
    />
  );
}

function StickerPanelImpl({
  stickers,
  selectedStickerId,
  onAdd,
  onRemove,
  onSelect,
  onUpdate,
}: StickerPanelProps) {
  const groups = useMemo(() => {
    const travel = STICKER_LIST.filter((s) => s.category === 'travel');
    const deco = STICKER_LIST.filter((s) => s.category === 'deco');
    const label = STICKER_LIST.filter((s) => s.category === 'label');
    return { travel, deco, label };
  }, []);

  const selected =
    selectedStickerId != null
      ? stickers.find((s) => s.id === selectedStickerId) ?? null
      : null;

  const spawn = (kind: StickerKind) => {
    const def = STICKER_LIBRARY[kind];
    const sticker: Sticker = {
      id: newStickerId(),
      kind,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      color: def?.defaultColor,
    };
    onAdd(sticker);
    onSelect(sticker.id);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Library ─── */}
      <div className="space-y-2">
        {(['travel', 'deco', 'label'] as const).map((cat) => (
          <div key={cat}>
            <div className="text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">
              {cat === 'travel' ? 'Viaje' : cat === 'deco' ? 'Decoración' : 'Letras'}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {groups[cat].map((def) => (
                <button
                  key={def.kind}
                  type="button"
                  onClick={() => spawn(def.kind)}
                  title={def.label}
                  className="aspect-square flex items-center justify-center rounded-md bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.06] hover:border-amber-300/40 transition-colors"
                >
                  <StickerSvgThumb kind={def.kind} color={def.defaultColor} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Stickers currently on this page ─── */}
      <div>
        <div className="text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">
          En esta página · {stickers.length}
        </div>
        {stickers.length === 0 ? (
          <p className="text-[10.5px] text-white/45 italic">
            Tocá un sticker arriba para agregarlo. Después arrastralo sobre el
            preview.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {stickers.map((s) => {
              const def = STICKER_LIBRARY[s.kind];
              const color = s.color ?? def?.defaultColor ?? '#0f172a';
              const isSel = s.id === selectedStickerId;
              return (
                <li
                  key={s.id}
                  className={
                    'flex items-center gap-2 px-1.5 py-1 rounded-md border ' +
                    (isSel
                      ? 'bg-amber-300/10 border-amber-300/40'
                      : 'bg-white/[0.03] border-white/[0.06]')
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelect(isSel ? null : s.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <StickerSvgThumb kind={s.kind} color={color} />
                    <span className="text-[10.5px] text-white/80 truncate">
                      {def?.label ?? s.kind}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(s.id)}
                    className="text-red-300/80 hover:text-red-200 p-1 rounded-md hover:bg-red-500/10"
                    title="Quitar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ─── Selected sticker controls ─── */}
      {selected && (
        <div className="rounded-md bg-white/[0.04] border border-white/[0.08] p-2 space-y-2">
          <div className="text-[9px] uppercase font-bold tracking-wider text-white/60">
            Sticker seleccionado
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/65">
              Tamaño · {selected.scale.toFixed(2)}×
            </span>
            <input
              type="range"
              min={0.4}
              max={2.5}
              step={0.05}
              value={selected.scale}
              onChange={(e) => onUpdate(selected.id, { scale: parseFloat(e.target.value) })}
              className="w-full accent-amber-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/65">
              Rotación · {Math.round(selected.rotation)}°
            </span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={selected.rotation}
              onChange={(e) => onUpdate(selected.id, { rotation: parseFloat(e.target.value) })}
              className="w-full accent-amber-400"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[10px] text-white/65">Color</span>
            <input
              type="color"
              value={selected.color ?? STICKER_LIBRARY[selected.kind]?.defaultColor ?? '#000'}
              onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer bg-transparent border border-white/15"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default memo(StickerPanelImpl);
