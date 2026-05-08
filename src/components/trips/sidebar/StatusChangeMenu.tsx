'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plane, Check, X as XIcon, ChevronDown, Loader2 } from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';

type Status = 'planning' | 'active' | 'completed' | 'cancelled';

interface StatusChangeMenuProps {
  currentStatus: Status;
  onChange: (newStatus: Status) => Promise<void> | void;
}

interface StatusVisual {
  label: string;
  Icon: typeof Clock;
  text: string;
  bg: string;
  border: string;
  activeBg: string;
  activeText: string;
}

const STATUS_CONFIG: Record<Status, StatusVisual> = {
  planning: {
    label: 'Planificando',
    Icon: Clock,
    text: 'text-amber-300',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    activeBg: 'bg-amber-500/20',
    activeText: 'text-amber-300',
  },
  active: {
    label: 'Activo',
    Icon: Plane,
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    activeBg: 'bg-emerald-500/20',
    activeText: 'text-emerald-300',
  },
  completed: {
    label: 'Completado',
    Icon: Check,
    text: 'text-blue-300',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    activeBg: 'bg-blue-500/20',
    activeText: 'text-blue-300',
  },
  cancelled: {
    label: 'Cancelado',
    Icon: XIcon,
    text: 'text-red-300',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    activeBg: 'bg-red-500/20',
    activeText: 'text-red-300',
  },
};

const STATUS_ORDER: Status[] = ['planning', 'active', 'completed', 'cancelled'];

export default function StatusChangeMenu({ currentStatus, onChange }: StatusChangeMenuProps) {
  const [open, setOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<Status | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const current = STATUS_CONFIG[currentStatus];
  const CurrentIcon = current.Icon;

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = async (status: Status) => {
    if (loadingStatus) return;
    setLoadingStatus(status);
    setOpen(false);
    try {
      await onChange(status);
    } finally {
      setLoadingStatus(null);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          'inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-0.5 border transition-all hover:brightness-110',
          current.bg,
          current.text,
          current.border,
        )}
      >
        <CurrentIcon className="h-3 w-3" />
        <span>{current.label}</span>
        <ChevronDown className="h-3 w-3 text-current/70" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute right-0 mt-1.5 z-50 min-w-[160px] origin-top-right bg-[#1a3352]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-1 divide-y divide-white/[0.05]"
          >
            {STATUS_ORDER.map((status) => {
              const cfg = STATUS_CONFIG[status];
              const Icon = cfg.Icon;
              const isActive = status === currentStatus;
              const isLoading = loadingStatus === status;
              const disabled = loadingStatus !== null;

              return (
                <button
                  key={status}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelect(status)}
                  className={classNames(
                    'w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors',
                    isActive
                      ? classNames(cfg.activeBg, cfg.activeText)
                      : 'text-white/85 hover:bg-white/[0.06]',
                    disabled && !isLoading ? 'opacity-50 cursor-not-allowed' : '',
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className={classNames('h-3.5 w-3.5', isActive ? cfg.activeText : cfg.text)} />
                  )}
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
