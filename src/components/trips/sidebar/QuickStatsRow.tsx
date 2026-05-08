'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { classNames } from '@/lib/utils/helpers';
import type { LucideIcon } from 'lucide-react';

interface StatItem {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color: 'blue' | 'amber' | 'emerald' | 'rose' | 'violet' | 'cyan' | 'orange';
  href?: string;
}

interface QuickStatsRowProps {
  stats: StatItem[];
}

const ICON_COLOR_MAP: Record<StatItem['color'], string> = {
  blue: 'text-blue-300',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  cyan: 'text-cyan-300',
  orange: 'text-orange-300',
};

const CARD_CLASSES =
  'flex-1 min-w-0 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm px-2.5 py-2 text-center hover:bg-white/[0.06] hover:border-white/[0.08] transition';

export default function QuickStatsRow({ stats }: QuickStatsRowProps) {
  return (
    <div className="flex gap-2">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const iconColor = ICON_COLOR_MAP[stat.color];

        const content = (
          <>
            <div className="flex justify-center">
              <Icon className={classNames('h-4 w-4', iconColor)} />
            </div>
            <div className="mt-1 text-[13px] font-bold tabular-nums text-white">
              {stat.value}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/70">
              {stat.label}
            </div>
          </>
        );

        const motionProps = {
          initial: { opacity: 0, y: 4 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.04 * index },
        };

        if (stat.href) {
          return (
            <motion.div
              key={`${stat.label}-${index}`}
              {...motionProps}
              className={CARD_CLASSES}
            >
              <Link href={stat.href} className="block">
                {content}
              </Link>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={`${stat.label}-${index}`}
            {...motionProps}
            className={CARD_CLASSES}
          >
            {content}
          </motion.div>
        );
      })}
    </div>
  );
}
