'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  /** Pull distance (px) needed to trigger refresh. Default 90. */
  threshold?: number;
  /**
   * Optional CSS selector for the scrollable container.
   * If omitted, the hook listens on the window/document and only
   * triggers when `window.scrollY === 0`.
   */
  containerSelector?: string;
}

interface UsePullToRefreshReturn {
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Mobile pull-to-refresh primitive.
 *
 * Listens to touch events while the page (or chosen container) is at the top.
 * When the user drags down past the threshold and releases, the supplied
 * `onRefresh` callback is invoked. The hook then keeps `isRefreshing` true
 * until the returned promise (if any) resolves, then resets smoothly.
 *
 * Disabled on desktop — the listeners are only attached when
 * `'ontouchstart' in window` is true.
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options: UsePullToRefreshOptions = {},
): UsePullToRefreshReturn {
  const { threshold = 90, containerSelector } = options;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs avoid re-attaching listeners on every render.
  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Keep ref in sync so the touch handlers (which close over a stable
  // function) can early-out while a refresh is in flight.
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const isAtTop = useCallback((): boolean => {
    if (containerSelector) {
      const el = document.querySelector(containerSelector) as HTMLElement | null;
      if (!el) return false;
      return el.scrollTop <= 0;
    }
    return window.scrollY <= 0;
  }, [containerSelector]);

  useEffect(() => {
    // Bail out on desktop / non-touch environments.
    if (typeof window === 'undefined') return;
    if (!('ontouchstart' in window)) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (!isAtTop()) {
        startYRef.current = null;
        trackingRef.current = false;
        return;
      }
      startYRef.current = e.touches[0]?.clientY ?? null;
      trackingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || isRefreshingRef.current) return;
      if (startYRef.current === null) return;

      const currentY = e.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;

      if (delta <= 0) {
        // Pulling up — reset and stop tracking until next touchstart.
        if (pullDistance !== 0) setPullDistance(0);
        trackingRef.current = false;
        return;
      }

      // Apply a soft rubber-band so distance grows sublinearly.
      const damped = Math.min(delta * 0.5, threshold * 1.6);
      setPullDistance(damped);
    };

    const handleTouchEnd = async () => {
      if (!trackingRef.current) {
        return;
      }
      trackingRef.current = false;
      const distance = pullDistance;
      startYRef.current = null;

      if (distance >= threshold && !isRefreshingRef.current) {
        setIsRefreshing(true);
        // Snap the indicator down to threshold while the work runs.
        setPullDistance(threshold);
        try {
          await onRefreshRef.current();
        } catch (err) {
          // Surface but don't block — pull-to-refresh should never throw.
          console.error('[usePullToRefresh] onRefresh threw:', err);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [threshold, isAtTop, pullDistance]);

  return { pullDistance, isRefreshing };
}
