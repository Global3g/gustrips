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

    let animId: number;
    let width = 0;
    let height = 0;

    interface Dot {
      x: number; y: number; vx: number; vy: number; r: number; opacity: number;
    }

    const dots: Dot[] = [];

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      width = rect.width;
      height = rect.height;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const init = () => {
      resize();
      dots.length = 0;
      for (let i = 0; i < count; i++) {
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

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connections
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
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

      animId = requestAnimationFrame(draw);
    };

    init();
    draw();

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
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
