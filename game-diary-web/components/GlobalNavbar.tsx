"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

const NavLink = ({ href, children, active }: { href: string; children: React.ReactNode; active?: boolean }) => (
  <Link 
    href={href}
    className={cn(
      "relative group text-sm font-bold transition-all duration-200 py-1 px-1",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {children}
    <motion.div
      className={cn("absolute bottom-[-2px] left-0 right-0 h-[2px] bg-primary rounded-full", active ? "opacity-100" : "opacity-0")}
      initial={false}
      animate={{ scaleX: active ? 1 : 0, opacity: active ? 1 : 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    />
    {!active && (
      <motion.div
        className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-primary/40 rounded-full"
        variants={{ initial: { scaleX: 0, opacity: 0 }, hover: { scaleX: 1, opacity: 1 } }}
        initial="initial"
        whileHover="hover"
        transition={{ duration: 0.2 }}
      />
    )}
  </Link>
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

export default function GlobalNavbar() {
  const { data: session }: any = useSession();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  if (pathname === "/auth/signin") return null;

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={cn(
          "fixed top-4 left-0 right-0 z-[100] px-4 transition-all duration-500 font-sans"
        )}
      >
        <nav className={cn(
          "max-w-7xl mx-auto flex justify-between items-center px-6 h-[56px] transition-all duration-500",
          "bg-white/80 backdrop-blur-3xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-full",
          isScrolled && "shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-primary/10"
        )}>
          {/* Logo */}
          <Link href="/?landing=true" className="flex items-center gap-2.5 group transition-transform active:scale-95">
            <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 transition-transform group-hover:rotate-6">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-black text-[15px] tracking-tighter text-foreground uppercase">Plog</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-10">
            <NavLink href="/?landing=true" active={pathname === "/"}>홈</NavLink>
            <NavLink href="/diary" active={pathname.startsWith("/diary")}>일기장</NavLink>
            <NavLink href="/stats" active={pathname === "/stats"}>통계</NavLink>
          </div>

          {/* User / Auth */}
          <div className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-3 pr-1">
                <div className="flex flex-col text-right hidden sm:flex">
                  <span className="text-[11px] font-black text-foreground leading-none">{session.user?.name}</span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter mt-1">Player</span>
                </div>
                <button onClick={() => signOut()} className="w-9 h-9 rounded-full overflow-hidden border border-border shadow-sm hover:border-primary/40 transition-all cursor-pointer">
                  <img src={session.user?.image || ""} alt="" className="w-full h-full object-cover" />
                </button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => signIn('discord')}
                className="bg-primary text-primary-foreground px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 group"
              >
                시작하기
              </motion.button>
            )}

            {/* Mobile Menu Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            >
              {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </motion.button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden absolute top-full left-4 right-4 mt-2 p-6 bg-popover border border-border shadow-2xl rounded-3xl space-y-6 z-[90]"
            >
              <div className="flex flex-col gap-4 text-center">
                <NavLink href="/?landing=true" active={pathname === "/"}>홈</NavLink>
                <NavLink href="/diary" active={pathname.startsWith("/diary")}>일기장</NavLink>
                <NavLink href="/stats" active={pathname === "/stats"}>통계</NavLink>
              </div>
              <div className="pt-4 border-t border-border flex flex-col gap-4">
                {session ? (
                  <button onClick={() => signOut()} className="font-black text-destructive uppercase tracking-widest text-sm">로그아웃</button>
                ) : (
                  <button onClick={() => signIn('discord')} className="font-black text-primary uppercase tracking-widest text-sm">로그인</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
