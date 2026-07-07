"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from "next-auth/react";
import { supabase } from "@/src/lib/supabase";
import { ArrowUp, Pin, X, Info } from 'lucide-react';

const GameCommentInput = ({ gameId, gameTitle, onComplete, activeReply, onCancelReply, onAddReply, isMobile }: any) => {
  const { data: session }: any = useSession();
  const [text, setText] = useState("");
  const [isChecklistMode, setIsChecklistMode] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 게임(또는 일기장)이 변경될 때 입력창 초기화
  React.useEffect(() => {
    setText("");
    setIsChecklistMode(false);
  }, [gameId]);

  // 답글 모드가 활성화될 때 체크리스트 모드 비활성화 및 입력창 포커싱
  React.useEffect(() => {
    if (activeReply) {
      setIsChecklistMode(false);
      inputRef.current?.focus();
    }
  }, [activeReply]);
  
  const handleSubmit = async (isChecklist = false) => {
    const finalChecklist = isChecklist || isChecklistMode;
    if (!text.trim() || !session) return;
    
    try {
      if (activeReply) {
        if (onAddReply) {
          await onAddReply(activeReply.commentId, text.trim());
        }
        setText("");
        if (onCancelReply) onCancelReply();
        return;
      }

      if (finalChecklist) {
        // 1인당 1개의 고정메세지만 허용하는 로직
        const { data: existingPins } = await supabase
          .from('comments')
          .select('id')
          .eq('game_id', gameId)
          .eq('user_id', session.user.id)
          .eq('is_checklist', true);

        if (existingPins && existingPins.length > 0) {
          if (!window.confirm("이미 고정된 메시지가 있습니다. 새로운 메시지로 교체하시겠습니까?")) {
            return;
          }
          // 기존 고정 메시지들 해제
          await supabase
            .from('comments')
            .update({ is_checklist: false })
            .eq('game_id', gameId)
            .eq('user_id', session.user.id)
            .eq('is_checklist', true);
        }
      }

      await supabase.from('comments').insert({
        game_id: gameId,
        user_id: session.user.id,
        content: text.trim(),
        is_checklist: finalChecklist,
        created_at: new Date().toISOString(),
        reactions: {},
        replies: []
      });
      setText("");
      setIsChecklistMode(false);
      onComplete?.();
    } catch (err) { console.error(err); }
  };

  if (!session) return null;

  return (
    <div className={`flex flex-col w-full overflow-hidden transition-all duration-300 rounded-xl ${isMobile ? 'bg-card shadow-xs' : 'bg-muted'}`}>
      <AnimatePresence initial={false}>
        {activeReply && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`overflow-hidden ${isMobile ? 'bg-muted/40' : 'bg-muted/80'}`}
          >
            <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
              <button 
                onClick={onCancelReply}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-muted-foreground/10 hover:bg-muted-foreground/20 text-muted-foreground transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <span className="text-[11px] font-bold leading-none">
                {activeReply.userName}님에게 답장하는 중
              </span>
            </div>
            <div 
              className="h-[1px] w-full opacity-40" 
              style={{ 
                background: 'linear-gradient(to right, transparent 0%, var(--border) 15%, var(--border) 85%, transparent 100%)' 
              }} 
            />
          </motion.div>
        )}
        {isChecklistMode && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-primary/10"
          >
            <div className="flex items-center gap-1.5 px-3 py-2">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] font-semibold text-primary leading-none">
                메시지를 상단에 고정하고 체크리스트로 활용할 수 있습니다.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
 
      <div className="flex items-center py-[10px] px-3.5 bg-transparent">
        {!activeReply && (
          <button 
            onClick={() => setIsChecklistMode(!isChecklistMode)}
            className={`flex items-center justify-center transition-all duration-300 ${isChecklistMode ? 'text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'} shrink-0 ml-1 mr-2.5`}
            title={isChecklistMode ? "고정 해제" : "상단 고정 (체크리스트)"}
          >
            <Pin className={`w-5 h-5 transition-transform duration-300 ${isChecklistMode ? 'rotate-45' : ''}`} strokeWidth={isChecklistMode ? 3 : 2.5} />
          </button>
        )}
        
        <input 
          ref={inputRef}
          id="diary-comment-input"
          type="text" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit(false)}
          placeholder={activeReply ? "답글 남기기..." : isChecklistMode ? "고정할 이야기 작성..." : "댓글을 남겨보세요."} 
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] md:text-[14px] text-foreground placeholder:text-muted-foreground/40 px-1.5 font-sans font-medium" 
        />
        
        <motion.button 
          animate={{ 
            width: text.trim() ? 32 : 0,
            marginLeft: text.trim() ? 10 : 0,
            scale: text.trim() ? 1 : 0.5, 
            opacity: text.trim() ? 1 : 0 
          }}
          style={{ overflow: 'hidden' }}
          whileHover={text.trim() ? { scale: 1.05 } : undefined}
          whileTap={text.trim() ? { scale: 0.95 } : undefined}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          onClick={() => handleSubmit(false)} 
          disabled={!text.trim()}
          className={`h-8 flex items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/20 shrink-0 mr-0.5 ${text.trim() ? 'pointer-events-auto' : 'pointer-events-none'}`}
          title="보내기"
        >
          <ArrowUp className="w-5 h-5" strokeWidth={3} />
        </motion.button>
      </div>
    </div>
  );
};

export default GameCommentInput;
