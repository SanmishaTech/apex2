"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxOption {
  value: string
  label: string
}

interface AppComboboxProps {
  value?: string
  onValueChange?: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}

export function AppCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  className,
  disabled,
}: AppComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [buttonWidth, setButtonWidth] = React.useState<number>(0)

  React.useEffect(() => {
    if (buttonRef.current) {
      setButtonWidth(buttonRef.current.offsetWidth)
    }
  }, [open])

  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="outline"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal overflow-hidden",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: buttonWidth }}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value || '__empty'}
                  value={option.label}
                  keywords={[option.value, option.label]}
                  onSelect={() => {
                    onValueChange?.(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
