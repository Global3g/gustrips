import type { ReactNode, HTMLAttributes } from 'react';
import { classNames } from '@/lib/utils/helpers';

/* ─── Card ─────────────────────────────────────────── */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverable?: boolean;
}

export function Card({ children, hoverable = false, className, ...props }: CardProps) {
  return (
    <div
      className={classNames(
        'glass rounded-2xl overflow-hidden',
        hoverable && 'transition-transform duration-300 hover:scale-[1.02] hover:shadow-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── CardHeader ───────────────────────────────────── */

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={classNames('relative px-5 py-4', className)} {...props}>
      {children}
      {/* Gradient underline */}
      <div className="absolute bottom-0 left-5 right-5 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
    </div>
  );
}

/* ─── CardBody ─────────────────────────────────────── */

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ children, className, ...props }: CardBodyProps) {
  return (
    <div className={classNames('px-5 py-4', className)} {...props}>
      {children}
    </div>
  );
}

/* ─── CardFooter ───────────────────────────────────── */

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <div
      className={classNames(
        'px-5 py-3 border-t border-white/10 bg-white/5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
