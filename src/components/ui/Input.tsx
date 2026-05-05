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
    const errorId = error ? `${inputId}-error` : undefined;
    const isSmall = compact;

    return (
      <div className={isSmall ? 'space-y-0.5' : 'space-y-1.5'}>
        {label && (
          <label
            htmlFor={inputId}
            className={classNames(
              'block font-medium',
              isSmall ? 'text-xs text-gray-500' : 'text-sm text-gray-700'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={classNames(
            'w-full bg-white border border-gray-300 text-gray-900',
            'placeholder:text-gray-500',
            'outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus:border-blue-500',
            'transition-all duration-200',
            isSmall ? 'rounded-lg px-3 py-1.5 text-sm' : 'rounded-xl px-4 py-3',
            error && 'border-red-400 focus:border-red-500 focus-visible:ring-red-400 focus-visible:ring-2',
            className
          )}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-red-500 text-xs mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
