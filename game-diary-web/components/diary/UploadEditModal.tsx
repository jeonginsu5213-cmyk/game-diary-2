"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { supabase } from "@/src/lib/supabase";
import { X, ArrowRight, MessageSquare, Image as ImageIcon, Loader2, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';

const UploadEditModal = ({ file, sessionId, defaultGame = "", onClose, games, onComplete }: any) => {
  const { data: session }: any = useSession();
  const [comment, setComment] = useState("");
  const [selectedGame, setSelectedGame] = useState(defaultGame);
  const [isUploading, setIsUploading] = useState(false);
  const matchedGame = games?.find((g: any) => g.title === selectedGame);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleUpload = async () => {
    if (!session) return alert("로그인이 필요합니다.");
    setIsUploading(true);
    try {
      const fileName = `shots/${sessionId}_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('screenshots').getPublicUrl(fileName);

      const { data: insertedData, error: insertError } = await supabase.from('screenshots').insert({
        session_id: sessionId,
        url: publicUrl.publicUrl,
        uploader_id: session.user.id,
        comment: comment.trim(),
        game_title: selectedGame || null,
        created_at: new Date().toISOString()
      }).select().single();

      if (insertError) throw insertError;
      
      onComplete?.(insertedData.id);
      onClose();
    } catch (err) { alert("업로드에 실패했습니다."); }
    finally { setIsUploading(false); }
  };

  return (
    <div className={`fixed inset-0 z-[150] flex justify-center bg-black/40 backdrop-blur-md p-4 transition-all duration-300 ${
      isInputFocused ? 'items-start pt-4 md:items-center md:pt-4' : 'items-center pt-4'
    }`}>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="bg-[#ffffff] w-full max-w-[860px] max-h-[90vh] md:max-h-none overflow-y-auto md:overflow-visible rounded-[0.75rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col md:flex-row"
      >
          {/* Left: Preview Section */}
          <div className="w-full md:w-[55%] bg-[#f9fafb] border-b md:border-b-0 md:border-r border-[#dcdfe2] p-0 md:p-8 flex flex-col">
            <div className="hidden md:flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#e94a44]/10 flex items-center justify-center">
                <ImageIcon size={16} className="text-[#e94a44]" />
              </div>
              <span className="text-[14px] font-bold text-[#333333] tracking-tight">이미지 미리보기</span>
            </div>
            
            <div className="relative aspect-video w-full md:rounded-[0.75rem] overflow-hidden md:border border-[#dcdfe2] bg-[#111111]/70 backdrop-blur-md shadow-sm group">
              {previewUrl && (
                <img 
                  src={previewUrl} 
                  className="w-full h-full object-contain" 
                  alt="Preview" 
                />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />

              {/* Mobile-only close button floating on top-right of the image, wrapped in background */}
              <button 
                onClick={onClose}
                className="absolute top-3 right-3 md:hidden p-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all shadow-md z-20 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

        {/* Right: Info Section */}
        <div className="w-full md:w-[45%] p-4 md:p-8 flex flex-col bg-white">
          {/* Desktop header (hidden on mobile) */}
          <div className="hidden md:flex justify-between items-start mb-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-bold text-[#333333] tracking-tight leading-tight truncate">새로운 순간 기록</h2>
              <p className="text-[13px] text-[#6b7280] mt-1 truncate flex items-center gap-1.5">
                {matchedGame?.icon_url ? (
                  <img 
                    src={matchedGame.icon_url} 
                    className="w-5 h-5 object-contain shrink-0" 
                    alt="" 
                  />
                ) : (
                  <Gamepad2 size={16} className="text-[#e94a44]/85 shrink-0" />
                )}
                <span>{selectedGame || "분류되지 않은 순간"}에 기록됩니다.</span>
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-[#f3f4f6] rounded-full transition-colors text-[#6b7280] ml-4 shrink-0 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

            <div className="flex-1 flex flex-col">
            {/* Comment Input */}
            <div className="space-y-1.5 md:space-y-2 mb-2 md:mb-4 flex-1 flex flex-col">
              {/* Mobile-only target text above the comment input */}
              <div className="md:hidden text-[14px] font-bold text-[#333333] mb-2 flex items-center gap-1.5 pl-[2px]">
                {matchedGame?.icon_url ? (
                  <img 
                    src={matchedGame.icon_url} 
                    className="w-5 h-5 object-contain shrink-0" 
                    alt="" 
                  />
                ) : (
                  <Gamepad2 size={20} className="text-[#e94a44] shrink-0" />
                )}
                <span>{selectedGame || "분류되지 않은 순간"}에 기록됩니다.</span>
              </div>
              <label className="hidden md:flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-[#333333] uppercase tracking-wider">
                <MessageSquare size={13} className="text-[#e94a44]" />
                코멘트
              </label>
              <textarea 
                value={comment} 
                onChange={(e) => setComment(e.target.value)} 
                placeholder="이 순간을 기억할 수 있는 짧은 글을 남겨주세요."
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                className="w-full bg-[#f4f5f7] border-none p-3 md:p-4 rounded-[0.75rem] text-[13px] md:text-[14px] text-[#333333] focus:ring-2 focus:ring-[#e94a44]/20 transition-all placeholder:text-[#6b7280]/50 flex-1 min-h-[60px] md:min-h-[80px] resize-none font-medium leading-relaxed"
              />
            </div>

            {/* Action Button */}
            <button 
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full bg-[#e94a44] text-white py-3 md:py-4 rounded-[0.75rem] text-[15px] md:text-[16px] font-bold flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(233,74,68,0.15)] hover:shadow-[0_15px_30px_rgba(233,74,68,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {isUploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  기록 중...
                </>
              ) : (
                "업로드 완료"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadEditModal;
