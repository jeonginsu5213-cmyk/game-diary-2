"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const navItems = [
    { name: "홈", href: "/" },
    { name: "통계", href: "/stats" },
  ];

  if (session?.user?.id) {
    navItems.push({ name: "내 프로필", href: `/profile/${session.user.id}` });
  }

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-[#1A1D1F] rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
            <span className="text-xl">📖</span>
          </div>
          <span className="text-lg font-black tracking-tighter text-[#1A1D1F]">GAME DIARY</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${pathname === item.href ? 'bg-[#1A1D1F] text-white shadow-md' : 'text-gray-500 hover:bg-slate-100'}`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {session ? (
          <div className="flex items-center gap-3 bg-slate-50 p-1 pr-4 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white shadow-sm">
              <img src={session.user?.image || ""} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black leading-none">{session.user?.name}님</span>
              <button 
                onClick={() => signOut()}
                className="text-[9px] font-bold text-gray-400 hover:text-red-500 text-left transition-colors cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => signIn('discord')}
            className="px-5 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-black rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
          >
            로그인
          </button>
        )}
      </div>
    </nav>
  );
}
