"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from "next-auth/react";
import { supabase } from "@/src/lib/supabase";
import { ArrowUp, Pin } from 'lucide-react';

const GameCommentInput = ({ gameId, gameTitle, onComplete }: any) => {
  const { data: session }: any = useSession();
  const [text, setText] = useState("");
  const [isChecklistMode, setIsChecklistMode] = useState(false);

  // 게임(또는 일기장)이 변경될 때 입력창 초기화
  React.useEffect(() => {
    setText("");
    setIsChecklistMode(false);
  }, [gameId]);
  
  const handleSubmit = async (isChecklist = false) => {
    const finalChecklist = isChecklist || isChecklistMode;
    if (!text.trim() || !session) return;
    
    try {
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
    <div className={`flex flex-col w-full overflow-hidden transition-all duration-300 border ${isChecklistMode ? 'border-primary shadow-lg shadow-primary/10' : 'border-border shadow-sm'} rounded-xl focus-within:border-primary/50`}>
      <AnimatePresence initial={false}>
        {isChecklistMode && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-primary"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-[11px] font-black text-white leading-none">
                메시지를 상단에 고정하고 체크리스트로 활용할 수 있습니다.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 p-2 bg-card">
        <button 
          onClick={() => setIsChecklistMode(!isChecklistMode)}
          className={`flex items-center justify-center transition-all duration-300 ${isChecklistMode ? 'text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'} shrink-0 ml-1`}
          title={isChecklistMode ? "고정 해제" : "상단 고정 (체크리스트)"}
        >
          <Pin className={`w-4 h-4 transition-transform duration-300 ${isChecklistMode ? 'rotate-45' : ''}`} strokeWidth={isChecklistMode ? 3 : 2.5} />
        </button>
        
        <input 
          type="text" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit(false)}
          placeholder={isChecklistMode ? "고정할 이야기 작성..." : "댓글을 남겨보세요."} 
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] md:text-[14px] text-foreground placeholder:text-muted-foreground/40 px-1 font-sans font-medium" 
        />
        
        <button 
          onClick={() => handleSubmit(false)} 
          disabled={!text.trim()}
          className={`w-7 h-7 flex items-center justify-center rounded-full transition-all shrink-0 ${text.trim() ? 'bg-primary text-white shadow-md shadow-primary/20 hover:scale-105 active:scale-95' : 'bg-muted text-muted-foreground/30 cursor-not-allowed'} mr-0.5`}
          title="보내기"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

export default GameCommentInput;
