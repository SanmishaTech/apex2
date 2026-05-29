"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  options: (string | { label: string; value: string })[];
  className?: string;
  inputClassName?: string;
  onSelectOption?: (value: string) => void;
}

function BatchNumberTypeaheadInputInner({
  value,
  onChange,
  disabled,
  placeholder,
  options,
  inputClassName,
  onSelectOption,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  options: (string | { label: string; value: string })[];
  inputClassName?: string;
  onSelectOption?: (value: string) => void;
}) {
  const normalizedOptions = React.useMemo(() => {
    return options.map((o) => {
      if (typeof o === "string") return { label: o, value: o };
      return o;
    });
  }, [options]);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [takeInput, setTakeInput] = React.useState<string>(String(value || ""));
  const [selected, setSelected] = React.useState<{ value: string; label: string } | null>(
    value ? { value, label: value } : null
  );
  const [menuPos, setMenuPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);

  React.useEffect(() => {
    const next = String(value || "");
    const option = normalizedOptions.find((o) => o.value === next);
    const label = option ? option.label : next;
    setTakeInput(label);
    setSelected(next ? { value: next, label } : null);
  }, [value, normalizedOptions]);

  const normalized = takeInput.toLowerCase();
  const filtered = normalizedOptions
    .filter((o) =>
      String(o.label || "")
        .toLowerCase()
        .includes(normalized)
    )
    .slice(0, 50);

  const handleBlur = () => {
    setOpen(false);
    if (selected?.label) {
      setTakeInput(selected.label);
    } else {
      const next = String(value || "");
      const option = normalizedOptions.find((o) => o.value === next);
      setTakeInput(option ? option.label : next);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maxMenuHeight = 224; // matches max-h-56
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < maxMenuHeight && r.top > spaceBelow;
      setMenuPos({
        top: openUp ? r.top - 4 : r.bottom + 4,
        left: r.left,
        width: r.width,
        openUp,
      });
    };
    update();

    // Capture scroll events from any scroll container
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <CommandPrimitive
      onKeyDown={(event: React.KeyboardEvent) => {
        const input = inputRef.current;
        if (!input) return;

        if (!open) setOpen(true);

        if (event.key === "Enter" && input.value !== "") {
          const optionToSelect = normalizedOptions.find(
            (o) => String(o.label || "").toLowerCase() === input.value.toLowerCase() || String(o.value || "").toLowerCase() === input.value.toLowerCase()
          );

          const next = optionToSelect ? String(optionToSelect.value) : input.value;
          onChange(next);
          setSelected({ value: next, label: optionToSelect ? optionToSelect.label : next });
          if (optionToSelect) onSelectOption?.(next);
          setOpen(false);
          setTimeout(() => inputRef.current?.blur(), 0);
        }

        if (event.key === "Escape") {
          input.blur();
        }
      }}
    >
      <div ref={anchorRef} className="relative">
        <FormControl>
          <CommandInput
            ref={inputRef}
            value={takeInput}
            onValueChange={
              disabled
                ? undefined
                : (v) => {
                    setTakeInput(v);
                    onChange(v);
                    if (!open) setOpen(true);
                  }
            }
            onBlur={handleBlur}
            onFocus={() => {
              if (!disabled) setOpen(true);
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={cn("text-base", inputClassName)}
          />
        </FormControl>

        {open && menuPos
          ? createPortal(
              <div
                className={cn(
                  "animate-in fade-in-0 zoom-in-95 fixed z-9999 rounded-xl bg-background outline-none",
                  menuPos.openUp ? "origin-bottom" : "origin-top"
                )}
                style={{
                  top: menuPos.top,
                  left: menuPos.left,
                  width: menuPos.width,
                  transform: menuPos.openUp ? "translateY(-100%)" : undefined,
                }}
              >
                <CommandList className="rounded-lg ring-1 ring-border max-h-56 overflow-auto">
                  {filtered.length > 0 ? (
                    <CommandGroup>
                      {filtered.map((o) => {
                        const isSelected = selected?.value === o.value;
                        return (
                          <CommandItem
                            key={o.value + o.label}
                            value={o.label}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onSelect={() => {
                              const next = String(o.value);
                              setTakeInput(next);
                              onChange(next);
                              setSelected({ value: next, label: o.label });
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
                            {o.label}
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
              </div>,
              document.body
            )
          : null}
      </div>
    </CommandPrimitive>
  );
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
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        return (
          <FormItem className={className}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
              </FormLabel>
            )}
            <BatchNumberTypeaheadInputInner
              value={String(field.value || "")}
              onChange={(v) => field.onChange(v)}
              disabled={disabled}
              placeholder={placeholder}
              options={options}
              inputClassName={inputClassName}
              onSelectOption={onSelectOption}
            />
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
