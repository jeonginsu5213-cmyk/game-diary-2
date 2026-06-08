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

  const normalComments = game.comments?.filter((c: any) => !c.is_checklist) || [];

  return (
    <div ref={scrollRef} className={`flex-1 overflow-y-auto px-0 pt-3 space-y-1 scroll-smooth ${hasScrollbarHide ? '' : 'custom-scrollbar'} ${className}`}>
      {normalComments.length > 0 ? (
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
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 space-y-2 italic">
          <MessageCircleMore className="w-8 h-8 opacity-20" />
          <p className="text-xs font-bold">No stories shared yet.</p>
        </div>
      )}
    </div>
  );
};

export default GameCommentList;
