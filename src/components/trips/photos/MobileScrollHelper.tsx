'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsDown, ChevronsUp } from 'lucide-react';

/**
 * Floating side button on /trips/[id]/photos that lets the user jump to
 * the bottom of a long gallery (or back to the top once they've scrolled
 * past it). Shows on both mobile and desktop.
 *
 * Detects the right scroll container automatically: on mobile the window
 * scrolls, but inside the trip layout on desktop a dedicated <div> with
 * `overflow-y-auto` does, so we walk up from our mount point looking for
 * the first element whose computed overflow-y is auto/scroll/overlay.
 */
export default function MobileScrollHelper() {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<'down' | 'up'>('down');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Find the closest scrollable ancestor. Falls back to window/document
    // when nothing custom scrolls (mobile single-column case).
    const findScrollContainer = (): HTMLElement | null => {
      let el: HTMLElement | null = anchorRef.current?.parentElement ?? null;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          // Only count it if there's actually something to scroll.
          if (el.scrollHeight > el.clientHeight + 1) return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const scrollEl = findScrollContainer();
    // null means "use window/document" (mobile / non-trip-layout pages).
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const readScroll = () => {
      if (scrollEl) {
        return {
          y: scrollEl.scrollTop,
          scrollable: scrollEl.scrollHeight - scrollEl.clientHeight,
        };
      }
      const y = window.scrollY;
      const docH = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      const winH = window.innerHeight;
      return { y, scrollable: docH - winH };
    };

    const update = (): void => {
      const { y, scrollable } = readScroll();

      if (scrollable < 400) {
        // Page barely scrolls — no point in showing the helper.
        setVisible(false);
        return;
      }

      if (y > 200) {
        setVisible(true);
        setDirection(y > scrollable * 0.5 ? 'up' : 'down');
      } else {
        setVisible(false);
      }

      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 1800);
    };

    update();
    const target: EventTarget = scrollEl ?? window;
    target.addEventListener('scroll', update, { passive: true } as AddEventListenerOptions);
    window.addEventListener('resize', update);
    return () => {
      target.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  const jump = (): void => {
    // Re-resolve at click time so we always target the current container
    // even if the layout shifted (e.g. user collapsed something).
    let el: HTMLElement | null = anchorRef.current?.parentElement ?? null;
    let scrollEl: HTMLElement | null = null;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        if (el.scrollHeight > el.clientHeight + 1) {
          scrollEl = el;
          break;
        }
      }
      el = el.parentElement;
    }

    if (scrollEl) {
      const target =
        direction === 'down' ? scrollEl.scrollHeight : 0;
      scrollEl.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      const target =
        direction === 'down'
          ? Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight,
            )
          : 0;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  };

  return (
    // The anchor is a zero-size sentinel — we just need a DOM node from
    // which to walk up looking for the scroll container.
    <>
      <div ref={anchorRef} className="hidden" aria-hidden />
      <AnimatePresence>
        {visible && (
          <motion.button
            type="button"
            onClick={jump}
            aria-label={direction === 'down' ? 'Saltar al final' : 'Volver al inicio'}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            // Bottom offset clears the mobile bottom nav on phones; on
            // desktop the trip layout has no bottom nav and the button
            // floats over the gallery.
            className="fixed right-3 bottom-24 lg:right-6 lg:bottom-8 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-xl shadow-black/40 backdrop-blur-sm active:scale-95 hover:scale-105 transition-transform"
          >
            {direction === 'down' ? (
              <ChevronsDown className="w-6 h-6" />
            ) : (
              <ChevronsUp className="w-6 h-6" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
