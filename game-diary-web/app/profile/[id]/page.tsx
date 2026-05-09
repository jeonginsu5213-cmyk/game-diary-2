"use client";

import React, { useState, useEffect, use } from 'react';
import { db } from "../../../src/lib/firebase"; 
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import TopNav from '../../../components/TopNav';
import Link from 'next/link';

const formatDurationText = (minutes: number) => {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
};

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "sessions"), 
      where("participants", "array-contains", userId),
      orderBy("startTime", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const calculateUserStats = () => {
    let totalMinutes = 0;
    const gamePlayTimes: { [key: string]: number } = {};
    const dailyActivity: { [date: string]: number } = {};
    let latestName = "";
    let latestImage = "";

    sessions.forEach((s, idx) => {
      // 가장 최근 세션에서 이름과 사진 추출
      if (idx === 0) {
        latestName = s.displayNames?.[userId] || "알 수 없는 유저";
        latestImage = s.profileImages?.[userId] || "";
      }

      // 개인 플레이 시간 합산
      (s.games || []).forEach((g: any) => {
        const userTime = g.playerPlayTimes?.[userId] || 0;
        totalMinutes += userTime;
        if (userTime > 0) {
          gamePlayTimes[g.title] = (gamePlayTimes[g.title] || 0) + userTime;
        }
      });

      // 날짜별 활동
      if (s.startTime?.seconds) {
        const date = new Date(s.startTime.seconds * 1000).toISOString().split('T')[0];
        const userDayTime = (s.games || []).reduce((acc: number, g: any) => acc + (g.playerPlayTimes?.[userId] || 0), 0);
        dailyActivity[date] = (dailyActivity[date] || 0) + userDayTime;
      }
    });

    const topGames = Object.entries(gamePlayTimes)
      .map(([title, time]) => ({ title, time }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);

    return { totalMinutes, topGames, dailyActivity, latestName, latestImage };
  };

  const { totalMinutes, topGames, dailyActivity, latestName, latestImage } = calculateUserStats();

  const generateHeatmap = () => {
    const cells = [];
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const value = dailyActivity[dateStr] || 0;
      cells.push({ date: dateStr, value });
    }
    return cells;
  };

  const heatmapCells = generateHeatmap();

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black bg-[#F0F2F5] text-[#1A1D1F] font-sans text-xl animate-pulse">LOADING PROFILE...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F2F5] text-[#1A1D1F] font-sans">
      <TopNav />
      
      <main className="flex-1 p-4 md:p-12 max-w-6xl mx-auto w-full space-y-12">
        {/* 유저 헤더 */}
        <section className="flex flex-col md:flex-row items-center gap-8 bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
          <div className="w-32 h-32 rounded-[3rem] overflow-hidden border-4 border-[#1A1D1F] shadow-2xl shrink-0">
            <img src={latestImage || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-4xl font-black tracking-tighter mb-2">{latestName}님</h1>
            <p className="text-gray-400 font-bold mb-6">총 {sessions.length}편의 게임 일기에 함께했습니다.</p>
            <div className="flex gap-4">
              <div className="bg-[#F8F9FA] px-6 py-3 rounded-2xl border border-slate-100 flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">나의 누적 플레이</span>
                <span className="text-xl font-black">{formatDurationText(totalMinutes)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* 활동 히트맵 */}
          <section className="bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black mb-8 flex items-center gap-2">
              <span className="w-2 h-6 bg-[#1A1D1F] rounded-full" />
              나의 잔디 기록 (Last 90 Days)
            </h3>
            <div className="grid grid-cols-10 md:grid-cols-15 gap-2">
              {heatmapCells.map((cell, idx) => {
                let color = "bg-slate-100";
                if (cell.value > 0) color = "bg-blue-100";
                if (cell.value > 60) color = "bg-blue-300";
                if (cell.value > 180) color = "bg-blue-500";
                if (cell.value > 300) color = "bg-blue-700";
                return (
                  <div 
                    key={idx} 
                    title={`${cell.date}: ${formatDurationText(cell.value)}`}
                    className={`aspect-square rounded-md ${color} transition-all hover:scale-110 hover:ring-2 hover:ring-[#1A1D1F] cursor-help`}
                  />
                );
              })}
            </div>
          </section>

          {/* 나의 선호 게임 TOP 5 */}
          <section className="bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black mb-8 flex items-center gap-2">
              <span className="w-2 h-6 bg-[#1A1D1F] rounded-full" />
              가장 많이 한 게임 TOP 5
            </h3>
            <div className="space-y-6">
              {topGames.map((game, idx) => {
                const percentage = (game.time / (topGames[0].time || 1)) * 100;
                return (
                  <div key={game.title} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-[#1A1D1F]">{game.title}</span>
                      <span className="text-xs font-bold text-gray-400">{formatDurationText(game.time)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className="h-full bg-[#5865F2] rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {topGames.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">참여한 게임 기록이 없습니다.</div>}
            </div>
          </section>
        </div>

        {/* 타임라인 (참여한 일기 목록) */}
        <section className="space-y-6">
          <h3 className="text-xl font-black px-2">참여한 일기 타임라인</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessions.map(s => (
              <Link key={s.id} href={`/?id=${s.id}`} className="group bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black text-gray-400 uppercase mb-1">{formatDate(s.startTime?.seconds ? new Date(s.startTime.seconds * 1000).toLocaleDateString() : "")}</span>
                    <h4 className="text-lg font-black tracking-tighter truncate group-hover:text-[#5865F2] transition-colors">{s.sessionTitle}</h4>
                    <p className="text-xs font-bold text-gray-400 mt-1">{s.games?.length || 0}개의 게임 플레이</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 font-black text-[10px] group-hover:bg-[#1A1D1F] group-hover:text-white transition-colors uppercase">
                    View Diary
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
