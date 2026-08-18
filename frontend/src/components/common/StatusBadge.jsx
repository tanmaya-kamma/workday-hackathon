import React from 'react';
import { Badge } from './Badge.jsx';

export function StatusBadge({ status, className = '', size = 'sm' }) {
  const normalized = String(status || 'default').toLowerCase();
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <Badge variant={normalized} size={size} className={className}>
      {label}
    </Badge>
  );
}

export { Badge };
