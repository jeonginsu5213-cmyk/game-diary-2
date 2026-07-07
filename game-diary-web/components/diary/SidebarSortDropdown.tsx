"use client";

import React, { useState, useRef, useEffect, FC, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [ref, handler]);
}

interface SidebarSortDropdownProps {
  currentSort: string;
  onSortChange: (sort: 'desc' | 'asc' | 'playtime' | 'favorites') => void;
  className?: string;
}

const SORT_OPTIONS = [
  { id: 'desc', name: '최신순' },
  { id: 'asc', name: '오래된순' },
  { id: 'playtime', name: '플레이시간순' },
  { id: 'favorites', name: '즐겨찾기' },
] as const;

export default function SidebarSortDropdown({
  currentSort,
  onSortChange,
  className,
}: SidebarSortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const currentLabel = SORT_OPTIONS.find(opt => opt.id === currentSort)?.name || '최신순';

  return (
    <div ref={wrapperRef} className={cn('relative inline-block', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 text-[12px] font-bold text-muted-foreground hover:text-primary transition-all duration-200 group outline-none",
          isOpen && "text-primary"
        )}
      >
        <span className={cn("opacity-40 group-hover:opacity-100 transition-opacity", isOpen && "opacity-100")}>
          {currentLabel}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={cn("opacity-40 group-hover:opacity-100 transition-opacity", isOpen && "opacity-100")}
        >
          <ChevronDown className='h-3 w-3' strokeWidth={2.5} />
        </motion.div>
      </button>

      {/* Mobile-only native select overlay */}
      <select
        value={currentSort}
        onChange={(e) => onSortChange(e.target.value as any)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full md:hidden z-20"
        style={{ WebkitAppearance: 'none' }}
      >
        {SORT_OPTIONS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute top-[calc(100%+0.25rem)] right-0 z-50 w-32',
              'overflow-hidden rounded-lg',
              'bg-card',
              'shadow-lg shadow-black/5'
            )}
          >
            <div className="flex flex-col p-1">
              {SORT_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSortChange(item.id as any);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[12px] font-bold rounded-md transition-colors',
                    currentSort === item.id 
                      ? 'bg-primary/5 text-primary' 
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
