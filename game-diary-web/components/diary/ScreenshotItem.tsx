"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircleMore, FolderInput, Download, Trash2, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from "@/src/lib/supabase";
import { cn, maskNickname } from "@/src/lib/utils";

interface ScreenshotItemProps {
  shot: any;
  profiles: any;
  current: any;
  session: any;
  activeMoveShotId: string | null;
  setActiveMoveShotId: (id: string | null) => void;
  setActiveShot: (shot: any) => void;
  setHoveredShot: (shot: any | null) => void;
  handleDownload: (url: string) => void;
  handleImageDelete: (id: string) => void;
  fetchData: () => void;
  positionHint?: 'left' | 'right' | 'center';
  isNew?: boolean;
  isDrawer?: boolean;
  onMoveClick?: (shot: any) => void;
}

const ScreenshotItem = ({
  shot,
  profiles,
  current,
  session,
  isNew,
  activeMoveShotId,
  setActiveMoveShotId,
  setActiveShot,
  setHoveredShot,
  handleDownload,
  handleImageDelete,
  fetchData,
  positionHint = 'center',
  isDrawer = false,
  onMoveClick
}: ScreenshotItemProps) => {
  const [isActionsHovered, setIsActionsHovered] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (isDrawer) {
        setCoords({
          bottom: window.innerHeight - rect.top + 6,
          left: rect.right - 192,
        });
      } else {
        setCoords({
          top: rect.bottom + 6,
          left: rect.right - 192,
        });
      }
    }
  };

  useEffect(() => {
    if (activeMoveShotId === shot.id) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    } else {
      setCoords(null);
    }
  }, [activeMoveShotId, shot.id]);

  return (
    <motion.div 
      initial={isNew ? { scale: 0.8, opacity: 0 } : false}
      animate={isNew ? { 
        scale: [1, 1.05, 1],
        opacity: 1
      } : { opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative group aspect-video z-10 hover:z-30 transform-gpu"
      onMouseEnter={() => typeof window !== 'undefined' && window.innerWidth >= 768 && !isActionsHovered && setHoveredShot({ ...shot, positionHint, isDrawer })}
      onMouseLeave={() => {
        setActiveMoveShotId(null);
        setHoveredShot(null);
        setIsActionsHovered(false);
      }}
    >
      <div 
        className={`absolute inset-0 rounded-xl overflow-hidden border bg-card shadow-sm cursor-zoom-in transition-all duration-300 ${
          isNew ? 'border-primary ring-4 ring-primary/20 border-2 z-20' : 'border-border/50'
        }`} 
        style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
        onClick={() => setActiveShot(shot)}
      >
        <img 
          src={shot.url} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 will-change-transform" 
          alt="" 
        />
        
        {/* Thumbnail Info (Uploader & Comment Icon) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent p-2.5 flex flex-col justify-end pointer-events-none transition-opacity duration-300 group-hover:opacity-0 hidden md:flex">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-white">
            {(() => {
              const uploaderProfile = profiles?.[shot.uploader_id];
              const hasLoggedIn = !!uploaderProfile?.has_logged_in;
              const displayName = hasLoggedIn 
                ? (uploaderProfile?.display_name || 'Anonymous') 
                : maskNickname(uploaderProfile?.display_name || 'Anonymous');
              return (
                <>
                  <div className="w-4 h-4 rounded-full overflow-hidden border border-white/20 shadow-sm shrink-0">
                    <img 
                      src={uploaderProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`} 
                      className={cn(
                        "w-full h-full object-cover",
                        !hasLoggedIn && "blur-xs scale-110"
                      )} 
                      alt="" 
                    />
                  </div>
                  <span className="text-[10px] font-bold truncate opacity-90">{displayName}</span>
                </>
              );
            })()}
            </div>
            {shot.comment && (
              <div className="w-5 h-5 rounded-lg bg-primary/90 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/10">
                <MessageCircleMore className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {isNew && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: 1 }}
          className="absolute inset-0 rounded-xl bg-primary/20 pointer-events-none z-20"
        />
      )}
      
      <div 
        className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-[-4px] group-hover:translate-y-0 z-40"
        onMouseEnter={() => {
          setIsActionsHovered(true);
          setHoveredShot(null);
        }}
        onMouseLeave={() => {
          setIsActionsHovered(false);
          setHoveredShot(shot);
        }}
      >
        <div className="relative">
          <button 
            ref={buttonRef}
            onClick={(e) => { 
              e.stopPropagation(); 
              if (onMoveClick) {
                onMoveClick(shot);
              } else {
                setActiveMoveShotId(activeMoveShotId === shot.id ? null : shot.id); 
              }
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all backdrop-blur-md border ${activeMoveShotId === shot.id ? 'bg-primary text-white border-primary shadow-lg' : 'bg-black/40 text-white/80 border-white/10 hover:bg-black/60 hover:text-white'}`}
            title="이미지 이동"
          >
            <FolderInput className="w-3.5 h-3.5" />
          </button>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); handleDownload(shot.url); }}
          className="w-7 h-7 rounded-lg bg-black/40 text-white/80 border border-white/10 hover:bg-black/60 hover:text-white transition-all backdrop-blur-md flex items-center justify-center"
          title="이미지 다운로드"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {session?.user?.id === shot.uploader_id && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleImageDelete(shot.id); }}
            className="w-7 h-7 rounded-lg bg-black/40 text-white/80 border border-white/10 hover:bg-red-500 hover:text-white transition-all backdrop-blur-md flex items-center justify-center"
            title="이미지 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeMoveShotId === shot.id && coords && (
            <motion.div
              initial={{ opacity: 0, y: isDrawer ? 4 : -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isDrawer ? 4 : -4, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed z-[350] w-48 overflow-hidden rounded-xl bg-card border border-border shadow-2xl"
              style={{
                left: `${coords.left}px`,
                top: coords.top !== undefined ? `${coords.top}px` : undefined,
                bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-1 flex flex-col">
                <button 
                  onClick={() => {
                    supabase.from('screenshots').update({ game_title: null }).eq('id', shot.id).then(() => { fetchData(); setActiveMoveShotId(null); });
                  }}
                  className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-2 ${!shot.game_title ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                >
                  <FolderInput className="w-3.5 h-3.5 shrink-0 opacity-50" /> 분류되지 않은 순간들
                </button>
                {current.session_games?.map((g: any) => (
                  <button 
                    key={g.id}
                    onClick={() => {
                      supabase.from('screenshots').update({ game_title: g.title }).eq('id', shot.id).then(() => { fetchData(); setActiveMoveShotId(null); });
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-2 ${shot.game_title === g.title ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                  >
                    {g.icon_url ? (
                      <img src={g.icon_url} className="w-3.5 h-3.5 object-contain shrink-0" alt="" />
                    ) : (
                      <Gamepad2 className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    )}
                    <span className="truncate">{g.title}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};

export default ScreenshotItem;
