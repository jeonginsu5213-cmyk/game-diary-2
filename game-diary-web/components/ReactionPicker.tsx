"use client";

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const EMOJIS = ["👍", "❤️", "🔥", "🎮", "😮", "😂", "😢"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <motion.div 
      ref={pickerRef}
      initial={{ opacity: 0, scale: 0.9, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="flex items-center gap-1 p-1.5 bg-card/95 backdrop-blur-xl rounded-full shadow-xl"
    >
      {EMOJIS.map((emoji, index) => (
        <motion.button
          key={emoji}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.03 }}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center text-[18px] hover:bg-primary/10 rounded-full transition-all cursor-pointer active:scale-90 hover:scale-110"
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}
