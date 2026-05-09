"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const NavIcon = ({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) => (
  <div className="group relative flex items-center justify-center w-full">
    <div className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-300 ${active ? 'h-10' : 'h-0 group-hover:h-5'}`} />
    <Link 
      href={href}
      className={`w-12 h-12 flex items-center justify-center transition-all duration-300 shadow-lg ${
        active 
          ? 'bg-discord-blue text-white rounded-[15px]' 
          : 'bg-discord-sidebar text-discord-text-muted hover:bg-discord-blue hover:text-white rounded-[24px] hover:rounded-[15px]'
      }`}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        {icon}
      </div>
      <div className="absolute left-16 px-3 py-1 bg-black text-white text-xs font-bold rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
        {label}
        <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-black" />
      </div>
    </Link>
  </div>
);

export default function SidebarNav() {
  const pathname = usePathname();
  const { data: session }: any = useSession();
  const [toast, setToast] = useState<string | null>(null);

  const handleNotImplemented = (e: React.MouseEvent) => {
    e.preventDefault();
    setToast("아직 미구현이야..");
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <aside className="w-[72px] bg-discord-server-list flex flex-col items-center py-3 gap-2 shrink-0 h-full relative transition-transform duration-300 ease-in-out md:translate-x-0 [.mobile-view-active_&]:-translate-x-full [.mobile-view-active_&]:absolute [.mobile-view-active_&]:z-0">
      <NavIcon 
        href="/" 
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><path d="M12 6v12"></path><path d="M16 6v12"></path></svg>} 
        label="홈 (일기장)" 
        active={pathname === "/"} 
      />
      <div className="w-8 h-[2px] bg-discord-sidebar rounded-full my-1" />
      
      <div onClick={handleNotImplemented}>
        <NavIcon 
          href="/stats" 
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>} 
          label="통계" 
          active={pathname === "/stats"} 
        />
      </div>

      {session && (
        <div onClick={handleNotImplemented}>
          <NavIcon 
            href={`/profile/${session.user.id}`} 
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>} 
            label="내 프로필" 
            active={pathname.startsWith("/profile")} 
          />
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-[#232428] text-white px-4 py-2 rounded-[4px] shadow-2xl border border-white/10 font-bold text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}
    </aside>
  );
}

