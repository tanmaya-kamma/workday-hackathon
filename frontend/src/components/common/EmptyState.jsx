import React from 'react';
import { Button } from './Button.jsx';

export function EmptyState({
  icon = 'inbox',
  title = 'No records found',
  description = 'There are currently no items matching your criteria.',
  actionLabel = null,
  onAction = null,
  actionIcon = null,
}) {
  return (
    <div className="w-full py-12 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-[#ebf5ff] text-[#00646f] flex items-center justify-center mb-3">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </div>
      <h3 className="text-base font-semibold text-[#0f1d27] mb-1">{title}</h3>
      <p className="text-sm text-[#687781] mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
