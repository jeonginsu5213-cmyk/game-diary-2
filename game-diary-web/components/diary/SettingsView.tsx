"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Bell, User, Monitor, Info, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface SettingsViewProps {
  onClose: () => void;
  session: any;
}

type SubViewType = 'menu' | 'notifications';

const pageVariants = {
  enter: (direction: number) => ({
    x: direction === 0 ? 0 : (direction > 0 ? '100%' : '-100%'),
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction === 0 ? 0 : (direction > 0 ? '-100%' : '100%'),
    opacity: 0,
  }),
};

const pageTransition = {
  x: { type: "spring", stiffness: 380, damping: 30 },
  opacity: { duration: 0.2 },
} as const;

export default function SettingsView({ onClose, session }: SettingsViewProps) {
  const [subView, setSubView] = useState<SubViewType>('menu');
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [pushEnabled, setPushEnabled] = useState(true);
  const [diaryAlert, setDiaryAlert] = useState(true);
  const [replyAlert, setReplyAlert] = useState(true);
  const [reactionAlert, setReactionAlert] = useState(true);
  const [dailyAlert, setDailyAlert] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleBack = () => {
    if (subView === 'menu') {
      onClose();
    } else {
      setDirection(-1);
      setSubView('menu');
    }
  };

  return (
    <div className="fixed inset-0 bg-background text-foreground z-50 flex flex-col font-sans">
      {/* Header */}
      <header className="h-12 pl-2 pr-4 flex items-center shrink-0">
        <button 
          onClick={handleBack}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
          title="뒤로가기"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2} />
        </button>
      </header>
      
      {/* Content */}
      <main className="flex-1 overflow-y-auto py-4 px-4 max-w-[1192px] w-full mx-auto pb-24">
        <div className="max-w-2xl mx-auto relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {subView === 'menu' && (
              <motion.div
                key="menu"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={pageTransition}
                className="flex flex-col gap-[10px] w-full"
              >
              {/* Card 1: 기본 설정 */}
              <div className="bg-card rounded-2xl p-6 flex flex-col gap-6">
                <button 
                  onClick={() => alert("언어 설정은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">언어</span>
                  <div className="flex items-center gap-1.5 text-[15px] font-semibold text-primary">
                    <span>한국어</span>
                    <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setDirection(1);
                    setSubView('notifications');
                  }}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">알림</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>

                <button 
                  onClick={() => alert("화면 테마 설정은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">화면 테마 · 진동</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>

                <button 
                  onClick={() => alert("연락처 관리 기능은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">연락처 관리</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>
              </div>

              {/* Card 2: 인증 및 보안 */}
              <div className="bg-card rounded-2xl p-6 flex flex-col gap-6">
                <div>
                  <h4 className="text-[15px] font-bold text-foreground">인증 및 보안</h4>
                </div>

                <button 
                  onClick={() => alert("인증서 관리 기능은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">인증서</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>

                <button 
                  onClick={() => alert("비밀번호 설정 기능은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">비밀번호 · 보안</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>

                <button 
                  onClick={() => alert("디스크로 로그인한 서비스 리스트 기능은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">디스코드로 로그인한 서비스</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>
              </div>

              {/* Card 3: 일기 및 데이터 관리 */}
              <div className="bg-card rounded-2xl p-6 flex flex-col gap-6">
                <div>
                  <h4 className="text-[15px] font-bold text-foreground">일기 및 데이터 관리</h4>
                </div>

                <button 
                  onClick={() => alert("내보낸 일기 데이터 기능은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">내보낸 일기 데이터 관리</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>

                <button 
                  onClick={() => alert("증명서 기능은 준비 중입니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">증명서 발급</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>
              </div>

              {/* Card 4: 고객 지원 및 정보 */}
              <div className="bg-card rounded-2xl p-6 flex flex-col gap-6">
                <div>
                  <h4 className="text-[15px] font-bold text-foreground">고객 지원 및 정보</h4>
                </div>

                <button 
                  onClick={() => setIsHelpOpen(true)}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">도움말 및 지원</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>

                <button 
                  onClick={() => alert("오픈소스 라이선스는 v1.0.0 MIT 라이선스를 준수합니다.")}
                  className="w-full text-left flex items-center justify-between gap-4 outline-none cursor-pointer group"
                >
                  <span className="text-[15px] font-semibold text-foreground">오픈소스 라이선스</span>
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>

                <div className="w-full flex items-center justify-between gap-4 select-none">
                  <span className="text-[15px] font-semibold text-foreground">버전 정보</span>
                  <span className="text-[15px] font-semibold text-muted-foreground/60">v1.0.0</span>
                </div>
              </div>
            </motion.div>
          )}

          {subView === 'notifications' && (
            <motion.div
              key="notifications"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={pageTransition}
              className="flex flex-col gap-5 w-full"
            >
              {/* Header Title Area (IMG_4518.PNG Style) */}
              <div className="flex flex-col px-1">
                <h2 className="text-[20px] font-bold text-foreground tracking-tight">
                  알림 설정
                </h2>
                <p className="text-[13px] text-muted-foreground/80 mt-2">
                  여기서 끄면 비슷한 내용의 알림은 보내지 않아요.
                </p>
              </div>

              {/* Cards List: Each option is a standalone card without borders/shadows */}
              <div className="flex flex-col gap-[10px]">
                
                {/* 1. 웹 알림 수신 */}
                <div className="bg-card rounded-2xl py-3 px-5 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-foreground">웹 알림 수신</span>
                    <span className="text-[12px] text-muted-foreground leading-relaxed">기기에서 웹 알림을 수신합니다.</span>
                  </div>
                  <button 
                    onClick={() => setPushEnabled(!pushEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 focus:outline-none shrink-0 cursor-pointer ${pushEnabled ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${pushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* 2. 일기장 생성 알림 */}
                <div className={`bg-card rounded-2xl py-3 px-5 flex items-center justify-between gap-4 transition-opacity duration-200 ${pushEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-foreground">일기장 생성 알림</span>
                    <span className="text-[12px] text-muted-foreground leading-relaxed">새로운 일기장이 생성되면 알려줍니다.</span>
                  </div>
                  <button 
                    onClick={() => setDiaryAlert(!diaryAlert)}
                    disabled={!pushEnabled}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 focus:outline-none shrink-0 cursor-pointer ${diaryAlert ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${diaryAlert ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* 3. 답글 알림 */}
                <div className={`bg-card rounded-2xl py-3 px-5 flex items-center justify-between gap-4 transition-opacity duration-200 ${pushEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-foreground">답글 알림</span>
                    <span className="text-[12px] text-muted-foreground leading-relaxed">내 댓글에 새로운 답글이 달리면 알려줍니다.</span>
                  </div>
                  <button 
                    onClick={() => setReplyAlert(!replyAlert)}
                    disabled={!pushEnabled}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 focus:outline-none shrink-0 cursor-pointer ${replyAlert ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${replyAlert ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* 4. 반응(이모지) 알림 */}
                <div className={`bg-card rounded-2xl py-3 px-5 flex items-center justify-between gap-4 transition-opacity duration-200 ${pushEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-foreground">반응(이모지) 알림</span>
                    <span className="text-[12px] text-muted-foreground leading-relaxed">내 댓글에 이모지 반응이 달리면 알려줍니다.</span>
                  </div>
                  <button 
                    onClick={() => setReactionAlert(!reactionAlert)}
                    disabled={!pushEnabled}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 focus:outline-none shrink-0 cursor-pointer ${reactionAlert ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${reactionAlert ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </main>

      {/* 도움말 및 지원 모달 (설정 전용 임시 팝업) */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-64 overflow-hidden rounded-xl bg-card/75 dark:bg-card/45 backdrop-blur-2xl border border-white/20 dark:border-border/35 p-4 shadow-2xl shadow-black/10 flex flex-col items-center text-center gap-4 z-10"
            >
              <p className="text-[12px] text-muted-foreground whitespace-pre-line leading-relaxed my-2">
                <span className="font-bold text-foreground">꼬우면 전화해</span>{"\n"}
                <span className="font-mono font-bold text-foreground text-[13px]">010-7109-8131</span>
              </p>
              <div className="flex flex-col w-full gap-1.5">
                <a 
                  href="tel:010-7109-8131"
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground font-bold text-[12px] shadow-md shadow-primary/10 hover:bg-primary/90 active:scale-98 transition-all"
                >
                  <span>전화걸기</span>
                </a>
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="w-full py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground font-bold text-[12px] active:scale-98 transition-all"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
