'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';
import AppSidebar from '@/components/layout/AppSidebar';
import AppBottomNav from '@/components/layout/AppBottomNav';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/context/ToastContext';
import { Chatbot } from '@/components/chat/Chatbot';
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
          <div className="flex min-h-screen" style={{ background: inTrip ? undefined : 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 30%, #dbeafe 60%, #ede9fe 100%)' }}>
            {/* Sidebar - desktop only, hidden inside trip views */}
            {!inTrip && <AppSidebar />}

            {/* Main content area */}
            <main
              role="main"
              className={classNames(
              'relative',
              inTrip ? 'flex-1 min-w-0' : 'flex-1 min-w-0 pb-20 lg:pb-0 lg:ml-64',
            )}>
              {/* Decorative orbs for main pages */}
              {!inTrip && (
                <>
                  <div className="absolute top-10 right-10 w-80 h-80 bg-amber-100/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute top-1/2 left-0 w-64 h-64 bg-orange-100/15 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-20 right-1/3 w-56 h-56 bg-amber-200/10 rounded-full blur-3xl pointer-events-none" />
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
          </div>
        </ErrorBoundary>
      </ToastProvider>
    </AuthGuard>
  );
}
