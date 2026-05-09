'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { classNames } from '@/lib/utils/helpers';

export type EmptyStateVariant =
  | 'photos'
  | 'expenses'
  | 'events'
  | 'documents'
  | 'travelers'
  | 'checklist'
  | 'links'
  | 'budget'
  | 'balance'
  | 'map'
  | 'generic';

export interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
  compact?: boolean;
}

/* ─── Animation presets ─────────────────────────── */

type AnimKind = 'float' | 'sparkle' | 'breath';

const ANIM_BY_VARIANT: Record<EmptyStateVariant, AnimKind> = {
  photos: 'sparkle',
  expenses: 'float',
  events: 'breath',
  documents: 'float',
  travelers: 'breath',
  checklist: 'float',
  links: 'sparkle',
  budget: 'breath',
  balance: 'float',
  map: 'sparkle',
  generic: 'sparkle',
};

const ANIM_PROPS: Record<
  AnimKind,
  { animate: Record<string, number[]>; transition: { duration: number; repeat: number; ease: 'easeInOut' } }
> = {
  float: {
    animate: { y: [0, -4, 0] },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  sparkle: {
    animate: { rotate: [0, 6, -4, 0] },
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
  breath: {
    animate: { scale: [1, 1.04, 1] },
    transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

/* ─── Illustrations ─────────────────────────────── */

const STROKE = 'rgba(255,255,255,0.6)';
const ACCENT_AMBER = '#fbbf24';
const ACCENT_SKY = '#7dd3fc';
const ACCENT_VIOLET = '#c4b5fd';
const ACCENT_EMERALD = '#6ee7b7';
const ACCENT_PINK = '#f9a8d4';

function Illustration({ variant, size }: { variant: EmptyStateVariant; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 96 96',
    fill: 'none' as const,
    xmlns: 'http://www.w3.org/2000/svg',
  };

  switch (variant) {
    case 'photos':
      return (
        <svg {...common}>
          <rect x="14" y="28" width="68" height="48" rx="10" stroke={STROKE} strokeWidth="2.5" />
          <rect x="36" y="20" width="24" height="10" rx="3" stroke={STROKE} strokeWidth="2.5" fill="rgba(255,255,255,0.04)" />
          <circle cx="48" cy="52" r="12" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="48" cy="52" r="5" fill={ACCENT_AMBER} opacity="0.85" />
          <circle cx="70" cy="40" r="2" fill={ACCENT_AMBER} />
          <path d="M76 24 L78 28 L82 30 L78 32 L76 36 L74 32 L70 30 L74 28 Z" fill={ACCENT_AMBER} opacity="0.9" />
          <path d="M22 70 L23.5 73 L26.5 74.5 L23.5 76 L22 79 L20.5 76 L17.5 74.5 L20.5 73 Z" fill={ACCENT_SKY} opacity="0.85" />
        </svg>
      );

    case 'expenses':
      return (
        <svg {...common}>
          <path
            d="M24 16 L72 16 L72 80 L66 76 L60 80 L54 76 L48 80 L42 76 L36 80 L30 76 L24 80 Z"
            stroke={STROKE}
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.03)"
          />
          <line x1="32" y1="32" x2="64" y2="32" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="42" x2="56" y2="42" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="58" r="11" fill={ACCENT_AMBER} opacity="0.18" stroke={ACCENT_AMBER} strokeWidth="2" />
          <text x="48" y="63" textAnchor="middle" fontSize="14" fontWeight="900" fill={ACCENT_AMBER}>
            $
          </text>
        </svg>
      );

    case 'events':
      return (
        <svg {...common}>
          <rect x="14" y="22" width="56" height="52" rx="8" stroke={STROKE} strokeWidth="2.5" fill="rgba(255,255,255,0.03)" />
          <line x1="14" y1="36" x2="70" y2="36" stroke={STROKE} strokeWidth="2" />
          <line x1="26" y1="16" x2="26" y2="28" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="58" y1="16" x2="58" y2="28" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="68" cy="62" r="14" fill="rgba(255,255,255,0.04)" stroke={ACCENT_VIOLET} strokeWidth="2.5" />
          <line x1="68" y1="55" x2="68" y2="62" stroke={ACCENT_VIOLET} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="68" y1="62" x2="73" y2="64" stroke={ACCENT_VIOLET} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="28" cy="50" r="2.5" fill={ACCENT_AMBER} />
          <circle cx="40" cy="50" r="2.5" fill={ACCENT_AMBER} opacity="0.4" />
          <circle cx="52" cy="50" r="2.5" fill={ACCENT_AMBER} opacity="0.25" />
        </svg>
      );

    case 'documents':
      return (
        <svg {...common}>
          <path
            d="M16 30 L40 30 L46 24 L78 24 L78 76 L16 76 Z"
            stroke={STROKE}
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.04)"
          />
          <rect x="28" y="38" width="38" height="26" rx="3" stroke={ACCENT_SKY} strokeWidth="2" fill="rgba(125,211,252,0.08)" />
          <rect x="34" y="34" width="38" height="26" rx="3" stroke={ACCENT_AMBER} strokeWidth="2" fill="rgba(251,191,36,0.08)" />
          <line x1="40" y1="42" x2="64" y2="42" stroke={ACCENT_AMBER} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="40" y1="48" x2="60" y2="48" stroke={ACCENT_AMBER} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          <line x1="40" y1="54" x2="56" y2="54" stroke={ACCENT_AMBER} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
        </svg>
      );

    case 'travelers':
      return (
        <svg {...common}>
          <circle cx="36" cy="36" r="10" stroke={STROKE} strokeWidth="2.5" fill="rgba(255,255,255,0.04)" />
          <path d="M20 70 Q20 54 36 54 Q52 54 52 70" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" fill="rgba(255,255,255,0.04)" />
          <circle cx="60" cy="40" r="9" stroke={ACCENT_AMBER} strokeWidth="2.5" fill="rgba(251,191,36,0.1)" />
          <path
            d="M46 72 Q46 58 60 58 Q74 58 74 72"
            stroke={ACCENT_AMBER}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="rgba(251,191,36,0.1)"
          />
          <circle cx="76" cy="22" r="2.5" fill={ACCENT_AMBER} opacity="0.8" />
        </svg>
      );

    case 'checklist':
      return (
        <svg {...common}>
          <rect x="20" y="22" width="14" height="14" rx="3" stroke={STROKE} strokeWidth="2.5" fill="rgba(110,231,183,0.15)" />
          <path d="M23 29 L26 32 L31 26" stroke={ACCENT_EMERALD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="42" y1="29" x2="74" y2="29" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="20" y="42" width="14" height="14" rx="3" stroke={STROKE} strokeWidth="2.5" fill="rgba(110,231,183,0.15)" />
          <path d="M23 49 L26 52 L31 46" stroke={ACCENT_EMERALD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="42" y1="49" x2="68" y2="49" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          <rect x="20" y="62" width="14" height="14" rx="3" stroke={ACCENT_AMBER} strokeWidth="2.5" fill="rgba(251,191,36,0.08)" />
          <line x1="42" y1="69" x2="62" y2="69" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
        </svg>
      );

    case 'links':
      return (
        <svg {...common}>
          <path
            d="M30 48 a14 14 0 0 1 14 -14 l8 0 a14 14 0 0 1 14 14"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M66 48 a14 14 0 0 1 -14 14 l-8 0 a14 14 0 0 1 -14 -14"
            stroke={ACCENT_AMBER}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <line x1="36" y1="48" x2="60" y2="48" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="76" cy="26" r="2" fill={ACCENT_AMBER} />
          <circle cx="22" cy="72" r="2" fill={ACCENT_SKY} />
        </svg>
      );

    case 'budget':
      return (
        <svg {...common}>
          <circle cx="48" cy="48" r="28" stroke={STROKE} strokeWidth="2.5" fill="rgba(255,255,255,0.03)" />
          <path
            d="M48 48 L48 20 A28 28 0 0 1 75 53 Z"
            fill={ACCENT_AMBER}
            opacity="0.55"
            stroke={ACCENT_AMBER}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M48 48 L75 53 A28 28 0 0 1 60 73 Z"
            fill={ACCENT_VIOLET}
            opacity="0.55"
            stroke={ACCENT_VIOLET}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="48" cy="48" r="6" fill="rgba(13,27,46,1)" stroke={STROKE} strokeWidth="2" />
        </svg>
      );

    case 'balance':
      return (
        <svg {...common}>
          <line x1="48" y1="18" x2="48" y2="78" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="22" y1="30" x2="74" y2="30" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="48" y1="30" x2="28" y2="50" stroke={STROKE} strokeWidth="2" />
          <line x1="48" y1="30" x2="68" y2="50" stroke={STROKE} strokeWidth="2" />
          <path d="M18 50 Q28 60 38 50" stroke={ACCENT_AMBER} strokeWidth="2.5" strokeLinejoin="round" fill="rgba(251,191,36,0.18)" />
          <path d="M58 50 Q68 60 78 50" stroke={ACCENT_SKY} strokeWidth="2.5" strokeLinejoin="round" fill="rgba(125,211,252,0.18)" />
          <rect x="38" y="74" width="20" height="6" rx="2" stroke={STROKE} strokeWidth="2" fill="rgba(255,255,255,0.04)" />
          <circle cx="48" cy="22" r="3" fill={ACCENT_AMBER} />
        </svg>
      );

    case 'map':
      return (
        <svg {...common}>
          <ellipse cx="48" cy="74" rx="20" ry="4" stroke={STROKE} strokeWidth="2" strokeDasharray="3 3" fill="none" />
          <path
            d="M48 18 C36 18 28 27 28 38 C28 52 48 70 48 70 C48 70 68 52 68 38 C68 27 60 18 48 18 Z"
            stroke={STROKE}
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="rgba(251,191,36,0.12)"
          />
          <circle cx="48" cy="38" r="6" fill={ACCENT_AMBER} />
          <circle cx="22" cy="32" r="2" fill={ACCENT_SKY} />
          <circle cx="74" cy="50" r="2" fill={ACCENT_PINK} />
        </svg>
      );

    case 'generic':
    default:
      return (
        <svg {...common}>
          <path d="M48 18 L52 38 L72 42 L52 46 L48 66 L44 46 L24 42 L44 38 Z" fill={ACCENT_AMBER} opacity="0.85" />
          <circle cx="74" cy="24" r="3" fill={ACCENT_SKY} />
          <circle cx="20" cy="68" r="3" fill={ACCENT_VIOLET} />
          <path d="M68 64 L70 70 L76 72 L70 74 L68 80 L66 74 L60 72 L66 70 Z" fill={ACCENT_AMBER} opacity="0.7" />
        </svg>
      );
  }
}

/* ─── Component ─────────────────────────────────── */

export function EmptyState({
  variant,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const animKind = ANIM_BY_VARIANT[variant];
  const anim = ANIM_PROPS[animKind];
  const size = compact ? 64 : 96;

  const actionClasses =
    'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg shadow-amber-500/30 mt-4 transition-transform active:scale-[0.97]';
  const actionStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
  };

  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      <motion.div
        animate={anim.animate}
        transition={anim.transition}
        className="flex items-center justify-center mb-4"
        style={{ width: size, height: size }}
      >
        <Illustration variant={variant} size={size} />
      </motion.div>

      <h3 className="text-base font-bold text-white/85">{title}</h3>

      {description && (
        <p className="text-xs text-white/50 max-w-xs leading-relaxed mt-1.5">{description}</p>
      )}

      {action &&
        (action.href ? (
          <Link href={action.href} className={actionClasses} style={actionStyle}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={actionClasses} style={actionStyle}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

export default EmptyState;
