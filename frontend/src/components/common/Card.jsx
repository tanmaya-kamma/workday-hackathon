import React from 'react';

/**
 * Reusable Card component respecting Stitch white background, subtle border & shadows
 */
export function Card({
  children,
  className = '',
  padding = 'p-6',
  hover = false,
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-[#dfe5e8] shadow-sm ${
        hover ? 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : ''
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
