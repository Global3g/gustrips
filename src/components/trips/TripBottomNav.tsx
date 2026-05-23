'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
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

// Primary tabs: the four most-used sections during an active trip.
// "Hoy" replaces the old "General" overview as the first slot —
// the overview is now reachable via the "Más" sheet.
const PRIMARY_TABS = [
  { key: 'today', icon: CalendarDays, label: 'Hoy', path: '/today' },
  { key: 'itinerary', icon: CalendarDays, label: 'Itinerario', path: '/itinerary' },
  { key: 'expenses', icon: Receipt, label: 'Gastos', path: '/expenses' },
  { key: 'photos', icon: Camera, label: 'Fotos', path: '/photos' },
];

const MORE_TABS = [
  { key: 'overview', icon: LayoutDashboard, label: 'Resumen', path: '' },
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
  const [hidden, setHidden] = useState(false);
  // Compact mode = collapsed visual: icons + smaller bar with no labels.
  // Triggered by inactivity. Tapping the nav or scrolling pops it back
  // to full so the labels are reachable.
  const [compact, setCompact] = useState(true);
  const lastScrollY = useRef(0);
  const compactTimerRef = useRef<number | null>(null);
  const basePath = `/trips/${tripId}`;

  // Schedule a transition to compact after a period of inactivity.
  const scheduleCompact = () => {
    if (compactTimerRef.current) window.clearTimeout(compactTimerRef.current);
    compactTimerRef.current = window.setTimeout(() => setCompact(true), 2500);
  };

  // Expand the bar and (re)start the inactivity timer.
  const expandTemporarily = () => {
    setCompact(false);
    scheduleCompact();
  };

  // Hide on scroll down, show + expand briefly on scroll up.
  useEffect(() => {
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentY = scrollContainer.scrollTop;
      if (currentY > lastScrollY.current && currentY > 60) {
        setHidden(true);
        setShowMore(false);
      } else {
        setHidden(false);
        // Scrolling up signals intent — expand so labels are visible while
        // the user looks for a section to tap, then collapse again.
        expandTemporarily();
      }
      lastScrollY.current = currentY;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Start in compact mode after first paint. The user can scroll up or
    // tap to expand.
    scheduleCompact();
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (compactTimerRef.current) window.clearTimeout(compactTimerRef.current);
    };
  }, []);

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

      {/* Bottom nav bar — pinned to the bottom edge of the viewport.
          The safe-area inset is applied directly to the inner padding so
          the bar visually touches the home indicator on iPhones with
          notch. No outer page margin — the bar is flush with the screen. */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-transform duration-300 ${hidden ? 'translate-y-full' : 'translate-y-0'}`}
        // Tap anywhere on the bar pops it back to full size with labels.
        onTouchStart={expandTemporarily}
        onMouseEnter={expandTemporarily}
      >
        <nav
          className={classNames(
            'flex items-center justify-around bg-white/95 backdrop-blur-md border-t border-gray-200/80 transition-all duration-200',
            compact ? 'py-0.5' : 'py-1.5',
          )}
          style={{
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${compact ? 2 : 6}px)`,
          }}
        >
          {/* Back to dashboard */}
          <Link
            href="/dashboard"
            onClick={expandTemporarily}
            className={classNames(
              'flex flex-col items-center justify-center gap-0.5 min-w-[44px] transition-all',
              compact ? 'py-1' : 'py-1.5',
            )}
          >
            <ArrowLeft className={classNames('text-gray-400 transition-all', compact ? 'w-4 h-4' : 'w-5 h-5')} />
            {!compact && (
              <span className="text-[9px] font-medium text-gray-400">Inicio</span>
            )}
          </Link>

          {/* Primary tabs */}
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.key}
                href={`${basePath}${tab.path}`}
                onClick={expandTemporarily}
                className={classNames(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[44px] transition-all',
                  compact ? 'py-1' : 'py-1.5',
                )}
              >
                <Icon
                  className={classNames(
                    'transition-all',
                    compact ? 'w-4 h-4' : 'w-5 h-5',
                    active ? 'text-amber-600' : 'text-gray-400',
                  )}
                />
                {!compact && (
                  <span
                    className={classNames(
                      'text-[9px] font-medium transition-colors',
                      active ? 'text-amber-600' : 'text-gray-400',
                    )}
                  >
                    {tab.label}
                  </span>
                )}
                {active && compact && (
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                )}
                {active && !compact && (
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
            onClick={() => {
              expandTemporarily();
              setShowMore((v) => !v);
            }}
            className={classNames(
              'flex flex-col items-center justify-center gap-0.5 min-w-[44px] transition-all',
              compact ? 'py-1' : 'py-1.5',
            )}
          >
            {showMore ? (
              <X
                className={classNames(
                  'transition-all',
                  compact ? 'w-4 h-4' : 'w-5 h-5',
                  moreTabActive ? 'text-amber-600' : 'text-gray-400',
                )}
              />
            ) : (
              <MoreHorizontal
                className={classNames(
                  'transition-all',
                  compact ? 'w-4 h-4' : 'w-5 h-5',
                  moreTabActive ? 'text-amber-600' : 'text-gray-400',
                )}
              />
            )}
            {!compact && (
              <span
                className={classNames(
                  'text-[9px] font-medium',
                  moreTabActive ? 'text-amber-600' : 'text-gray-400',
                )}
              >
                Más
              </span>
            )}
            {moreTabActive && !showMore && compact && (
              <span className="w-1 h-1 rounded-full bg-amber-500" />
            )}
          </button>
        </nav>
      </div>
    </>
  );
}
