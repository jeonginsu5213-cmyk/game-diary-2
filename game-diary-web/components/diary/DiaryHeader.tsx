"use client";

import React, { useState } from 'react';
import { cn, formatDate, formatDurationText, formatTime } from "../../src/lib/utils";
import { Clock, Calendar } from 'lucide-react';
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
  viewMode
}) => {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);

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
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/70 backdrop-blur-xl sticky top-0 z-30">
      <div className="flex items-center gap-6 min-w-0 flex-1">
        {/* 1. Members & Title Section */}
        <div className="flex items-center gap-4 min-w-0">
          {current && (
            <div className="flex items-center shrink-0">
              <div className="flex items-center">
                {visibleParticipants.map((p: any, index: number) => {
                  const isObserver = !playedUsersSet.has(p.user_id);
                  const isHovered = hoveredMemberId === p.user_id;
                  const profile = profiles?.[p.user_id];
                  
                  return (
                    <div
                      key={p.user_id}
                      className="relative flex items-center justify-center transition-all duration-300"
                      onMouseEnter={() => setHoveredMemberId(p.user_id)}
                      onMouseLeave={() => setHoveredMemberId(null)}
                      style={{
                        marginLeft: index === 0 ? 0 : "-0.6rem",
                        zIndex: isHovered ? 100 : visibleParticipants.length - index,
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              scale: 1,
                              transition: { type: "spring", stiffness: 300, damping: 20 },
                            }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute top-10 whitespace-nowrap flex flex-col items-center justify-center rounded-xl bg-card/90 border border-border shadow-2xl px-4 py-2.5 z-[110] min-w-max backdrop-blur-2xl"
                          >
                            <div className="font-black text-foreground text-[13px] flex items-center gap-1.5 mb-0.5">
                              {profile?.display_name || 'Anonymous'}
                              {isObserver && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                  관전
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-black font-mono tracking-tight opacity-70">
                              {formatDurationText(p.duration_min || 0)}
                            </div>
                            {/* Arrow Pointer */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-card border-l border-t border-border rotate-45" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div
                        animate={isHovered ? { scale: 1.15 } : { scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <img 
                          src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.user_id}`} 
                          className={cn(
                            "w-7 h-7 rounded-full border-2 transition-all duration-300 object-cover",
                            isHovered ? "border-primary shadow-lg shadow-primary/20" : "border-card shadow-sm"
                          )} 
                          alt="" 
                        />
                      </motion.div>
                    </div>
                  );
                })}
                {remainingCount > 0 && (
                  <div className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-black text-muted-foreground z-0 ml-[-0.6rem] shadow-sm">
                    +{remainingCount}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative flex items-center gap-3 min-w-0 max-w-[400px]">
            {isEditingTitle ? (
              <input 
                type="text" 
                value={tempTitle} 
                onChange={(e) => onTitleChange(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && onTitleUpdate()} 
                onBlur={onTitleUpdate} 
                autoFocus 
                className="bg-background text-foreground font-black text-lg outline-none px-3 py-1 rounded-lg border border-primary/50 w-full transition-all focus:ring-4 focus:ring-primary/10" 
              />
            ) : (
              <h2 
                className="text-foreground font-black text-xl tracking-tight truncate cursor-pointer hover:text-primary transition-colors flex items-center gap-2 group" 
                onClick={onTitleClick}
              >
                {current?.sessionTitle || '기록을 선택해주세요'}
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </h2>
            )}
          </div>

          {current && (
            <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg border border-border/50 shrink-0">
              <Calendar className="w-3 h-3 opacity-40 text-foreground" />
              <span className="text-[11px] font-bold text-muted-foreground tabular-nums uppercase tracking-tight translate-y-[0.5px]">
                {formatDate(current.date)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {current && (
          <div className="flex items-center gap-4 border-r border-border pr-4 mr-2">
            {/* Session Active Time (No Background) */}
            <div className="flex items-center gap-2 shrink-0">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-wider tabular-nums">
                {formatTime(current.start_time)} — {formatTime(current.end_time)}
              </span>
            </div>
            {/* Total Duration */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-full border border-primary shadow-lg shadow-primary/10 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-[0.05em]">
                {formatDurationText(current.total_duration_min)}
              </span>
            </div>
          </div>
        )}

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
      </div>
    </header>
  );
};

export default DiaryHeader;
