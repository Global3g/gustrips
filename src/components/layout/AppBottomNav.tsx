'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Plane, Bell, PlaneTakeoff, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { APP_BOTTOM_NAV_ITEMS } from '@/config/navigation';
import { classNames, glassStyle } from '@/lib/utils/helpers';

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  Plane,
  Bell,
  PlaneTakeoff,
};

export default function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-bottom">
      <div className="px-4 pb-3 pt-1">
        <nav
          className="flex items-center justify-around rounded-2xl px-2 py-2"
          style={glassStyle}
        >
          {/* Left nav item */}
          {APP_BOTTOM_NAV_ITEMS.slice(0, 1).map((item) => {
            const Icon = ICON_MAP[item.icon];
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-4 py-1.5 min-w-[64px]"
              >
                <Icon
                  className={classNames(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-blue-400' : 'text-white/50'
                  )}
                />
                <span
                  className={classNames(
                    'text-[10px] font-medium transition-colors',
                    isActive ? 'text-blue-400' : 'text-white/50'
                  )}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottomNavDot"
                    className="w-1 h-1 rounded-full bg-blue-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {/* Middle nav item */}
          {APP_BOTTOM_NAV_ITEMS.slice(1, 2).map((item) => {
            const Icon = ICON_MAP[item.icon];
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-4 py-1.5 min-w-[64px]"
              >
                <Icon
                  className={classNames(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-cyan-400' : 'text-white/50'
                  )}
                />
                <span
                  className={classNames(
                    'text-[10px] font-medium transition-colors',
                    isActive ? 'text-cyan-400' : 'text-white/50'
                  )}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottomNavDot"
                    className="w-1 h-1 rounded-full bg-cyan-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {/* Right nav item / FAB */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => router.push('/trips/new')}
            className="flex flex-col items-center gap-1 px-4 py-1.5 min-w-[64px]"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-blue-400/30">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className={classNames(
              'text-[10px] font-medium transition-colors',
              pathname === '/trips/new' ? 'text-cyan-400' : 'text-white/50'
            )}>
              Nuevo
            </span>
            {pathname === '/trips/new' && (
              <motion.div
                layoutId="bottomNavDot"
                className="w-1 h-1 rounded-full bg-cyan-400"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        </nav>
      </div>
    </div>
  );
}
