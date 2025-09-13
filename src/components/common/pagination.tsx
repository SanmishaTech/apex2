"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/common/app-select";
import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationProps = {
  page: number;
  totalPages: number;
  total?: number;
  perPage?: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (per: number) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
  showPageNumbers?: boolean; // simple toggle for number buttons
  maxButtons?: number; // max numeric buttons when showPageNumbers
  disabled?: boolean;
  compact?: boolean; // icon-only prev/next with tooltip-like labels hidden
  withSummary?: boolean; // wraps in footer layout with summary text
  summaryLabel?: (args: { page: number; totalPages: number; total?: number; perPage?: number }) => React.ReactNode;
};

export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  onPerPageChange,
  className,
  size = "sm",
  showPageNumbers = false,
  maxButtons = 5,
  disabled = false,
  compact = false,
  withSummary = true,
  summaryLabel,
}: PaginationProps) {
  const perPageOptions = [5, 10, 20, 50];
  const canPrev = page > 1 && !disabled;
  const canNext = page < totalPages && !disabled;

  function go(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
  }

  const pages: number[] = showPageNumbers
    ? (() => {
        const list: number[] = [];
        const half = Math.floor(maxButtons / 2);
        let start = Math.max(1, page - half);
        let end = start + maxButtons - 1;
        if (end > totalPages) {
          end = totalPages;
          start = Math.max(1, end - maxButtons + 1);
        }
        for (let i = start; i <= end; i++) list.push(i);
        return list;
      })()
    : [];

  const core = (
    <ShadcnPagination className={cn(!withSummary && className)}>
      <PaginationContent>
        <PaginationItem>
          { (compact || showPageNumbers || size !== 'default') ? (
            <PaginationLink
              href="#"
              size={size === 'default' ? 'default' : 'icon'}
              aria-disabled={!canPrev}
              className={!canPrev ? 'pointer-events-none opacity-50' : ''}
              onClick={e => { e.preventDefault(); if (canPrev) go(page - 1); }}
            >
              <ChevronLeft className="h-4 w-4" />
            </PaginationLink>
          ) : (
            <PaginationPrevious
              href="#"
              onClick={e => { e.preventDefault(); if (canPrev) go(page - 1); }}
              aria-disabled={!canPrev}
              className={!canPrev ? 'pointer-events-none opacity-50' : ''}
            />
          ) }
        </PaginationItem>
        {showPageNumbers && pages[0] && pages[0] > 1 && (
          <PaginationItem>
            <PaginationLink href="#" size={size === 'default' ? 'default' : 'icon'} onClick={e => { e.preventDefault(); go(1); }}>
              1
            </PaginationLink>
          </PaginationItem>
        )}
        {showPageNumbers && pages[0] && pages[0] > 2 && (
          <PaginationItem><PaginationEllipsis /></PaginationItem>
        )}
        {showPageNumbers && pages.map(n => (
          <PaginationItem key={n}>
            <PaginationLink
              href="#"
              size={size === 'default' ? 'default' : 'icon'}
              isActive={n === page}
              onClick={e => { e.preventDefault(); go(n); }}
            >{n}</PaginationLink>
          </PaginationItem>
        ))}
        {showPageNumbers && pages.at(-1) && pages.at(-1)! < totalPages - 1 && (
          <PaginationItem><PaginationEllipsis /></PaginationItem>
        )}
        {showPageNumbers && pages.at(-1) && pages.at(-1)! < totalPages && (
          <PaginationItem>
            <PaginationLink href="#" size={size === 'default' ? 'default' : 'icon'} onClick={e => { e.preventDefault(); go(totalPages); }}>
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem>
          { (compact || showPageNumbers || size !== 'default') ? (
            <PaginationLink
              href="#"
              size={size === 'default' ? 'default' : 'icon'}
              aria-disabled={!canNext}
              className={!canNext ? 'pointer-events-none opacity-50' : ''}
              onClick={e => { e.preventDefault(); if (canNext) go(page + 1); }}
            >
              <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          ) : (
            <PaginationNext
              href="#"
              onClick={e => { e.preventDefault(); if (canNext) go(page + 1); }}
              aria-disabled={!canNext}
              className={!canNext ? 'pointer-events-none opacity-50' : ''}
            />
          ) }
        </PaginationItem>
        {!compact && !withSummary && (
          <PaginationItem>
            <div className="ml-2 hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
              Page {page} / {totalPages || 1}
              {typeof total === "number" && perPage ? ` · ${total} items` : ""}
            </div>
          </PaginationItem>
        )}
        {onPerPageChange && !compact && (
          <PaginationItem>
            <div className="ml-2 flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Rows:</span>
              <div className="min-w-[70px]">
                <AppSelect
                  value={String(perPage)}
                  onValueChange={(v) => onPerPageChange(Number(v))}
                  triggerClassName="h-7 w-[70px] px-2 text-xs"
                  disabled={disabled}
                >
                  {perPageOptions.map(opt => (
                    <AppSelect.Item key={opt} value={String(opt)}>{opt}</AppSelect.Item>
                  ))}
                </AppSelect>
              </div>
            </div>
          </PaginationItem>
        )}
      </PaginationContent>
    </ShadcnPagination>
  );

  if (!withSummary) return (
    <div className={cn("flex items-center gap-2", className)}>
      {core}
    </div>
  );

  const label = summaryLabel
    ? summaryLabel({ page, totalPages, total, perPage })
    : (() => {
      if (typeof total === 'number' && perPage) {
        if (total === 0) {
          return <div className="text-xs text-muted-foreground order-2 sm:order-1 flex-1 min-w-0 truncate">No items</div>;
        }
        const startItem = (page - 1) * perPage + 1;
        const endItem = Math.min(startItem + perPage - 1, total);
        return (
          <div className="text-xs text-muted-foreground order-2 sm:order-1 flex-1 min-w-0 truncate">
            Showing <span className="font-medium">{startItem}</span>–<span className="font-medium">{endItem}</span> of <span className="font-medium">{total}</span> items
          </div>
        );
      }
      return (
        <div className="text-xs text-muted-foreground order-2 sm:order-1 flex-1 min-w-0 truncate">
          Page {page} of {totalPages || 1}
        </div>
      );
    })();

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 text-sm", className)}>
      {label}
      <div className="order-1 sm:order-2 flex items-center gap-2 flex-shrink-0">{core}</div>
    </div>
  );
}
