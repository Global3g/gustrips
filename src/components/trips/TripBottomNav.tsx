'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Receipt,
  PiggyBank,
  Users,
  Camera,
  CheckSquare,
  FileText,
  Map,
  Link as LinkIcon,
  ArrowLeft,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '@/lib/utils/helpers';

interface TripBottomNavProps {
  tripId: string;
}

const PRIMARY_TABS = [
  { key: 'overview', icon: LayoutDashboard, label: 'General', path: '' },
  { key: 'itinerary', icon: CalendarDays, label: 'Itinerario', path: '/itinerary' },
  { key: 'expenses', icon: Receipt, label: 'Gastos', path: '/expenses' },
  { key: 'photos', icon: Camera, label: 'Fotos', path: '/photos' },
];

const MORE_TABS = [
  { key: 'budget', icon: PiggyBank, label: 'Presupuesto', path: '/budget' },
  { key: 'members', icon: Users, label: 'Viajeros', path: '/members' },
  { key: 'checklist', icon: CheckSquare, label: 'Checklist', path: '/checklist' },
  { key: 'documents', icon: FileText, label: 'Documentos', path: '/documents' },
  { key: 'map', icon: Map, label: 'Mapa', path: '/map' },
  { key: 'links', icon: LinkIcon, label: 'Enlaces', path: '/links' },
];

export default function TripBottomNav({ tripId }: TripBottomNavProps) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const basePath = `/trips/${tripId}`;

  function isActive(tabPath: string): boolean {
    const fullPath = `${basePath}${tabPath}`;
    if (tabPath === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(fullPath);
  }

  // Check if a "more" tab is active
  const moreTabActive = MORE_TABS.some((tab) => isActive(tab.path));

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowMore(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="absolute bottom-20 left-4 right-4 bg-white rounded-2xl border border-gray-200 shadow-xl p-2"
              onClick={(e) => e.stopPropagation()}
            >
              {MORE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.path);
                return (
                  <Link
                    key={tab.key}
                    href={`${basePath}${tab.path}`}
                    onClick={() => setShowMore(false)}
                    className={classNames(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                      active ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <Icon className={classNames('w-5 h-5', active ? 'text-amber-600' : 'text-gray-400')} />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </Link>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-bottom">
        <div className="px-3 pb-2 pt-1">
          <nav className="flex items-center justify-around rounded-2xl px-1 py-1.5 bg-white border border-gray-200 shadow-lg shadow-black/5">
            {/* Back to dashboard */}
            <Link
              href="/dashboard"
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[48px]"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
              <span className="text-[9px] font-medium text-gray-400">Inicio</span>
            </Link>

            {/* Primary tabs */}
            {PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.path);
              return (
                <Link
                  key={tab.key}
                  href={`${basePath}${tab.path}`}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[48px]"
                >
                  <Icon className={classNames('w-5 h-5 transition-colors', active ? 'text-amber-600' : 'text-gray-400')} />
                  <span className={classNames('text-[9px] font-medium transition-colors', active ? 'text-amber-600' : 'text-gray-400')}>
                    {tab.label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="tripNavDot"
                      className="w-1 h-1 rounded-full bg-amber-500"
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    />
                  )}
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setShowMore(!showMore)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[48px]"
            >
              {showMore ? (
                <X className={classNames('w-5 h-5', moreTabActive ? 'text-amber-600' : 'text-gray-400')} />
              ) : (
                <MoreHorizontal className={classNames('w-5 h-5', moreTabActive ? 'text-amber-600' : 'text-gray-400')} />
              )}
              <span className={classNames('text-[9px] font-medium', moreTabActive ? 'text-amber-600' : 'text-gray-400')}>
                Más
              </span>
              {moreTabActive && !showMore && (
                <motion.div
                  layoutId="tripNavDot"
                  className="w-1 h-1 rounded-full bg-amber-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                />
              )}
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}
