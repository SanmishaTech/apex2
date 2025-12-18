"use client";

import * as React from 'react';
import { 
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator
} from '@/components/ui/select';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Lightweight shadcn-style Select wrapper (loose typing – no interfaces)
// Usage:
// <AppSelect value={val} onValueChange={setVal} placeholder="Choose">\n//   <AppSelect.Item value="one">One</AppSelect.Item>\n// </AppSelect>

type AppSelectRootProps = Omit<React.ComponentProps<typeof Select>, 'onValueChange' | 'value' | 'defaultValue'> & {
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: React.ReactNode;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  // For RHF usage
  control?: unknown; // relaxed
  name?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  required?: boolean;
};


function BaseAppSelect(props: AppSelectRootProps) {
  const { className, triggerClassName, contentClassName, placeholder, label, description, disabled, children, control, name, value, onValueChange, required, ...rest } = props;
  const id = React.useId();

  // If control & name provided -> treat as RHF controlled field
  if (control && name) {
    return (
      <FormField
        // @ts-expect-error RHF generic loosened intentionally
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={cn(className)}>
            {label && (
              <FormLabel>
                {label}
                {required ? <span className='ml-0.5 text-destructive'>*</span> : null}
              </FormLabel>
            )}
            <FormControl>
              <Select
                disabled={disabled}
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val);
                  if (typeof onValueChange === 'function') onValueChange(val);
                }}
                {...rest}
              >
                <SelectTrigger id={id} className={cn('w-full', triggerClassName)}>
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className={contentClassName}>{children}</SelectContent>
              </Select>
            </FormControl>
            {description && <p className='text-xs text-muted-foreground mt-1'>{description}</p>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  // Uncontrolled / external state variant
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <Label htmlFor={id} className='text-xs font-medium text-muted-foreground'>
          {label}
          {required ? <span className='ml-0.5 text-destructive'>*</span> : null}
        </Label>
      )}
      <Select disabled={disabled} value={value} onValueChange={onValueChange} {...rest}>
        <SelectTrigger id={id} className={cn('w-full', triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={contentClassName}>{children}</SelectContent>
      </Select>
      {description && <p className='text-xs text-muted-foreground mt-1'>{description}</p>}
    </div>
  );
}

type AppSelectComponent = typeof BaseAppSelect & {
  Item: typeof SelectItem;
  Group: typeof SelectGroup;
  Label: typeof SelectLabel;
  Separator: typeof SelectSeparator;
};

const AppSelect = BaseAppSelect as AppSelectComponent;

// Group / Label / Separator wrappers (thin)
// Re-export primitives under namespaced properties for ergonomic usage
// Augment component with subcomponents (loose typing acceptable)
AppSelect.Item = SelectItem;
AppSelect.Group = SelectGroup;
AppSelect.Label = SelectLabel;
AppSelect.Separator = SelectSeparator;

export { AppSelect };
