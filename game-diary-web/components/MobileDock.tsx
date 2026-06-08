"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { List, BookOpen, Home } from "lucide-react";

function DockContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Hide dock on signin page
  if (pathname === "/auth/signin") {
    return null;
  }

  const viewParam = searchParams.get('view') || 'list';
  const isLanding = pathname === "/" || searchParams.get('landing') === 'true';

  const navItems = [
    {
      href: "/diary?view=list",
      icon: <List className="w-[22px] h-[22px]" strokeWidth={2} />,
      label: "일기 목록",
      active: pathname === "/diary" && viewParam === "list",
    },
    {
      href: "/diary?view=diary",
      icon: <BookOpen className="w-[22px] h-[22px]" strokeWidth={2} />,
      label: "일기장",
      active: pathname === "/diary" && viewParam === "diary",
    },
    {
      href: "/?landing=true",
      icon: <Home className="w-[22px] h-[22px]" strokeWidth={2} />,
      label: "메인화면",
      active: isLanding,
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/30 rounded-t-[24px] w-full h-[88px] pb-safe flex items-start pt-3 justify-around px-4 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] select-none">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex flex-col items-center justify-center gap-1 py-1 flex-1 transition-all active:scale-95"
        >
          <div
            className={`flex items-center justify-center transition-colors duration-250 ${
              item.active ? "text-primary" : "text-[#b0b8c1]"
            }`}
          >
            {item.icon}
          </div>
          <span
            className={`text-[10px] font-medium tracking-tight transition-colors ${
              item.active ? "text-primary font-bold" : "text-[#8b95a1]"
            }`}
          >
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function MobileDock() {
  return (
    <Suspense fallback={null}>
      <DockContent />
    </Suspense>
  );
}
