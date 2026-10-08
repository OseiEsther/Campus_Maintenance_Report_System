'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface UsePaginationOptions {
  pageSize?: number;
  resetDeps?: unknown[];
}

export function usePagination<T>(
  items: T[],
  options?: UsePaginationOptions
) {
  const initialPageSize = options?.pageSize ?? 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, options?.resetDeps ?? []);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // If current page is beyond totalPages (e.g. list shrank), clamp it
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  // Synchronize state if needed
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, validPage, pageSize]);

  return {
    currentPage: validPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    paginatedItems,
  };
}

export interface DataPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
}

export function DataPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className,
  itemLabel = 'entries',
}: DataPaginationProps) {
  if (totalItems === 0) return null;

  const start = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const end = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart sliding window & ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        'flex flex-col gap-3 py-3 px-1 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground',
        className
      )}
    >
      {/* Left side: Range & optional Page Size selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] tabular-nums text-foreground/80">
          Showing <span className="font-semibold text-foreground">{start}</span> to{' '}
          <span className="font-semibold text-foreground">{end}</span> of{' '}
          <span className="font-semibold text-foreground">{totalItems}</span> {itemLabel}
        </span>

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
            <span className="text-[11px] text-muted-foreground">Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                onPageSizeChange(Number(val));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-7 w-[68px] text-[11px] px-2 bg-background border-border shadow-none">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right side: Navigation buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 self-center sm:self-auto">
          {/* First page button for > 5 pages */}
          {totalPages > 5 && (
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-xs border-border"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(1)}
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Previous page button */}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 text-xs border-border"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            title="Previous Page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, idx) =>
              p === 'ellipsis' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex h-7 w-7 items-center justify-center text-muted-foreground"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </span>
              ) : (
                <Button
                  key={`page-${p}`}
                  variant={p === currentPage ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'h-7 w-7 text-xs font-mono tabular-nums transition-colors',
                    p === currentPage
                      ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 font-bold border-transparent'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              )
            )}
          </div>

          {/* Next page button */}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 text-xs border-border"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            title="Next Page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          {/* Last page button for > 5 pages */}
          {totalPages > 5 && (
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-xs border-border"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(totalPages)}
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
