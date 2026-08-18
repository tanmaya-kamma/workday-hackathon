import React from 'react';

/**
 * Reusable Select component matching Stitch form designs
 */
export function Select({
  label,
  id,
  value,
  onChange,
  options = [],
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Select an option',
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
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full appearance-none bg-[#ffffff] border text-[#0f1d27] rounded-lg px-3.5 py-2.5 pr-10 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#087f8c]/40 cursor-pointer ${
            error ? 'border-[#ba1a1a] focus:ring-[#ba1a1a]/30' : 'border-[#dfe5e8] focus:border-[#00646f]'
          } ${disabled ? 'bg-[#f5f7f8] text-[#687781] cursor-not-allowed' : ''}`}
          {...props}
        >
          {placeholder && !value && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <span className="material-symbols-outlined absolute right-3 text-[#687781] pointer-events-none text-[20px]">
          expand_more
        </span>
      </div>

      {error && <span className="text-xs text-[#ba1a1a]">{error}</span>}
      {!error && helperText && <span className="text-xs text-[#687781]">{helperText}</span>}
    </div>
  );
}
