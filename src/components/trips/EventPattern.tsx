'use client';

import type { EventType } from '@/types';

interface EventPatternProps {
  type: EventType;
  color: string;
  className?: string;
  /** Optional event for time-aware pattern variations */
  event?: { startTime?: string; title?: string };
}

type TimeOfDay = 'morning' | 'noon' | 'evening' | 'night' | 'unknown';

function getTimeOfDay(startTime?: string): TimeOfDay {
  if (!startTime || !/^\d{2}:\d{2}/.test(startTime)) return 'unknown';
  const [hStr] = startTime.split(':');
  const h = Number(hStr);
  if (Number.isNaN(h)) return 'unknown';
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'noon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/**
 * Decorative SVG pattern unique to each event type.
 * Sits behind card content, very subtle (~10% opacity).
 */
export default function EventPattern({ type, color, className, event }: EventPatternProps) {
  const baseClass = 'absolute inset-0 w-full h-full pointer-events-none ' + (className ?? '');

  switch (type) {
    case 'flight':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          <path d="M -10 95 Q 100 5, 210 60" stroke={color} strokeWidth="1.2" fill="none" opacity="0.55" />
          <path d="M -10 115 Q 100 25, 210 80" stroke={color} strokeWidth="0.6" strokeDasharray="3 5" fill="none" opacity="0.4" />
          <g transform="translate(155, 32) rotate(-18)" opacity="0.6">
            <path d="M 0 4 L 14 0 L 16 -4 L 20 -4 L 18 4 L 22 8 L 26 6 L 26 10 L 18 12 L 14 8 L 0 12 Z" fill={color} />
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-50 18" begin="0s" dur="14s" repeatCount="indefinite" additive="sum" />
            <animate attributeName="opacity" values="0.6;0.4;0.6" dur="14s" repeatCount="indefinite" />
          </g>
        </svg>
      );

    case 'hotel':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="xMaxYMin slice" className={baseClass} aria-hidden>
          <g opacity="0.55">
            {[0, 1, 2, 3].map((row) =>
              [0, 1, 2, 3].map((col) => (
                <g key={`${row}-${col}`}>
                  <rect
                    x={138 + col * 14}
                    y={8 + row * 14}
                    width="9"
                    height="9"
                    rx="1"
                    fill="none"
                    stroke={color}
                    strokeWidth="0.7"
                  />
                  {(row + col) % 3 === 0 && (
                    <rect
                      x={138 + col * 14}
                      y={8 + row * 14}
                      width="9"
                      height="9"
                      rx="1"
                      fill={color}
                      opacity="0.35"
                    />
                  )}
                </g>
              ))
            )}
          </g>
        </svg>
      );

    case 'car_rental':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          <line x1="-20" y1="105" x2="220" y2="-5" stroke={color} strokeWidth="1.6" strokeDasharray="8 10" opacity="0.45" strokeLinecap="round" />
          <line x1="-20" y1="125" x2="220" y2="15" stroke={color} strokeWidth="0.8" strokeDasharray="4 7" opacity="0.3" strokeLinecap="round" />
          <line x1="-20" y1="145" x2="220" y2="35" stroke={color} strokeWidth="0.5" strokeDasharray="2 5" opacity="0.25" strokeLinecap="round" />
        </svg>
      );

    case 'activity': {
      const tod = getTimeOfDay(event?.startTime);

      // Shared mountain landscape (used by all variants)
      const mountains = (
        <>
          <path d="M 0 100 L 25 65 L 50 85 L 78 45 L 105 75 L 135 55 L 165 80 L 200 60 L 200 100 Z" fill={color} opacity="0.18" />
          <path d="M 0 100 L 25 65 L 50 85 L 78 45 L 105 75 L 135 55 L 165 80 L 200 60" stroke={color} strokeWidth="0.8" fill="none" opacity="0.55" strokeLinejoin="round" />
        </>
      );

      // Sun group (rotating); position chosen by caller
      const sun = (tx: number, ty: number, opacity = 0.5) => (
        <g transform={`translate(${tx}, ${ty})`} opacity={opacity}>
          <circle cx="0" cy="0" r="5" fill="none" stroke={color} strokeWidth="0.7" />
          {[0, 45, 90, 135].map((angle) => (
            <line
              key={angle}
              x1={Math.cos((angle * Math.PI) / 180) * 8}
              y1={Math.sin((angle * Math.PI) / 180) * 8}
              x2={Math.cos((angle * Math.PI) / 180) * 11}
              y2={Math.sin((angle * Math.PI) / 180) * 11}
              stroke={color}
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          ))}
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="30s" repeatCount="indefinite" additive="sum" />
        </g>
      );

      if (tod === 'night') {
        // Stars + crescent moon
        const stars: Array<[number, number, number]> = [
          [150, 18, 1.2],
          [170, 28, 1.0],
          [180, 14, 0.9],
          [130, 22, 1.1],
          [165, 12, 0.8],
        ];
        return (
          <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
            {mountains}
            {/* Crescent moon, top center */}
            <g opacity="0.55">
              <defs>
                <mask id="crescent-mask">
                  <rect x="0" y="0" width="200" height="100" fill="black" />
                  <circle cx="100" cy="20" r="6" fill="white" />
                  <circle cx="103" cy="18" r="5" fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="200" height="100" fill={color} mask="url(#crescent-mask)" />
            </g>
            {/* Stars */}
            <g opacity="0.7">
              {stars.map(([x, y, r], i) => (
                <circle key={i} cx={x} cy={y} r={r} fill={color}>
                  <animate
                    attributeName="opacity"
                    values="0.3;0.8;0.3"
                    dur="3s"
                    begin={`${i * 0.6}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </g>
          </svg>
        );
      }

      if (tod === 'morning') {
        // Sun in upper LEFT + warm color accent
        return (
          <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
            {mountains}
            {/* Warm glow accent (soft halo behind sun) */}
            <circle cx="35" cy="22" r="18" fill={color} opacity="0.12" />
            {sun(35, 22, 0.55)}
          </svg>
        );
      }

      if (tod === 'evening') {
        // Sun lower (translate(165, 50)) plus partial moon shape
        return (
          <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
            {mountains}
            {sun(165, 50, 0.5)}
            {/* Partial moon shape (top-left accent) */}
            <g opacity="0.45">
              <defs>
                <mask id="evening-moon-mask">
                  <rect x="0" y="0" width="200" height="100" fill="black" />
                  <circle cx="35" cy="22" r="5.5" fill="white" />
                  <circle cx="38" cy="20" r="4.5" fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="200" height="100" fill={color} mask="url(#evening-moon-mask)" />
            </g>
          </svg>
        );
      }

      // Default (noon / unknown): sun in upper right (existing)
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          {mountains}
          {sun(165, 22, 0.5)}
        </svg>
      );
    }

    case 'restaurant': {
      const tod = getTimeOfDay(event?.startTime);

      // Shared plate + utensils
      const plate = (
        <>
          <circle cx="170" cy="38" r="22" stroke={color} strokeWidth="0.6" fill="none">
            <animate attributeName="opacity" values="0.45;0.7;0.45" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle cx="170" cy="38" r="14" stroke={color} strokeWidth="0.4" fill="none">
            <animate attributeName="opacity" values="0.3;0.55;0.3" dur="5s" begin="-2.5s" repeatCount="indefinite" />
          </circle>
          {/* Fork */}
          <g transform="translate(150, 24) rotate(-30)">
            <line x1="0" y1="0" x2="0" y2="22" stroke={color} strokeWidth="1" strokeLinecap="round" />
            <line x1="-3" y1="0" x2="-3" y2="6" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
            <line x1="3" y1="0" x2="3" y2="6" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
          </g>
          {/* Knife */}
          <g transform="translate(190, 24) rotate(30)">
            <line x1="0" y1="0" x2="0" y2="22" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
          </g>
        </>
      );

      // Steam wisps for morning
      const steam = (
        <g opacity="0.55">
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <path
                d={`M ${162 + i * 8} 16 q 3 -4 0 -8 q -3 -4 0 -8`}
                stroke={color}
                strokeWidth="0.7"
                fill="none"
                strokeLinecap="round"
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from="0 0"
                  to="0 -10"
                  dur="3s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.7;0"
                  dur="3s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ))}
        </g>
      );

      // Glass / cup outline accent for evening / night
      const glass = (
        <g transform="translate(140, 16)" opacity="0.5">
          {/* Cylindrical cup: rounded-top rect */}
          <path
            d="M 0 4 Q 0 0, 4 0 L 10 0 Q 14 0, 14 4 L 13 16 Q 13 18, 11 18 L 3 18 Q 1 18, 1 16 Z"
            stroke={color}
            strokeWidth="0.7"
            fill="none"
            strokeLinejoin="round"
          />
          {/* Liquid line */}
          <line x1="2" y1="6" x2="12" y2="6" stroke={color} strokeWidth="0.5" opacity="0.7" />
        </g>
      );

      if (tod === 'morning') {
        return (
          <svg viewBox="0 0 200 100" preserveAspectRatio="xMaxYMin slice" className={baseClass} aria-hidden>
            <g opacity="0.5">{plate}</g>
            {steam}
          </svg>
        );
      }

      if (tod === 'evening') {
        return (
          <svg viewBox="0 0 200 100" preserveAspectRatio="xMaxYMin slice" className={baseClass} aria-hidden>
            <g opacity="0.5">{plate}</g>
            {glass}
          </svg>
        );
      }

      if (tod === 'night') {
        // Same as evening but slightly darker / static (no breathing on plate)
        return (
          <svg viewBox="0 0 200 100" preserveAspectRatio="xMaxYMin slice" className={baseClass} aria-hidden>
            <g opacity="0.4">
              {/* Static plate (no animate breathing) */}
              <circle cx="170" cy="38" r="22" stroke={color} strokeWidth="0.6" fill="none" />
              <circle cx="170" cy="38" r="14" stroke={color} strokeWidth="0.4" fill="none" />
              {/* Fork */}
              <g transform="translate(150, 24) rotate(-30)">
                <line x1="0" y1="0" x2="0" y2="22" stroke={color} strokeWidth="1" strokeLinecap="round" />
                <line x1="-3" y1="0" x2="-3" y2="6" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
                <line x1="3" y1="0" x2="3" y2="6" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
              </g>
              {/* Knife */}
              <g transform="translate(190, 24) rotate(30)">
                <line x1="0" y1="0" x2="0" y2="22" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
              </g>
            </g>
            {glass}
          </svg>
        );
      }

      // Default (noon / unknown): existing pattern
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="xMaxYMin slice" className={baseClass} aria-hidden>
          <g opacity="0.5">{plate}</g>
        </svg>
      );
    }

    case 'transport':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          {[-20, 10, 40, 70, 100, 130, 160, 190].map((offset) => (
            <line
              key={offset}
              x1={offset}
              y1="120"
              x2={offset + 70}
              y2="-20"
              stroke={color}
              strokeWidth="0.7"
              opacity="0.4"
              strokeLinecap="round"
            />
          ))}
          {/* Arrow accent */}
          <g transform="translate(160, 28) rotate(-55)" opacity="0.5">
            <path d="M 0 0 L 12 0 M 8 -3 L 12 0 L 8 3" stroke={color} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      );

    case 'cruise':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          <path d="M 0 65 Q 25 55, 50 65 T 100 65 T 150 65 T 200 65 L 200 100 L 0 100 Z" fill={color} opacity="0.16" />
          <g>
            <path d="M 0 75 Q 25 65, 50 75 T 100 75 T 150 75 T 200 75 T 250 75 T 300 75" stroke={color} strokeWidth="0.7" fill="none" opacity="0.55" />
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-40 0" begin="0s" dur="8s" repeatCount="indefinite" />
          </g>
          <g>
            <path d="M 0 85 Q 25 75, 50 85 T 100 85 T 150 85 T 200 85 T 250 85 T 300 85" stroke={color} strokeWidth="0.5" fill="none" opacity="0.4" />
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-40 0" begin="-2s" dur="8s" repeatCount="indefinite" />
          </g>
          <g>
            <path d="M 0 95 Q 25 85, 50 95 T 100 95 T 150 95 T 200 95 T 250 95 T 300 95" stroke={color} strokeWidth="0.3" fill="none" opacity="0.3" />
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-40 0" begin="-4s" dur="8s" repeatCount="indefinite" />
          </g>
          {/* Anchor */}
          <g transform="translate(168, 28)" opacity="0.45">
            <circle cx="0" cy="0" r="2.5" stroke={color} strokeWidth="0.7" fill="none" />
            <line x1="0" y1="2.5" x2="0" y2="14" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
            <path d="M -6 12 Q 0 18, 6 12" stroke={color} strokeWidth="0.7" fill="none" strokeLinecap="round" />
            <line x1="-3" y1="6" x2="3" y2="6" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'souvenirs':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          {[-30, 0, 30, 60, 90, 120, 150, 180, 210].map((offset, i) => (
            <line
              key={offset}
              x1={offset}
              y1="-10"
              x2={offset + 80}
              y2="120"
              stroke={color}
              strokeWidth={i % 2 === 0 ? '1' : '0.4'}
              opacity={i % 2 === 0 ? '0.35' : '0.2'}
            />
          ))}
        </svg>
      );

    case 'snacks':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" className={baseClass} aria-hidden>
          <g opacity="0.55">
            {[
              [22, 18, 1.8],
              [55, 32, 1.3],
              [85, 20, 1.5],
              [118, 40, 1.7],
              [148, 24, 1.2],
              [178, 38, 1.6],
              [40, 62, 1.4],
              [70, 78, 1.7],
              [102, 68, 1.3],
              [132, 82, 1.5],
              [162, 72, 1.6],
              [190, 88, 1.2],
            ].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill={color}>
                <animate
                  attributeName="opacity"
                  values="0.4;0.85;0.4"
                  dur="4s"
                  begin={`${i * 0.3}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </g>
        </svg>
      );

    case 'clothing':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          <g opacity="0.4">
            {[-20, 10, 40, 70, 100, 130, 160, 190].map((offset) => (
              <g key={offset}>
                <line x1={offset - 25} y1="-5" x2={offset + 35} y2="115" stroke={color} strokeWidth="0.45" />
                <line x1={offset + 25} y1="-5" x2={offset - 35} y2="115" stroke={color} strokeWidth="0.45" />
              </g>
            ))}
          </g>
        </svg>
      );

    case 'fuel':
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" className={baseClass} aria-hidden>
          <g opacity="0.5">
            {[
              [28, 22],
              [62, 48],
              [98, 26],
              [132, 56],
              [168, 32],
              [188, 68],
              [42, 78],
              [112, 80],
              [152, 86],
            ].map(([x, y], i) => (
              <path
                key={i}
                d={`M ${x} ${y} c -4 -7 0 -12 0 -14 c 0 2 4 7 0 14 z`}
                fill={color}
              />
            ))}
          </g>
        </svg>
      );

    case 'misc':
    default:
      return (
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className={baseClass} aria-hidden>
          {[-30, 0, 30, 60, 90, 120, 150, 180, 210].map((offset) => (
            <line
              key={offset}
              x1={offset}
              y1="-10"
              x2={offset + 60}
              y2="120"
              stroke={color}
              strokeWidth="0.4"
              opacity="0.3"
            />
          ))}
        </svg>
      );
  }
}
