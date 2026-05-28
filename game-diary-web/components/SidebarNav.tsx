"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const NavIcon = ({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) => (
  <div className="group relative flex items-center justify-center w-full">
    <div className={`absolute left-0 w-1.5 bg-primary rounded-r-full transition-all duration-500 ease-out ${active ? 'h-8 opacity-100' : 'h-0 opacity-0 group-hover:h-4 group-hover:opacity-50'}`} />
    <Link 
      href={href}
      className={`w-12 h-12 flex items-center justify-center transition-all duration-300 shadow-xl ${
        active 
          ? 'bg-primary text-primary-foreground rounded-[14px]' 
          : 'bg-card/40 text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded-[24px] hover:rounded-[14px] border border-white/5'
      }`}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        {icon}
      </div>
      <div className="absolute left-16 px-3 py-1.5 bg-popover/90 backdrop-blur-xl text-foreground text-[11px] font-black uppercase tracking-widest rounded-lg border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-50 pointer-events-none scale-90 group-hover:scale-100 origin-left">
        {label}
        <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-white/10" />
      </div>
    </Link>
  </div>
);

export default function SidebarNav() {
  const pathname = usePathname();
  const { data: session }: any = useSession();
  const [toast, setToast] = useState<string | null>(null);

  // Do not show sidebar on the landing page or auth page
  if (pathname === "/" || pathname === "/auth/signin") return null;

  return (
    <aside className="w-[72px] bg-[#09090b]/80 backdrop-blur-3xl border-r border-white/5 flex flex-col items-center py-5 gap-3 shrink-0 h-full relative transition-all duration-300 ease-in-out md:translate-x-0 [.mobile-view-active_&]:-translate-x-full [.mobile-view-active_&]:absolute [.mobile-view-active_&]:z-0 shadow-2xl">
      <NavIcon 
        href="/diary" 
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><path d="M12 6v12"></path><path d="M16 6v12"></path></svg>} 
        label="일기장" 
        active={pathname === "/diary"} 
      />
      <div className="w-8 h-[1.5px] bg-white/5 rounded-full my-1.5" />
      
      <NavIcon 
        href="/stats" 
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>} 
        label="통계" 
        active={pathname === "/stats"} 
      />

      {session && (
        <NavIcon 
          href={`/profile/${session.user.id}`} 
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>} 
          label="내 프로필" 
          active={pathname.startsWith("/profile")} 
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-popover/90 backdrop-blur-2xl text-foreground px-6 py-2.5 rounded-2xl shadow-2xl border border-white/10 font-bold text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          {toast}
        </div>
      )}
    </aside>
  );
}

