import * as React from 'react';
import { cn } from '@/lib/utils';
import { ElementType } from 'react';

/**
 * FormSection: works like a semantic fieldset (optional legend) but styled.
 */
export interface FormSectionProps extends React.HTMLAttributes<HTMLElement> {
  legend?: React.ReactNode;
  as?: ElementType; // default fieldset
  description?: React.ReactNode;
  inlineLegend?: boolean;
}

export const FormSection = React.forwardRef<HTMLElement, FormSectionProps>(function FormSection(
  { legend, description, className, children, as, inlineLegend = false, ...rest }, ref
) {
  const Comp = (as || 'fieldset') as ElementType;
  return (
    <Comp ref={ref as unknown as React.RefObject<HTMLElement>} className={cn('space-y-4', className)} {...rest}>
      {(legend || description) && (
        <div className={cn('space-y-2')}>
          {legend && (
            <div className='flex items-center gap-3'>
              <div className='text-base font-semibold shrink-0 px-0'>{legend}</div>
              <div className='h-px bg-border flex-1' />
            </div>
          )}
          {description && <div className='text-xs text-muted-foreground'>{description}</div>}
        </div>
      )}
      <div className={cn('space-y-4', (legend || description) && 'pt-6')}>
        {children}
      </div>
    </Comp>
  );
});

/**
 * FormRow: responsive grid row. Provide number of columns (1-4 typical).
 */
export interface FormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Desired number of columns at desktop (lg breakpoint). Mobile defaults to 1 column. */
  cols?: number; // allow up to 12 (validated at runtime)
  /** Number of columns from the sm breakpoint upward (optional) */
  smCols?: number;
  /** Number of columns from the md breakpoint upward (optional) */
  mdCols?: number;
  /** Explicit override for lg breakpoint if you need different than cols (rare). */
  lgCols?: number;
  /** Breakpoint from which the 'cols' value should apply (default 'lg'). */
  from?: 'md' | 'lg';
}

export const FormRow = React.forwardRef<HTMLDivElement, FormRowProps>(function FormRow(
  { className, cols = 1, smCols, mdCols, lgCols, from = 'lg', children, ...rest }, ref
) {
  // Inherently desktop-first: base is 1 column; add earlier breakpoints only if specified.
  const classes: string[] = ['grid', 'grid-cols-1'];
  if (smCols) classes.push(`sm:grid-cols-${smCols}`);
  if (mdCols) classes.push(`md:grid-cols-${mdCols}`);
  const finalLg = lgCols || cols; // allow explicit override
  if (finalLg && finalLg > 1) {
    const safe = Math.min(Math.max(finalLg, 1), 12);
    if (from === 'md') {
      classes.push(`md:grid-cols-${safe}`);
    } else {
      classes.push(`lg:grid-cols-${safe}`);
    }
  }

  return (
    <div ref={ref} className={cn(classes.join(' '), 'gap-6 items-start', className)} {...rest}>
      {children}
    </div>
  );
});

export const Forms = { FormSection, FormRow };
