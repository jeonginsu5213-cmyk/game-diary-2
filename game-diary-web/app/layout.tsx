import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "./SessionProviderWrapper";
import SidebarNav from "../components/SidebarNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "🎮 Game Diary - 우리들의 게임 일기장",
  description: "디스코드 봇이 기록해주는 우리들의 게임 추억",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex bg-discord-server-list overflow-hidden">
        <SessionProviderWrapper>
          <SidebarNav />
          <main className="flex-1 flex flex-col bg-discord-main-content min-w-0">
            {children}
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
