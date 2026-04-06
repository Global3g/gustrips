'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plane, LayoutDashboard, PlaneTakeoff, Bell, LogOut } from 'lucide-react';
import { APP_NAV_ITEMS } from '@/config/navigation';
import { APP_NAME } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import { classNames, getInitials, glassStyle } from '@/lib/utils/helpers';

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  Plane,
  Bell,
  PlaneTakeoff,
};

const ICON_COLORS: Record<string, string> = {
  '/dashboard': 'text-blue-400',
  '/flights': 'text-cyan-400',
  '/alerts': 'text-purple-400',
  '/trips/new': 'text-cyan-400',
};

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 z-40">
      <div
        className="flex flex-col h-full rounded-r-2xl overflow-hidden"
        style={glassStyle}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            {APP_NAME}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            const iconColor = ICON_COLORS[item.href] ?? 'text-white/60';

            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white/15 text-white shadow-lg shadow-black/10'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                )}
              >
                <Icon
                  className={classNames(
                    'w-5 h-5 flex-shrink-0',
                    isActive ? iconColor : 'text-white/40'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        {user && (
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {getInitials(user.displayName || user.email)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {user.displayName || 'Usuario'}
                </p>
                <p className="text-white/40 text-xs truncate">{user.email}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="text-white/40 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/10"
                title="Cerrar sesion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
