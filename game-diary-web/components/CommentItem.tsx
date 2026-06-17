"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from "next-auth/react";
import ReactionPicker from './ReactionPicker';
import Link from 'next/link';
import { ArrowUp, Pin, CornerUpLeft, Copy, Trash2 } from 'lucide-react';
import { cn, maskNickname } from "@/src/lib/utils";
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Drawer, DrawerPopup, DrawerPanel } from '@/components/diary/Drawer';

const EMOJIS = ["👍", "❤️", "🔥", "🎮", "😮", "😂", "😢"];

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
  profiles?: any;
  onMobileReply?: (commentId: string, userName: string) => void;
  isActiveReply?: boolean;
  onOpenReactionDetail?: (commentId: string, initialEmoji: string) => void;
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
  displayNames = {},
  profiles = {},
  onMobileReply,
  isActiveReply = false,
  onOpenReactionDetail
}: CommentItemProps) {
  const { data: session }: any = useSession();
  const [showPicker, setShowPicker] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyInput] = useState("");
  const replyInputRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const iconScale = useTransform(x, [0, 50], [0.6, 1.15]);
  const iconOpacity = useTransform(x, [0, 40], [0, 1]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressed = useRef(false);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    isLongPressed.current = false;
    setIsPressing(true);
    longPressTimer.current = setTimeout(() => {
      isLongPressed.current = true;
      setIsMenuOpen(true);
      setIsPressing(false);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 600);
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    setIsPressing(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
    setIsPressing(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isLongPressed.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressed.current = false;
    }
  };

  // 이모지 반응 롱프레스 상태 관리
  const emojiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEmojiLongPressed = useRef(false);

  const startEmojiPress = (emoji: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    isEmojiLongPressed.current = false;
    emojiTimerRef.current = setTimeout(() => {
      isEmojiLongPressed.current = true;
      if (onOpenReactionDetail) {
        onOpenReactionDetail(comment.id, emoji);
      }
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500);
  };

  const endEmojiPress = (emoji: string, callback: () => void) => {
    if (emojiTimerRef.current) {
      clearTimeout(emojiTimerRef.current);
      emojiTimerRef.current = null;
    }
    if (!isEmojiLongPressed.current) {
      callback();
    }
  };

  const cancelEmojiPress = () => {
    if (emojiTimerRef.current) {
      clearTimeout(emojiTimerRef.current);
      emojiTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (isActiveReply && itemRef.current) {
      const timer = setTimeout(() => {
        itemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isActiveReply]);

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

  const uploaderProfile = profiles?.[comment.userId];
  const hasLoggedIn = !!uploaderProfile?.has_logged_in;
  const displayName = hasLoggedIn 
    ? (comment.user || 'Anonymous') 
    : maskNickname(comment.user || 'Anonymous');

  return (
    <div ref={itemRef} className={`flex flex-col scroll-my-2 ${isReply ? 'ml-0 mt-0.5' : 'mt-1'}`}>
      <div className={`relative ${isActiveReply || showReplyInput ? 'overflow-visible' : 'overflow-hidden rounded-lg'}`}>
        {/* Swipe Reply Icon Background */}
        {!isReply && (
          <div className="absolute inset-y-0 left-0 w-24 flex items-center pl-3 pointer-events-none z-0">
            <motion.div 
              style={{ scale: iconScale, opacity: iconOpacity }}
              className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary"
            >
              <CornerUpLeft className="w-3.5 h-3.5" strokeWidth={3} />
            </motion.div>
          </div>
        )}

        <motion.div 
          drag={!isReply ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.6 }}
          dragTransition={{ bounceStiffness: 300, bounceDamping: 28 }}
          style={{ x }}
          onDragEnd={(event, info) => {
            if (!isReply && x.get() > 50) {
              if (window.innerWidth < 768) {
                onMobileReply?.(comment.id, displayName);
                const input = document.getElementById('diary-comment-input') as HTMLInputElement;
                if (input) input.focus();
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate(30);
                }
              } else {
                setShowReplyInput(true);
                setTimeout(() => {
                  const input = replyInputRef.current?.querySelector('input');
                  if (input) input.focus();
                }, 100);
              }
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          onClickCapture={handleCardClick}
          className={`group flex items-start gap-3 py-2 transition-[background-color,box-shadow,opacity] duration-200 hover:bg-muted/50 select-none relative z-10 ${
            isPressing
              ? '-mx-4 px-4 scale-[0.97] bg-primary/15 shadow-inner rounded-none'
              : (showReplyInput || isActiveReply)
                ? '-mx-4 px-4 bg-primary/10 rounded-none border-l-4 border-primary'
                : isChecklist 
                  ? 'px-1 rounded-lg bg-primary/5'
                  : 'px-1 rounded-lg bg-transparent'
          }`}
        >
          {/* Avatar - Slightly larger than sidebar, but still compact */}
          <Link href={comment.userId ? `/profile/${comment.userId}` : "#"} className="shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-background border border-border/50 flex items-center justify-center shadow-sm transition-transform hover:scale-105 isolate">
              {comment.image ? (
                <img 
                  src={comment.image} 
                  className={cn("w-full h-full object-cover", !hasLoggedIn && "blur-xs scale-110")} 
                  alt="" 
                />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                  {displayName.charAt(0)}
                </div>
              )}
            </div>
          </Link>

          <div className="flex flex-col flex-1 min-w-0">
            {/* Header Line */}
            <div className="flex items-baseline gap-2 mb-0.5 min-w-0">
              <span className={`text-[12px] tracking-tight truncate ${selectedId === comment.id ? 'font-black' : 'font-bold'} ${isReply ? 'text-muted-foreground' : 'text-foreground'}`}>
                {displayName}
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
                  const reactorNames = users.map((uid: string) => {
                    const p = profiles?.[uid];
                    const reactorHasLoggedIn = !!p?.has_logged_in;
                    const name = p?.display_name || displayNames[uid] || "알 수 없음";
                    return reactorHasLoggedIn ? name : maskNickname(name);
                  }).join(", ");
                  return (
                    <div key={emoji} className="relative group/reaction">
                      <button
                        onMouseDown={(e) => startEmojiPress(emoji, e)}
                        onMouseUp={(e) => { e.stopPropagation(); endEmojiPress(emoji, () => onAddReaction(emoji)); }}
                        onMouseLeave={(e) => { e.stopPropagation(); cancelEmojiPress(); }}
                        onTouchStart={(e) => { e.stopPropagation(); startEmojiPress(emoji, e); }}
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); endEmojiPress(emoji, () => onAddReaction(emoji)); }}
                        onTouchMove={(e) => { e.stopPropagation(); cancelEmojiPress(); }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all border bg-primary/20 border-primary/30 text-primary hover:border-primary/50 select-none touch-none touch-callout-none"
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
                <button 
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      onMobileReply?.(comment.id, displayName);
                      const input = document.getElementById('diary-comment-input') as HTMLInputElement;
                      if (input) input.focus();
                    } else {
                      setShowReplyInput(!showReplyInput);
                    }
                  }} 
                  className="w-5 h-5 flex items-center justify-center rounded-md bg-card border border-border shadow-sm text-muted-foreground hover:text-primary transition-colors"
                >
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
        </motion.div>
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
              profiles={profiles}
            />
          ))}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput && (
        <div ref={replyInputRef} className="hidden md:flex ml-7 mt-1 mb-3 items-center gap-2 bg-white/40 p-1.5 rounded-none border border-border/50 focus-within:border-primary/30 transition-all">
          <input 
            type="text" 
            value={replyText} 
            onChange={(e) => setReplyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
            autoFocus
            placeholder="답글 남기기..." 
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] md:text-[12px] text-foreground placeholder:text-muted-foreground/40 px-1 font-medium"
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
      {/* Drawer Panel */}
      <Drawer open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DrawerPopup position="bottom" showBar className="bg-[#F4F5F6]" backdropClassName="backdrop-blur-none bg-black/15">
          <DrawerPanel scrollable={false} className="px-3 pb-6 pt-5 select-none font-sans h-[50vh] flex flex-col">
            {/* Emojis Reaction Bar (Separate white box matching the actions list) */}
            <div className="flex justify-around items-center p-2 bg-[#FFFFFF] rounded-xl mb-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onAddReaction(emoji);
                    setIsMenuOpen(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center text-[22px] rounded-lg hover:bg-primary/10 active:scale-90 transition-all cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions List (shadcn/ui style divided list) */}
            <div className="bg-[#FFFFFF] rounded-xl overflow-hidden divide-y divide-border/30">
              {/* Reply (Only if not a nested reply) */}
              {!isReply && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (window.innerWidth < 768) {
                      onMobileReply?.(comment.id, displayName);
                      const input = document.getElementById('diary-comment-input') as HTMLInputElement;
                      if (input) input.focus();
                    } else {
                      setShowReplyInput(true);
                      setTimeout(() => {
                        const input = replyInputRef.current?.querySelector('input');
                        if (input) input.focus();
                      }, 100);
                    }
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-semibold text-foreground/80 hover:bg-accent/40 transition-colors text-left font-sans"
                >
                  <CornerUpLeft className="w-4 h-4 text-foreground/60 shrink-0" strokeWidth={2.5} />
                  <span>답장하기</span>
                </button>
              )}

              {/* Copy */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigator.clipboard.writeText(comment.text);
                  alert("댓글 내용이 복사되었습니다.");
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-semibold text-foreground/80 hover:bg-accent/40 transition-colors text-left font-sans"
              >
                <Copy className="w-4 h-4 text-foreground/60 shrink-0" strokeWidth={2.5} />
                <span>댓글 복사</span>
              </button>

              {/* Toggle Checklist (Only for root comments and if author) */}
              {!isReply && isAuthor && (
                <button
                  onClick={async () => {
                    await onToggleChecklist?.();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-semibold text-foreground/80 hover:bg-accent/40 transition-colors text-left font-sans"
                >
                  <Pin className={`w-4 h-4 shrink-0 ${isChecklist ? 'text-primary rotate-45' : 'text-foreground/60'}`} strokeWidth={2.5} />
                  <span>{isChecklist ? "체크리스트 해제" : "체크리스트 등록 (상단 고정)"}</span>
                </button>
              )}

              {/* Delete (Only if author) */}
              {isAuthor && (
                <button
                  onClick={async () => {
                    if (window.confirm('삭제할까요?')) {
                      await onDelete?.();
                    }
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-500/5 transition-colors text-left font-sans"
                >
                  <Trash2 className="w-4 h-4 text-red-500 shrink-0" strokeWidth={2.5} />
                  <span>삭제하기</span>
                </button>
              )}
            </div>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>


    </div>
  );
}

// Dummy selectedId for internal logic consistency with sidebar style
const selectedId = ""; 
