'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';
import AppSidebar from '@/components/layout/AppSidebar';
import AppBottomNav from '@/components/layout/AppBottomNav';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/context/ToastContext';
import { Chatbot } from '@/components/chat/Chatbot';
import CommandPaletteProvider from '@/components/CommandPaletteProvider';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import MilestoneBanner from '@/components/MilestoneBanner';
import OfflineIndicator from '@/components/OfflineIndicator';
import SyncIndicator from '@/components/SyncIndicator';
import PendingPhotoSync from '@/components/PendingPhotoSync';
import { classNames } from '@/lib/utils/helpers';

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

            {/* AI Chatbot - floating assistant */}
            <Chatbot />

            {/* Global command palette (Cmd/Ctrl + K) */}
            <CommandPaletteProvider />

            {/* Global keyboard shortcuts (e, g, f, m, i, b, r, ?) */}
            <KeyboardShortcuts />

            {/* Confetti milestone toast banner */}
            <MilestoneBanner />

            {/* Offline / sync UX */}
            <OfflineIndicator />
            <SyncIndicator />
            <PendingPhotoSync />
          </div>
        </ErrorBoundary>
      </ToastProvider>
    </AuthGuard>
  );
}
