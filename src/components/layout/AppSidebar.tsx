'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlaneTakeoff,
  Users,
  LogOut,
  HardDriveDownload,
  Loader2,
  Globe,
  Compass,
} from 'lucide-react';
import { APP_NAV_ITEMS } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { classNames, getInitials } from '@/lib/utils/helpers';
import { exportAllTripsBackup, downloadBackup, getFullBackupFilename } from '@/lib/utils/backup';
import { useToast } from '@/context/ToastContext';

/* ── Each nav item gets its own unique color ── */
const NAV_COLORS: Record<string, { active: string; icon: string; bg: string; glow: string }> = {
  '/dashboard': {
    active: 'text-blue-400',
    icon: 'text-blue-400',
    bg: 'bg-blue-500/10',
    glow: 'shadow-blue-500/20',
  },
  '/travelers': {
    active: 'text-emerald-400',
    icon: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/20',
  },
  '/trips/new': {
    active: 'text-amber-400',
    icon: 'text-amber-400',
    bg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/20',
  },
};

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  Users,
  PlaneTakeoff,
};

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState(false);

  const handleGlobalBackup = async () => {
    if (!user) return;
    try {
      setBackingUp(true);
      const data = await exportAllTripsBackup(user.uid);
      const filename = getFullBackupFilename();
      downloadBackup(data, filename);
      toast('Backup completo descargado', 'success');
    } catch (err) {
      console.error('Error al generar backup global:', err);
      toast('Error al generar el backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 z-40">
      <div className="flex flex-col h-full relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #1a3352 50%, #162d48 100%)' }}>

        {/* ── Background orbs for depth ── */}
        <div className="absolute top-20 -left-10 w-40 h-40 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-40 -right-10 w-32 h-32 bg-violet-600/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-5 w-24 h-24 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* ── Logo ── */}
        <div className="relative flex items-center justify-center px-6 pt-6 pb-4">
          <img src="/logo.png" alt="GusTrips" className="h-[135px] w-auto object-contain" />
        </div>

        {/* ── Divider ── */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ── Navigation ── */}
        <nav className="relative flex-1 px-3 py-5 space-y-1.5">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const colors = NAV_COLORS[item.href] || NAV_COLORS['/dashboard'];
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 relative group',
                  isActive
                    ? `${colors.bg} ${colors.active} font-semibold shadow-lg ${colors.glow} backdrop-blur-sm`
                    : 'text-white hover:text-white hover:bg-white/[0.04]',
                )}
              >
                {/* Active bar */}
                {isActive && (
                  <div className={classNames(
                    'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full',
                    colors.active.replace('text-', 'bg-'),
                  )} />
                )}
                <Icon
                  className={classNames(
                    'w-5 h-5 flex-shrink-0 transition-colors duration-200',
                    isActive ? colors.icon : 'text-white/95 group-hover:text-white',
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Explore section ── */}
        <div className="relative px-5 pb-3">
          <div className="mx-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
          <div className="flex items-center gap-2 px-1 mb-3">
            <Compass className="w-3.5 h-3.5 text-white/90" />
            <span className="text-[10px] font-bold text-white/90 uppercase tracking-[0.12em]">Acciones</span>
          </div>
          <button
            onClick={handleGlobalBackup}
            disabled={backingUp}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-white hover:text-white/95 hover:bg-white/[0.04] transition-all duration-200 disabled:opacity-40"
          >
            {backingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <HardDriveDownload className="w-4 h-4" />
            )}
            <span>Backup completo</span>
          </button>
        </div>

        {/* ── User Footer ── */}
        {user && (
          <div className="relative px-4 py-4">
            <div className="mx-1 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mb-4" />
            <div className="flex items-center gap-3">
              {/* Avatar with gradient ring */}
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500 via-violet-500 to-rose-500 rounded-full opacity-60 blur-[1px]" />
                <div className="relative w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center ring-2 ring-slate-800">
                  <span className="text-white text-xs font-bold">
                    {getInitials(user.displayName || user.email)}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[12px] font-medium truncate">
                  {user.displayName || 'Usuario'}
                </p>
                <p className="text-white/95 text-[10px] truncate">{user.email}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="text-white/90 hover:text-rose-400 transition-colors duration-200 p-1.5 rounded-lg hover:bg-white/[0.05]"
                title="Cerrar sesion"
                aria-label="Cerrar sesion"
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
