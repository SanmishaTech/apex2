import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NonFormTextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  prefixIcon?: React.ReactNode;
  requiredIndicator?: boolean;
  containerClassName?: string;
}

export const NonFormTextInput = React.forwardRef<HTMLInputElement, NonFormTextInputProps>(function NonFormTextInput(
  { label, description, prefixIcon, requiredIndicator, className, containerClassName, id, ...rest }, ref
) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const descId = description ? `${inputId}-desc` : undefined;
  return (
    <div className={cn('flex flex-col gap-1 min-w-[140px]', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className='text-xs font-medium text-muted-foreground'>
          {label}{requiredIndicator && <span className='ml-0.5 text-destructive'>*</span>}
        </label>
      )}
      <div className='relative'>
        {prefixIcon && (
          <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground'>
            {prefixIcon}
          </div>
        )}
        <Input
          id={inputId}
          ref={ref}
          aria-describedby={descId}
            className={cn(prefixIcon && 'pl-9', 'h-9', className)}
          {...rest}
        />
      </div>
      {description && (
        <p id={descId} className='text-[10px] text-muted-foreground'>{description}</p>
      )}
    </div>
  );
});

export default NonFormTextInput;
