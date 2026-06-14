"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Custom Hook Integration ---

interface UseImageUploadProps {
  onUpload?: (file: File) => void;
}

export function useImageUpload({ onUpload }: UseImageUploadProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleThumbnailClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        onUpload?.(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onUpload],
  );

  // Drag & Drop Handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUpload?.(file);
    }
  }, [onUpload]);

  return {
    fileInputRef,
    isHovered,
    setIsHovered,
    isDragging,
    handleThumbnailClick,
    handleFileChange,
    onDragOver,
    onDragLeave,
    onDrop
  };
}

// --- Component ---

const UploadPlaceholder = ({ onFileSelect }: { onFileSelect: (file: File) => void }) => {
  const {
    fileInputRef,
    isHovered,
    setIsHovered,
    isDragging,
    handleThumbnailClick,
    handleFileChange,
    onDragOver,
    onDragLeave,
    onDrop
  } = useImageUpload({ onUpload: onFileSelect });

  const active = isHovered || isDragging;

  return (
    <div 
      onClick={handleThumbnailClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative aspect-video rounded-[6px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 group/upload ${
        active 
          ? 'bg-primary/10 shadow-sm' 
          : 'bg-black/5'
      }`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*" 
      />

      <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          active 
            ? 'text-white bg-primary scale-110 shadow-md shadow-primary/20' 
            : 'bg-[#dddfe2] text-[#6b7280]'
        }`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        
        <div className="text-center">
          <p className={`text-[11px] font-bold transition-colors ${active ? 'text-primary' : 'text-[#333333]'}`}>사진 추가</p>
          <p className="text-[9px] text-[#6b7280] hidden sm:block opacity-60">클릭하거나 파일을 드래그</p>
        </div>
      </div>
    </div>
  );
};

export default UploadPlaceholder;
