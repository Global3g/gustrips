'use client';

import { useRef, useState, useCallback, type ReactNode, type MouseEvent, type TouchEvent } from 'react';

interface RippleData {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  tilt?: boolean;
}

export default function SpotlightCard({ children, className = '', glowColor = 'rgba(59,130,246,0.15)', tilt = true }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const [ripples, setRipples] = useState<RippleData[]>([]);

  const update = useCallback((clientX: number, clientY: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Spotlight
    setSpotlightStyle({
      opacity: 1,
      background: `radial-gradient(350px circle at ${x}px ${y}px, ${glowColor}, transparent 70%)`,
    });

    // 3D Tilt
    if (tilt) {
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;
      setTiltStyle({
        transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
        transition: 'transform 0.1s ease-out',
      });
    }
  }, [glowColor, tilt]);

  const addRipple = useCallback((clientX: number, clientY: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const ripple: RippleData = {
      id: Date.now(),
      x: clientX - rect.left,
      y: clientY - rect.top,
      color: glowColor.replace(/[\d.]+\)$/, '0.5)'),
    };
    setRipples((prev) => [...prev, ripple]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== ripple.id)), 800);
  }, [glowColor]);

  const handleMouseMove = (e: MouseEvent) => update(e.clientX, e.clientY);
  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (touch) update(touch.clientX, touch.clientY);
  };

  const handleLeave = () => {
    setSpotlightStyle({ opacity: 0 });
    setTiltStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.4s ease-out',
    });
  };

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ ...tiltStyle, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={handleLeave}
      onTouchEnd={handleLeave}
      onClick={(e) => addRipple(e.clientX, e.clientY)}
      onTouchStart={(e) => { const t = e.touches[0]; if (t) addRipple(t.clientX, t.clientY); }}
    >
      {/* Spotlight overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 rounded-[inherit]"
        style={spotlightStyle}
      />
      {/* Glare — light streak that follows cursor */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          ...spotlightStyle,
          background: spotlightStyle.opacity
            ? `radial-gradient(200px circle at ${spotlightStyle.background?.toString().match(/at (.+?),/)?.[1] || '50% 50%'}, rgba(255,255,255,0.06), transparent 70%)`
            : undefined,
        }}
      />
      {/* Ripples */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="ripple-wave z-10"
          style={{
            left: r.x - 40,
            top: r.y - 40,
            width: 80,
            height: 80,
            background: r.color,
          }}
        />
      ))}
      {/* Content — elevated on Z axis for parallax depth */}
      <div className="relative z-20" style={{ transform: tilt ? 'translateZ(30px)' : undefined }}>
        {children}
      </div>
    </div>
  );
}
