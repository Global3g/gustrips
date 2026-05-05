import type { ReactNode, HTMLAttributes } from 'react';
import { classNames } from '@/lib/utils/helpers';

/* --- Card --- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverable?: boolean;
}

export function Card({ children, hoverable = false, className, ...props }: CardProps) {
  return (
    <div
      className={classNames(
        'bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]',
        hoverable && 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* --- CardHeader --- */

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={classNames('relative px-5 py-4', className)} {...props}>
      {children}
      {/* Subtle underline */}
      <div className="absolute bottom-0 left-5 right-5 h-[1px] bg-gray-100" />
    </div>
  );
}

/* --- CardBody --- */

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

/* --- CardFooter --- */

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <div
      className={classNames(
        'px-5 py-3 border-t border-gray-100 bg-gray-50/30',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
