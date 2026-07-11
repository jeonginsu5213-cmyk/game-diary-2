"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn, formatDate, formatDurationText, formatTime, maskNickname } from "../../src/lib/utils";
import { Clock, Calendar, ChevronLeft, Users, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiaryHeaderProps {
  current: any;
  profiles: any;
  isEditingTitle: boolean;
  tempTitle: string;
  onTitleClick: () => void;
  onTitleChange: (value: string) => void;
  onTitleUpdate: () => void;
  onShare: () => void;
  onDelete: () => void;
  viewMode: 'list' | 'diary';
  isDeleted?: boolean;
}

const DiaryHeader: React.FC<DiaryHeaderProps> = ({
  current,
  profiles,
  isEditingTitle,
  tempTitle,
  onTitleClick,
  onTitleChange,
  onTitleUpdate,
  onShare,
  onDelete,
  viewMode,
  isDeleted = false
}) => {
  const router = useRouter();
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [isParticipantsDropdownOpen, setIsParticipantsDropdownOpen] = useState(false);

  // 1. Calculate played users (to identify observers)
  const playedUsersSet = React.useMemo(() => {
    if (!current?.session_games) return new Set();
    return new Set(
      current.session_games.flatMap((g: any) => 
        g.session_game_players?.map((p: any) => p.user_id) || []
      )
    );
  }, [current?.session_games]);

  // 2. Sort participants by duration
  const sortedParticipants = React.useMemo(() => {
    if (!current?.session_participants) return [];
    return [...current.session_participants].sort((a: any, b: any) => 
      (b.duration_min || 0) - (a.duration_min || 0)
    );
  }, [current?.session_participants]);

  const maxVisible = 4;
  const visibleParticipants = sortedParticipants.slice(0, maxVisible);
  const remainingCount = sortedParticipants.length - maxVisible;

  return (
    <header className="h-16 flex items-center justify-between px-4 bg-card/80 backdrop-blur-2xl sticky top-0 z-30">
      <div className="flex items-center gap-1.5 md:gap-6 min-w-0 flex-1">
        {/* 1. Members & Title Section */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          {/* Mobile Back Button */}
          {viewMode === 'diary' && (
            <button 
              onClick={() => router.push('/diary?view=list')}
              className="md:hidden p-0 text-muted-foreground hover:text-foreground shrink-0 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}
          {current && (
            <div className="relative shrink-0 hidden md:block">
              <button 
                onClick={() => setIsParticipantsDropdownOpen(!isParticipantsDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 active:scale-95 text-foreground rounded-lg border border-border/50 text-[12px] font-bold transition-all cursor-pointer select-none"
              >
                <Users className="w-3.5 h-3.5 opacity-60" />
                <span>{sortedParticipants.length}</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${isParticipantsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Content */}
              <AnimatePresence>
                {isParticipantsDropdownOpen && (
                  <>
                    {/* Click Outside Overlay (invisible) */}
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setIsParticipantsDropdownOpen(false)}
                    />
                    {/* Panel */}
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute top-10 left-0 w-64 bg-card border border-border shadow-2xl rounded-2xl p-4 z-50 flex flex-col gap-3 max-h-[300px] overflow-y-auto overscroll-contain"
                    >
                      <div className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider pl-0.5">
                        참여자 명단
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {sortedParticipants.map((p: any) => {
                          const isObserver = !playedUsersSet.has(p.user_id);
                          const profile = profiles?.[p.user_id];
                          const hasLoggedIn = !!profile?.has_logged_in;
                          const displayName = hasLoggedIn 
                            ? (profile?.display_name || 'Anonymous') 
                            : maskNickname(profile?.display_name || 'Anonymous');
                          
                          return (
                            <div key={p.user_id} className="flex items-center justify-between gap-3 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6.5 h-6.5 rounded-full border border-border overflow-hidden shrink-0">
                                  <img 
                                    src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.user_id}`} 
                                    className={cn("w-full h-full object-cover", !hasLoggedIn && "blur-xs scale-110")} 
                                    alt="" 
                                  />
                                </div>
                                <span className="text-[12px] font-bold text-foreground truncate">{displayName}</span>
                                {isObserver && (
                                  <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1 py-0.5 rounded-md shrink-0">
                                    관전
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-black text-muted-foreground/70 shrink-0 font-mono">
                                {formatDurationText(p.duration_min || 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Title Wrapper */}
          <div className="relative flex items-center gap-3 min-w-0 flex-1 md:flex-initial max-w-[240px] sm:max-w-[360px] md:max-w-[450px]">
            {isEditingTitle ? (
              <input 
                type="text" 
                value={tempTitle} 
                onChange={(e) => onTitleChange(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && onTitleUpdate()} 
                onBlur={onTitleUpdate} 
                autoFocus 
                className="bg-background text-foreground font-semibold text-xl tracking-tight outline-none px-3 py-1 rounded-lg w-full" 
              />
            ) : (
              <h2 
                className={cn(
                  "text-foreground font-semibold text-xl tracking-tight md:pl-0 min-w-0 truncate",
                  !isDeleted ? "cursor-pointer hover:text-primary transition-colors flex items-center gap-2 group" : ""
                )}
                onClick={!isDeleted ? onTitleClick : undefined}
              >
                <span className="truncate">{current?.sessionTitle || '기록을 선택해주세요'}</span>
                {current && !isDeleted && (
                  <svg className="w-3.5 h-3.5 text-muted-foreground/45 group-hover:text-primary transition-colors shrink-0 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </h2>
            )}
          </div>

          {current && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg border border-border/50 shrink-0">
              <Calendar className="w-3 h-3 opacity-40 text-foreground" />
              <span className="text-[11px] font-bold text-muted-foreground tabular-nums uppercase tracking-tight translate-y-[-0.5px]">
                {formatDate(current.date)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {current && (
          <div className="hidden md:flex items-center gap-4 border-r border-border pr-4 mr-2">
            {/* Session Active Time (No Background) */}
            <div className="flex items-center gap-2 shrink-0">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-wider tabular-nums">
                {formatTime(current.start_time)} - {formatTime(current.end_time)}
              </span>
            </div>
            {/* Total Duration */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-full border border-primary shrink-0 leading-none">
              <span className="text-[10px] font-black uppercase tracking-[0.05em] translate-y-[-0.5px] font-sans">
                {formatDurationText(current.total_duration_min)}
              </span>
            </div>
          </div>
        )}

        {!isDeleted && (
          <div className="flex items-center gap-2">
            <button 
              onClick={onShare} 
              className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all border border-transparent hover:border-primary/20 group" 
              title="공유"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
            </button>
            {current && (
              <button 
                onClick={onDelete} 
                className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all border border-transparent hover:border-destructive/20 group" 
                title="삭제"
              >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default DiaryHeader;
