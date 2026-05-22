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
  const smMap: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 7: 'sm:grid-cols-7', 8: 'sm:grid-cols-8', 9: 'sm:grid-cols-9', 10: 'sm:grid-cols-10', 11: 'sm:grid-cols-11', 12: 'sm:grid-cols-12' };
  const mdMap: Record<number, string> = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8', 9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12' };
  const lgMap: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7', 8: 'lg:grid-cols-8', 9: 'lg:grid-cols-9', 10: 'lg:grid-cols-10', 11: 'lg:grid-cols-11', 12: 'lg:grid-cols-12' };

  if (smCols && smMap[smCols]) classes.push(smMap[smCols]);
  if (mdCols && mdMap[mdCols]) classes.push(mdMap[mdCols]);
  const finalLg = lgCols || cols; // allow explicit override
  if (finalLg && finalLg > 1) {
    const safe = Math.min(Math.max(finalLg, 1), 12);
    if (from === 'md') {
      classes.push(mdMap[safe]);
    } else {
      classes.push(lgMap[safe]);
    }
  }

  return (
    <div ref={ref} className={cn(classes.join(' '), 'gap-6 items-start', className)} {...rest}>
      {children}
    </div>
  );
});

export const Forms = { FormSection, FormRow };
