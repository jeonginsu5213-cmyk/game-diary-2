"use client";

import React from "react";
import { cn } from "@/src/lib/utils";
import {
    Gamepad2,
    Clock,
} from "lucide-react";

export interface BentoItem {
    title: string;
    description?: string;
    content?: React.ReactNode;
    icon?: React.ReactNode;
    status?: React.ReactNode;
    tags?: string[];
    meta?: string;
    cta?: string;
    colSpan?: number;
    hasPersistentHover?: boolean;
    isCommentSection?: boolean;
    className?: string;
}

interface BentoGridProps {
    items: BentoItem[];
}

function BentoGrid({ items }: BentoGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 pb-3 px-3 md:px-4 md:pt-4 md:pb-4 w-full items-stretch">
            {items.map((item, index) => (
                <div
                    key={index}
                    className={cn(
                        "group/card relative rounded-2xl overflow-hidden transition-all duration-300 flex flex-col h-auto md:h-full min-h-0",
                        item.colSpan === 3 && "md:h-auto",
                        item.isCommentSection ? "pt-5 px-3 pb-3 md:pt-6 md:px-4 md:pb-4" : "p-4 md:p-6",
                        "bg-card backdrop-blur-sm",
                        item.isCommentSection && "md:border md:border-border/50",
                        "max-md:hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-md:dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.02)]",
                        item.colSpan === 3 ? "md:col-span-3" : item.colSpan === 2 ? "md:col-span-2" : "md:col-span-1",
                        item.hasPersistentHover && "max-md:shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
                        item.className
                    )}
                >
                    {/* Background Pattern (Subtle dots, static) */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,93,56,1)_1px,transparent_1px)] bg-[length:24px_24px]" />
                    </div>

                    <div className="relative flex flex-col h-full min-h-0 z-0">
                        <div className={cn("flex items-start md:items-center gap-4 md:gap-6 mb-4 shrink-0 min-h-[40px] pt-0", item.isCommentSection && "px-2", item.colSpan === 3 && "md:pr-[400px]")}>
                            {item.icon && (
                                <div className="w-10 h-10 shrink-0 flex items-center justify-center transition-all duration-500">
                                    {item.icon}
                                </div>
                            )}
                            
                            <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4">
                                <div className="flex flex-col gap-1 md:flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <h3 className="font-semibold text-foreground tracking-tight text-lg truncate leading-normal">
                                            {item.title}
                                        </h3>
                                        {item.status && (
                                            <div className="md:hidden shrink-0 flex items-center">
                                                {item.status}
                                            </div>
                                        )}
                                    </div>
                                    {item.meta && (
                                        <div className={cn(
                                            "text-[10px] text-muted-foreground font-sans font-bold uppercase tracking-wider opacity-60 mt-[-1.5px]",
                                            item.colSpan === 3 && "md:hidden"
                                        )}>
                                            {item.meta}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center justify-end gap-3 shrink-0 md:items-center md:-mt-4">
                                    {item.meta && item.colSpan === 3 && (
                                        <div className="hidden md:flex items-center gap-1.5 text-[11.5px] text-muted-foreground font-sans font-bold uppercase tracking-wider opacity-60 shrink-0">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                            <span className="translate-y-[1px]">{item.meta}</span>
                                        </div>
                                    )}
                                    {item.status && (
                                        <div className="hidden md:flex shrink-0 items-center h-6 mt-1 md:mt-0">
                                            {item.status}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col min-h-0">
                            {item.description && (
                                <p className="text-sm text-muted-foreground leading-relaxed font-medium shrink-0">
                                    {item.description}
                                </p>
                            )}
                            {item.content && (
                                <div className="pt-2 flex-1 flex flex-col min-h-0">
                                    {item.content}
                                </div>
                            )}
                        </div>

                        {(item.tags?.length || item.cta) && (
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40 shrink-0">
                                <div className="flex items-center gap-2">
                                    {item.tags?.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/50"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                                {item.cta && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover/card:opacity-100 transition-all translate-x-2 group-hover/card:translate-x-0">
                                        {item.cta}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export { BentoGrid };
