'use client';

import type { DatasheetStatus } from '@/types/datasheet';
import { normalizeStatus, STATUS_BADGE_CLASS, STATUS_LABELS } from '@/lib/status';

export function StatusBadge({
  status,
  className = '',
}: {
  status: DatasheetStatus | string;
  className?: string;
}) {
  const normalized = normalizeStatus(status);
  return (
    <span className={`status-badge ${STATUS_BADGE_CLASS[normalized]} ${className}`}>
      {STATUS_LABELS[normalized]}
    </span>
  );
}
