import React from 'react';

/**
 * Reusable Button component styled with Deep Teal enterprise palette
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#0875e1] text-white hover:bg-[#005cb9] active:bg-[#004085] focus:ring-[#0875e1] shadow-xs',
    'primary-container':
      'bg-[#002244] text-white hover:bg-[#0875e1] focus:ring-[#0875e1] shadow-xs',
    secondary:
      'bg-[#ebf5ff] text-[#0875e1] hover:bg-[#dbeaf9] active:bg-[#cddcea] focus:ring-[#92c1ff]',
    outline:
      'bg-white border border-[#d8dde6] text-[#1b2533] hover:bg-[#f4f6f8] hover:border-[#0875e1] hover:text-[#0875e1] focus:ring-[#0875e1] shadow-2xs',
    ghost:
      'bg-transparent text-[#5c6574] hover:bg-[#f0f4f8] hover:text-[#1b2533] focus:ring-[#d8dde6]',
    danger:
      'bg-[#d92d20] text-white hover:bg-[#b42318] focus:ring-[#fecdca] shadow-xs',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[18px]">
          progress_activity
        </span>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          )}
        </>
      )}
    </button>
  );
}
