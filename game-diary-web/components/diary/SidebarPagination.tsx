"use client";

import { Pagination } from "@ark-ui/react/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarPaginationProps {
  totalCount: number;
  pageSize: number;
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function SidebarPagination({
  totalCount,
  pageSize,
  page,
  onPageChange,
  className,
}: SidebarPaginationProps) {
  if (totalCount <= pageSize) return null;

  return (
    <Pagination.Root
      count={totalCount}
      pageSize={pageSize}
      page={page}
      siblingCount={1}
      onPageChange={(details) => onPageChange(details.page)}
      className={cn("flex items-center justify-center gap-1 mt-6", className)}
    >
      <Pagination.PrevTrigger className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors data-disabled:opacity-20 data-disabled:cursor-not-allowed data-disabled:pointer-events-none">
        <ChevronLeft className="w-4 h-4" />
      </Pagination.PrevTrigger>

      <Pagination.Context>
        {(pagination) =>
          pagination.pages.map((pageObj, index) =>
            pageObj.type === "page" ? (
              <Pagination.Item
                key={index}
                {...pageObj}
                className="inline-flex items-center justify-center w-8 h-8 text-xs font-bold text-muted-foreground hover:bg-muted rounded-md transition-colors data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:bg-primary/90"
              >
                {pageObj.value}
              </Pagination.Item>
            ) : (
              <Pagination.Ellipsis
                key={index}
                index={index}
                className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground opacity-50"
              >
                &#8230;
              </Pagination.Ellipsis>
            )
          )
        }
      </Pagination.Context>

      <Pagination.NextTrigger className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors data-disabled:opacity-20 data-disabled:cursor-not-allowed data-disabled:pointer-events-none">
        <ChevronRight className="w-4 h-4" />
      </Pagination.NextTrigger>
    </Pagination.Root>
  );
}
