"use client";

import React, { useState, useEffect } from 'react';
import { db } from "../../src/lib/firebase"; 
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import TopNav from '../../components/TopNav';

/**
 * 헬퍼: 분 단위를 시간/분 텍스트로 변환
 */
const formatDurationText = (minutes: number) => {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

export default function StatsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("startTime", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 📊 통계 데이터 계산
  const calculateStats = () => {
    let totalMinutes = 0;
    const gamePlayTimes: { [key: string]: { time: number, icon: string } } = {};
    const dailyActivity: { [date: string]: number } = {};

    sessions.forEach(s => {
      totalMinutes += (s.totalDurationMin || 0);
      
      // 게임별 시간 합산
      (s.games || []).forEach((g: any) => {
        if (!gamePlayTimes[g.title]) {
          gamePlayTimes[g.title] = { time: 0, icon: g.iconURL };
        }
        gamePlayTimes[g.title].time += (g.playTimeMin || 0);
      });

      // 날짜별 활동 (Heatmap용)
      if (s.startTime?.seconds) {
        const date = new Date(s.startTime.seconds * 1000).toISOString().split('T')[0];
        dailyActivity[date] = (dailyActivity[date] || 0) + (s.totalDurationMin || 0);
      }
    });

    const topGames = Object.entries(gamePlayTimes)
      .map(([title, data]) => ({ title, ...data }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);

    return { totalMinutes, topGames, dailyActivity };
  };

  const { totalMinutes, topGames, dailyActivity } = calculateStats();

  // 🔥 히트맵 데이터 생성 (최근 90일)
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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black bg-[#F0F2F5] text-[#1A1D1F] font-sans">ANALYZING DATA...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F2F5] text-[#1A1D1F] font-sans">
      <TopNav />
      
      <main className="flex-1 p-4 md:p-12 max-w-6xl mx-auto w-full space-y-10">
        <header>
          <h1 className="text-3xl font-black tracking-tighter mb-2">서버 통계 대시보드</h1>
          <p className="text-gray-400 font-bold text-sm">지금까지 우리들의 모든 기록을 모았습니다.</p>
        </header>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">총 누적 플레이 시간</span>
            <span className="text-4xl font-black text-[#1A1D1F]">{formatDurationText(totalMinutes)}</span>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">총 발행된 일기</span>
            <span className="text-4xl font-black text-[#1A1D1F]">{sessions.length}개</span>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">플레이한 게임 종류</span>
            <span className="text-4xl font-black text-[#1A1D1F]">{Object.keys(topGames).length > 5 ? '5+' : Object.keys(topGames).length}종</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* 활동 히트맵 */}
          <section className="bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black mb-8 flex items-center gap-2">
              <span className="w-2 h-6 bg-[#1A1D1F] rounded-full" />
              최근 활동 (Last 90 Days)
            </h3>
            <div className="grid grid-cols-10 md:grid-cols-15 gap-2">
              {heatmapCells.map((cell, idx) => {
                let color = "bg-slate-100";
                if (cell.value > 0) color = "bg-green-100";
                if (cell.value > 60) color = "bg-green-300";
                if (cell.value > 180) color = "bg-green-500";
                if (cell.value > 300) color = "bg-green-700";
                
                return (
                  <div 
                    key={idx} 
                    title={`${cell.date}: ${formatDurationText(cell.value)}`}
                    className={`aspect-square rounded-md ${color} transition-colors hover:ring-2 hover:ring-[#1A1D1F] cursor-help`}
                  />
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <span className="text-[10px] font-bold text-gray-400">Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-slate-100" />
                <div className="w-3 h-3 rounded-sm bg-green-100" />
                <div className="w-3 h-3 rounded-sm bg-green-300" />
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <div className="w-3 h-3 rounded-sm bg-green-700" />
              </div>
              <span className="text-[10px] font-bold text-gray-400">More</span>
            </div>
          </section>

          {/* 인기 게임 순위 */}
          <section className="bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black mb-8 flex items-center gap-2">
              <span className="w-2 h-6 bg-[#1A1D1F] rounded-full" />
              인기 게임 TOP 5
            </h3>
            <div className="space-y-6">
              {topGames.map((game, idx) => {
                const percentage = (game.time / (topGames[0].time || 1)) * 100;
                return (
                  <div key={game.title} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                          {game.icon ? <img src={game.icon} alt="" className="w-full h-full object-contain" /> : "🕹️"}
                        </div>
                        <span className="text-sm font-black text-[#1A1D1F]">{game.title}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-400">{formatDurationText(game.time)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className="h-full bg-[#1A1D1F] rounded-full transition-all duration-1000 ease-out group-hover:bg-[#5865F2]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {topGames.length === 0 && (
                <div className="text-center py-10 text-gray-400 font-bold">아직 기록된 게임이 없습니다.</div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
