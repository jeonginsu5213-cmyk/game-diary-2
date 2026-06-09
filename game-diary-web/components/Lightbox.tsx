"use client";

import React, { useEffect } from 'react';

interface LightboxProps {
  imageUrl: string;
  onClose: () => void;
  uploader?: {
    name: string;
    avatar?: string;
    isBlurred?: boolean;
  };
  comment?: string;
}

export default function Lightbox({ imageUrl, onClose, uploader, comment }: LightboxProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-10 cursor-zoom-out"
      onClick={onClose}
    >
      <button 
        className="absolute top-6 right-6 z-[110] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer group"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div 
        className="relative max-w-full max-h-full flex flex-col items-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col items-start">
          <img 
            src={imageUrl} 
            alt="Full screen" 
            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/5"
          />
          
          {(uploader || comment) && (
            <div className="mt-6 w-full flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-500">
              {uploader && (
                <div className="w-6.5 h-6.5 md:w-8 md:h-8 rounded-full overflow-hidden border border-white/20 shadow-lg shrink-0 isolate">
                  <img 
                    src={uploader.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uploader.name}`} 
                    alt="" 
                    className={`w-full h-full object-cover ${uploader.isBlurred ? 'blur-xs scale-110' : ''}`}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 text-sm leading-normal break-words translate-y-[1px]">
                {uploader && (
                  <span className="font-black text-white mr-2 select-none">{uploader.name}</span>
                )}
                {comment && (
                  <span className="font-medium text-white/80 italic tracking-tight">
                    "{comment}"
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
