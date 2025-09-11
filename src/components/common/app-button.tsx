"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as Icons from 'lucide-react';

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

type IconName = keyof typeof Icons;

type AppButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & {
  isLoading?: boolean;
  /** (Legacy) direct React node icon */
  icon?: React.ReactNode;
  /** Name of a lucide-react icon (e.g. "Plus", "User", "Trash2"). Overrides icon node when provided */
  iconName?: IconName;
  iconPosition?: 'left' | 'right';
  hideIconWhenLoading?: boolean;
  /** Classes applied to rendered icon */
  iconClassName?: string;
  /** When true, delegate rendering to a single child element (e.g., Next.js Link) using Radix Slot. */
  asChild?: boolean;
};

const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ className, variant, size, children, isLoading, icon, iconName, iconPosition = 'left', hideIconWhenLoading = true, iconClassName = 'h-4 w-4', asChild, ...props }, ref) => {
    const iconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    const ResolvedIcon = iconName ? iconMap[iconName] : null;
    const finalIcon = ResolvedIcon ? <ResolvedIcon className={iconClassName} /> : icon;

    // If asChild is true, Radix Slot requires a single React element as child.
    // We therefore avoid injecting icons/spinners and just forward the child element.
    if (asChild) {
      return (
        <Button
          asChild
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={isLoading}
          {...props}
        >
          {children as React.ReactElement}
        </Button>
      );
    }

    // Default rendering with optional icons/spinner
    return (
      <Button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading}
        {...props}
      >
        {/* Left icon or spinner */}
        {iconPosition === 'left' && (
          isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : finalIcon && (!hideIconWhenLoading || !isLoading) ? (
            <span className="inline-flex items-center justify-center">{finalIcon}</span>
          ) : null
        )}
        {/* Text */}
        {children}
        {/* Right icon or spinner */}
        {iconPosition === 'right' && (
          isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : finalIcon && (!hideIconWhenLoading || !isLoading) ? (
            <span className="inline-flex items-center justify-center">{finalIcon}</span>
          ) : null
        )}
      </Button>
    );
  }
);
AppButton.displayName = "AppButton";

export { AppButton };
