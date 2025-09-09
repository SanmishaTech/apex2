// Toast abstraction wrapping sonner with semantic variant styling & iconography.
// Use toast.success/error/... for consistent UX; avoids duplicating styling logic.
"use client";

import { toast as baseToast, type ExternalToast } from "sonner";
import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Info,
  Loader2
} from "lucide-react";
import { ReactNode } from "react";

// Color + icon mapping per variant
const variantConfig: Record<string, { icon: ReactNode; className: string; defaultTitle: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    className:
      "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    defaultTitle: "Success"
  },
  error: {
    icon: <CircleX className="h-5 w-5 text-red-600 dark:text-red-400" />,
    className:
      "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    defaultTitle: "Error"
  },
  warning: {
    icon: <CircleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    className:
      "border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    defaultTitle: "Warning"
  },
  info: {
    icon: <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
    className:
      "border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    defaultTitle: "Info"
  },
  loading: {
    icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
    className: "border border-primary/40 bg-primary/10 text-primary",
    defaultTitle: "Loading"
  }
};

type ToastOptions = Omit<ExternalToast, "description"> & {
  description?: ReactNode;
  variant?: keyof typeof variantConfig;
  // override base container classes
  containerClassName?: string;
};

// Core wrapper: merges variant styling and injects leading icon
function show(title?: ReactNode, opts: ToastOptions = {}) {
  const { variant, description, className, /* containerClassName */ ...rest } = opts;
  const cfg = variant ? variantConfig[variant] : undefined;
  const content = cfg
    ? (
        <span className="inline-flex items-center gap-2">
          <span className="shrink-0">{cfg.icon}</span>
          <span className="font-medium text-sm leading-tight">
            {title || cfg.defaultTitle}
          </span>
        </span>
      )
    : title;

  return baseToast(content as unknown as string, {
    // Sonner expects string | ReactNode for description already
    description: description,
    className: [
      "flex items-center gap-3 rounded-md p-3 pr-4 shadow-sm backdrop-blur-sm max-w-sm",
      "border bg-background/90 supports-[backdrop-filter]:bg-background/70",
      cfg?.className,
      className
    ]
      .filter(Boolean)
      .join(" "),
    // Prepend icon via data attribute styling using ::before not available -> we inline icon in title
    // Simplest approach: mutate title when variant present
    ...rest
  });
}

export const toast = Object.assign(show, {
  success: (title?: ReactNode, opts?: Omit<ToastOptions, "variant">) =>
    show(title, { ...opts, variant: "success" }),
  error: (title?: ReactNode, opts?: Omit<ToastOptions, "variant">) =>
    show(title, { ...opts, variant: "error" }),
  warning: (title?: ReactNode, opts?: Omit<ToastOptions, "variant">) =>
    show(title, { ...opts, variant: "warning" }),
  info: (title?: ReactNode, opts?: Omit<ToastOptions, "variant">) =>
    show(title, { ...opts, variant: "info" }),
  loading: (title?: ReactNode, opts?: Omit<ToastOptions, "variant">) =>
    show(title, { ...opts, variant: "loading", duration: Infinity })
});

export type { ToastOptions };
