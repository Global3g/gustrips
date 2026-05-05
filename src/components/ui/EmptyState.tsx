import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { classNames } from '@/lib/utils/helpers';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  suggestion?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  suggestion,
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
      {/* Icon */}
      <div className="relative mb-6 animate-empty-icon-in">
        {/* Subtle background pulse */}
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-gray-100 animate-empty-glow" />
        {/* Icon wrapper */}
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/60 shadow-sm flex items-center justify-center">
          <Icon className="w-9 h-9 text-gray-500" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-gray-900 font-bold text-lg mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-gray-500 text-sm max-w-xs mb-2 leading-relaxed">
          {description}
        </p>
      )}

      {/* Suggestion */}
      {suggestion && (
        <p className="text-gray-400 text-xs max-w-xs mb-6 leading-relaxed italic">
          {suggestion}
        </p>
      )}

      {/* Spacer when no suggestion but has description */}
      {description && !suggestion && <div className="mb-4" />}

      {/* Action */}
      {action && <div>{action}</div>}
    </div>
  );
}
