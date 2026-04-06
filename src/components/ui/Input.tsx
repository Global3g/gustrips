'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { classNames } from '@/lib/utils/helpers';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  compact?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, compact = false, className, id, required, ...props }, ref) => {
    const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
    const isSmall = compact;

    return (
      <div className={isSmall ? 'space-y-0.5' : 'space-y-1.5'}>
        {label && (
          <label
            htmlFor={inputId}
            className={classNames(
              'block font-medium',
              isSmall ? 'text-xs text-white/50' : 'text-sm text-white/70'
            )}
          >
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          className={classNames(
            'w-full bg-white/10 border border-white/20 text-white',
            'placeholder:text-white/30',
            'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
            'transition-colors duration-200',
            isSmall ? 'rounded-lg px-3 py-1.5 text-sm' : 'rounded-xl px-4 py-3',
            error && 'border-red-400/60 focus:border-red-400 focus:ring-red-400/30',
            className
          )}
          {...props}
        />

        {error && (
          <p className="text-red-400 text-xs mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
