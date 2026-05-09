'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bell, Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useSmartNotifications, type SmartNotification } from '@/hooks/useSmartNotifications';
import { classNames } from '@/lib/utils/helpers';

interface Props {
  tripId: string;
}

interface LevelStyle {
  containerBg: string;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  bodyColor: string;
  dismissColor: string;
  buttonBg: string;
  buttonText: string;
}

const LEVEL_STYLES: Record<SmartNotification['level'], LevelStyle> = {
  warning: {
    containerBg:
      'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.10))',
    borderColor: 'border-amber-300/40',
    iconBg: 'rgba(217,119,6,0.20)',
    iconColor: 'text-amber-700',
    titleColor: 'text-amber-950',
    bodyColor: 'text-amber-900/90',
    dismissColor: 'text-amber-700/70 hover:text-amber-900 hover:bg-amber-200/40',
    buttonBg: 'bg-amber-500 hover:bg-amber-600',
    buttonText: 'text-white',
  },
  success: {
    containerBg:
      'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.08))',
    borderColor: 'border-emerald-300/40',
    iconBg: 'rgba(5,150,105,0.20)',
    iconColor: 'text-emerald-700',
    titleColor: 'text-emerald-950',
    bodyColor: 'text-emerald-900/90',
    dismissColor:
      'text-emerald-700/70 hover:text-emerald-900 hover:bg-emerald-200/40',
    buttonBg: 'bg-emerald-500 hover:bg-emerald-600',
    buttonText: 'text-white',
  },
  info: {
    containerBg:
      'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.08))',
    borderColor: 'border-blue-300/40',
    iconBg: 'rgba(37,99,235,0.20)',
    iconColor: 'text-blue-700',
    titleColor: 'text-blue-950',
    bodyColor: 'text-blue-900/90',
    dismissColor: 'text-blue-700/70 hover:text-blue-900 hover:bg-blue-200/40',
    buttonBg: 'bg-blue-500 hover:bg-blue-600',
    buttonText: 'text-white',
  },
};

function iconForLevel(level: SmartNotification['level']) {
  if (level === 'warning') return AlertTriangle;
  if (level === 'success') return Check;
  return Bell;
}

export default function NotificationsBanner({ tripId }: Props) {
  const { notifications, dismiss } = useSmartNotifications(tripId);
  const [expanded, setExpanded] = useState(false);

  if (notifications.length === 0) return null;

  const top = notifications[0];
  const rest = notifications.slice(1);
  const styles = LEVEL_STYLES[top.level];
  const Icon = iconForLevel(top.level);

  const ActionButton = ({ n }: { n: SmartNotification }) => {
    if (!n.actionLabel || !n.actionHref) return null;
    const s = LEVEL_STYLES[n.level];
    return (
      <Link
        href={n.actionHref}
        className={classNames(
          'inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-3 py-1.5 transition-all flex-shrink-0 hover:shadow-md',
          s.buttonBg,
          s.buttonText,
        )}
      >
        {n.actionLabel}
        <ChevronRight className="w-3 h-3" />
      </Link>
    );
  };

  return (
    <motion.div
      key={top.id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className={classNames(
        'rounded-2xl border overflow-hidden p-4 relative',
        styles.borderColor,
      )}
      style={{ background: styles.containerBg }}
    >
      {/* Dismiss */}
      {top.dismissible && (
        <button
          type="button"
          onClick={() => dismiss(top.id)}
          className={classNames(
            'absolute top-2.5 right-2.5 p-1.5 rounded-lg transition-colors',
            styles.dismissColor,
          )}
          title="Descartar por hoy"
          aria-label="Descartar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3 pr-8">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: styles.iconBg }}
        >
          <Icon className={classNames('w-5 h-5', styles.iconColor)} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className={classNames('font-bold text-sm leading-tight', styles.titleColor)}>
            {top.title}
          </p>
          <p className={classNames('text-xs mt-0.5', styles.bodyColor)}>{top.body}</p>

          {/* +N más chip */}
          {rest.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((s) => !s)}
              className={classNames(
                'mt-2 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-white/60 hover:bg-white/80 border border-white/40 transition-colors',
                styles.bodyColor,
              )}
              aria-expanded={expanded}
            >
              +{rest.length} más
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex"
              >
                <ChevronDown className="w-3 h-3" />
              </motion.span>
            </button>
          )}
        </div>

        {/* Top action */}
        <ActionButton n={top} />
      </div>

      {/* Expanded list */}
      <AnimatePresence initial={false}>
        {expanded && rest.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 space-y-2 border-t border-white/30">
              {rest.map((n) => {
                const NIcon = iconForLevel(n.level);
                const ns = LEVEL_STYLES[n.level];
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/70 border border-white/50"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: ns.iconBg }}
                    >
                      <NIcon className={classNames('w-4 h-4', ns.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-semibold leading-snug">
                        {n.title}
                      </p>
                      <p className="text-gray-700 text-xs mt-0.5">{n.body}</p>
                    </div>
                    <ActionButton n={n} />
                    {n.dismissible && (
                      <button
                        type="button"
                        onClick={() => dismiss(n.id)}
                        className="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-200/60 transition-colors flex-shrink-0"
                        title="Descartar por hoy"
                        aria-label="Descartar notificación"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
