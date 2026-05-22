'use client';

/**
 * Photo crop modal — opens on slot double-click, lets the user reframe a
 * photo within its slot's aspect ratio. Confirming writes a SlotCrop
 * (normalized 0..1 source rect) back to the page state.
 *
 * Uses react-easy-crop because the touch-zoom/pan UX is fiddly to get
 * right on iOS Safari and it ships that already solved.
 */

import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, Check, RotateCcw } from 'lucide-react';
import type { SlotCrop } from '@/lib/photobook/types';

interface Props {
  photoUrl: string;
  /** Slot's width/height ratio (e.g. 3/2 for a landscape slot). */
  aspect: number;
  /** Optional existing crop to preload (so reopening keeps the framing). */
  initialCrop?: SlotCrop | null;
  onConfirm: (crop: SlotCrop) => void;
  /** Reset to default cover-fit (clears the per-slot crop entirely). */
  onReset?: () => void;
  onCancel: () => void;
}

/**
 * react-easy-crop returns areaPixels in pixels of the natural image.
 * We normalize against (image.naturalWidth × image.naturalHeight) so the
 * stored crop survives image scaling and slot resizing.
 */
function pixelsToNormalizedCrop(
  pixels: Area,
  naturalW: number,
  naturalH: number,
): SlotCrop {
  return {
    x: pixels.x / naturalW,
    y: pixels.y / naturalH,
    w: pixels.width / naturalW,
    h: pixels.height / naturalH,
  };
}

export default function PhotoCropModal({
  photoUrl,
  aspect,
  initialCrop,
  onConfirm,
  onReset,
  onCancel,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleMediaLoaded = useCallback((media: { naturalWidth: number; naturalHeight: number }) => {
    setNaturalSize({ w: media.naturalWidth, h: media.naturalHeight });
    // If we have an existing crop, seed react-easy-crop with values that
    // approximate it. The lib has no direct "set crop in source pixels"
    // API, but it accepts (cropAreaPixels) via initialCroppedAreaPercentages
    // — we can't easily set that retroactively, so we leave the user to
    // re-frame. For most editing flows this is fine.
  }, []);

  const handleConfirm = () => {
    if (!croppedAreaPixels || !naturalSize) {
      onCancel();
      return;
    }
    onConfirm(pixelsToNormalizedCrop(croppedAreaPixels, naturalSize.w, naturalSize.h));
  };

  // Seed the cropper from initialCrop on first mount: react-easy-crop accepts
  // `initialCroppedAreaPercentages` which is x/y/w/h in percentages (0..100).
  const initialPercent = initialCrop
    ? {
        x: initialCrop.x * 100,
        y: initialCrop.y * 100,
        width: initialCrop.w * 100,
        height: initialCrop.h * 100,
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-zinc-950 border border-white/10 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
          <h2 className="text-sm font-semibold text-white">Reencuadrar foto</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.08]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cropper area — fixed height so the dialog stays predictable */}
        <div className="relative w-full bg-black" style={{ height: 'min(60vh, 500px)' }}>
          <Cropper
            image={photoUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            onMediaLoaded={handleMediaLoaded}
            initialCroppedAreaPercentages={initialPercent}
            showGrid
            objectFit="contain"
            // Slightly darker mask so the crop area pops.
            style={{
              containerStyle: { background: '#000' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center gap-3">
          <span className="text-xs text-white/55 font-medium">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-amber-300"
          />
          <span className="text-xs text-white/55 font-mono w-10 text-right">{zoom.toFixed(1)}×</span>
        </div>

        {/* Hint */}
        <div className="px-5 pb-3 text-[11px] text-white/45">
          Arrastrá la foto para reencuadrarla. En móvil podés hacer pinch para acercar.
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/10 bg-white/[0.02]">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/65 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Encuadre original
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/65 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-zinc-900 font-bold text-xs shadow-md transition-shadow"
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
