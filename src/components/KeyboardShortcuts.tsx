'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, Calendar, Receipt, Camera, Map, Wallet, Sparkles, Bookmark } from 'lucide-react';

type Shortcut = {
  key: string;
  label: string;
  description: string;
  Icon: typeof Calendar;
};

const SHORTCUTS: Shortcut[] = [
  { key: 'e', label: 'E', description: 'New event in itinerary', Icon: Calendar },
  { key: 'g', label: 'G', description: 'Capture expense (camera)', Icon: Receipt },
  { key: 'f', label: 'F', description: 'Upload photo', Icon: Camera },
  { key: 'm', label: 'M', description: 'Open map', Icon: Map },
  { key: 'i', label: 'I', description: 'Open itinerary', Icon: Bookmark },
  { key: 'b', label: 'B', description: 'Open budget', Icon: Wallet },
  { key: 'r', label: 'R', description: 'Open recap', Icon: Sparkles },
  { key: '?', label: '?', description: 'Toggle this help overlay', Icon: Keyboard },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function extractTripId(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/trips\/([^/]+)/);
  if (!match) return null;
  const id = match[1];
  if (id === 'new') return null;
  return id;
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept Cmd/Ctrl/Alt combos
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Don't fire when typing in an input/textarea/contenteditable
      if (isEditableTarget(e.target)) return;

      // Allow Escape to close help even outside trip routes
      if (e.key === 'Escape' && helpOpen) {
        e.preventDefault();
        setHelpOpen(false);
        return;
      }

      const tripId = extractTripId(pathname);
      if (!tripId) return;

      // Handle '?' (shift + /). Shift is allowed here.
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      // For all other shortcuts disallow Shift
      if (e.shiftKey) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case 'e':
          e.preventDefault();
          router.push(`/trips/${tripId}/itinerary`);
          // Fire global event so itinerary can open the new-event form
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('gustrips:open-event-form'));
          }
          return;
        case 'g':
          e.preventDefault();
          router.push(`/trips/${tripId}/expenses?capture=1`);
          return;
        case 'f':
          e.preventDefault();
          router.push(`/trips/${tripId}/photos?upload=1`);
          return;
        case 'm':
          e.preventDefault();
          router.push(`/trips/${tripId}/map`);
          return;
        case 'i':
          e.preventDefault();
          router.push(`/trips/${tripId}/itinerary`);
          return;
        case 'b':
          e.preventDefault();
          router.push(`/trips/${tripId}/budget`);
          return;
        case 'r':
          e.preventDefault();
          router.push(`/trips/${tripId}/recap`);
          return;
        default:
          return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname, router, helpOpen]);

  const closeHelp = () => setHelpOpen(false);

  return (
    <AnimatePresence>
      {helpOpen && (
        <motion.div
          key="kbd-shortcuts-overlay"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          aria-modal="true"
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={closeHelp}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0c1521]/95 shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden"
            initial={{ scale: 0.95, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {/* Amber accent glow */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-amber-500/[0.06] blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20">
                  <Keyboard className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm tracking-tight">Keyboard shortcuts</h2>
                  <p className="text-white/50 text-[11px]">Press any key below from a trip page</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeHelp}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Close shortcuts help"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="relative px-5 py-4">
              <ul className="grid grid-cols-1 gap-1.5">
                {SHORTCUTS.map(({ key, label, description, Icon }) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md bg-white/[0.08] border border-white/[0.12] text-white/85 text-[11px] font-bold font-mono shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]">
                      {label}
                    </kbd>
                    <span className="flex-1 flex items-center gap-2 text-white/75 text-[13px]">
                      <Icon className="w-3.5 h-3.5 text-white/40" />
                      {description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="relative px-5 py-3 border-t border-white/[0.06] bg-white/[0.015]">
              <p className="text-[11px] text-white/45">
                Press{' '}
                <kbd className="inline-flex items-center justify-center min-w-[24px] h-5 px-1 rounded bg-white/[0.08] border border-white/[0.12] text-white/80 text-[10px] font-mono">
                  Esc
                </kbd>{' '}
                or click outside to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
