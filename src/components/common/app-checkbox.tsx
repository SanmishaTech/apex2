"use client";

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// Simple wrapper around shadcn Checkbox providing label, description, error.
type AppCheckboxProps = {
  id?: string;
  className?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  name?: string;
  required?: boolean;
  span?: number;
  spanFrom?: 'md' | 'lg';
};

export function AppCheckbox({
  id,
  className,
  label,
  description,
  error,
  disabled,
  checked,
  defaultChecked,
  onCheckedChange,
  name,
  required,
  span,
  spanFrom='lg',
}: AppCheckboxProps) {
  const internalId = React.useId();
  const cid = id || internalId;
  const describedBy: string[] = [];
  if (description) describedBy.push(cid + '-desc');
  if (error) describedBy.push(cid + '-err');
  const MAP_MD: Record<number,string> = {1:'md:col-span-1',2:'md:col-span-2',3:'md:col-span-3',4:'md:col-span-4',5:'md:col-span-5',6:'md:col-span-6',7:'md:col-span-7',8:'md:col-span-8',9:'md:col-span-9',10:'md:col-span-10',11:'md:col-span-11',12:'md:col-span-12'};
  const MAP_LG: Record<number,string> = {1:'lg:col-span-1',2:'lg:col-span-2',3:'lg:col-span-3',4:'lg:col-span-4',5:'lg:col-span-5',6:'lg:col-span-6',7:'lg:col-span-7',8:'lg:col-span-8',9:'lg:col-span-9',10:'lg:col-span-10',11:'lg:col-span-11',12:'lg:col-span-12'};
  const spanMap = spanFrom === 'md' ? MAP_MD : MAP_LG;
  const spanClass = span && span>=1 && span<=12 ? spanMap[span] : undefined;
  return (
    <div className={cn('flex items-center h-full mt-3 col-span-12', spanClass, className)}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={cid}
          name={name}
          disabled={disabled}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={(v) => onCheckedChange?.(!!v)}
          aria-describedby={describedBy.length ? describedBy.join(' ') : undefined}
          aria-invalid={!!error || undefined}
          required={required}
        />
        {label && (
          <label htmlFor={cid} className="select-none text-sm leading-none peer-disabled:cursor-not-allowed">
            {label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}
          </label>
        )}
      </div>
      {description && !error && (
        <p id={cid + '-desc'} className="text-[11px] text-muted-foreground ml-2">{description}</p>
      )}
      {error && (
        <p id={cid + '-err'} className="text-[11px] text-destructive ml-2">{error}</p>
      )}
    </div>
  );
}
