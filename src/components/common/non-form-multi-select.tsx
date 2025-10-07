'use client';

import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = {
  value: number | string;
  label: string;
};

type NonFormMultiSelectProps = {
  options: Option[];
  value: (number | string)[];
  onChange: (value: (number | string)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
};

export function NonFormMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  className,
  label,
  required = false,
}: NonFormMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (optionValue: number | string) => {
    const newValues = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValues);
  };

  const handleRemoveOption = (optionValue: number | string) => {
    const newValues = value.filter((v) => v !== optionValue);
    onChange(newValues);
  };

  const handleSelectAll = () => {
    onChange(options.map((opt) => opt.value));
  };

  const handleClear = () => {
    onChange([]);
  };

  const selectedOptions = options.filter((option) => value.includes(option.value));

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className='block text-sm font-medium text-foreground'>
          {label} {required && <span className='text-red-500'>*</span>}
        </label>
      )}
      <div ref={containerRef} className='relative'>
        <button
          type='button'
          role='combobox'
          aria-expanded={isOpen}
          className={cn(
            'flex h-auto min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            value.length === 0 && 'text-muted-foreground'
          )}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className='flex flex-wrap gap-1 flex-1'>
            {value.length === 0 ? (
              <span>{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant='secondary'
                  className='text-xs'
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveOption(option.value);
                  }}
                >
                  {option.label}
                  <X className='ml-1 h-3 w-3' />
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </button>

        {isOpen && (
          <div className='absolute top-full z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto'>
            <div className='p-1'>
              {/* Select All / Clear All buttons */}
              <div className='flex gap-1 p-1 border-b border-border mb-1'>
                <button
                  type='button'
                  className='flex-1 px-2 py-1 text-xs rounded hover:bg-accent hover:text-accent-foreground'
                  onClick={handleSelectAll}
                >
                  Select All
                </button>
                <button
                  type='button'
                  className='flex-1 px-2 py-1 text-xs rounded hover:bg-accent hover:text-accent-foreground'
                  onClick={handleClear}
                >
                  Clear
                </button>
              </div>

              {options.length === 0 ? (
                <div className='px-2 py-1.5 text-sm text-muted-foreground'>
                  No options available
                </div>
              ) : (
                options.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                        isSelected && 'bg-accent'
                      )}
                      onClick={() => handleToggleOption(option.value)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {option.label}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      {value.length > 0 && (
        <p className='text-sm text-muted-foreground'>
          Selected: {value.length} {value.length === 1 ? 'item' : 'items'}
        </p>
      )}
    </div>
  );
}
