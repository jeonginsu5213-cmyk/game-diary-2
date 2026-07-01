"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler]);
}

interface NotificationFilterDropdownProps {
  currentFilter: 'all' | 'unread';
  onFilterChange: (filter: 'all' | 'unread') => void;
  className?: string;
}

const FILTER_OPTIONS = [
  { id: 'all', name: '모든 알림' },
  { id: 'unread', name: '읽지 않은 알림만' },
] as const;

export default function NotificationFilterDropdown({
  currentFilter,
  onFilterChange,
  className,
}: NotificationFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const currentLabel = FILTER_OPTIONS.find(opt => opt.id === currentFilter)?.name || '모든 알림';

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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute top-[calc(100%+0.25rem)] right-0 z-50 w-36',
              'overflow-hidden rounded-lg',
              'bg-card',
              'shadow-lg shadow-black/5 border border-border/30'
            )}
          >
            <div className="flex flex-col p-1">
              {FILTER_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onFilterChange(item.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[12px] font-bold rounded-md transition-colors',
                    currentFilter === item.id 
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
