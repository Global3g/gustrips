'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { classNames } from '@/lib/utils/helpers';

export default function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isOnDashboard = pathname === '/dashboard';
  const isOnTravelers = pathname === '/travelers';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-bottom">
      <div className="px-4 pb-3 pt-1">
        <nav
          className="flex items-center justify-around rounded-2xl px-2 py-2 bg-white border border-gray-200 shadow-lg shadow-black/5"
        >
          {/* Dashboard */}
          <Link
            href="/dashboard"
            aria-label="Ir a Viajes"
            className="flex flex-col items-center gap-1 px-4 py-1.5 min-w-[64px]"
          >
            <LayoutDashboard
              className={classNames(
                'w-5 h-5 transition-colors',
                isOnDashboard ? 'text-amber-600' : 'text-gray-400'
              )}
            />
            <span
              className={classNames(
                'text-[10px] font-medium transition-colors',
                isOnDashboard ? 'text-amber-600' : 'text-gray-400'
              )}
            >
              Viajes
            </span>
            {isOnDashboard && (
              <motion.div
                layoutId="bottomNavDot"
                className="w-1 h-1 rounded-full bg-amber-600"
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              />
            )}
          </Link>

          {/* Viajeros */}
          <Link
            href="/travelers"
            aria-label="Ir a Viajeros"
            className="flex flex-col items-center gap-1 px-4 py-1.5 min-w-[64px]"
          >
            <Users
              className={classNames(
                'w-5 h-5 transition-colors',
                isOnTravelers ? 'text-amber-600' : 'text-gray-400'
              )}
            />
            <span
              className={classNames(
                'text-[10px] font-medium transition-colors',
                isOnTravelers ? 'text-amber-600' : 'text-gray-400'
              )}
            >
              Viajeros
            </span>
            {isOnTravelers && (
              <motion.div
                layoutId="bottomNavDot"
                className="w-1 h-1 rounded-full bg-amber-600"
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              />
            )}
          </Link>

          {/* Nuevo Viaje FAB */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => router.push('/trips/new')}
            aria-label="Crear nuevo viaje"
            className="flex flex-col items-center gap-1 px-4 py-1.5 min-w-[64px]"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className={classNames(
              'text-[10px] font-medium transition-colors',
              pathname === '/trips/new' ? 'text-amber-600' : 'text-gray-400'
            )}>
              Nuevo
            </span>
            {pathname === '/trips/new' && (
              <motion.div
                layoutId="bottomNavDot"
                className="w-1 h-1 rounded-full bg-amber-600"
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              />
            )}
          </motion.button>
        </nav>
      </div>
    </div>
  );
}
