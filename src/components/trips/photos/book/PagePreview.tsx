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
 *
 * Vol. 2 additions:
 *  - Per-slot photo filter (CSS filter chain).
 *  - Per-slot photo frame (polaroid / rounded / circle / hexagon / tape / vintage-edge).
 *  - Decorative stickers (draggable in interactive mode).
 *  - Background pattern overlay.
 *  - Map-full layout draws a stylised SVG map behind the photo pins.
 *  - Magazine-3col splits `body` text into 3 columns.
 *  - Polaroid-grid auto-rotates each slot.
 *  - Timeline-strip exposes per-slot dates via slotCaptions.
 *  - Panorama-bleed renders title overlay over the photo.
 *  - Journal-page uses a soft paper texture.
 */

import { memo } from 'react';
import Image from 'next/image';
import { useDroppable } from '@dnd-kit/core';
import { LAYOUTS } from '@/lib/photobook/layouts';
import { fontForKind, getTheme } from '@/lib/photobook/themes';
import { filterCss } from '@/lib/photobook/filters';
import { framePhotoInset, frameClipCss } from '@/lib/photobook/frames';
import { patternBackgroundStyle } from '@/lib/photobook/patterns';
import StickerView from './Sticker';
import type {
  BookPage,
  BookSize,
  PhotoFilter,
  PhotoFrame,
  SlotCrop,
  Sticker,
  ThemeId,
} from '@/lib/photobook/types';

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
  /** Fired on double-click of a filled slot — opens the crop modal. */
  onCropSlot?: (slotIndex: number) => void;
  onTextChange?: (
    field: 'title' | 'subtitle' | 'caption' | 'body' | 'date' | 'location',
    value: string,
  ) => void;
  /** Indicates this is a thumbnail — disables editing + reduces font weight. */
  thumbnail?: boolean;

  /* Vol. 2 — sticker editing */
  selectedStickerId?: string | null;
  onSelectSticker?: (id: string | null) => void;
  onMoveSticker?: (id: string, x: number, y: number) => void;
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
  filter: PhotoFilter | null;
  frame: PhotoFrame | null;
  /** Polaroid caption text (optional). */
  caption?: string | null;
  /** Optional rotation in degrees for the whole slot (used by polaroid-grid). */
  rotateDeg?: number;
  /** User-defined crop rect (0..1 normalized). Null = default cover-fit. */
  crop?: SlotCrop | null;
  onSelect?: () => void;
  onCropOpen?: () => void;
}

/**
 * Single photo slot. When interactive it's both a drop target (so dragging
 * a photo from the pool lands here) and a click target (so the editor
 * knows which slot the user wants to fill via tap). Vol. 2 adds frame
 * styling around the slot, per-slot filters on the image, and optional
 * rotation for layouts like polaroid-grid.
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
  filter,
  frame,
  caption,
  rotateDeg,
  crop,
  onSelect,
  onCropOpen,
}: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${pageId}:${index}`,
    disabled: !interactive,
    data: { kind: 'slot', pageId, index },
  });

  // Combine theme-level sepia with per-slot filter. Theme sepia stays as a
  // fallback when the user hasn't picked an explicit filter.
  const effectiveFilter =
    filter && filter !== 'none'
      ? filterCss(filter)
      : sepia
        ? 'sepia(0.55) saturate(0.9) brightness(0.96)'
        : undefined;

  const inset = framePhotoInset(frame);
  const innerLeft = inset.left * width;
  const innerTop = inset.top * height;
  const innerW = (1 - inset.left - inset.right) * width;
  const innerH = (1 - inset.top - inset.bottom) * height;
  const clipCss = frameClipCss(frame);

  // ── Frame-specific wrapper styling ───────────────────────
  let wrapperBg = 'transparent';
  let wrapperBorder = `1px ${selected ? 'dashed' : 'solid'} ${selected ? '#f59e0b' : ruleColor}`;
  let wrapperShadow: string | undefined;
  let wrapperBorderRadius: number | undefined;
  let wrapperOverflow: React.CSSProperties['overflow'] = 'hidden';
  let extraInside: React.ReactNode = null;

  if (frame === 'polaroid') {
    wrapperBg = '#fefefe';
    wrapperBorder = `1px solid ${selected ? '#f59e0b' : 'rgba(0,0,0,0.06)'}`;
    wrapperShadow = '0 4px 14px rgba(0,0,0,0.25)';
    wrapperOverflow = 'visible';
    // Caption strip below.
    if (caption || interactive) {
      const stripTop = innerTop + innerH + Math.min(4, height * 0.01);
      extraInside = (
        <div
          style={{
            position: 'absolute',
            left: innerLeft,
            top: stripTop,
            width: innerW,
            height: height - stripTop - 2,
            color: '#222',
            fontFamily: '"Caveat", "Indie Flower", cursive',
            fontSize: Math.max(9, Math.min(width, height) * 0.07),
            textAlign: 'center',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {caption ?? ''}
        </div>
      );
    }
  } else if (frame === 'rounded') {
    wrapperBorderRadius = 14;
  } else if (frame === 'circle') {
    wrapperBorderRadius = Math.min(width, height) / 2;
  } else if (frame === 'hexagon') {
    // Hexagon clipping happens on the inner image — keep the wrapper bare.
    wrapperBorder = `1px ${selected ? 'dashed' : 'solid'} ${selected ? '#f59e0b' : 'transparent'}`;
    wrapperBg = 'transparent';
    wrapperOverflow = 'visible';
  } else if (frame === 'tape') {
    wrapperBg = paperColor;
    wrapperOverflow = 'visible';
    // Two tape strips, one on top-left, one on bottom-right.
    extraInside = (
      <>
        <div
          style={{
            position: 'absolute',
            top: -6,
            left: '10%',
            width: '28%',
            height: 12,
            background: '#fbbf24',
            opacity: 0.85,
            transform: 'rotate(-10deg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -6,
            right: '10%',
            width: '24%',
            height: 12,
            background: '#0a0a0a',
            opacity: 0.85,
            transform: 'rotate(8deg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}
        />
      </>
    );
  } else if (frame === 'vintage-edge') {
    wrapperBg = '#f4e6cf';
    wrapperBorder = `2px solid #6b4a2b`;
    wrapperShadow = 'inset 0 0 14px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)';
    wrapperBorderRadius = 3;
  }

  if (isOver) {
    wrapperShadow = (wrapperShadow ? wrapperShadow + ', ' : '') + '0 0 0 3px rgba(245,158,11,0.5)';
  }

  // When the user has applied a custom crop, we can't use Next/Image's
  // objectFit:'cover' (which centers the image). Instead we scale the image
  // up so that the crop rect fills the slot, and translate it so that the
  // crop's top-left aligns with the slot's top-left. Math:
  //   imageWidthPercent  = 100 / crop.w
  //   leftPercent        = -(crop.x / crop.w) * 100
  // (and analogous for height/top).
  const useCustomCrop = !!(photoUrl && crop);
  const cropTransform = useCustomCrop && crop
    ? {
        width: `${100 / crop.w}%`,
        height: `${100 / crop.h}%`,
        left: `${-(crop.x / crop.w) * 100}%`,
        top: `${-(crop.y / crop.h) * 100}%`,
      }
    : null;

  return (
    <div
      ref={setNodeRef}
      onClick={interactive ? onSelect : undefined}
      onDoubleClick={
        interactive && photoUrl && onCropOpen
          ? (e) => {
              e.stopPropagation();
              onCropOpen();
            }
          : undefined
      }
      title={interactive && photoUrl ? 'Doble click para reencuadrar' : undefined}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        cursor: interactive ? 'pointer' : 'default',
        transform: rotateDeg ? `rotate(${rotateDeg}deg)` : undefined,
        transformOrigin: 'center',
        transition: 'box-shadow 120ms',
        // Wrapper frame fill (polaroid / vintage-edge / tape need a visible bg)
        background: wrapperBg,
        border: wrapperBorder,
        boxShadow: wrapperShadow,
        borderRadius: wrapperBorderRadius,
        overflow: wrapperOverflow,
      }}
    >
      {/* Inner photo area (respects frame inset). */}
      <div
        style={{
          position: 'absolute',
          left: innerLeft,
          top: innerTop,
          width: innerW,
          height: innerH,
          background: paperColor,
          overflow: 'hidden',
          ...clipCss,
        }}
      >
        {photoUrl ? (
          useCustomCrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                objectFit: 'fill',
                display: 'block',
                filter: effectiveFilter,
                userSelect: 'none',
                ...cropTransform,
              }}
            />
          ) : (
            <Image
              src={photoUrl}
              alt=""
              fill
              draggable={false}
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{
                objectFit: 'cover',
                display: 'block',
                filter: effectiveFilter,
                userSelect: 'none',
              }}
            />
          )
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
      {extraInside}
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

/**
 * Stylised SVG map drawn behind `map-full` layouts. Pure decoration — does
 * not represent real geography.
 */
function MapDecoration({ width, height, ink }: { width: number; height: number; ink: string }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 280"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {/* Soft "ocean" wave lines. */}
      <g stroke={ink} strokeOpacity={0.18} fill="none" strokeWidth={0.6}>
        <path d="M0 40 C 40 30, 80 50, 120 38 S 180 50, 200 42" />
        <path d="M0 70 C 40 60, 80 78, 120 68 S 180 78, 200 72" />
        <path d="M0 100 C 40 90, 80 108, 120 98 S 180 108, 200 102" />
        <path d="M0 200 C 40 190, 80 208, 120 198 S 180 208, 200 202" />
        <path d="M0 230 C 40 220, 80 238, 120 228 S 180 238, 200 232" />
        <path d="M0 260 C 40 250, 80 268, 120 258 S 180 268, 200 262" />
      </g>
      {/* Land masses — abstract polygonal blobs. */}
      <g fill={ink} fillOpacity={0.08} stroke={ink} strokeOpacity={0.28} strokeWidth={0.8}>
        <path d="M14 50 Q 30 30, 60 38 T 110 56 Q 130 70, 120 96 Q 100 110, 70 100 Q 30 92, 18 78 Z" />
        <path d="M120 110 Q 150 100, 180 116 Q 192 140, 170 160 Q 140 170, 120 152 Q 110 130, 120 110 Z" />
        <path d="M30 160 Q 60 150, 90 168 Q 100 190, 84 210 Q 60 218, 36 200 Q 22 180, 30 160 Z" />
      </g>
      {/* Dashed route lines connecting "pins" — purely decorative. */}
      <g stroke={ink} strokeOpacity={0.55} fill="none" strokeWidth={0.8} strokeDasharray="3 2">
        <path d="M40 80 Q 90 60, 140 80 T 180 130" />
        <path d="M60 200 Q 100 180, 150 210" />
      </g>
      {/* Small city dots. */}
      <g fill={ink} fillOpacity={0.5}>
        <circle cx="40" cy="80" r="2" />
        <circle cx="100" cy="100" r="2" />
        <circle cx="150" cy="80" r="2" />
        <circle cx="170" cy="140" r="2" />
        <circle cx="80" cy="200" r="2" />
        <circle cx="150" cy="220" r="2" />
      </g>
    </svg>
  );
}

/** Split a body string into N roughly-equal columns by sentences. */
function splitBodyIntoColumns(body: string, n: number): string[] {
  if (!body || n <= 1) return [body];
  const sentences = body.match(/[^.!?\n]+[.!?]?[\s]?|\S+/g) ?? [body];
  const out: string[] = Array.from({ length: n }, () => '');
  // Distribute by approximate length so columns balance.
  const total = body.length;
  const target = total / n;
  let bucket = 0;
  let acc = 0;
  for (const s of sentences) {
    if (acc + s.length > target * (bucket + 1) && bucket < n - 1) {
      bucket++;
    }
    out[bucket] += s;
    acc += s.length;
  }
  return out;
}

function PagePreviewImpl({
  page,
  theme: themeId,
  size,
  width,
  interactive = false,
  selectedSlot = null,
  onSelectSlot,
  onCropSlot,
  onTextChange,
  thumbnail = false,
  selectedStickerId = null,
  onSelectSticker,
  onMoveSticker,
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
  const isPanorama = page.layoutId === 'panorama-bleed';
  const isJournal = page.layoutId === 'journal-page';
  const isMapFull = page.layoutId === 'map-full';
  const isPolaroidGrid = page.layoutId === 'polaroid-grid';
  const isMagazine3Col = page.layoutId === 'magazine-3col';

  const decorationLayer = renderDecorations(
    theme.decorations,
    width,
    height,
    theme.accent,
    theme.rule,
  );

  // Pattern overlay style — derived from page.backgroundPattern.
  const patternStyle = patternBackgroundStyle(page.backgroundPattern);

  // Stickers (Vol. 2). Render after photos, before text.
  const stickers: Sticker[] = page.stickers ?? [];

  // For magazine-3col we need to allocate body string across the 3 'body'
  // text zones. We compute the cuts up-front.
  const bodyColumns = isMagazine3Col
    ? splitBodyIntoColumns(page.body ?? '', 3)
    : null;
  let bodyZoneIndex = 0;

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
      {/* Pattern overlay. Drawn ABOVE the bg color, BELOW everything else. */}
      {page.backgroundPattern && page.backgroundPattern !== 'none' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            ...patternStyle,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Journal pages get a warm paper texture overlay (subtle). */}
      {isJournal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(0deg, rgba(120,80,40,0.04) 0 22px, rgba(120,80,40,0.10) 22px 23px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Map-full decoration. */}
      {isMapFull && <MapDecoration width={width} height={height} ink={theme.ink} />}

      {decorationLayer}

      {/* Photo slots. */}
      {layout.slots.map((slot, idx) => {
        // Per-slot filter / frame / caption.
        const filter = page.photoFilters?.[idx] ?? null;
        const frame = page.photoFrames?.[idx] ?? null;
        const caption = page.slotCaptions?.[idx] ?? null;

        // Polaroid-grid auto-rotates each slot for that "scattered" feel.
        let rotateDeg: number | undefined;
        if (isPolaroidGrid) {
          // Hand-picked rotations that read as playful but not chaotic.
          const wobble = [-6, 4, -3, 5, -4, 3];
          rotateDeg = wobble[idx % wobble.length];
        }
        // If user picked the polaroid frame on a non-polaroid layout, still
        // give a light wobble for personality (but only when there's no
        // explicit rotation set by the layout itself).
        if (frame === 'polaroid' && !isPolaroidGrid && rotateDeg == null) {
          rotateDeg = ((idx % 2 === 0 ? -1 : 1) * 2) + ((idx * 7) % 3 - 1);
        }

        return (
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
            filter={filter}
            frame={frame}
            caption={caption}
            rotateDeg={rotateDeg}
            crop={page.slotCrops?.[idx] ?? null}
            onSelect={() => onSelectSlot?.(idx)}
            onCropOpen={() => onCropSlot?.(idx)}
          />
        );
      })}

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

      {/* Panorama: dark scrim over the photo for title legibility. */}
      {isPanorama && page.photoUrls[0] && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: '55%',
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Stickers — render between photos and text. */}
      {stickers.map((s) => (
        <StickerView
          key={s.id}
          sticker={s}
          pageWidth={width}
          pageHeight={height}
          interactive={interactive && !thumbnail}
          selected={selectedStickerId === s.id}
          onSelect={() => onSelectSticker?.(s.id)}
          onMove={(x, y) => onMoveSticker?.(s.id, x, y)}
        />
      ))}

      {/* Text zones. */}
      {layout.textZones.map((zone, idx) => {
        const baseSize = (zone.size ?? 12) * fontScale;
        const family = fontForKind(theme, zone.kind);

        // Resolve text value. Magazine-3col body cycles through columns.
        let value = textValue(page, zone.kind) ?? '';
        if (isMagazine3Col && zone.kind === 'body' && bodyColumns) {
          value = bodyColumns[bodyZoneIndex] ?? '';
          bodyZoneIndex++;
        }

        const placeholder = placeholderFor(zone.kind);

        // Cover title/subtitle render as white for contrast against the
        // hero photo; same for panorama title/subtitle overlaid on the
        // photo.
        const overPhoto =
          isCover ||
          (isPanorama && (zone.kind === 'title' || zone.kind === 'subtitle'));

        const color = overPhoto
          ? '#ffffff'
          : zone.kind === 'title' || zone.kind === 'subtitle'
            ? theme.ink
            : theme.inkSoft;

        // Journal layout uses a handwritten feel for the body.
        const journalBody = isJournal && (zone.kind === 'body' || zone.kind === 'title');

        const style: React.CSSProperties = {
          position: 'absolute',
          left: zone.x * width,
          top: zone.y * height,
          width: zone.w * width,
          height: zone.h * height,
          fontFamily: journalBody
            ? '"Caveat", "Indie Flower", cursive'
            : family,
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
          overflow: 'hidden',
          textShadow:
            overPhoto && (zone.kind === 'title' || zone.kind === 'subtitle')
              ? '0 1px 6px rgba(0,0,0,0.6)'
              : undefined,
        };

        // We never edit a single column of magazine-3col body inline — only
        // the whole `body` text via the side panel. Skip inline editing for
        // these column zones.
        const editableHere =
          interactive &&
          !thumbnail &&
          !(isMagazine3Col && zone.kind === 'body');

        return (
          <EditableText
            key={`${page.id}-zone-${idx}`}
            value={value}
            placeholder={placeholder}
            style={style}
            interactive={editableHere}
            onCommit={(next) => {
              if (!onTextChange) return;
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
    | 'psychedelic-frame'
    | 'wes-symmetry'
    | 'postal-junk'
    | 'editorial-cinema'
    | 'riso-halftone'
    | 'enso-accent'
    | 'linen-grid'
    | 'herbarium-press'
    | 'doodle-marks',
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

  // ── Wes Anderson: symmetric crest + 8-point stars in each corner ──
  if (kind === 'wes-symmetry') {
    const starSize = Math.min(w, h) * 0.04;
    const star = (pos: React.CSSProperties): React.CSSProperties => ({
      position: 'absolute',
      width: starSize,
      height: starSize,
      color: accent,
      fontSize: starSize,
      lineHeight: 1,
      pointerEvents: 'none',
      fontFamily: 'serif',
      textAlign: 'center',
      ...pos,
    });
    return (
      <>
        {/* Outer thin frame (gold) */}
        <div
          style={{
            position: 'absolute',
            inset: 14,
            border: `1px solid ${accent}`,
            pointerEvents: 'none',
          }}
        />
        {/* Inner double rule (very tight) */}
        <div
          style={{
            position: 'absolute',
            inset: 17,
            border: `0.5px solid ${rule}`,
            pointerEvents: 'none',
          }}
        />
        {/* 8-point stars at each corner */}
        <div style={star({ top: 6, left: 6 })}>✦</div>
        <div style={star({ top: 6, right: 6 })}>✦</div>
        <div style={star({ bottom: 6, left: 6 })}>✦</div>
        <div style={star({ bottom: 6, right: 6 })}>✦</div>
      </>
    );
  }

  // ── Postal Junk Drawer: stamps + washi tape scraps + airmail stripes ──
  if (kind === 'postal-junk') {
    const stampW = Math.min(w, h) * 0.14;
    const stampH = stampW * 1.25;
    // The "perforated edge" comes from a dashed border with very short
    // dashes — close enough to read as a real stamp on screen.
    const stamp = (pos: React.CSSProperties, color: string): React.CSSProperties => ({
      position: 'absolute',
      width: stampW,
      height: stampH,
      border: `2px dashed ${color}`,
      background: 'rgba(255,255,255,0.5)',
      pointerEvents: 'none',
      transform: 'rotate(-4deg)',
      boxShadow: 'inset 0 0 0 2px #fff',
      ...pos,
    });
    return (
      <>
        {/* Top-left stamp */}
        <div style={stamp({ top: 10, left: 10 }, accent)}>
          <div
            style={{
              position: 'absolute',
              inset: 4,
              border: `1px solid ${accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'serif',
              fontSize: stampW * 0.18,
              color: accent,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            ◈
          </div>
        </div>
        {/* Bottom-right stamp, opposite color for variety */}
        <div style={{ ...stamp({ bottom: 10, right: 10 }, '#1a2d3a'), transform: 'rotate(3deg)' }}>
          <div
            style={{
              position: 'absolute',
              inset: 4,
              border: `1px solid #1a2d3a`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'serif',
              fontSize: stampW * 0.18,
              color: '#1a2d3a',
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            ✈
          </div>
        </div>
        {/* Airmail red/blue striped border along the top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundImage:
              `repeating-linear-gradient(135deg, ${accent} 0 8px, transparent 8px 14px, #1a2d3a 14px 22px, transparent 22px 28px)`,
            pointerEvents: 'none',
            opacity: 0.85,
          }}
        />
        {/* Same stripe along the bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundImage:
              `repeating-linear-gradient(135deg, ${accent} 0 8px, transparent 8px 14px, #1a2d3a 14px 22px, transparent 22px 28px)`,
            pointerEvents: 'none',
            opacity: 0.85,
          }}
        />
        {/* Washi tape scrap — top-right, mustard, slight rotation. The
            translucent fill lets the page show through, like real tape. */}
        <div
          style={{
            position: 'absolute',
            top: 22,
            right: -10,
            width: w * 0.22,
            height: 14,
            background:
              'linear-gradient(180deg, rgba(212,165,116,0.85) 0%, rgba(212,165,116,0.7) 100%)',
            transform: 'rotate(18deg)',
            pointerEvents: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        />
        {/* Second washi tape scrap — bottom-left, navy, opposite rotation. */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: -8,
            width: w * 0.18,
            height: 12,
            background:
              'linear-gradient(180deg, rgba(26,45,58,0.7) 0%, rgba(26,45,58,0.55) 100%)',
            transform: 'rotate(-12deg)',
            pointerEvents: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        />
      </>
    );
  }

  // ── Editorial Cinema: hairline frame + cherry corner notch + romanish folio
  //    The luxury-magazine read (Cereal / Kinfolk / Sight & Sound). All the
  //    work happens at the edges so the photos stay the main event. ──
  if (kind === 'editorial-cinema') {
    return (
      <>
        {/* Very thin rule frame in the soft accent tone. */}
        <div
          style={{
            position: 'absolute',
            inset: 14,
            border: `0.5px solid ${rule}`,
            pointerEvents: 'none',
          }}
        />
        {/* Cherry-red corner notch top-right — the only saturated mark on
            the page, like a Vogue cover-line dot. */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 10,
            height: 10,
            background: accent,
            pointerEvents: 'none',
          }}
        />
        {/* Greige hairline running horizontally across the bottom margin —
            evokes a foot-of-page rule from print magazines. */}
        <div
          style={{
            position: 'absolute',
            left: w * 0.08,
            right: w * 0.08,
            bottom: 22,
            height: 0.5,
            background: rule,
            pointerEvents: 'none',
          }}
        />
      </>
    );
  }

  // ── Japandi / Wabi-Sabi: one enso brush circle + a single vertical hairline
  //    Restraint is the decoration. Letting the page breathe IS the point. ──
  if (kind === 'enso-accent') {
    const ensoSize = Math.min(w, h) * 0.18;
    return (
      <>
        {/* Brushed enso circle in smokey jade — open ring, top-right. The
            mask-image trick draws a circle with a "gap" so it reads as a
            single brushstroke, not a closed ring. */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: ensoSize,
            height: ensoSize,
            borderRadius: '50%',
            border: `3px solid ${accent}`,
            // Soft offset so it looks brushed, not stamped.
            borderTopColor: 'transparent',
            transform: 'rotate(-35deg)',
            pointerEvents: 'none',
            opacity: 0.75,
          }}
        />
        {/* Single vertical hairline running 60% of the page height, left
            margin. Anchors the layout without enclosing it. */}
        <div
          style={{
            position: 'absolute',
            left: w * 0.08,
            top: h * 0.18,
            width: 0.5,
            height: h * 0.6,
            background: rule,
            pointerEvents: 'none',
          }}
        />
      </>
    );
  }

  // ── Neo-Minimal Earthy: 12-col linen grid + olive folio dot
  //    A whisper of structure. Reads as confident and quiet. ──
  if (kind === 'linen-grid') {
    return (
      <>
        {/* Linen-like noise overlay (radial spots, mixed via multiply). */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 14% 22%, rgba(0,0,0,0.04) 0%, transparent 50%),' +
              'radial-gradient(circle at 68% 78%, rgba(0,0,0,0.05) 0%, transparent 55%),' +
              'radial-gradient(circle at 88% 14%, rgba(0,0,0,0.03) 0%, transparent 40%)',
            mixBlendMode: 'multiply',
          }}
        />
        {/* 12-col gridlines — extremely subtle, only visible up close. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              `repeating-linear-gradient(90deg, transparent 0 ${w / 12 - 0.5}px, rgba(0,0,0,0.05) ${w / 12 - 0.5}px ${w / 12}px)`,
          }}
        />
        {/* Olive folio dot at the bottom-center — a wink at editorial
            page numbers without committing to actual numbers. */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            width: 4,
            height: 4,
            background: accent,
            borderRadius: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        />
      </>
    );
  }

  // ── Botanical Press: SVG leaf silhouettes + latin name band
  //    Herbarium-card vibe. The leaves anchor opposite corners. ──
  if (kind === 'herbarium-press') {
    const leafSize = Math.min(w, h) * 0.13;
    // Hand-drawn olive leaf path. Same shape, flipped for the opposite
    // corner — keeps the SVG asset count to one inline shape.
    const leafPath =
      'M50 5 Q70 25 65 50 Q60 75 50 90 Q40 75 35 50 Q30 25 50 5 Z M50 5 L50 90';
    return (
      <>
        {/* Top-left leaf, rotated naturally */}
        <svg
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: leafSize,
            height: leafSize,
            transform: 'rotate(-30deg)',
            pointerEvents: 'none',
            opacity: 0.55,
          }}
        >
          <path d={leafPath} fill={accent} stroke={accent} strokeWidth="1" />
        </svg>
        {/* Bottom-right leaf, mirrored */}
        <svg
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            width: leafSize,
            height: leafSize,
            transform: 'rotate(150deg) scaleX(-1)',
            pointerEvents: 'none',
            opacity: 0.55,
          }}
        >
          <path d={leafPath} fill={accent} stroke={accent} strokeWidth="1" />
        </svg>
        {/* Latin-style label band along the bottom edge — empty rule that
            sets up the herbarium card feel. */}
        <div
          style={{
            position: 'absolute',
            left: w * 0.18,
            right: w * 0.18,
            bottom: 16,
            height: 0.6,
            background: rule,
            pointerEvents: 'none',
          }}
        />
      </>
    );
  }

  // ── Naive Doodle / Notes App Chic: hand-drawn arrow + smiley sun + dots
  //    Intentionally wobbly. The off-center placement IS the aesthetic. ──
  if (kind === 'doodle-marks') {
    return (
      <>
        {/* Smiley sun, top-right. Yellow with hand-drawn rays. */}
        <svg
          viewBox="0 0 60 60"
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            width: 42,
            height: 42,
            pointerEvents: 'none',
          }}
        >
          {/* Rays */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i * 45 * Math.PI) / 180;
            const r1 = 18;
            const r2 = 26;
            const cx = 30;
            const cy = 30;
            return (
              <line
                key={i}
                x1={cx + Math.cos(angle) * r1}
                y1={cy + Math.sin(angle) * r1}
                x2={cx + Math.cos(angle) * r2}
                y2={cy + Math.sin(angle) * r2}
                stroke={rule}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
          {/* Face circle */}
          <circle cx="30" cy="30" r="15" fill={rule} stroke="#1d1d1d" strokeWidth="1.5" />
          {/* Eyes */}
          <circle cx="25" cy="28" r="1.5" fill="#1d1d1d" />
          <circle cx="35" cy="28" r="1.5" fill="#1d1d1d" />
          {/* Smile */}
          <path d="M24 34 Q30 39 36 34" stroke="#1d1d1d" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        {/* Squiggly arrow, bottom-left, pointing diagonally up-right. */}
        <svg
          viewBox="0 0 100 60"
          style={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            width: 60,
            height: 36,
            pointerEvents: 'none',
          }}
        >
          <path
            d="M5 50 Q20 38 30 42 Q42 47 50 32 Q58 18 78 18"
            stroke={accent}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Arrowhead */}
          <polyline
            points="72,12 80,18 73,25"
            stroke={accent}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Scattered chunky dots in the palette — like crayon marks. */}
        <div
          style={{
            position: 'absolute',
            top: h * 0.55,
            right: w * 0.15,
            width: 8,
            height: 8,
            background: '#4d96ff',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: h * 0.7,
            left: w * 0.4,
            width: 6,
            height: 6,
            background: '#6bcb77',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      </>
    );
  }

  // ── Risograph: halftone dot pattern + offset double frame ──
  if (kind === 'riso-halftone') {
    return (
      <>
        {/* Halftone dots filling the page very lightly */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              `radial-gradient(circle, ${accent} 1px, transparent 1.6px)`,
            backgroundSize: '14px 14px',
            opacity: 0.18,
            mixBlendMode: 'multiply',
          }}
        />
        {/* "Pink" border, offset down-right */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 8,
            bottom: 8,
            border: `2px solid ${accent}`,
            pointerEvents: 'none',
            opacity: 0.85,
          }}
        />
        {/* "Blue" border, offset up-left — the misregistration */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 12,
            bottom: 12,
            border: `2px solid ${rule}`,
            pointerEvents: 'none',
            opacity: 0.85,
            mixBlendMode: 'multiply',
          }}
        />
      </>
    );
  }

  return null;
}

export const PagePreview = memo(PagePreviewImpl);
export default PagePreview;
