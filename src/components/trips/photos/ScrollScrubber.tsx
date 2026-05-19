'use client';

/**
 * Apple-style scroll scrubber — a thin vertical bar fixed to the right
 * edge of the viewport with a draggable thumb. Drag the thumb to scrub
 * through the page; the bar position mirrors the scroll position when
 * the user scrolls normally.
 *
 * Implementation notes:
 *  - Finds the nearest `overflow-y-auto` ancestor (provided by the trip
 *    layout) and listens to its `scroll` event. Falls back to the
 *    window if no such container is found.
 *  - Drag uses pointer events with document-level listeners so events
 *    keep firing when the cursor leaves the thumb. setPointerCapture
 *    can fail when the host element is inside CSS transforms, so we
 *    avoid it.
 *  - The track is full-height of the viewport (minus small inset);
 *    the thumb scales to ~12-25% of the track depending on content
 *    length. Dragging the thumb scrolls proportionally.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

function findScrollContainer(): HTMLElement | Window {
  // The trip layout wraps page content in `<div className="flex-1
  // overflow-y-auto relative">`. Find it by walking the DOM.
  const candidates = document.querySelectorAll<HTMLElement>('div');
  for (const el of candidates) {
    const className = el.className;
    if (typeof className !== 'string') continue;
    if (
      className.includes('overflow-y-auto') &&
      el.parentElement &&
      typeof el.parentElement.className === 'string' &&
      el.parentElement.className.includes('flex')
    ) {
      // Confirm it's actually scrollable
      if (el.scrollHeight > el.clientHeight) return el;
    }
  }
  return window;
}

function getScrollMetrics(node: HTMLElement | Window): {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
} {
  if (node === window) {
    return {
      scrollTop: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: window.innerHeight,
    };
  }
  const el = node as HTMLElement;
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  };
}

function scrollTo(node: HTMLElement | Window, top: number): void {
  if (node === window) {
    window.scrollTo({ top, behavior: 'auto' });
  } else {
    (node as HTMLElement).scrollTop = top;
  }
}

export default function ScrollScrubber() {
  /** Vertical position of the thumb inside the track, 0-1. */
  const [thumbPct, setThumbPct] = useState(0);
  /** How tall the thumb is, relative to the track (0-1). Bigger thumb
   *  = less content to scroll. Floor + ceil so it never disappears or
   *  fills the whole track. */
  const [thumbSize, setThumbSize] = useState(0.18);
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLElement | Window | null>(null);
  const draggingRef = useRef(false);

  /* Locate the scroll container and wire up the scroll listener. */
  useLayoutEffect(() => {
    const c = findScrollContainer();
    containerRef.current = c;

    const sync = () => {
      const m = getScrollMetrics(c);
      const scrollable = m.scrollHeight - m.clientHeight;
      if (scrollable <= 4) {
        setVisible(false);
        return;
      }
      setVisible(true);
      setThumbPct(scrollable > 0 ? m.scrollTop / scrollable : 0);
      setThumbSize(
        Math.max(0.08, Math.min(0.5, m.clientHeight / m.scrollHeight)),
      );
    };

    sync();
    const target: EventTarget = c === window ? window : (c as HTMLElement);
    target.addEventListener('scroll', sync, { passive: true });
    // ResizeObserver: re-sync when the scrollable height changes (photos
    // loading in / template switching).
    let ro: ResizeObserver | null = null;
    if (c !== window) {
      ro = new ResizeObserver(sync);
      ro.observe(c as HTMLElement);
    }
    return () => {
      target.removeEventListener('scroll', sync);
      ro?.disconnect();
    };
  }, []);

  /* Auto-hide after a moment of inactivity to keep the chrome clean. */
  useEffect(() => {
    if (!visible) return;
    if (active) return;
    const handle = window.setTimeout(() => {
      if (!draggingRef.current) setActive(false);
    }, 1500);
    return () => window.clearTimeout(handle);
  }, [thumbPct, visible, active]);

  /* Pointer drag — convert vertical movement on the track into a new
   *  scroll offset. Document-level listeners so the user can drag past
   *  the track edges without losing the grip. */
  const startDrag = (clientY: number) => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    draggingRef.current = true;
    setActive(true);
    const rect = track.getBoundingClientRect();
    const m = getScrollMetrics(container);
    const scrollable = m.scrollHeight - m.clientHeight;
    const thumbPx = rect.height * thumbSize;
    // Start from the current thumb top; drag offsets relative to where
    // the pointer landed inside the thumb so the thumb doesn't jump.
    const thumbTopAtStart = rect.top + (rect.height - thumbPx) * thumbPct;
    const offsetInThumb = clientY - thumbTopAtStart;

    const onMove = (e: PointerEvent) => {
      const trackTop = rect.top;
      const availTrack = rect.height - thumbPx;
      const newThumbTop = Math.max(
        0,
        Math.min(availTrack, e.clientY - offsetInThumb - trackTop),
      );
      const pct = availTrack > 0 ? newThumbTop / availTrack : 0;
      setThumbPct(pct);
      scrollTo(container, pct * scrollable);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      // Linger active for a beat so the auto-hide doesn't snap it away.
      window.setTimeout(() => setActive(false), 600);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  /* Click on the bare track (not the thumb) jumps the thumb to that
   *  spot. Quality-of-life shortcut. */
  const onTrackPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    const rect = track.getBoundingClientRect();
    const thumbPx = rect.height * thumbSize;
    const m = getScrollMetrics(container);
    const scrollable = m.scrollHeight - m.clientHeight;
    // Center the thumb on the click position.
    const targetThumbTop = Math.max(
      0,
      Math.min(rect.height - thumbPx, e.clientY - rect.top - thumbPx / 2),
    );
    const pct = (rect.height - thumbPx) > 0 ? targetThumbTop / (rect.height - thumbPx) : 0;
    setThumbPct(pct);
    scrollTo(container, pct * scrollable);
    // Immediately enter drag mode so the user can keep scrubbing.
    startDrag(e.clientY);
  };

  const onThumbPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientY);
  };

  if (!visible) return null;

  return (
    <div
      // Right edge, full-ish height. Bypasses the chatbot FAB which
      // sits at right-6/right-8 — we hug the edge at right-2.
      className="fixed top-24 bottom-24 lg:top-16 lg:bottom-16 right-2 z-40 flex items-stretch select-none"
      style={{ width: 14 }}
      onMouseEnter={() => setActive(true)}
    >
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        className={`relative w-full rounded-full transition-all duration-200 ${
          active ? 'bg-white/20' : 'bg-white/10'
        }`}
        style={{ touchAction: 'none' }}
        aria-hidden
      >
        <div
          onPointerDown={onThumbPointerDown}
          className={`absolute left-0 right-0 rounded-full transition-colors duration-150 cursor-grab active:cursor-grabbing ${
            active ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]' : 'bg-white/70'
          }`}
          style={{
            top: `${thumbPct * (1 - thumbSize) * 100}%`,
            height: `${thumbSize * 100}%`,
            minHeight: 36,
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}
