"use client";

import React, { useState, useEffect } from 'react';
import { db } from "../../src/lib/firebase"; 
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Link from 'next/link';

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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black bg-discord-main-content text-white font-sans">ANALYZING DATA...</div>;

  return (
    <div className="flex flex-col h-full bg-discord-main-content font-sans overflow-hidden">
      {/* Header (Discord Style) */}
      <header className="h-12 flex items-center justify-between px-4 shadow-sm border-b border-black/20 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="text-discord-text-muted flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </div>
            <h2 className="text-white font-bold text-base">서버 통계 대시보드</h2>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto discord-scrollbar p-6 md:p-12">
        <div className="max-w-6xl mx-auto space-y-10">
          <header>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 font-sans">우리들의 기록 저장소</h1>
            <p className="text-discord-text-muted font-medium text-sm font-sans">지금까지 우리들이 함께한 모든 게임 추억을 분석했습니다.</p>
          </header>

          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-discord-card p-8 rounded-[8px] border border-black/20 flex flex-col items-center text-center shadow-lg">
              <span className="text-[11px] font-black text-discord-text-muted uppercase tracking-wider mb-2 font-sans">총 누적 플레이 시간</span>
              <span className="text-4xl font-bold text-white font-sans">{formatDurationText(totalMinutes)}</span>
            </div>
            <div className="bg-discord-card p-8 rounded-[8px] border border-black/20 flex flex-col items-center text-center shadow-lg">
              <span className="text-[11px] font-black text-discord-text-muted uppercase tracking-wider mb-2 font-sans">총 발행된 일기</span>
              <span className="text-4xl font-bold text-white font-sans">{sessions.length}개</span>
            </div>
            <div className="bg-discord-card p-8 rounded-[8px] border border-black/20 flex flex-col items-center text-center shadow-lg">
              <span className="text-[11px] font-black text-discord-text-muted uppercase tracking-wider mb-2 font-sans">플레이한 게임 종류</span>
              <span className="text-4xl font-bold text-white font-sans">{Object.keys(topGames).length > 5 ? '5+' : Object.keys(topGames).length}종</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* 활동 히트맵 */}
            <section className="bg-discord-card p-8 md:p-10 rounded-[8px] border border-black/20 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3 font-sans">
                <div className="w-1.5 h-5 bg-discord-blue rounded-full" />
                최근 활동 (Last 90 Days)
              </h3>
              <div className="grid grid-cols-10 md:grid-cols-15 gap-2">
                {heatmapCells.map((cell, idx) => {
                  let color = "bg-[#2B2D31]";
                  if (cell.value > 0) color = "bg-[#1E4D31]";
                  if (cell.value > 60) color = "bg-[#2D7A4D]";
                  if (cell.value > 180) color = "bg-[#3EB16F]";
                  if (cell.value > 300) color = "bg-[#23A559]";
                  
                  return (
                    <div 
                      key={idx} 
                      title={`${cell.date}: ${formatDurationText(cell.value)}`}
                      className={`aspect-square rounded-sm ${color} transition-all hover:scale-110 hover:ring-2 hover:ring-white/20 cursor-help`}
                    />
                  );
                })}
              </div>
              <div className="mt-6 flex items-center justify-end gap-2 font-sans">
                <span className="text-[10px] font-bold text-discord-text-muted font-sans">Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-[#2B2D31]" />
                  <div className="w-3 h-3 rounded-sm bg-[#1E4D31]" />
                  <div className="w-3 h-3 rounded-sm bg-[#2D7A4D]" />
                  <div className="w-3 h-3 rounded-sm bg-[#3EB16F]" />
                  <div className="w-3 h-3 rounded-sm bg-[#23A559]" />
                </div>
                <span className="text-[10px] font-bold text-discord-text-muted font-sans">More</span>
              </div>
            </section>

            {/* 인기 게임 순위 */}
            <section className="bg-discord-card p-8 md:p-10 rounded-[8px] border border-black/20 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3 font-sans">
                <div className="w-1.5 h-5 bg-discord-blue rounded-full" />
                인기 게임 TOP 5
              </h3>
              <div className="space-y-6 font-sans">
                {topGames.map((game, idx) => {
                  const percentage = (game.time / (topGames[0].time || 1)) * 100;
                  return (
                    <div key={game.title} className="group font-sans">
                      <div className="flex items-center justify-between mb-2 font-sans">
                        <div className="flex items-center gap-3 font-sans">
                          <div className="w-8 h-8 rounded-[4px] bg-discord-server-list border border-black/20 flex items-center justify-center overflow-hidden font-sans">
                            {game.icon ? <img src={game.icon} alt="" className="w-full h-full object-contain p-1" /> : <span className="text-sm">🕹️</span>}
                          </div>
                          <span className="text-sm font-bold text-white font-sans">{game.title}</span>
                        </div>
                        <span className="text-xs font-bold text-discord-text-muted font-sans">{formatDurationText(game.time)}</span>
                      </div>
                      <div className="h-2 w-full bg-discord-sidebar rounded-full overflow-hidden border border-black/20 font-sans">
                        <div 
                          className="h-full bg-discord-blue rounded-full transition-all duration-1000 ease-out group-hover:bg-discord-pink"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {topGames.length === 0 && (
                  <div className="text-center py-10 text-discord-text-muted font-bold font-sans">아직 기록된 게임이 없습니다.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
