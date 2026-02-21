"use client";

import * as React from "react";
import { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command as CommandPrimitive } from "cmdk";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface BatchNumberTypeaheadInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options: string[];
  className?: string;
  inputClassName?: string;
  onSelectOption?: (value: string) => void;
}

export function BatchNumberTypeaheadInput<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  placeholder,
  options,
  className,
  inputClassName,
  onSelectOption,
}: BatchNumberTypeaheadInputProps<T>) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const currentValue = String(field.value || "");
        const [takeInput, setTakeInput] = React.useState<string>(currentValue);
        const [selected, setSelected] = React.useState<{ value: string; label: string } | null>(
          currentValue ? { value: currentValue, label: currentValue } : null
        );

        React.useEffect(() => {
          const next = String(field.value || "");
          setTakeInput(next);
          setSelected(next ? { value: next, label: next } : null);
        }, [field.value]);

        const normalized = takeInput.toLowerCase();
        const filtered = options
          .filter((o) =>
            String(o || "")
              .toLowerCase()
              .includes(normalized)
          )
          .slice(0, 50);

        const handleBlur = () => {
          setOpen(false);
          setTakeInput(selected?.label || currentValue || "");
        };

        return (
          <FormItem className={className}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
              </FormLabel>
            )}
            <CommandPrimitive
              onKeyDown={(event: React.KeyboardEvent) => {
                const input = inputRef.current;
                if (!input) return;

                if (!open) setOpen(true);

                if (event.key === "Enter" && input.value !== "") {
                  const optionToSelect = options.find(
                    (o) => String(o || "").toLowerCase() === input.value.toLowerCase()
                  );

                  const next = optionToSelect ? String(optionToSelect) : input.value;
                  field.onChange(next);
                  setSelected({ value: next, label: next });
                  if (optionToSelect) onSelectOption?.(next);
                  setOpen(false);
                  setTimeout(() => inputRef.current?.blur(), 0);
                }

                if (event.key === "Escape") {
                  input.blur();
                }
              }}
            >
              <div className="relative">
                <FormControl>
                  <CommandInput
                    ref={inputRef}
                    value={takeInput}
                    onValueChange={disabled ? undefined : (v) => {
                      setTakeInput(v);
                      field.onChange(v);
                      if (!open) setOpen(true);
                    }}
                    onBlur={handleBlur}
                    onFocus={() => {
                      if (!disabled) setOpen(true);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn("text-base", inputClassName)}
                  />
                </FormControl>

                <div className="relative mt-1">
                  <div
                    className={cn(
                      "animate-in fade-in-0 zoom-in-95 absolute top-0 z-10 w-full rounded-xl bg-background outline-none",
                      open ? "block" : "hidden"
                    )}
                  >
                    <CommandList className="rounded-lg ring-1 ring-border max-h-56 overflow-auto">
                      {filtered.length > 0 ? (
                        <CommandGroup>
                          {filtered.map((o) => {
                            const isSelected = selected?.value === o;
                            return (
                              <CommandItem
                                key={o}
                                value={o}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onSelect={() => {
                                  const next = String(o);
                                  setTakeInput(next);
                                  field.onChange(next);
                                  setSelected({ value: next, label: next });
                                  onSelectOption?.(next);
                                  setOpen(false);
                                  setTimeout(() => inputRef.current?.blur(), 0);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2",
                                  !isSelected ? "pl-8" : null
                                )}
                              >
                                {isSelected ? <Check className="w-4" /> : null}
                                {o}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      ) : (
                        <div className="select-none rounded-sm px-2 py-3 text-center text-sm text-muted-foreground">
                          No batch found
                        </div>
                      )}
                    </CommandList>
                  </div>
                </div>
              </div>
            </CommandPrimitive>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
