'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { classNames } from '@/lib/utils/helpers';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  compact?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, compact = false, className, id, required, ...props }, ref) => {
    const selectId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
    const isSmall = compact;

    return (
      <div className={isSmall ? 'space-y-0.5' : 'space-y-1.5'}>
        {label && (
          <label
            htmlFor={selectId}
            className={classNames(
              'block font-medium',
              isSmall ? 'text-xs text-white/50' : 'text-sm text-white/70'
            )}
          >
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          required={required}
          className={classNames(
            'w-full bg-white/10 border border-white/20 text-white cursor-pointer',
            'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
            'transition-colors duration-200',
            isSmall ? 'rounded-lg px-3 py-1.5 text-sm' : 'rounded-xl px-4 py-3',
            error && 'border-red-400/60 focus:border-red-400 focus:ring-red-400/30',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">
              {opt.label}
            </option>
          ))}
        </select>

        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
export default Select;
