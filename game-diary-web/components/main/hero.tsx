"use client";

import React, {
    useEffect,
    useState,
} from 'react';
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent,
    type Variants,
} from 'framer-motion';
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import RotatingText from './RotatingText';
import BackgroundCanvas from './BackgroundCanvas';

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

const ShinyText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => (
    <span className={cn("relative overflow-hidden inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm shadow-sm leading-none", className)}>
        <span className="relative z-10 pt-[2px]">{text}</span>
        <span style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
            animation: 'shine 2s infinite linear',
            opacity: 0.8,
            pointerEvents: 'none'
        }}></span>
        <style>{`
            @keyframes shine {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
        `}</style>
    </span>
);

const ChevronDownIcon = () => (
   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 ml-1 inline-block transition-transform duration-200 group-hover:rotate-180">
     <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
   </svg>
);

const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);

const NavLink = ({ href, children, hasDropdown }: { href: string; children: React.ReactNode; hasDropdown?: boolean }) => (
   <Link 
     href={href}
     className="relative group text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center py-1"
   >
     {children}
     {hasDropdown && <ChevronDownIcon />}
     {!hasDropdown && (
         <motion.div
           className="absolute bottom-[-2px] left-0 right-0 h-[1px] bg-primary"
           variants={{ initial: { scaleX: 0, originX: 0.5 }, hover: { scaleX: 1, originX: 0.5 } }}
           initial="initial"
           whileHover="hover"
           transition={{ duration: 0.3, ease: "easeOut" }}
         />
     )}
   </Link>
 );

const InteractiveHero: React.FC = () => {
   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
   const [isScrolled, setIsScrolled] = useState<boolean>(false);
   const { data: session } = useSession();

   const { scrollY } = useScroll();
   useMotionValueEvent(scrollY, "change", (latest) => {
       setIsScrolled(latest > 10);
   });

   useEffect(() => {
       if (isMobileMenuOpen) {
           document.body.style.overflow = 'hidden';
       } else {
           document.body.style.overflow = 'unset';
       }
       return () => { document.body.style.overflow = 'unset'; };
   }, [isMobileMenuOpen]);

   const headerVariants: Variants = {
       top: {
           backgroundColor: "rgba(232, 235, 237, 0)",
           borderBottomColor: "rgba(0, 0, 0, 0)",
           position: 'fixed',
           boxShadow: 'none',
       },
       scrolled: {
           backgroundColor: "rgba(232, 235, 237, 0.8)",
           borderBottomColor: "rgba(0, 0, 0, 0.05)",
           boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
           position: 'fixed'
       }
   };

   const mobileMenuVariants: Variants = {
       hidden: { opacity: 0, y: -20 },
       visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
       exit: { opacity: 0, y: -20, transition: { duration: 0.15, ease: "easeIn" } }
   };

    const contentDelay = 0.3;
    const itemDelayIncrement = 0.1;

    const bannerVariants = {
        hidden: { opacity: 0, y: -10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: contentDelay } }
    };
    const headlineVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement } }
    };
    const subHeadlineVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement * 2 } }
    };
    const actionVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement * 3 } }
    };
    const imageVariants: Variants = {

        hidden: { opacity: 0, scale: 0.95, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, delay: contentDelay + itemDelayIncrement * 5, ease: [0.16, 1, 0.3, 1] } }
    };

  return (
    <div className="pt-[100px] relative bg-background text-foreground w-full flex flex-col overflow-x-hidden font-sans pb-32">
        <BackgroundCanvas />

        <motion.header
            variants={headerVariants}
            initial="top"
            animate={isScrolled ? "scrolled" : "top"}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="px-6 w-full md:px-10 lg:px-16 sticky top-0 z-30 backdrop-blur-md border-b border-border/10"
        >
            <nav className="flex justify-between items-center max-w-screen-xl mx-auto h-[70px]">
                <div className="flex items-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-xl font-bold text-foreground ml-2 tracking-tight">Game Diary</span>
                </div>

                <div className="hidden md:flex items-center justify-center flex-grow space-x-6 lg:space-x-8 px-4">
                    <NavLink href="/">홈</NavLink>
                    <NavLink href="/diary">일기장</NavLink>
                    <NavLink href="/stats">통계</NavLink>
                </div>

                <div className="flex items-center flex-shrink-0 space-x-4 lg:space-x-6">
                    {session ? (
                        <button onClick={() => signOut()} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">로그아웃</button>
                    ) : (
                        <button onClick={() => signIn('discord')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">로그인</button>
                    )}

                    <motion.div
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                        <Link
                            href={session ? "/diary" : "/auth/signin"}
                            className="bg-primary text-primary-foreground px-4 py-[6px] rounded-lg text-sm font-semibold hover:opacity-90 transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-primary/20"
                        >
                            {session ? "일기 쓰러가기" : "시작하기"}
                        </Link>
                    </motion.div>

                    <motion.button
                        className="md:hidden text-muted-foreground hover:text-foreground z-50"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Toggle menu"
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    >
                        {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                    </motion.button>
                </div>
            </nav>

            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        key="mobile-menu"
                        variants={mobileMenuVariants} initial="hidden" animate="visible" exit="exit"
                        className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl shadow-lg py-6 border-t border-border/20"
                    >
                        <div className="flex flex-col items-center space-y-5 px-6">
                            <NavLink href="/">홈</NavLink>
                            <NavLink href="/diary">일기장</NavLink>
                            <NavLink href="/stats">통계</NavLink>
                            <hr className="w-full border-t border-border/20 my-2"/>
                            {session ? (
                                <button onClick={() => signOut()} className="text-sm font-bold text-muted-foreground hover:text-foreground">로그아웃</button>
                            ) : (
                                <button onClick={() => signIn('discord')} className="text-sm font-bold text-muted-foreground hover:text-foreground">로그인</button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>

        <main className="flex-grow flex flex-col items-center justify-center text-center px-4 pt-8 pb-16 relative z-10">

            <motion.div
                variants={bannerVariants}
                initial="hidden"
                animate="visible"
                className="mb-6"
            >
                <ShinyText text="우리들의 게임 추억, 특별하게 기록하세요" className="text-[14px] text-primary font-bold cursor-pointer hover:bg-primary/10 transition-colors" />
            </motion.div>

            <motion.h1
                variants={headlineVariants}
                initial="hidden"
                animate="visible"
                className="text-4xl sm:text-5xl lg:text-[64px] font-black text-foreground leading-tight max-w-4xl mb-4 tracking-tighter"
            >
                함께한 순간을 기록하는<br />{' '}
                <span className="inline-block h-[1.2em] sm:h-[1.2em] lg:h-[1.2em] overflow-hidden align-bottom">
                    <RotatingText
                        texts={['게임 일기', '스크린샷', '추억', '데이터', '즐거움']}
                        mainClassName="text-primary mx-1"
                        staggerFrom={"last"}
                        initial={{ y: "-100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "110%", opacity: 0 }}
                        staggerDuration={0.01}
                        transition={{ type: "spring", damping: 18, stiffness: 250 }}
                        rotationInterval={2200}
                        splitBy="characters"
                        auto={true}
                        loop={true}
                    />
                </span>
            </motion.h1>

            <motion.p
                variants={subHeadlineVariants}
                initial="hidden"
                animate="visible"
                className="text-[14px] sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
            >
                디스코드에서의 시간을 자동으로 기록하고 공유하세요.<br />
                함께 웃고 떠들던 그 순간들이 소중한 일기가 됩니다.
            </motion.p>

            <motion.div
                variants={actionVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto mb-24 md:mb-32"
            >
                {session ? (
                    <Link
                        href="/diary"
                        className="w-full sm:w-auto bg-primary text-primary-foreground px-10 py-4 rounded-xl text-lg font-bold hover:opacity-90 transition-all duration-200 whitespace-nowrap shadow-xl shadow-primary/20 flex-shrink-0 text-center"
                    >
                        내 일기장으로 이동
                    </Link>
                ) : (
                    <motion.button
                        whileHover="hover"
                        onClick={() => signIn('discord')}
                        className="w-full sm:w-auto bg-primary text-primary-foreground px-10 py-4 rounded-xl text-lg font-bold hover:opacity-90 transition-all duration-200 whitespace-nowrap shadow-xl shadow-primary/20 flex items-center justify-center gap-3 flex-shrink-0 group"
                    >
                        <motion.svg 
                            className="w-6 h-6" 
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                            variants={{
                                hover: { rotate: [0, -10, 10, -10, 10, 0], transition: { duration: 0.5 } }
                            }}
                        >
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.077 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.078.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/></motion.svg>
                        디스코드로 시작하기
                    </motion.button>
                )}
            </motion.div>

            <motion.div
                variants={imageVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-5xl mx-auto px-4 sm:px-0 mt-8"
            >
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-border/50 bg-white/40 backdrop-blur-3xl aspect-video flex items-center justify-center group/preview">
                    <div className="text-muted-foreground flex flex-col items-center space-y-6 relative z-10 transition-transform duration-700 group-hover/preview:scale-105">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-5xl animate-pulse shadow-lg shadow-primary/5 border border-primary/20">🎮</div>
                        <div className="space-y-2 text-center">
                            <p className="text-2xl font-black text-foreground tracking-tight">서비스 프리뷰 준비 중</p>
                            <p className="text-sm font-medium opacity-60">우리들의 소중한 게임 일기장이 곧 더 멋진 모습으로 찾아옵니다.</p>
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60"></div>
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
                </div>
            </motion.div>
        </main>

    </div>
  );
};

export default InteractiveHero;
