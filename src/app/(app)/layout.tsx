'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import AuthGuard from '@/components/layout/AuthGuard';
import AppSidebar from '@/components/layout/AppSidebar';
import AppBottomNav from '@/components/layout/AppBottomNav';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/context/ToastContext';
import OfflineIndicator from '@/components/OfflineIndicator';
import { classNames } from '@/lib/utils/helpers';

/* ── Below-the-fold / interaction-only widgets — lazy ────────────────
 *
 * None of these need to be in the initial chunk: the Chatbot only opens on
 * tap, the CommandPalette is keyboard-triggered, KeyboardShortcuts only acts
 * on key events, the MilestoneBanner only fires after a milestone event,
 * Sync/Pending indicators only matter once Firebase resolves auth, and
 * OnboardingModal only shows for first-time users. Pulling them out of the
 * initial bundle is the single biggest first-paint win for dashboard. */
const Chatbot = dynamic(
  () => import('@/components/chat/Chatbot').then((m) => ({ default: m.Chatbot })),
  { ssr: false },
);
const CommandPaletteProvider = dynamic(
  () => import('@/components/CommandPaletteProvider'),
  { ssr: false },
);
const KeyboardShortcuts = dynamic(
  () => import('@/components/KeyboardShortcuts'),
  { ssr: false },
);
const MilestoneBanner = dynamic(
  () => import('@/components/MilestoneBanner'),
  { ssr: false },
);
const SyncIndicator = dynamic(
  () => import('@/components/SyncIndicator'),
  { ssr: false },
);
const PendingPhotoSync = dynamic(
  () => import('@/components/PendingPhotoSync'),
  { ssr: false },
);

/** Detect if we are inside a trip detail view (has tripId in path) */
function isInsideTrip(pathname: string): boolean {
  const match = pathname.match(/^\/trips\/([^/]+)/);
  // /trips/new is NOT a trip detail view
  return !!match && match[1] !== 'new';
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inTrip = isInsideTrip(pathname);

  return (
    <AuthGuard>
      <ToastProvider>
        <ErrorBoundary>
          <div className="flex min-h-screen" style={{ background: inTrip ? undefined : 'linear-gradient(135deg, #0c1929 0%, #132438 50%, #0f1f33 100%)' }}>
            {/* Sidebar - desktop only, hidden inside trip views */}
            {!inTrip && <AppSidebar />}

            {/* Main content area */}
            <main
              role="main"
              className={classNames(
              'relative',
              inTrip ? 'flex-1 min-w-0' : 'flex-1 min-w-0 pb-20 lg:pb-0 lg:ml-64 p-5 sm:p-8 lg:p-10',
            )}>
              {/* Decorative orbs */}
              {!inTrip && (
                <>
                  <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                </>
              )}
              <div className={classNames('relative', inTrip ? '' : 'animate-page-in')}>
                {children}
              </div>
            </main>

            {/* Bottom nav - mobile only, hidden inside trip views */}
            {!inTrip && <AppBottomNav />}

            {/* AI Chatbot - floating assistant (lazy) */}
            <Chatbot />

            {/* Global command palette (Cmd/Ctrl + K) (lazy) */}
            <CommandPaletteProvider />

            {/* Global keyboard shortcuts (e, g, f, m, i, b, r, ?) (lazy) */}
            <KeyboardShortcuts />

            {/* Confetti milestone toast banner (lazy) */}
            <MilestoneBanner />

            {/* Offline indicator stays eager — it's tiny and needs to react
                instantly to network changes. */}
            <OfflineIndicator />

            {/* Sync / pending photo sync (lazy) */}
            <SyncIndicator />
            <PendingPhotoSync />
          </div>
        </ErrorBoundary>
      </ToastProvider>
    </AuthGuard>
  );
}
