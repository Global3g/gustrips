'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { classNames } from '@/lib/utils/helpers';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, required, ...props }, ref) => {
    const textareaId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm text-white/70 font-medium"
          >
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          className={classNames(
            'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white resize-none min-h-[80px]',
            'placeholder:text-white/30',
            'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
            'transition-colors duration-200',
            error && 'border-red-400/60 focus:border-red-400 focus:ring-red-400/30',
            className
          )}
          {...props}
        />

        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
export default Textarea;
