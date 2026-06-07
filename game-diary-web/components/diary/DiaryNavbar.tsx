"use client";

import React, { useState } from 'react';
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import Link from 'next/link';

interface DiaryNavbarProps {
  session: any;
}

const DiaryNavbar: React.FC<DiaryNavbarProps> = ({ session }) => {
  return (
    <div className="fixed top-6 left-0 md:left-[72px] right-0 px-8 z-[100] flex justify-between items-center pointer-events-none transition-all">
      {/* 1. Floating Logo Button (Independent Island) */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto"
      >
        <Link 
          href="/?landing=true" 
          className="flex items-center gap-3 px-5 py-2.5 bg-card/80 backdrop-blur-2xl border border-border shadow-xl rounded-2xl hover:shadow-2xl hover:border-primary/30 transition-all group"
        >
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-black text-sm tracking-tighter text-foreground uppercase">Game Diary</span>
        </Link>
      </motion.div>

      {/* 2. Floating Profile Popover (Independent Island) */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto relative group"
      >
        <button className="flex items-center gap-2 p-1 bg-card/80 backdrop-blur-2xl border border-border shadow-xl rounded-full hover:border-primary/40 transition-all cursor-pointer overflow-hidden">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-border">
            <img 
              src={session?.user?.image || `https://api.dicebear.com/7.x/adventurer/svg?seed=${session?.user?.id}`} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="pr-3 pl-1 flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-foreground max-w-[80px] truncate">{session?.user?.name}</span>
            <svg className="w-3.5 h-3.5 text-muted-foreground transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Popover Content */}
        <div className="absolute top-full right-0 mt-3 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 ease-out z-[110]">
          <div className="w-48 bg-popover/90 backdrop-blur-3xl border border-border shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden p-2">
            <div className="px-3 py-2 border-b border-border/50 mb-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Signed in as</p>
              <p className="text-[12px] font-bold text-foreground truncate">@{session?.user?.username || session?.user?.name}</p>
            </div>
            <button 
              onClick={() => signOut()}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/10 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              로그아웃
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DiaryNavbar;
