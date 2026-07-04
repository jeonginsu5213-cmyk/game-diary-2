"use client";

import React from 'react';
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import BackgroundCanvas from '@/components/main/BackgroundCanvas';

export default function SignInPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      {/* Shared Interactive Background */}
      <BackgroundCanvas />

      {/* Back to Home Button (Top Left) */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute top-8 left-4 md:left-8 z-30"
      >
        <a 
          href="/" 
          className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all text-sm font-medium"
        >
          <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          메인으로 돌아가기
        </a>
      </motion.div>

      {/* Main Content Overlay */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6 bg-black/5">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[460px] bg-card/60 backdrop-blur-3xl border border-border/50 px-4 py-12 rounded-xl shadow-2xl relative overflow-hidden"
        >
          {/* Glass Reflection Highlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.3] via-transparent to-transparent pointer-events-none" />
          
          <div className="space-y-10 relative z-10">
            {/* Header Section */}
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-start">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xl font-bold text-foreground ml-2 tracking-tight">Game Diary</span>
              </div>
              <p className="text-muted-foreground font-medium text-[14px] leading-relaxed">
                디스코드 친구들과의 소중한 추억을 지금 확인해보세요.
              </p>
            </div>

            {/* Action Section */}
            <div className="flex flex-col gap-8">
              <motion.button
                whileHover="hover"
                whileTap={{ scale: 0.98 }}
                onClick={() => signIn('discord', { callbackUrl: '/diary' })}
                className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3 group"
              >
                <motion.svg 
                  className="w-6 h-6" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                  variants={{
                    hover: { rotate: [0, -10, 10, -10, 10, 0], transition: { duration: 0.5 } }
                  }}
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.077 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/></motion.svg>
                디스코드로 시작하기
              </motion.button>
              
              <p className="text-[11px] text-center text-muted-foreground px-2 whitespace-nowrap">
                로그인 시 Game Diary의 이용 약관 및 개인정보 처리방침에 동의하게 됩니다.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
