"use client";

import React from 'react';

const EMOJIS = ["👍", "❤️", "😂", "🔥", "🎮", "💩", "😮"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <div className="flex items-center gap-1 p-1.5 bg-[#1E1F22] border border-white/10 rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-100">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-full transition-colors cursor-pointer active:scale-90"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
