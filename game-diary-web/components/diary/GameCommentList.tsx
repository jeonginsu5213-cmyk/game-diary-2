"use client";

import React, { useRef, useEffect } from 'react';
import { supabase } from "@/src/lib/supabase";
import CommentItem from '@/components/CommentItem';
import { MessageCircleMore, Pin } from 'lucide-react';
import { cn, maskNickname } from "@/src/lib/utils";

const GameCommentList = ({ 
  game, 
  profiles, 
  displayNamesMap, 
  handleAddReaction, 
  handleAddReply, 
  handleToggleChecklist,
  fetchData,
  className
}: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCommentsLength = useRef(game.comments?.length || 0);

  // 게임이 변경될 때 이전 댓글 길이를 초기화 (스크롤 방지)
  useEffect(() => {
    prevCommentsLength.current = game.comments?.length || 0;
  }, [game.id]);

  useEffect(() => {
    if (scrollRef.current) {
      const currentLength = game.comments?.length || 0;

      // 댓글이 새로 추가되었을 때만 스크롤 수행
      if (currentLength > prevCommentsLength.current) {
        // 가장 최근에 작성된 댓글 찾기
        const comments = game.comments || [];
        const latestComment = [...comments].sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        if (latestComment?.is_checklist) {
          scrollRef.current.scrollTop = 0;
        } else {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
      prevCommentsLength.current = currentLength;
    }
  }, [game.comments?.length, game.comments]);

  const hasScrollbarHide = className?.includes("scrollbar-hide");

  const checklistComments = game.comments?.filter((c: any) => c.is_checklist) || [];
  const normalComments = game.comments?.filter((c: any) => !c.is_checklist) || [];

  return (
    <div ref={scrollRef} className={`flex-1 overflow-y-auto px-2 pt-3 space-y-1 scroll-smooth ${hasScrollbarHide ? '' : 'custom-scrollbar'} ${className}`}>
      {/* Sticky Pinned Checklist Comments */}
      {checklistComments.length > 0 && (
        <div className="sticky top-0 z-20 bg-card pb-3 pt-1 border-b border-border/20 space-y-1.5 -mx-2 px-2">
          <div className="flex items-center gap-1 px-1 mb-1">
            <span className="text-[9px] font-black text-primary/75 tracking-widest uppercase flex items-center gap-1">
              <Pin className="w-2.5 h-2.5 rotate-45 text-primary" /> 고정 체크리스트
            </span>
          </div>
          <div className="space-y-1.5">
            {checklistComments.map((c: any) => {
              const hasLoggedIn = !!profiles?.[c.user_id]?.has_logged_in;
              const displayName = hasLoggedIn 
                ? (profiles?.[c.user_id]?.display_name || 'Anonymous') 
                : maskNickname(profiles?.[c.user_id]?.display_name || 'Anonymous');
              
              return (
                <div 
                  key={c.id} 
                  className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10 animate-in fade-in duration-300 group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Checkbox to toggle checklist */}
                    <button 
                      onClick={() => handleToggleChecklist(c.id, c.is_checklist, game.id)}
                      className="w-4 h-4 rounded-md border border-primary/30 flex items-center justify-center bg-primary/10 text-primary shrink-0 hover:bg-primary/20 transition-colors"
                      title="체크해제 (고정 해제)"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    
                    {/* Avatar */}
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-border/30 shrink-0">
                      {profiles?.[c.user_id]?.avatar_url ? (
                        <img 
                          src={profiles[c.user_id].avatar_url} 
                          className={cn("w-full h-full object-cover", !hasLoggedIn && "blur-xs scale-110")} 
                          alt="" 
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[8px] font-black text-primary uppercase">
                          {displayName.charAt(0)}
                        </div>
                      )}
                    </div>

                    <span className="text-[11px] font-medium text-foreground/90 truncate flex-1 leading-none">
                      <span className="font-bold text-foreground mr-1.5">{displayName}:</span>
                      {c.content}
                    </span>
                  </div>

                  {/* Delete button */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={async () => { 
                        if (window.confirm("삭제할까요?")) { 
                          await supabase.from('comments').delete().eq('id', c.id); 
                          fetchData(); 
                        } 
                      }}
                      className="text-[9px] font-bold text-muted-foreground/60 hover:text-red-500 transition-colors px-1"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Normal Comments */}
      {game.comments?.length > 0 ? (
        normalComments.length > 0 ? (
          normalComments.map((c: any) => (
            <CommentItem 
              key={c.id} 
              comment={{ ...c, userId: c.user_id, text: c.content, isChecklist: c.is_checklist, user: profiles[c.user_id]?.display_name || c.user_id, image: profiles[c.user_id]?.avatar_url, createdAt: c.created_at, reactions: c.reactions || {}, replies: c.replies || [] }}
              displayNames={displayNamesMap}
              profiles={profiles}
              onAddReaction={(emoji: string) => handleAddReaction(c.id, emoji)}
              onAddReply={(text: string) => handleAddReply(c.id, text)}
              onToggleChecklist={() => handleToggleChecklist(c.id, c.is_checklist, game.id)}
              onDelete={async () => { if(window.confirm("삭제할까요?")) { await supabase.from('comments').delete().eq('id', c.id); fetchData(); } }}
            />
          ))
        ) : (
          checklistComments.length > 0 ? null : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 space-y-2 italic">
              <MessageCircleMore className="w-8 h-8 opacity-20" />
              <p className="text-xs font-bold">No stories shared yet.</p>
            </div>
          )
        )
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 space-y-2 italic">
          <MessageCircleMore className="w-8 h-8 opacity-20" />
          <p className="text-xs font-bold">No stories shared yet.</p>
        </div>
      )}
    </div>
  );
};

export default GameCommentList;
