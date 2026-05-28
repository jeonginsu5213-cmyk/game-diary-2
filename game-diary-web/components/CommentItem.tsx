"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from "next-auth/react";
import ReactionPicker from './ReactionPicker';
import Link from 'next/link';
import { ArrowUp, Pin } from 'lucide-react';

interface CommentItemProps {
  comment: any;
  onAddReaction: (emoji: string) => void;
  onAddReactionReply?: (replyIdx: number, emoji: string) => void;
  onAddReply: (text: string) => void;
  onToggleChecklist?: () => void;
  onDelete?: () => void;
  onDeleteReply?: (replyIdx: number) => void;
  isReply?: boolean;
  displayNames?: { [userId: string]: string };
}

const formatCommentDate = (isoString?: string) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const isSameDay = now.getFullYear() === date.getFullYear() && 
                    now.getMonth() === date.getMonth() && 
                    now.getDate() === date.getDate();
  
  if (isSameDay) return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

export default function CommentItem({ 
  comment, 
  onAddReaction, 
  onAddReactionReply,
  onAddReply, 
  onToggleChecklist,
  onDelete, 
  onDeleteReply,
  isReply = false,
  displayNames = {} 
}: CommentItemProps) {
  const { data: session }: any = useSession();
  const [showPicker, setShowPicker] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyInput] = useState("");
  const replyInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (replyInputRef.current && !replyInputRef.current.contains(event.target as Node)) {
        setShowReplyInput(false);
      }
    }
    if (showReplyInput) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showReplyInput]);

  const handleReplySubmit = () => {
    if (!replyText.trim()) return;
    onAddReply(replyText.trim());
    setReplyInput("");
    setShowReplyInput(false);
  };

  const myId = session?.user?.id;
  const isAuthor = myId && comment.userId === myId;
  const isChecklist = comment.isChecklist;

  return (
    <div className={`flex flex-col ${isReply ? 'ml-0 mt-0.5' : 'mt-1'}`}>
      <div 
        onMouseLeave={() => setShowPicker(false)}
        className={`group flex items-start gap-3 px-1 py-2 rounded-lg transition-all duration-200 hover:bg-muted/50 relative ${isChecklist ? 'bg-primary/5 border border-primary/10' : 'bg-transparent border border-transparent'}`}
      >
        {/* Avatar - Slightly larger than sidebar, but still compact */}
        <Link href={comment.userId ? `/profile/${comment.userId}` : "#"} className="shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-background border border-border/50 flex items-center justify-center shadow-sm transition-transform hover:scale-105">
            {comment.image ? (
              <img src={comment.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                {comment.user?.charAt(0)}
              </div>
            )}
          </div>
        </Link>

        <div className="flex flex-col flex-1 min-w-0">
          {/* Header Line */}
          <div className="flex items-baseline gap-2 mb-0.5 min-w-0">
            <span className={`text-[12px] tracking-tight truncate ${selectedId === comment.id ? 'font-black' : 'font-bold'} ${isReply ? 'text-muted-foreground' : 'text-foreground'}`}>
              {comment.user}
            </span>
            {isChecklist && <span className="text-[8px] text-primary font-black uppercase tracking-tighter opacity-70">Check</span>}
            <span className="text-[9px] font-mono tracking-tighter opacity-30 shrink-0">
              {formatCommentDate(comment.createdAt)}
            </span>
          </div>
          
          {/* Content Line */}
          <div className="flex items-baseline gap-2">
            <p className="text-[12px] leading-snug break-words text-foreground/80 flex-1">{comment.text}</p>
          </div>

          {/* Reactions Row */}
          {comment.reactions && Object.keys(comment.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(comment.reactions).map(([emoji, users]: [string, any]) => {
                const hasReacted = myId && users.includes(myId);
                const reactorNames = users.map((uid: string) => displayNames[uid] || "알 수 없음").join(", ");
                return (
                  <div key={emoji} className="relative group/reaction">
                    <button
                      onClick={() => onAddReaction(emoji)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all border ${hasReacted ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-transparent text-muted-foreground hover:border-border'}`}
                    >
                      <span>{emoji}</span>
                      <span>{users.length}</span>
                    </button>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover/reaction:opacity-100 pointer-events-none transition-all duration-200 transform translate-y-1 group-hover/reaction:translate-y-0 z-30">
                      <div className="bg-foreground/90 text-background text-[9px] px-2 py-1 rounded-lg whitespace-nowrap shadow-xl backdrop-blur-md font-bold border border-white/10">
                        {reactorNames}
                      </div>
                      <div className="w-1.5 h-1.5 bg-foreground/90 rotate-45 absolute -bottom-0.5 left-1/2 -translate-x-1/2" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Bar (Hover Only) */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 absolute right-2 -top-2.5 transition-opacity z-10">
            <button onClick={() => setShowPicker(!showPicker)} className="w-5 h-5 flex items-center justify-center rounded-md bg-card border border-border shadow-sm text-muted-foreground hover:text-primary transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            {!isReply && (
              <button onClick={() => setShowReplyInput(!showReplyInput)} className="w-5 h-5 flex items-center justify-center rounded-md bg-card border border-border shadow-sm text-muted-foreground hover:text-primary transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>
            )}
            {isAuthor && (
              <>
                {!isReply && (
                  <button 
                    onClick={onToggleChecklist} 
                    className={`w-5 h-5 flex items-center justify-center rounded-md bg-card border border-border shadow-sm transition-colors ${isChecklist ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                    title={isChecklist ? "고정 해제" : "상단 고정 (체크리스트)"}
                  >
                    <Pin className={`w-3 h-3 transition-transform ${isChecklist ? 'rotate-45' : ''}`} strokeWidth={3} />
                  </button>
                )}
                <button onClick={() => { if(window.confirm('삭제할까요?')) onDelete?.(); }} className="w-5 h-5 flex items-center justify-center rounded-md bg-card border border-border shadow-sm text-muted-foreground hover:text-destructive transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            )}
          </div>

          {showPicker && (
            <div className="absolute z-50 mt-2 right-0 origin-top-right">
              <ReactionPicker onSelect={(emoji) => { onAddReaction(emoji); setShowPicker(false); }} onClose={() => setShowPicker(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0.5 border-l border-border/50 ml-3.5 pl-2">
          {comment.replies.map((reply: any, idx: number) => (
            <CommentItem 
              key={idx} 
              comment={reply} 
              onAddReaction={(emoji) => onAddReactionReply?.(idx, emoji)} 
              onAddReply={() => {}} 
              onDelete={() => onDeleteReply?.(idx)} 
              isReply 
              displayNames={displayNames}
            />
          ))}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput && (
        <div ref={replyInputRef} className="ml-7 mt-1 mb-3 flex items-center gap-2 bg-white/40 p-1.5 rounded-none border border-border/50 focus-within:border-primary/30 transition-all">
          <input 
            type="text" 
            value={replyText} 
            onChange={(e) => setReplyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
            autoFocus
            placeholder="답글 남기기..." 
            className="flex-1 bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 px-1 font-medium"
          />
          <button 
            onClick={handleReplySubmit} 
            disabled={!replyText.trim()}
            className={`w-6 h-6 flex items-center justify-center rounded-full transition-all shrink-0 ${replyText.trim() ? 'bg-primary text-white shadow-sm hover:scale-105 active:scale-95' : 'bg-muted text-muted-foreground/30 cursor-not-allowed'} mr-0.5`}
            title="보내기"
          >
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>
      )}


    </div>
  );
}

// Dummy selectedId for internal logic consistency with sidebar style
const selectedId = ""; 
