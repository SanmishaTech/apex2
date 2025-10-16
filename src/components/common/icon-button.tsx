"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';

type IconName = keyof typeof Icons;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  iconName?: IconName; // lucide icon name
  tooltip?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: React.ComponentProps<typeof Button>['variant'];
  srLabel?: string; // accessible label if no children
}

const sizeClasses: Record<NonNullable<IconButtonProps['size']>, string> = {
  xs: 'h-7 w-7 text-[13px]',
  sm: 'h-8 w-8 text-sm',
  md: 'h-9 w-9',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, iconName, tooltip, size = 'sm', variant = 'ghost', className, srLabel, children, ...rest }, ref) => {
  const IconComp = iconName ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName] : null;
    const content = icon || (IconComp ? <IconComp className="h-4 w-4" /> : null);

    // Simple native title attribute for tooltip (lightweight). Could switch to custom Popover later.
    const withTooltip = tooltip || srLabel;

    return (
      <Button
        ref={ref}
        type={rest.type || 'button'}
        variant={variant}
        className={cn(
          'inline-flex items-center justify-center rounded-md transition-colors',
          sizeClasses[size],
          'p-0',
          className
        )}
        title={withTooltip || undefined}
        aria-label={srLabel || tooltip || (typeof children === 'string' ? children : undefined)}
        {...rest}
      >
        {content}
        {children && (
          <span className={cn('ml-1', !children && 'sr-only')}>{children}</span>
        )}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';

// Pre-configured edit button
export function EditButton(props: Omit<IconButtonProps, 'iconName' | 'tooltip'> & { tooltip?: string }) {
  return <IconButton iconName="Pencil" tooltip={props.tooltip || 'Edit'} variant={props.variant || 'ghost'} size={props.size || 'sm'} {...props} />;
}

// Pre-configured delete (trash) button
export function DeleteIconButton(props: Omit<IconButtonProps, 'iconName' | 'tooltip'> & { tooltip?: string }) {
  return (
    <IconButton
      iconName="Trash2"
      tooltip={props.tooltip || 'Delete'}
      variant={props.variant || 'ghost'}
      size={props.size || 'sm'}
      className={cn('text-destructive hover:text-destructive focus-visible:ring-destructive', props.className)}
      {...props}
    />
  );
}

// Pre-configured open/view button
export function OpenIconButton(props: Omit<IconButtonProps, 'iconName' | 'tooltip'> & { tooltip?: string }) {
  return (
    <IconButton
      iconName="ExternalLink"
      tooltip={props.tooltip || 'Open'}
      variant={props.variant || 'ghost'}
      size={props.size || 'sm'}
      {...props}
    />
  );
}

// Pre-configured view button
export function ViewButton(props: Omit<IconButtonProps, 'iconName' | 'tooltip'> & { tooltip?: string }) {
  return (
    <IconButton
      iconName="Eye"
      tooltip={props.tooltip || 'View'}
      variant={props.variant || 'ghost'}
      size={props.size || 'sm'}
      {...props}
    />
  );
}

export default IconButton;
