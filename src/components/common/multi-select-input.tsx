'use client';

import { useState, useRef, useEffect } from 'react';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
};

type MultiSelectInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>;
  name: TName;
  label?: string;
  placeholder?: string;
  options: Option[];
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  span?: number;
  spanFrom?: 'sm' | 'md' | 'lg' | 'xl';
};

export function MultiSelectInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  placeholder = 'Select options...',
  options,
  disabled = false,
  className,
  size = 'md',
  span,
  spanFrom,
}: MultiSelectInputProps<TFieldValues, TName>) {
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

  const getSpanClasses = () => {
    if (!span || !spanFrom) return '';
    const MAP_SM: Record<number, string> = {
      1: 'sm:col-span-1',
      2: 'sm:col-span-2',
      3: 'sm:col-span-3',
      4: 'sm:col-span-4',
      5: 'sm:col-span-5',
      6: 'sm:col-span-6',
      7: 'sm:col-span-7',
      8: 'sm:col-span-8',
      9: 'sm:col-span-9',
      10: 'sm:col-span-10',
      11: 'sm:col-span-11',
      12: 'sm:col-span-12',
    };
    const MAP_MD: Record<number, string> = {
      1: 'md:col-span-1',
      2: 'md:col-span-2',
      3: 'md:col-span-3',
      4: 'md:col-span-4',
      5: 'md:col-span-5',
      6: 'md:col-span-6',
      7: 'md:col-span-7',
      8: 'md:col-span-8',
      9: 'md:col-span-9',
      10: 'md:col-span-10',
      11: 'md:col-span-11',
      12: 'md:col-span-12',
    };
    const MAP_LG: Record<number, string> = {
      1: 'lg:col-span-1',
      2: 'lg:col-span-2',
      3: 'lg:col-span-3',
      4: 'lg:col-span-4',
      5: 'lg:col-span-5',
      6: 'lg:col-span-6',
      7: 'lg:col-span-7',
      8: 'lg:col-span-8',
      9: 'lg:col-span-9',
      10: 'lg:col-span-10',
      11: 'lg:col-span-11',
      12: 'lg:col-span-12',
    };
    const MAP_XL: Record<number, string> = {
      1: 'xl:col-span-1',
      2: 'xl:col-span-2',
      3: 'xl:col-span-3',
      4: 'xl:col-span-4',
      5: 'xl:col-span-5',
      6: 'xl:col-span-6',
      7: 'xl:col-span-7',
      8: 'xl:col-span-8',
      9: 'xl:col-span-9',
      10: 'xl:col-span-10',
      11: 'xl:col-span-11',
      12: 'xl:col-span-12',
    };
    const spanMap = spanFrom === 'sm' ? MAP_SM : spanFrom === 'md' ? MAP_MD : spanFrom === 'lg' ? MAP_LG : MAP_XL;
    return span >= 1 && span <= 12 ? spanMap[span] : '';
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedValues: string[] = Array.isArray(field.value) ? field.value : [];
        
        const handleToggleOption = (optionValue: string) => {
          const newValues = selectedValues.includes(optionValue)
            ? selectedValues.filter((v: string) => v !== optionValue)
            : [...selectedValues, optionValue];
          field.onChange(newValues);
        };

        const handleRemoveOption = (optionValue: string) => {
          const newValues = selectedValues.filter((v: string) => v !== optionValue);
          field.onChange(newValues);
        };

        const selectedOptions = options.filter(option => selectedValues.includes(option.value));

        const buttonSizeClass = size === 'sm' ? 'min-h-9' : 'min-h-10';
        const badgeSizeClass = size === 'sm' ? 'text-[11px] px-2 py-0' : 'text-xs';
        const formItemSpacingClass = size === 'sm' ? 'space-y-1' : 'space-y-2';

        return (
          <FormItem className={cn('col-span-12', formItemSpacingClass, getSpanClasses(), className)}>
            {label && <FormLabel>{label}</FormLabel>}
            <FormControl>
              <div ref={containerRef} className="relative">
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isOpen}
                  className={cn(
                    "w-full justify-between text-left font-normal h-auto items-start",
                    buttonSizeClass,
                    selectedValues.length === 0 && "text-muted-foreground"
                  )}
                  disabled={disabled}
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedValues.length === 0 ? (
                      <span>{placeholder}</span>
                    ) : (
                      selectedOptions.map((option) => (
                        <Badge
                          key={option.value}
                          variant="secondary"
                          className={badgeSizeClass}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveOption(option.value);
                          }}
                        >
                          {option.label}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      ))
                    )}
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                
                {isOpen && (
                  <div className="absolute top-full z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                    <div className="p-1">
                      {options.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No options available
                        </div>
                      ) : (
                        options.map((option) => {
                          const isSelected = selectedValues.includes(option.value);
                          return (
                            <div
                              key={option.value}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-accent"
                              )}
                              onClick={() => handleToggleOption(option.value)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
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
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
