'use client';

/**
 * PhotoFramePicker — chooses the frame style for a selected slot.
 *
 * Each option shows a tiny preview of the FRAME geometry (not the actual
 * photo). The polaroid option draws an extra white pad below the photo to
 * make the caption strip obvious.
 */

import { memo } from 'react';
import { FRAME_LIST } from '@/lib/photobook/frames';
import type { PhotoFrame } from '@/lib/photobook/types';

interface PhotoFramePickerProps {
  value: PhotoFrame | null;
  onChange: (id: PhotoFrame | null) => void;
}

function FrameThumb({ kind, active }: { kind: PhotoFrame; active: boolean }) {
  const photoBg = active
    ? 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)'
    : 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)';
  const baseBox: React.CSSProperties = {
    position: 'relative',
    width: 36,
    height: 36,
    background: '#1f1f23',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  };

  if (kind === 'polaroid') {
    return (
      <div style={baseBox}>
        <div style={{ width: 26, height: 30, background: '#fff', padding: 2, paddingBottom: 8 }}>
          <div style={{ width: '100%', height: 20, background: photoBg }} />
        </div>
      </div>
    );
  }
  if (kind === 'rounded') {
    return (
      <div style={baseBox}>
        <div style={{ width: 28, height: 28, background: photoBg, borderRadius: 8 }} />
      </div>
    );
  }
  if (kind === 'circle') {
    return (
      <div style={baseBox}>
        <div style={{ width: 28, height: 28, background: photoBg, borderRadius: '50%' }} />
      </div>
    );
  }
  if (kind === 'hexagon') {
    return (
      <div style={baseBox}>
        <div
          style={{
            width: 28,
            height: 28,
            background: photoBg,
            clipPath:
              'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}
        />
      </div>
    );
  }
  if (kind === 'tape') {
    return (
      <div style={baseBox}>
        <div style={{ position: 'relative', width: 28, height: 26, background: photoBg }}>
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: 4,
              width: 14,
              height: 5,
              background: '#fbbf24',
              opacity: 0.85,
              transform: 'rotate(-15deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              right: 4,
              width: 14,
              height: 5,
              background: '#0a0a0a',
              opacity: 0.85,
              transform: 'rotate(8deg)',
            }}
          />
        </div>
      </div>
    );
  }
  if (kind === 'vintage-edge') {
    return (
      <div style={baseBox}>
        <div
          style={{
            width: 28,
            height: 28,
            background: photoBg,
            boxShadow: 'inset 0 0 6px rgba(0,0,0,0.6), 0 0 0 1px rgba(120,80,40,0.6)',
            borderRadius: 2,
            border: '1px solid #4a2c1a',
          }}
        />
      </div>
    );
  }
  // none
  return (
    <div style={baseBox}>
      <div style={{ width: 28, height: 28, background: photoBg }} />
    </div>
  );
}

function PhotoFramePickerImpl({ value, onChange }: PhotoFramePickerProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {FRAME_LIST.map((f) => {
        const active = (value ?? 'none') === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id === 'none' ? null : f.id)}
            aria-pressed={active}
            className={
              'flex flex-col items-center gap-1 p-1.5 rounded-md border transition-colors ' +
              (active
                ? 'bg-amber-300/15 border-amber-300/60'
                : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]')
            }
          >
            <FrameThumb kind={f.id} active={active} />
            <span
              className={
                'text-[9px] leading-tight text-center ' +
                (active ? 'text-amber-100' : 'text-white/65')
              }
            >
              {f.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(PhotoFramePickerImpl);
