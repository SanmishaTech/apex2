import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Core style map; extend or override via prop.
export const DEFAULT_STATUS_STYLES: Record<string, { label?: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  inactive: { label: 'Inactive', className: 'bg-destructive/10 text-destructive' },
  open: { label: 'Open', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  closed: { label: 'Closed', className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
  converted: { label: 'Converted', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  rejected: { label: 'Rejected', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
};

export type StatusBadgeProps = {
  /** Boolean mode (legacy) */
  active?: boolean;
  /** String status key e.g. 'open' | 'closed' | 'converted' */
  status?: string | null;
  /** Optional custom map merging over defaults */
  stylesMap?: Record<string, { label?: string; className: string }>;
  className?: string;
  activeLabel?: string; // legacy override
  inactiveLabel?: string; // legacy override
  fallbackLabel?: string; // label if status not found
};

export function StatusBadge({
  active,
  status,
  stylesMap,
  className,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
  fallbackLabel = '—',
}: StatusBadgeProps) {
  const map = React.useMemo(
    () => ({ ...DEFAULT_STATUS_STYLES, ...(stylesMap || {}) }),
    [stylesMap]
  );

  // Backward compatibility: if status prop not provided, derive from active boolean
  const effectiveStatus = status ?? (active === true ? 'active' : active === false ? 'inactive' : undefined);

  if (!effectiveStatus) {
    return (
      <Badge variant='secondary' className={cn('bg-muted text-muted-foreground border-transparent', className)}>
        {fallbackLabel}
      </Badge>
    );
  }

  const cfg = map[effectiveStatus];
  const label = cfg?.label || (effectiveStatus === 'active' ? activeLabel : effectiveStatus === 'inactive' ? inactiveLabel : effectiveStatus);
  const style = cfg?.className || 'bg-muted text-foreground';

  return (
    <Badge
      variant='outline'
      className={cn(
        'rounded-full border-transparent px-2 py-0.5',
        style,
        className
      )}
    >
      {label}
    </Badge>
  );
}

