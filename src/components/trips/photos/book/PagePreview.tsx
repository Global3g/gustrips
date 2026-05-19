'use client';

/**
 * PagePreview — HTML render of a single BookPage.
 *
 * Both the central editor canvas and the tiny sidebar thumbnails use this
 * component; only the `scale` and interactivity differ. All positioning is
 * driven by the layout's 0-1 relative coordinates, so the preview can be
 * resized to any pixel width without re-laying-out.
 *
 * Photo "slots" are valid drop targets for dnd-kit when `interactive` is
 * true. Text zones become contentEditable inputs in the same mode. In
 * thumbnail mode (interactive=false) the page is fully static.
 */

import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { LAYOUTS } from '@/lib/photobook/layouts';
import { fontForKind, getTheme } from '@/lib/photobook/themes';
import type { BookPage, BookSize, ThemeId } from '@/lib/photobook/types';

// Approximate aspect ratios. Matches the PDF page sizes.
const PAGE_RATIOS: Record<BookSize, number> = {
  a4: 210 / 297,
  square: 1,
  letter: 216 / 279,
};

interface PagePreviewProps {
  page: BookPage;
  theme: ThemeId;
  size: BookSize;
  /** Pixel width of the rendered preview. Height derives from page ratio. */
  width: number;
  interactive?: boolean;
  /** Slot index currently selected (highlights the slot border). */
  selectedSlot?: number | null;
  onSelectSlot?: (slotIndex: number) => void;
  onTextChange?: (
    field: 'title' | 'subtitle' | 'caption' | 'body' | 'date' | 'location',
    value: string,
  ) => void;
  /** Indicates this is a thumbnail — disables editing + reduces font weight. */
  thumbnail?: boolean;
}

interface SlotProps {
  pageId: string;
  index: number;
  photoUrl: string | null;
  sepia: boolean;
  paperColor: string;
  ruleColor: string;
  inkSoftColor: string;
  width: number;
  height: number;
  left: number;
  top: number;
  interactive: boolean;
  selected: boolean;
  onSelect?: () => void;
}

/**
 * Single photo slot. When interactive it's both a drop target (so dragging
 * a photo from the pool lands here) and a click target (so the editor
 * knows which slot the user wants to fill via tap).
 */
function Slot({
  pageId,
  index,
  photoUrl,
  sepia,
  paperColor,
  ruleColor,
  inkSoftColor,
  width,
  height,
  left,
  top,
  interactive,
  selected,
  onSelect,
}: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${pageId}:${index}`,
    disabled: !interactive,
    data: { kind: 'slot', pageId, index },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={interactive ? onSelect : undefined}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        background: paperColor,
        border: `1px ${selected ? 'dashed' : 'solid'} ${selected ? '#f59e0b' : ruleColor}`,
        boxShadow: isOver ? '0 0 0 3px rgba(245,158,11,0.5)' : undefined,
        cursor: interactive ? 'pointer' : 'default',
        overflow: 'hidden',
        transition: 'box-shadow 120ms',
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            // Cheap sepia approximation for the vintage theme. The PDF uses
            // a pixel-level sepia transform, but for the preview a CSS
            // filter is more than enough.
            filter: sepia ? 'sepia(0.55) saturate(0.9) brightness(0.96)' : undefined,
            userSelect: 'none',
          }}
        />
      ) : interactive ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: inkSoftColor,
            fontSize: Math.max(10, Math.min(width, height) * 0.1),
            fontStyle: 'italic',
            textAlign: 'center',
            padding: 6,
          }}
        >
          arrastrá una foto aquí
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inline editable text — uses contentEditable so the user can type
 * directly into the preview. Keeps onBlur as the commit point to avoid
 * thrashing state on every keystroke.
 */
interface EditableTextProps {
  value: string;
  placeholder: string;
  onCommit?: (value: string) => void;
  style: React.CSSProperties;
  interactive: boolean;
}

function EditableText({
  value,
  placeholder,
  onCommit,
  style,
  interactive,
}: EditableTextProps) {
  const isEmpty = !value.trim();

  if (!interactive) {
    return (
      <div style={style}>
        {value ? value : null}
      </div>
    );
  }

  return (
    <div
      // Stop slot click handlers from stealing the click that should land
      // inside the textbox.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      contentEditable
      suppressContentEditableWarning
      // Block the dnd-kit pointer sensor from hijacking text selection.
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const next = e.currentTarget.innerText;
        if (onCommit) onCommit(next);
      }}
      style={{
        ...style,
        outline: 'none',
        cursor: 'text',
        // Render placeholder via opacity trick when empty.
        opacity: isEmpty ? 0.45 : 1,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {value || placeholder}
    </div>
  );
}

function PagePreviewImpl({
  page,
  theme: themeId,
  size,
  width,
  interactive = false,
  selectedSlot = null,
  onSelectSlot,
  onTextChange,
  thumbnail = false,
}: PagePreviewProps) {
  const theme = getTheme(themeId);
  const layout = LAYOUTS[page.layoutId];
  const ratio = PAGE_RATIOS[size];
  const height = width / ratio;
  // Used to convert layout `size` (in pt-ish units) to px.
  const fontScale = width / 600;

  // Resolve page background: per-page override > theme background.
  const bgColor = page.background || theme.background;

  // Cover photo for the cover layout is rendered FULL BLEED behind text.
  const isCover = page.layoutId === 'cover';

  const decorationLayer = renderDecorations(theme.decorations, width, height, theme.accent, theme.rule);

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: bgColor,
        overflow: 'hidden',
        boxShadow: thumbnail ? 'none' : '0 12px 36px rgba(0,0,0,0.45)',
        borderRadius: thumbnail ? 4 : 6,
      }}
    >
      {decorationLayer}

      {/* Photo slots. */}
      {layout.slots.map((slot, idx) => (
        <Slot
          key={`${page.id}-slot-${idx}`}
          pageId={page.id}
          index={idx}
          photoUrl={page.photoUrls[idx] ?? null}
          sepia={theme.sepia}
          paperColor={theme.paper}
          ruleColor={theme.rule}
          inkSoftColor={theme.inkSoft}
          left={slot.x * width}
          top={slot.y * height}
          width={slot.w * width}
          height={slot.h * height}
          interactive={interactive}
          selected={selectedSlot === idx}
          onSelect={() => onSelectSlot?.(idx)}
        />
      ))}

      {/* Cover overlay: a soft dark gradient at the bottom so light text
          on bright photos stays legible. Only applied when there's a
          cover image actually loaded. */}
      {isCover && page.photoUrls[0] && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '55%',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.0) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Text zones. */}
      {layout.textZones.map((zone, idx) => {
        const baseSize = (zone.size ?? 12) * fontScale;
        const family = fontForKind(theme, zone.kind);
        const value = textValue(page, zone.kind) ?? '';
        const placeholder = placeholderFor(zone.kind);

        // Cover title/subtitle render as white for contrast against the
        // hero photo; everything else uses theme colours.
        const color = isCover
          ? '#ffffff'
          : zone.kind === 'title' || zone.kind === 'subtitle'
            ? theme.ink
            : theme.inkSoft;

        const style: React.CSSProperties = {
          position: 'absolute',
          left: zone.x * width,
          top: zone.y * height,
          width: zone.w * width,
          height: zone.h * height,
          fontFamily: family,
          fontSize: baseSize,
          color,
          textAlign: zone.align ?? 'left',
          fontStyle: zone.italic ? 'italic' : 'normal',
          textTransform: zone.upper ? 'uppercase' : 'none',
          letterSpacing: zone.upper ? '0.15em' : 'normal',
          fontWeight:
            zone.kind === 'title'
              ? 700
              : zone.kind === 'subtitle'
                ? 500
                : 400,
          lineHeight: zone.kind === 'body' ? 1.45 : 1.15,
          // Allow titles to grow downward if user types more, by hiding
          // overflow at the box boundary rather than crashing the layout.
          overflow: 'hidden',
          textShadow: isCover && (zone.kind === 'title' || zone.kind === 'subtitle')
            ? '0 1px 6px rgba(0,0,0,0.6)'
            : undefined,
        };

        return (
          <EditableText
            key={`${page.id}-zone-${idx}`}
            value={value}
            placeholder={placeholder}
            style={style}
            interactive={interactive && !thumbnail}
            onCommit={(next) => {
              if (!onTextChange) return;
              // Map kind to BookPage field. Most kinds are 1:1; we never
              // edit 'date' or 'location' inline (the side panel handles
              // those) but supporting them keeps the surface symmetric.
              onTextChange(zone.kind, next);
            }}
          />
        );
      })}
    </div>
  );
}

function textValue(
  page: BookPage,
  kind: 'title' | 'subtitle' | 'caption' | 'body' | 'date' | 'location',
): string | undefined {
  switch (kind) {
    case 'title': return page.title;
    case 'subtitle': return page.subtitle;
    case 'caption': return page.caption;
    case 'body': return page.body;
    case 'date': return page.date;
    case 'location': return page.location;
  }
}

function placeholderFor(kind: 'title' | 'subtitle' | 'caption' | 'body' | 'date' | 'location'): string {
  switch (kind) {
    case 'title': return 'Título';
    case 'subtitle': return 'Subtítulo';
    case 'caption': return 'Descripción breve';
    case 'body': return 'Escribí el cuerpo del texto…';
    case 'date': return 'Fecha';
    case 'location': return 'Lugar';
  }
}

/**
 * Light decorative layer per theme. Kept dead-simple — heavy ornaments
 * are best handled in the PDF where we control DPI.
 */
function renderDecorations(
  kind:
    | 'none'
    | 'dashed-borders'
    | 'corner-flourish'
    | 'paper-noise'
    | 'geometric-bars'
    | 'mono-borders'
    | 'neon-glow'
    | 'tape-strips'
    | 'glass-blur'
    | 'psychedelic-frame',
  w: number,
  h: number,
  accent: string,
  rule: string,
): React.ReactNode {
  if (kind === 'none') return null;
  if (kind === 'dashed-borders') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 8,
          border: `1px dashed ${rule}`,
          pointerEvents: 'none',
        }}
      />
    );
  }
  if (kind === 'corner-flourish') {
    const len = Math.min(w, h) * 0.06;
    const corners = [
      { top: 12, left: 12, borderTop: `1px solid ${accent}`, borderLeft: `1px solid ${accent}` },
      { top: 12, right: 12, borderTop: `1px solid ${accent}`, borderRight: `1px solid ${accent}` },
      { bottom: 12, left: 12, borderBottom: `1px solid ${accent}`, borderLeft: `1px solid ${accent}` },
      { bottom: 12, right: 12, borderBottom: `1px solid ${accent}`, borderRight: `1px solid ${accent}` },
    ];
    return (
      <>
        {corners.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: len,
              height: len,
              ...c,
              pointerEvents: 'none',
            }}
          />
        ))}
      </>
    );
  }
  if (kind === 'paper-noise') {
    // Very subtle, fast-rendering noise via radial gradients.
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.04) 0%, transparent 50%),' +
            'radial-gradient(circle at 80% 70%, rgba(0,0,0,0.05) 0%, transparent 60%)',
          mixBlendMode: 'multiply',
        }}
      />
    );
  }
  if (kind === 'geometric-bars') {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 6,
            height: h,
            background: accent,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: w * 0.18,
            height: 4,
            background: accent,
            pointerEvents: 'none',
          }}
        />
      </>
    );
  }

  /* ── Brutalist: thick black frame + corner label ── */
  if (kind === 'mono-borders') {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 6,
            border: `4px solid ${rule || '#000'}`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            padding: '2px 6px',
            background: '#000',
            color: '#fff',
            fontFamily: '"Space Mono", monospace',
            fontSize: 9,
            letterSpacing: 1.5,
            pointerEvents: 'none',
          }}
        >
          {`PB · ${Math.round(w)}×${Math.round(h)}`}
        </div>
      </>
    );
  }

  /* ── Y2K Neon glow + scanlines ── */
  if (kind === 'neon-glow') {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 6,
            border: `2px solid ${accent}`,
            boxShadow: `0 0 18px ${accent}, inset 0 0 14px ${accent}55`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 4px)',
          }}
        />
      </>
    );
  }

  /* ── Zine: washi tape strips at corners ── */
  if (kind === 'tape-strips') {
    const tapeCommon: React.CSSProperties = {
      position: 'absolute',
      width: 56,
      height: 16,
      background: accent,
      opacity: 0.85,
      pointerEvents: 'none',
      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
    };
    return (
      <>
        <div style={{ ...tapeCommon, top: -4, left: 22, transform: 'rotate(-12deg)' }} />
        <div style={{ ...tapeCommon, top: -4, right: 22, transform: 'rotate(10deg)', background: '#0a0a0a' }} />
        <div style={{ ...tapeCommon, bottom: -4, left: 22, transform: 'rotate(8deg)', background: '#ffd400' }} />
        <div style={{ ...tapeCommon, bottom: -4, right: 22, transform: 'rotate(-10deg)' }} />
      </>
    );
  }

  /* ── Glass: soft translucent overlay rect with blur look ── */
  if (kind === 'glass-blur') {
    return (
      <div
        style={{
          position: 'absolute',
          top: '6%',
          left: '6%',
          width: '88%',
          height: '88%',
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 12,
          pointerEvents: 'none',
        }}
      />
    );
  }

  /* ── Psychedelic: concentric color rings in opposite corners ── */
  if (kind === 'psychedelic-frame') {
    const ring = (size: number, stroke: number, color: string, pos: React.CSSProperties): React.CSSProperties => ({
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      border: `${stroke}px solid ${color}`,
      pointerEvents: 'none',
      ...pos,
    });
    return (
      <>
        <div style={ring(60, 4, '#fb923c', { top: -20, left: -20 })} />
        <div style={ring(40, 3, '#f472b6', { top: -10, left: -10 })} />
        <div style={ring(80, 5, '#a855f7', { bottom: -30, right: -30 })} />
        <div style={ring(50, 3, '#38bdf8', { bottom: -15, right: -15 })} />
      </>
    );
  }

  return null;
}

export const PagePreview = memo(PagePreviewImpl);
export default PagePreview;
