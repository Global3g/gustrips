'use client';

import { useEffect, useRef } from 'react';

interface ParticlesProps {
  count?: number;
  className?: string;
}

export default function Particles({ count = 40, className = '' }: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect users who asked for reduced motion — skip the animation
    // entirely and don't burn CPU/GPU on decoration.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Cap the effective count. With the photos page calling count=32 the
    // O(N²) connection pass did ~500 distance checks per frame on every
    // device. Decoration shouldn't fight the photo decode/paint budget.
    const effectiveCount = Math.min(count, 16);

    let animId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    interface Dot {
      x: number; y: number; vx: number; vy: number; r: number; opacity: number;
    }

    const dots: Dot[] = [];

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      width = rect.width;
      height = rect.height;
      // Cap DPR at 1.5 so a 3x retina screen doesn't pay 9x the fill cost
      // for a barely-visible decoration layer.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      resize();
      dots.length = 0;
      for (let i = 0; i < effectiveCount; i++) {
        dots.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.3 + 0.1,
        });
      }
    };

    // Throttle to ~30fps. The visual delta from 60fps for slow-drifting
    // dots is imperceptible and the saved frame budget is real.
    const FRAME_MS = 33;
    let lastFrame = 0;

    // Pause when the page is hidden or when our container scrolls out of
    // view. requestAnimationFrame already pauses on hidden tabs, but the
    // IntersectionObserver path also catches "scrolled past the header
    // while still on the photos page" — which is most of the time.
    let isVisible = true;

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      if (!isVisible) return;
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;

      ctx.clearRect(0, 0, width, height);

      // Draw connections — O(N²) but with effectiveCount<=16 that's <=120
      // pair checks. Cheap.
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 10000) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / 100) * 0.08;
            ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (const dot of dots) {
        dot.x += dot.vx;
        dot.y += dot.vy;

        if (dot.x < 0 || dot.x > width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > height) dot.vy *= -1;

        ctx.fillStyle = `rgba(255,255,255,${dot.opacity})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    init();
    animId = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    // Pause/resume based on visibility of the canvas container.
    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && canvas.parentElement) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) isVisible = e.isIntersecting;
        },
        { threshold: 0 },
      );
      intersectionObserver.observe(canvas.parentElement);
    }

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ zIndex: 1 }}
    />
  );
}
