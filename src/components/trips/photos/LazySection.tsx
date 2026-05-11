'use client';

import { useEffect, useRef, useState } from 'react';

interface LazySectionProps {
  /** Approximate height (in px) to reserve while off-screen.
   *  Should be a reasonable estimate so the scroll position doesn't jump
   *  as sections mount/unmount. */
  placeholderHeight: number;
  /** Root margin for the IntersectionObserver. Wider = mount sooner.
   *  Default: 800px above/below viewport for smooth scroll-into-view. */
  rootMargin?: string;
  /** When true, render children immediately (e.g. the first section). */
  forceRender?: boolean;
  children: React.ReactNode;
}

/** Section-level virtualization.
 *
 *  Renders a fixed-height placeholder while off-screen, swapping in the
 *  real content once the section enters the viewport (with a buffer so
 *  the swap happens before the user can see it).
 *
 *  Once revealed, the section stays mounted — un-mounting mid-scroll would
 *  destroy in-flight drag operations and re-trigger image decoding when
 *  the user scrolls back up. The DOM-cost win comes from sections far
 *  below the fold never having to mount in the first place.
 *
 *  Falls back to immediate render when IntersectionObserver is unavailable
 *  (very old browsers, SSR). */
export default function LazySection({
  placeholderHeight,
  rootMargin = '800px 0px',
  forceRender = false,
  children,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(forceRender);

  useEffect(() => {
    if (visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Older browsers: render eagerly rather than show a permanent placeholder.
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight: placeholderHeight }}>
      {visible ? children : null}
    </div>
  );
}
