'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ChevronDown, MapPin, Check, Home } from 'lucide-react';
import { useTrips } from '@/hooks/useTrips';
import { ROUTES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import type { Trip } from '@/types';

interface TripSwitcherProps {
  currentTripId: string;
  currentTitle?: string;
}

function formatTripDates(trip: Trip): string {
  try {
    if (!trip.startDate || !trip.endDate) return '';
    const start = parseISO(trip.startDate);
    const end = parseISO(trip.endDate);
    return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`;
  } catch {
    return '';
  }
}

export default function TripSwitcher({ currentTripId, currentTitle }: TripSwitcherProps) {
  const { trips } = useTrips();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Portal mount: avoid the parent sidebar's overflow-hidden cropping the
  // dropdown. We render into document.body and position the panel via
  // getBoundingClientRect() so it tracks the trigger.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 288,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const update = (): void => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setPos({
        top: r.bottom + 8,
        left: Math.max(8, r.left),
        width: 288,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Close on outside click and Escape. The dropdown is portaled to body,
  // so we have to whitelist both the trigger AND the dropdown when
  // deciding whether a click is "outside".
  useEffect(() => {
    if (!open) return;

    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const insideTrigger = containerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (insideTrigger || insideDropdown) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const otherTrips = useMemo(() => {
    return trips
      .filter((t) => t.id !== currentTripId)
      .slice()
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [trips, currentTripId]);

  const currentTrip = useMemo(
    () => trips.find((t) => t.id === currentTripId) || null,
    [trips, currentTripId],
  );

  const buttonLabel = currentTitle || currentTrip?.title || 'Mis Viajes';

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80 hover:text-white transition-all duration-200 rounded-lg px-2 py-1.5 -ml-1 hover:bg-white/[0.06] group max-w-full"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 shrink-0" />
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown
          className={classNames(
            'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {mounted && open && createPortal(
        (
          <div
            ref={dropdownRef}
            role="menu"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: Math.min(pos.width, typeof window !== 'undefined' ? window.innerWidth - 16 : pos.width),
              // Belt-and-suspenders solid color: fixed RGB, no alpha, no
              // backdrop-filter — guarantees we sit on top of any sidebar
              // background, particles, or gradient.
              backgroundColor: '#0d1b2e',
              zIndex: 9999,
            }}
            className="border border-white/20 rounded-xl shadow-2xl shadow-black/70 overflow-hidden"
          >
            {/* Primary CTA: go home. Gradient + white text → impossible to miss. */}
            <Link
              href={ROUTES.app.dashboard}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-[13px] font-bold text-white bg-gradient-to-br from-amber-500/25 via-rose-500/15 to-amber-400/20 hover:from-amber-500/35 hover:via-rose-500/25 hover:to-amber-400/30 border-b border-white/10 transition-colors"
              role="menuitem"
            >
              <Home className="w-4 h-4 text-amber-200" />
              <span>Volver a Mis Viajes</span>
            </Link>

            {currentTrip && (
              <div
                className="flex items-start gap-2.5 px-4 py-3 bg-amber-400/[0.12] border-l-[3px] border-amber-400 cursor-default select-none"
                aria-current="page"
              >
                <Check className="w-3.5 h-3.5 text-amber-300 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white truncate">
                    {currentTrip.title}
                  </div>
                  {currentTrip.destination && (
                    <div className="flex items-center gap-1 text-[11.5px] text-white/75 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{currentTrip.destination}</span>
                    </div>
                  )}
                  {formatTripDates(currentTrip) && (
                    <div className="text-[11px] text-white/60 mt-0.5">
                      {formatTripDates(currentTrip)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {otherTrips.length > 0 && (
              <>
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Otros viajes
                </div>
                <div className="pb-1">
                  {otherTrips.map((trip) => (
                    <Link
                      key={trip.id}
                      href={ROUTES.app.trip(trip.id)}
                      onClick={() => setOpen(false)}
                      role="menuitem"
                      className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/[0.08] transition-colors group/item"
                    >
                      <span className="w-3.5 h-3.5 mt-1 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-white truncate">
                          {trip.title}
                        </div>
                        {trip.destination && (
                          <div className="flex items-center gap-1 text-[11.5px] text-white/70 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{trip.destination}</span>
                          </div>
                        )}
                        {formatTripDates(trip) && (
                          <div className="text-[11px] text-white/55 mt-0.5">
                            {formatTripDates(trip)}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ),
        document.body,
      )}
    </div>
  );
}
