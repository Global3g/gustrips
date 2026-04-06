import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center text-center py-16 px-6 animate-empty-state-in',
        className
      )}
    >
      {/* Icon with gradient glow */}
      <div className="relative mb-6 animate-empty-icon-in">
        {/* Glow background */}
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 blur-xl animate-empty-glow" />
        {/* Icon wrapper */}
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
          <Icon className="w-9 h-9 text-white/60" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-white/50 text-sm max-w-xs mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action */}
      {action && <div>{action}</div>}
    </div>
  );
}
