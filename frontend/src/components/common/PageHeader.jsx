import React from 'react';

export function PageHeader({
  title,
  subtitle,
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 ${className}`}>
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#0f1d27]">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-[#687781] mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
