import React from 'react';

/**
 * Reusable Input component with labels, helper text, and icon adornments
 */
export function Input({
  label,
  id,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  error,
  helperText,
  icon,
  iconPosition = 'left',
  required = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wider text-[#687781]"
        >
          {label} {required && <span className="text-[#ba1a1a]">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {icon && iconPosition === 'left' && (
          <span className="material-symbols-outlined absolute left-3 text-[#687781] text-[20px] pointer-events-none">
            {icon}
          </span>
        )}

        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full bg-[#ffffff] border text-[#0f1d27] rounded-lg px-3.5 py-2.5 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#087f8c]/40 ${
            error ? 'border-[#ba1a1a] focus:ring-[#ba1a1a]/30' : 'border-[#dfe5e8] focus:border-[#00646f]'
          } ${icon && iconPosition === 'left' ? 'pl-10' : ''} ${
            icon && iconPosition === 'right' ? 'pr-10' : ''
          } ${disabled ? 'bg-[#f5f7f8] text-[#687781] cursor-not-allowed' : ''}`}
          {...props}
        />

        {icon && iconPosition === 'right' && (
          <span className="material-symbols-outlined absolute right-3 text-[#687781] text-[20px] pointer-events-none">
            {icon}
          </span>
        )}
      </div>

      {error && <span className="text-xs text-[#ba1a1a]">{error}</span>}
      {!error && helperText && <span className="text-xs text-[#687781]">{helperText}</span>}
    </div>
  );
}
