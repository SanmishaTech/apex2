"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Filter, ChevronUp, ChevronDown } from 'lucide-react';

type FilterBarProps = {
  children: React.ReactNode;
  className?: string;
  /** Optional heading */
  title?: string;
  /** Visual style variant */
  variant?: 'subtle' | 'gradient' | 'outline' | 'glass';
  /** Spacing density */
  size?: 'sm' | 'md';
  /** Allow collapsing */
  collapsible?: boolean;
  /** Initial open state when collapsible */
  defaultOpen?: boolean;
};

const variantClasses: Record<NonNullable<FilterBarProps['variant']>, string> = {
  subtle: 'bg-muted/40 border',
  outline: 'border border-dashed bg-background',
  gradient: 'border bg-gradient-to-r from-muted/60 via-muted/30 to-transparent dark:from-muted/40 dark:via-muted/20',
  glass: 'backdrop-blur-sm border bg-background/40 dark:bg-background/30',
};

export function FilterBar({
  children,
  className,
  title = 'Filters',
  variant = 'subtle',
  size = 'md',
  collapsible = true,
  defaultOpen = true,
}: FilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);

  const sizeClasses =
    size === 'sm'
      ? 'rounded-md p-2 md:p-3 transition-colors group shadow-sm/10 ring-1 ring-transparent hover:shadow-sm flex flex-col gap-2'
      : 'rounded-md p-3 md:p-4 transition-colors group shadow-sm/10 ring-1 ring-transparent hover:shadow-sm flex flex-col gap-3';

  return (
    <div
      className={cn(
        sizeClasses,
        variantClasses[variant],
        className
      )}
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2 text-sm font-medium tracking-wide'>
          <span className='inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary'>
            <Filter className='h-3.5 w-3.5' strokeWidth={2} />
          </span>
          {title}
        </div>
        {collapsible && (
          <button
            type='button'
            onClick={() => setOpen(o => !o)}
            className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
            aria-expanded={open}
            aria-label={open ? 'Collapse filters' : 'Expand filters'}
          >
            {open ? <ChevronUp className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />}
          </button>
        )}
      </div>
      <div
        className={cn(
          'grid transition-all duration-200 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className={cn(open ? 'overflow-visible' : 'overflow-hidden')}> 
          <div
            className={cn(
              'grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] auto-rows-fr',
              size === 'sm' ? 'gap-2' : 'gap-3'
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Provide a default export as some tooling may expect it
export default FilterBar;
