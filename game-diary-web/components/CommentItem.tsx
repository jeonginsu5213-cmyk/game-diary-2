"use client";

import React, { useState } from 'react';
import { useSession } from "next-auth/react";
import ReactionPicker from './ReactionPicker';

interface CommentItemProps {
  comment: any;
  onAddReaction: (emoji: string) => void;
  onAddReply: (text: string) => void;
  isReply?: boolean;
}

export default function CommentItem({ comment, onAddReaction, onAddReply, isReply = false }: CommentItemProps) {
  const { data: session }: any = useSession();
  const [showPicker, setShowPicker] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyInput] = useState("");

  const handleReplySubmit = () => {
    if (!replyText.trim()) return;
    onAddReply(replyText.trim());
    setReplyInput("");
    setShowReplyInput(false);
  };

  const myId = session?.user?.id;

  return (
    <div className={`flex flex-col gap-2 ${isReply ? 'ml-8 mt-2' : 'mt-4'}`}>
      <div className="flex items-start gap-3 p-2 bg-[#F8F9FA] rounded-2xl border border-white font-sans transition-all hover:shadow-sm">
        <div className={`${isReply ? 'w-5 h-5' : 'w-7 h-7'} rounded-full overflow-hidden shrink-0 mt-0.5 border border-white shadow-sm font-sans`}>
          <img src={comment.image || ""} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col flex-1 font-sans">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 leading-none mb-1 font-sans">{comment.user}</span>
          </div>
          <p className={`${isReply ? 'text-[10px]' : 'text-[11px]'} font-bold leading-snug font-sans text-gray-700`}>{comment.text}</p>
          
          {/* Reactions Display */}
          {comment.reactions && Object.keys(comment.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(comment.reactions).map(([emoji, users]: [string, any]) => {
                const hasReacted = myId && users.includes(myId);
                return (
                  <button
                    key={emoji}
                    onClick={() => onAddReaction(emoji)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${hasReacted ? 'bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2] border' : 'bg-white border-slate-100 border text-gray-400 hover:bg-slate-50'}`}
                  >
                    <span>{emoji}</span>
                    <span>{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Comment Actions */}
          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => setShowPicker(!showPicker)}
              className="text-[9px] font-black text-gray-400 hover:text-[#1A1D1F] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              반응
            </button>
            {!isReply && (
              <button 
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-[9px] font-black text-gray-400 hover:text-[#1A1D1F] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                답글
              </button>
            )}
          </div>

          {/* Picker Popover */}
          {showPicker && (
            <div className="absolute z-10 mt-8">
              <ReactionPicker onSelect={onAddReaction} onClose={() => setShowPicker(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1">
          {comment.replies.map((reply: any, idx: number) => (
            <CommentItem key={idx} comment={reply} onAddReaction={() => {}} onAddReply={() => {}} isReply />
          ))}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput && (
        <div className="ml-8 mt-2 flex items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-100 shadow-inner group/reply-input font-sans">
          <input 
            type="text" 
            value={replyText}
            onChange={(e) => setReplyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
            placeholder="답글 남기기..." 
            className="flex-1 bg-transparent border-none outline-none text-[10px] font-bold text-gray-500 placeholder:text-gray-300"
          />
          <button 
            onClick={handleReplySubmit}
            className={`text-[9px] font-black px-2 py-1 rounded-lg transition-opacity cursor-pointer ${replyText.trim() ? 'bg-[#1A1D1F] text-white opacity-100' : 'bg-gray-100 text-gray-400 opacity-0 group-hover/reply-input:opacity-100'}`}
          >
            등록
          </button>
        </div>
      )}
    </div>
  );
}
