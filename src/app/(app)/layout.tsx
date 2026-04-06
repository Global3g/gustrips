'use client';

import type { ReactNode } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import AppSidebar from '@/components/layout/AppSidebar';
import AppBottomNav from '@/components/layout/AppBottomNav';
import { ToastProvider } from '@/context/ToastContext';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ToastProvider>
        <div className="app-bg-gradient flex min-h-screen">
          {/* Sidebar - desktop only */}
          <AppSidebar />

          {/* Main content area */}
          <main className="flex-1 min-w-0 pb-20 lg:pb-0 lg:ml-64">
            {children}
          </main>

          {/* Bottom nav - mobile only */}
          <AppBottomNav />
        </div>
      </ToastProvider>
    </AuthGuard>
  );
}
