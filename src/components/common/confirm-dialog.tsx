"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ReactNode, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  trigger?: ReactNode; // optional external trigger
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  confirmButtonClassName?: string;
  cancelButtonClassName?: string;
  autoCloseOnConfirm?: boolean; // default true
};

export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  disabled,
  className,
  confirmButtonClassName,
  cancelButtonClassName,
  autoCloseOnConfirm = true,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback((v: boolean) => {
    if (!isControlled) setUncontrolledOpen(v);
    onOpenChange?.(v);
  }, [isControlled, onOpenChange]);

  const handleConfirm = useCallback(async () => {
    if (disabled || submitting) return;
    try {
      setSubmitting(true);
      await onConfirm();
      if (autoCloseOnConfirm) setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [disabled, submitting, onConfirm, autoCloseOnConfirm, setOpen]);

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-50 bg-black/25 dark:bg-black/40 backdrop-blur-[1px] supports-[backdrop-filter]:backdrop-blur-[1px] transition-opacity animate-in fade-in-0"
        />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg focus:outline-none animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          <AlertDialog.Title className="text-base font-semibold tracking-tight">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-6 flex items-center justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("min-w-20", cancelButtonClassName)}
                disabled={submitting}
              >
                {cancelText}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              size="sm"
              variant={confirmButtonClassName ? undefined : "destructive"}
              onClick={handleConfirm}
              disabled={disabled || submitting}
              className={cn(
                "min-w-24",
                // If custom class provided, ensure text color is readable on destructive backgrounds
                confirmButtonClassName || "text-white",
                confirmButtonClassName && !/text-/.test(confirmButtonClassName) && "text-destructive-foreground"
              )}
            >
              {submitting ? "Please wait..." : confirmText}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
