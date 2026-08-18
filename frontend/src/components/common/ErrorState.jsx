import React from 'react';
import { Button } from './Button.jsx';

export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred while loading this section.',
  onRetry = null,
}) {
  return (
    <div className="w-full py-12 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-3">
        <span className="material-symbols-outlined text-[28px]">error_outline</span>
      </div>
      <h3 className="text-base font-semibold text-[#0f1d27] mb-1">{title}</h3>
      <p className="text-sm text-[#687781] mb-5">{description}</p>
      {onRetry && (
        <Button variant="outline" icon="refresh" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
