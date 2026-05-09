"use client";

import React, { useState } from 'react';
import { useSession } from "next-auth/react";
import ReactionPicker from './ReactionPicker';
import Link from 'next/link';

interface CommentItemProps {
  comment: any;
  onAddReaction: (emoji: string) => void;
  onAddReactionReply?: (replyIdx: number, emoji: string) => void;
  onAddReply: (text: string) => void;
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
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.getFullYear() === date.getFullYear() && 
                      yesterday.getMonth() === date.getMonth() && 
                      yesterday.getDate() === date.getDate();

  const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (isSameDay) return `오늘 ${timeStr}`;
  if (isYesterday) return `어제 ${timeStr}`;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}.`;
};

export default function CommentItem({ 
  comment, 
  onAddReaction, 
  onAddReactionReply,
  onAddReply, 
  onDelete, 
  onDeleteReply,
  isReply = false,
  displayNames = {} 
}: CommentItemProps) {
  const { data: session }: any = useSession();
  const [showPicker, setShowPicker] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [replyText, setReplyInput] = useState("");

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
    <div className={`flex flex-col group ${isReply ? 'ml-10 mt-1' : 'mt-4'}`}>
      <div className={`flex items-start gap-4 p-1 rounded-md transition-colors hover:bg-black/10 relative ${isChecklist ? 'bg-discord-blue/10' : ''}`}>
        <Link href={comment.userId ? `/profile/${comment.userId}` : "#"} className="shrink-0 mt-0.5">
          <div className={`${isReply ? 'w-6 h-6' : 'w-10 h-10'} rounded-full overflow-hidden bg-discord-server-list`}>
            <img src={comment.image || ""} alt="" className="w-full h-full object-cover" />
          </div>
        </Link>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link href={comment.userId ? `/profile/${comment.userId}` : "#"} className="hover:underline flex items-center gap-1.5 min-w-0">
                <span className={`font-bold text-[14px] leading-tight truncate ${isReply ? 'text-discord-text-muted' : 'text-white'}`}>{comment.user}</span>
                {isChecklist && <span className="text-[9px] text-discord-blue font-black uppercase tracking-tighter shrink-0">Checklist</span>}
              </Link>
              <span className="text-[10px] text-discord-text-muted font-medium shrink-0 md:hidden mt-0.5">{formatCommentDate(comment.createdAt)}</span>
            </div>

            {/* Mobile Expandable Action Bar */}
            <div className="md:hidden flex items-center justify-end relative h-6 min-w-[24px]">
              {showMobileMenu ? (
                <div className="absolute right-0 z-30 flex items-center gap-0.5 bg-[#2B2D31] rounded-full pl-2 pr-1 py-0.5 border border-white/5 shadow-xl animate-in slide-in-from-right-4 fade-in duration-200 whitespace-nowrap">
                  <button onClick={() => { setShowPicker(!showPicker); setShowMobileMenu(false); }} className="text-discord-text-muted hover:text-white p-1.5 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  {!isReply && (
                    <button onClick={() => { setShowReplyInput(!showReplyInput); setShowMobileMenu(false); }} className="text-discord-text-muted hover:text-white p-1.5 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                  )}
                  {isAuthor && (
                    <button onClick={() => { setShowMobileMenu(false); if(window.confirm('정말로 삭제하시겠습니까?')) onDelete?.(); }} className="text-discord-text-muted hover:text-red-400 p-1.5 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                  <div className="w-px h-3 bg-white/10 mx-1" />
                  <button onClick={() => setShowMobileMenu(false)} className="text-discord-text-muted p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              ) : (
                <button onClick={() => setShowMobileMenu(true)} className="text-discord-text-muted hover:text-white p-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-baseline gap-2">
            <p className="text-[14px] leading-snug break-words text-discord-text-normal flex-1">{comment.text}</p>
          </div>

          <span className="hidden md:inline-block text-[10px] text-discord-text-muted font-medium mt-0.5">{formatCommentDate(comment.createdAt)}</span>
          
          {comment.reactions && Object.keys(comment.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(comment.reactions).map(([emoji, users]: [string, any]) => {
                const hasReacted = myId && users.includes(myId);
                return (
                  <div key={emoji} className="relative group/emoji">
                    <button
                      onClick={() => onAddReaction(emoji)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[12px] font-bold transition-all cursor-pointer border ${hasReacted ? 'bg-discord-blue/10 border-discord-blue text-discord-blue' : 'bg-[#2B2D31] border-transparent text-discord-text-muted hover:border-discord-text-muted/30'}`}
                    >
                      <span>{emoji}</span>
                      <span className={hasReacted ? 'text-discord-blue' : 'text-discord-text-normal'}>{users.length}</span>
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/emoji:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                      {users.map((uid: string) => displayNames[uid] || uid).join(', ')}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop Hover Action Bar */}
          <div className="hidden md:group-hover:flex absolute -top-4 right-2 items-center bg-discord-sidebar border border-black/20 rounded-[4px] overflow-hidden shadow-lg z-10">
            <button onClick={() => setShowPicker(!showPicker)} className="p-1.5 hover:bg-white/10 text-discord-text-muted hover:text-white transition-colors cursor-pointer" title="반응 추가"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
            {!isReply && <button onClick={() => setShowReplyInput(!showReplyInput)} className="p-1.5 hover:bg-white/10 text-discord-text-muted hover:text-white transition-colors cursor-pointer" title="답글"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>}
            {isAuthor && <button onClick={() => { if(window.confirm('정말로 삭제하시겠습니까?')) onDelete?.(); }} className="p-1.5 hover:bg-red-500/20 text-discord-text-muted hover:text-red-400 transition-colors cursor-pointer" title="삭제"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
          </div>

          {showPicker && (
            <div className="absolute z-20 mt-8 right-0">
              <ReactionPicker onSelect={(emoji) => { onAddReaction(emoji); setShowPicker(false); }} onClose={() => setShowPicker(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0.5">
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

      {showReplyInput && (
        <div className="ml-14 mt-1 flex items-center gap-3 p-2 bg-discord-server-list rounded-[8px] border border-black/10 shadow-inner group/reply-input font-sans">
          <input 
            type="text" 
            value={replyText} 
            onChange={(e) => setReplyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
            placeholder="답글 남기기..." 
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-discord-text-normal placeholder:text-discord-text-muted"
          />
          <button onClick={handleReplySubmit} className={`text-[12px] font-bold px-3 py-1 rounded-[4px] transition-colors ${replyText.trim() ? 'bg-discord-blue text-white' : 'bg-discord-sidebar text-discord-text-muted opacity-50 cursor-not-allowed'}`}>등록</button>
        </div>
      )}
    </div>
  );
}
