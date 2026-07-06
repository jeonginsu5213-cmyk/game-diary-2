"use client";

import React from 'react';
import { signIn, signOut } from "next-auth/react";
import { formatDate } from "../../src/lib/utils";

interface DiarySidebarProps {
  sessions: any[];
  selectedId: string | null;
  onDiarySelect: (id: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSidebarOpen: boolean;
  viewMode: 'list' | 'diary';
  session: any;
}

const DiarySidebar: React.FC<DiarySidebarProps> = ({
  sessions,
  selectedId,
  onDiarySelect,
  searchTerm,
  onSearchChange,
  isSidebarOpen,
  viewMode,
  session
}) => {
  // Matching Toss Developer Center Sidebar Spec (Width: 312px)
  return (
    <aside className={`fixed md:relative z-40 h-full bg-sidebar/40 border-r border-border flex flex-col font-sans transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[calc(100vw-72px)] md:w-[312px] shrink-0' : 'w-0 overflow-hidden'} ${viewMode === 'diary' ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
      <div className="h-14 flex items-center px-8 border-b border-border shrink-0">
        <h1 className="font-black text-[11px] tracking-[0.15em] text-muted-foreground uppercase truncate">게임 일기 목록</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-6">
        <div className="space-y-2">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">일기 검색</p>
          <div className="px-1">
            <input 
              type="text" 
              placeholder="검색어를 입력하세요..." 
              value={searchTerm} 
              onChange={(e) => onSearchChange(e.target.value)} 
              className="w-full bg-card/40 border border-border/50 rounded-xl px-4 py-2.5 text-[16px] md:text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/40" 
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2 mb-2">최근 기록 <span className="opacity-40 ml-1">({sessions.length})</span></p>
          {sessions.map(s => (
            <button 
              key={s.id} 
              onClick={() => onDiarySelect(s.id)} 
              className={`w-full text-left px-4 py-3.5 rounded-xl flex flex-col gap-0.5 transition-all border ${selectedId === s.id ? 'bg-card border-border shadow-sm text-foreground ring-1 ring-primary/10' : 'bg-transparent border-transparent text-muted-foreground hover:bg-card/40 hover:border-border/30 hover:text-foreground'}`}
            >
               <span className={`text-[12px] truncate tracking-tight ${selectedId === s.id ? 'font-semibold' : 'font-medium'}`}>{s.sessionTitle || s.title}</span>
               <span className="text-[10px] font-medium opacity-50 tracking-widest uppercase font-sans">{formatDate(s.date || s.start_time)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User Info Bar */}
      <div className="p-6 border-t border-border flex items-center gap-4 bg-card/20 backdrop-blur-sm">
        {session ? (
          <>
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-border shadow-sm ring-2 ring-background/50">
                <img src={session.user?.image || ""} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full z-10" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-black text-foreground truncate leading-none mb-1.5">{session.user?.name}</span>
              <span className="text-[10px] text-muted-foreground font-black tracking-[0.1em] uppercase opacity-60">Status: Online</span>
            </div>
            <button 
              onClick={() => signOut()} 
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer shrink-0"
              title="로그아웃"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </>
        ) : (
          <button onClick={() => signIn('discord')} className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-bold rounded-xl transition-all shadow-lg shadow-primary/10 uppercase tracking-widest">Login with Discord</button>
        )}
      </div>
    </aside>
  );
};

export default DiarySidebar;
