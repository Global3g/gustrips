'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Plus, X, Plane, Receipt, CalendarPlus, MapPin, ChevronRight, BookHeart } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useTrips } from '@/hooks/useTrips';
import { classNames } from '@/lib/utils/helpers';
import type { Trip } from '@/types';

type PendingAction = 'expense' | 'event' | null;

export default function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { trips } = useTrips();
  const [showMenu, setShowMenu] = useState(false);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const isOnDashboard = pathname === '/dashboard';
  const isOnTravelers = pathname === '/travelers';
  const isOnHistorias = pathname === '/tripshistory' || pathname.startsWith('/tripshistory/');
  const mouseX = useMotionValue(Infinity);
  const navRef = useRef<HTMLElement>(null);

  // Active trips (planning or active, not completed/cancelled)
  const activeTrips = trips.filter((t) => t.status === 'planning' || t.status === 'active');

  const handleAction = (action: PendingAction) => {
    setShowMenu(false);

    if (action === null) return;

    if (action === 'expense' || action === 'event') {
      if (activeTrips.length === 1) {
        // Go directly
        const tripId = activeTrips[0].id;
        router.push(action === 'expense' ? `/trips/${tripId}/expenses` : `/trips/${tripId}/itinerary`);
      } else if (activeTrips.length > 1) {
        // Show trip picker
        setPendingAction(action);
        setShowTripPicker(true);
      } else {
        // No trips — go to create
        router.push('/trips/new');
      }
    }
  };

  const handleTripSelect = (trip: Trip) => {
    setShowTripPicker(false);
    const tripId = trip.id;
    if (pendingAction === 'expense') {
      router.push(`/trips/${tripId}/expenses`);
    } else if (pendingAction === 'event') {
      router.push(`/trips/${tripId}/itinerary`);
    }
    setPendingAction(null);
  };

  return (
    <>
      {/* FAB menu overlay */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setShowMenu(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {[
                { icon: Plane, label: 'Nuevo viaje', action: null as PendingAction, href: '/trips/new', color: '#3b82f6' },
                { icon: Receipt, label: 'Capturar gasto', action: 'expense' as PendingAction, href: null, color: '#f59e0b' },
                { icon: CalendarPlus, label: 'Agregar evento', action: 'event' as PendingAction, href: null, color: '#10b981' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, y: 15, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.8 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      if (item.href) {
                        setShowMenu(false);
                        router.push(item.href);
                      } else {
                        handleAction(item.action);
                      }
                    }}
                    className="flex items-center gap-3 bg-white rounded-2xl px-5 py-3.5 shadow-xl min-w-[200px] hover:scale-105 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                      <Icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trip picker modal */}
      <AnimatePresence>
        {showTripPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => { setShowTripPicker(false); setPendingAction(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm mx-0 sm:mx-4 p-5 pb-8 sm:pb-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {pendingAction === 'expense' ? 'Capturar gasto' : 'Agregar evento'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">Selecciona el viaje</p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {activeTrips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => handleTripSelect(trip)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 transition-all text-left group"
                  >
                    {trip.coverImage ? (
                      <img src={trip.coverImage} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-white/70" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{trip.title}</p>
                      <p className="text-xs text-gray-400 truncate">{trip.destination}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav bar — Dock magnification */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-bottom">
        <div className="px-4 pb-2 pt-0">
          <nav
            ref={navRef}
            className="flex items-end justify-around rounded-xl px-2 py-1.5 bg-white/90 backdrop-blur-xl border border-gray-200/80 shadow-lg shadow-black/5 relative"
            onMouseMove={(e) => mouseX.set(e.clientX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            onTouchMove={(e) => { const t = e.touches[0]; if (t) mouseX.set(t.clientX); }}
            onTouchEnd={() => mouseX.set(Infinity)}
          >
            {/* Dashboard */}
            <DockItem mouseX={mouseX} href="/dashboard" active={isOnDashboard}>
              <LayoutDashboard className={classNames('w-full h-full transition-colors', isOnDashboard ? 'text-amber-600' : 'text-gray-400')} />
              <span className={classNames('text-[9px] font-medium transition-colors absolute -bottom-3.5', isOnDashboard ? 'text-amber-600' : 'text-gray-400')}>Viajes</span>
            </DockItem>

            {/* Travelers */}
            <DockItem mouseX={mouseX} href="/travelers" active={isOnTravelers}>
              <Users className={classNames('w-full h-full transition-colors', isOnTravelers ? 'text-amber-600' : 'text-gray-400')} />
              <span className={classNames('text-[9px] font-medium transition-colors absolute -bottom-3.5', isOnTravelers ? 'text-amber-600' : 'text-gray-400')}>Viajeros</span>
            </DockItem>

            {/* FAB — center "+" */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Acciones rapidas"
              className="relative -mt-6 mx-3"
            >
              <motion.div
                animate={{ rotate: showMenu ? 45 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-12 h-12 rounded-full bg-[#1e3a5f] flex items-center justify-center shadow-lg shadow-[#1e3a5f]/30 border-3 border-white"
              >
                {showMenu ? (
                  <X className="w-6 h-6 text-white" />
                ) : (
                  <Plus className="w-6 h-6 text-white" />
                )}
              </motion.div>
            </motion.button>

            {/* Historias */}
            <DockItem mouseX={mouseX} href="/tripshistory" active={isOnHistorias}>
              <BookHeart className={classNames('w-full h-full transition-colors', isOnHistorias ? 'text-amber-600' : 'text-gray-400')} />
              <span className={classNames('text-[9px] font-medium transition-colors absolute -bottom-3.5', isOnHistorias ? 'text-amber-600' : 'text-gray-400')}>Historias</span>
            </DockItem>
          </nav>
        </div>
      </div>
    </>
  );
}

/* ── Dock Item with magnification ── */

function DockItem({ mouseX, href, active, children }: {
  mouseX: ReturnType<typeof useMotionValue<number>>;
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const distance = useTransform(mouseX, (val: number) => {
    if (!ref.current) return 200;
    const rect = ref.current.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    return Math.abs(val - center);
  });

  const size = useTransform(distance, [0, 80, 200], [32, 26, 20]);

  return (
    <Link ref={ref} href={href} className="relative flex flex-col items-center pb-4 px-3">
      <motion.div style={{ width: size, height: size }} className="relative">
        {children}
      </motion.div>
      {active && (
        <motion.div layoutId="bottomNavDot" className="w-1 h-1 rounded-full bg-amber-600 absolute bottom-1"
          transition={{ type: 'spring', stiffness: 400, damping: 28 }} />
      )}
    </Link>
  );
}
