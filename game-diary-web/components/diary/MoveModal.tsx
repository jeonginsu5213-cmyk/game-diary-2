"use client";

import React from 'react';
import { Gamepad2 } from 'lucide-react';

const MoveModal = ({ shot, onClose, onMove, games }: any) => {
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-popover w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden border border-border" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-foreground font-bold text-sm flex items-center gap-2">📂 이동 위치 선택</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto scrollbar-hide space-y-1">
          {games.map((g: any) => (
            <button 
              key={g.id} 
              onClick={() => onMove(g.title)}
              className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all flex items-center gap-2.5 ${shot.game_title === g.title ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
            >
              {g.icon_url ? (
                <img src={g.icon_url} className="w-4 h-4 object-contain shrink-0" alt="" />
              ) : (
                <Gamepad2 className="w-4 h-4 shrink-0 opacity-60" />
              )}
              <span className="truncate">{g.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoveModal;
