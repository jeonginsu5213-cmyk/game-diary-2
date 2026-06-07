"use client";

import React, { useState, useEffect, use } from 'react';
import { supabase } from "../../../src/lib/supabase"; 
import Link from 'next/link';
import { formatDurationText, formatDate, maskNickname } from "../../../src/lib/utils";

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfileData() {
      // 1. 유저가 속한 세션 ID들을 먼저 찾습니다.
      const { data: userSessions, error: pError } = await supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', userId);

      if (pError || !userSessions || userSessions.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const sessionIds = userSessions.map((p: any) => p.session_id);

      // 2. 찾아낸 세션 ID들로 상세 정보를 가져옵니다.
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          session_games (
            *,
            session_game_players (*)
          )
        `)
        .in('id', sessionIds)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setSessions(data || []);
      }
      setLoading(false);
    }

    fetchProfileData();
  }, [userId]);

  const calculateUserStats = () => {
    let totalMinutes = 0;
    const gamePlayTimes: { [key: string]: number } = {};
    const dailyActivity: { [date: string]: number } = {};
    let latestName = "";
    let latestImage = "";

    sessions.forEach((s, idx) => {
      // 개인 플레이 시간 합산 (session_game_players 테이블 활용)
      (s.session_games || []).forEach((g: any) => {
        const playerRecord = (g.session_game_players || []).find((p: any) => p.user_id === userId);
        const userTime = playerRecord ? playerRecord.play_time_min : 0;
        
        totalMinutes += userTime;
        if (userTime > 0) {
          gamePlayTimes[g.title] = (gamePlayTimes[g.title] || 0) + userTime;
        }
      });

      // 날짜별 활동
      if (s.start_time) {
        const date = new Date(s.start_time).toISOString().split('T')[0];
        const userDayTime = (s.session_games || []).reduce((acc: number, g: any) => {
          const p = (g.session_game_players || []).find((pr: any) => pr.user_id === userId);
          return acc + (p ? p.play_time_min : 0);
        }, 0);
        dailyActivity[date] = (dailyActivity[date] || 0) + userDayTime;
      }
    });

    const topGames = Object.entries(gamePlayTimes)
      .map(([title, time]) => ({ title, time }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);

    return { totalMinutes, topGames, dailyActivity };
  };

  const { totalMinutes, topGames, dailyActivity } = calculateUserStats();

  // 프로필 정보는 세션 데이터에서 가져오기 어려울 수 있으므로 별도 쿼리 (또는 첫 세션에서 유추)
  // 여기서는 세션 데이터의 displayNames 맵이 Supabase profiles 테이블로 이전되었으므로 이를 활용합니다.
  const [profile, setProfile] = useState<{display_name: string, avatar_url: string, has_logged_in?: boolean} | null>(null);
  
  useEffect(() => {
    async function fetchUserInfo() {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data);
    }
    fetchUserInfo();
  }, [userId]);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black bg-discord-main-content text-white font-sans text-xl animate-pulse">LOADING PROFILE...</div>;

  return (
    <div className="flex flex-col h-full bg-discord-main-content font-sans overflow-hidden">
      {/* Header (Discord Style) */}
      <header className="h-12 flex items-center justify-between px-4 shadow-sm border-b border-black/20 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="text-discord-text-muted flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <h2 className="text-white font-bold text-base">유저 프로필</h2>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto discord-scrollbar p-6 md:p-12">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* 유저 헤더 */}
          <section className="flex flex-col md:flex-row items-center gap-8 bg-discord-card p-10 rounded-[8px] border border-black/20 shadow-xl relative overflow-hidden">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-discord-card shadow-2xl shrink-0 z-10 relative">
              <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`} alt="" className={`w-full h-full object-cover ${!profile?.has_logged_in ? 'blur-xs scale-110' : ''}`} />
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-discord-success border-4 border-discord-card rounded-full" />
            </div>
            <div className="flex flex-col items-center md:items-start text-center md:text-left z-10">
              <h1 className="text-4xl font-bold text-white tracking-tight mb-2 font-sans">
                {profile?.has_logged_in 
                  ? (profile?.display_name || '알 수 없는 유저') 
                  : maskNickname(profile?.display_name || '알 수 없는 유저')}님
              </h1>
              <p className="text-discord-text-muted font-bold mb-6 font-sans">총 {sessions.length}편의 게임 일기에 함께했습니다.</p>
              <div className="flex gap-4 font-sans">
                <div className="bg-black/20 px-6 py-3 rounded-[8px] border border-white/5 flex flex-col font-sans">
                  <span className="text-[10px] font-black text-discord-text-muted uppercase tracking-widest mb-1 font-sans">나의 누적 플레이</span>
                  <span className="text-xl font-bold text-white font-sans">{formatDurationText(totalMinutes)}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* 활동 히트맵 */}
            <section className="bg-discord-card p-8 md:p-10 rounded-[8px] border border-black/20 shadow-lg font-sans">
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3 font-sans">
                <div className="w-1.5 h-5 bg-discord-blue rounded-full" />
                나의 잔디 기록 (Last 90 Days)
              </h3>
              <div className="grid grid-cols-10 md:grid-cols-15 gap-2 font-sans">
                {heatmapCells.map((cell, idx) => {
                  let color = "bg-[#2B2D31]";
                  if (cell.value > 0) color = "bg-[#1A2A47]";
                  if (cell.value > 60) color = "bg-[#274075]";
                  if (cell.value > 180) color = "bg-[#3B61B3]";
                  if (cell.value > 300) color = "bg-[#5865F2]";
                  return (
                    <div 
                      key={idx} 
                      title={`${cell.date}: ${formatDurationText(cell.value)}`}
                      className={`aspect-square rounded-sm ${color} transition-all hover:scale-110 hover:ring-2 hover:ring-white/20 cursor-help font-sans`}
                    />
                  );
                })}
              </div>
            </section>

            {/* 나의 선호 게임 TOP 5 */}
            <section className="bg-discord-card p-8 md:p-10 rounded-[8px] border border-black/20 shadow-lg font-sans">
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3 font-sans">
                <div className="w-1.5 h-5 bg-discord-blue rounded-full" />
                가장 많이 한 게임 TOP 5
              </h3>
              <div className="space-y-6 font-sans">
                {topGames.map((game, idx) => {
                  const percentage = (game.time / (topGames[0].time || 1)) * 100;
                  return (
                    <div key={game.title} className="group font-sans">
                      <div className="flex items-center justify-between mb-2 font-sans">
                        <span className="text-sm font-bold text-white font-sans">{game.title}</span>
                        <span className="text-xs font-bold text-discord-text-muted font-sans">{formatDurationText(game.time)}</span>
                      </div>
                      <div className="h-2 w-full bg-discord-sidebar rounded-full overflow-hidden border border-black/20 font-sans">
                        <div 
                          className="h-full bg-discord-blue rounded-full transition-all duration-1000 ease-out font-sans"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {topGames.length === 0 && <div className="text-center py-10 text-discord-text-muted font-bold font-sans">참여한 게임 기록이 없습니다.</div>}
              </div>
            </section>
          </div>

          {/* 타임라인 (참여한 일기 목록) */}
          <section className="space-y-6 font-sans">
            <h3 className="text-xl font-bold text-white px-2 font-sans">참여한 일기 타임라인</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
              {sessions.map(s => (
                <Link key={s.id} href={`/diary?id=${s.id}`} className="group bg-discord-card p-6 rounded-[8px] border border-black/20 hover:border-discord-blue transition-all shadow-lg font-sans">
                  <div className="flex items-start justify-between gap-4 font-sans">
                    <div className="flex flex-col min-w-0 font-sans">
                      <span className="text-[10px] font-black text-discord-text-muted uppercase mb-1 font-sans">{s.start_time ? formatDate(s.start_time) : ""}</span>
                      <h4 className="text-lg font-bold text-white tracking-tight truncate group-hover:text-discord-blue transition-colors font-sans">{s.title}</h4>
                      <p className="text-xs font-bold text-discord-text-muted mt-1 font-sans">{s.session_games?.length || 0}개의 게임 플레이</p>
                    </div>
                    <div className="bg-discord-sidebar px-3 py-1.5 rounded-[4px] border border-black/20 font-bold text-[10px] text-discord-text-muted group-hover:bg-discord-blue group-hover:text-white transition-colors uppercase font-sans shrink-0">
                      View Diary
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
