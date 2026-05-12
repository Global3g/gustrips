'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Persistent vertical scroll rail on /trips/[id]/photos, Apple-style.
 *
 * Always visible on the right edge while there's enough content to scroll.
 * Shows current position as a thumb, tap top/bottom to jump to top/bottom,
 * drag the thumb to scrub directly. Works in mobile + desktop because it
 * resolves the closest scrollable ancestor at mount (the trip layout's
 * inner overflow-y-auto on desktop, the window on mobile).
 *
 * z-index 50 + bottom offset that clears both the mobile bottom nav and
 * the floating Chatbot button.
 */
export default function MobileScrollHelper() {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);

  const [pct, setPct] = useState(0); // 0..1
  const [enabled, setEnabled] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Resolve scroll container once on mount. Walks up from a sentinel <div>
  // until we find an ancestor whose computed overflow-y actually scrolls.
  // Falls back to document.scrollingElement when nothing custom scrolls.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const findContainer = (): HTMLElement | null => {
      let el: HTMLElement | null = anchorRef.current?.parentElement ?? null;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          if (el.scrollHeight > el.clientHeight + 1) return el;
        }
        el = el.parentElement;
      }
      return null;
    };
    scrollElRef.current = findContainer();

    const read = (): { y: number; scrollable: number } => {
      const el = scrollElRef.current;
      if (el) return { y: el.scrollTop, scrollable: el.scrollHeight - el.clientHeight };
      const y = window.scrollY;
      const docH = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      return { y, scrollable: docH - window.innerHeight };
    };

    const update = (): void => {
      const { y, scrollable } = read();
      if (scrollable < 400) {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      setPct(Math.max(0, Math.min(1, y / scrollable)));
    };

    update();
    const target: EventTarget = scrollElRef.current ?? window;
    target.addEventListener('scroll', update, { passive: true } as AddEventListenerOptions);
    window.addEventListener('resize', update);
    // Re-resolve container on layout changes (sections collapsing/expanding)
    const ro = new ResizeObserver(update);
    if (scrollElRef.current) ro.observe(scrollElRef.current);
    ro.observe(document.body);

    return () => {
      target.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, []);

  const scrollTo = (target: number, behavior: ScrollBehavior = 'smooth'): void => {
    const el = scrollElRef.current;
    if (el) {
      el.scrollTo({ top: target, behavior });
    } else {
      window.scrollTo({ top: target, behavior });
    }
  };

  const getScrollable = (): number => {
    const el = scrollElRef.current;
    if (el) return el.scrollHeight - el.clientHeight;
    const docH = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    return docH - window.innerHeight;
  };

  // Map a pointer Y inside the rail to a scroll target.
  const pointerToScroll = (clientY: number): number => {
    const rail = railRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return ratio * getScrollable();
  };

  const onRailPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    scrollTo(pointerToScroll(e.clientY), 'auto');
  };
  const onRailPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    scrollTo(pointerToScroll(e.clientY), 'auto');
  };
  const onRailPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    setDragging(false);
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const jumpTop = (): void => scrollTo(0);
  const jumpBottom = (): void => scrollTo(getScrollable());

  if (!enabled) {
    // Still render the sentinel so we can resolve the scroll container later
    // (e.g. once images load and the page actually becomes scrollable).
    return <div ref={anchorRef} className="hidden" aria-hidden />;
  }

  return (
    <>
      <div ref={anchorRef} className="hidden" aria-hidden />

      {/* Rail wrapper: fixed to the right side, vertically centered.
          Bottom offset (5rem mobile / 1.5rem desktop) clears both the mobile
          bottom nav and the floating Chatbot launcher. z-50 sits above the
          chatbot's z-40. */}
      <div
        className="fixed right-1.5 top-1/2 -translate-y-1/2 z-50 select-none flex flex-col items-center gap-1.5 pointer-events-auto"
        style={{ height: 'min(60vh, 360px)' }}
      >
        {/* Jump-to-top */}
        <button
          type="button"
          onClick={jumpTop}
          aria-label="Ir al inicio"
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/55 backdrop-blur-md text-white/90 hover:bg-black/75 active:scale-95 transition"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Rail track */}
        <div
          ref={railRef}
          onPointerDown={onRailPointerDown}
          onPointerMove={onRailPointerMove}
          onPointerUp={onRailPointerUp}
          onPointerCancel={onRailPointerUp}
          className="relative flex-1 w-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors cursor-pointer"
          role="slider"
          aria-label="Posición de scroll"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
        >
          {/* Thumb */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-8 rounded-full bg-gradient-to-b from-amber-300 to-rose-400 shadow-lg shadow-amber-500/40 transition-[width,height] duration-150"
            style={{
              top: `calc(${pct * 100}% - 1rem)`,
              transform: `translate(-50%, 0)${dragging ? ' scale(1.15)' : ''}`,
            }}
          />
        </div>

        {/* Jump-to-bottom */}
        <button
          type="button"
          onClick={jumpBottom}
          aria-label="Ir al final"
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/55 backdrop-blur-md text-white/90 hover:bg-black/75 active:scale-95 transition"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
