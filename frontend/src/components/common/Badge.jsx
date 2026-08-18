import React from 'react';

/**
 * Reusable StatusBadge & Tag component matching the exact Stitch design badges
 */
export function Badge({
  variant = 'default',
  children,
  icon = null,
  className = '',
  size = 'sm',
}) {
  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2',
  };

  const normalizedVariant = String(variant).toLowerCase();

  const variantStyles = {
    default: 'bg-[#ebf5ff] text-[#0875e1] border border-[#bcd7f7]',
    approved: 'bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd] font-medium',
    pending: 'bg-[#fef7e0] text-[#b06000] border border-[#fce8b2] font-medium',
    rejected: 'bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] font-medium',
    draft: 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] font-medium',
    cancelled: 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] font-medium',
    info: 'bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc] font-medium',
    neutral: 'bg-[#f4f6f8] text-[#5c6574] border border-[#d8dde6]',
    success: 'bg-[#e6f4ea] text-[#137333]',
    warning: 'bg-[#fef7e0] text-[#b06000]',
    danger: 'bg-[#fce8e6] text-[#c5221f]',
  };

  const defaultIcons = {
    approved: 'check_circle',
    pending: 'schedule',
    rejected: 'cancel',
    draft: 'edit_note',
    cancelled: 'block',
  };

  const renderIcon = icon || defaultIcons[normalizedVariant] || null;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium tracking-tight ${sizeStyles[size] || sizeStyles.sm} ${variantStyles[normalizedVariant] || variantStyles.default} ${className}`}
    >
      {renderIcon && (
        <span className="material-symbols-outlined text-[13px]">{renderIcon}</span>
      )}
      <span>{children}</span>
    </span>
  );
}
