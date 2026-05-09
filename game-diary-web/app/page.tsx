"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db } from "../src/lib/firebase"; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useSession, signIn, signOut } from "next-auth/react";
import TopNav from '../components/TopNav';
import Lightbox from '../components/Lightbox';
import CommentItem from '../components/CommentItem';

/** 
 * 보조 컴포넌트: 서버 아이콘 (디스코드 스타일)
 */
const ServerIcon = ({ url, name, className = "w-7 h-7" }: { url?: string, name: string, className?: string }) => {
  if (url && url.startsWith('http')) {
    return <img src={url} alt={name} className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} bg-[#5865F2] flex items-center justify-center text-white font-black uppercase overflow-hidden`}>
      <span className="text-[40%]">{name?.charAt(0)}</span>
    </div>
  );
};

const formatDurationText = (minutes: number) => {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === "DATE UNKNOWN") return dateStr;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const formattedDate = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const weekday = date.toLocaleDateString('ko-KR', { weekday: 'short' });
  return `${formattedDate} (${weekday})`;
};

const DownloadButton = ({ url, className = "" }: { url: string; className?: string }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
    className={`p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full border border-white/20 shadow-lg transition-all cursor-pointer group/dl ${className}`}
  >
    <svg className="w-4 h-4 text-white group-hover/dl:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  </button>
);

const PhotoCaption = ({ text }: { text: string }) => (
  <div className="mt-0 pt-3 pb-1 px-1 flex gap-2 items-start opacity-90 font-sans text-[#1A1D1F]">
    <div className="w-1 h-3 bg-slate-200 rounded-full mt-0.5 shrink-0" />
    <p className="text-[11px] font-bold text-gray-500 leading-tight tracking-tight">{text}</p>
  </div>
);

const ScreenshotSlider = ({ screenshots, data, onImageClick }: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };
  if (!screenshots || screenshots.length === 0) return null;

  return (
    <div className="relative group/slider mt-2 mb-4 font-sans text-[#1A1D1F]">
      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-3 px-1">게임 하이라이트</p>
      <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-slate-100 flex items-center justify-center -ml-4 opacity-0 group-hover/slider:opacity-100 transition-all hover:bg-white cursor-pointer"><svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
      <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-slate-100 flex items-center justify-center -mr-4 opacity-0 group-hover/slider:opacity-100 transition-all hover:bg-white cursor-pointer"><svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
      <div ref={scrollRef} className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-1 font-sans">
        {screenshots.map((shot: any, idx: number) => {
          const uploaderId = Object.keys(data.displayNames || {}).find(key => data.displayNames[key] === shot.user) || shot.user;
          const profileImage = data.profileImages?.[uploaderId] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uploaderId}&backgroundColor=f0f2f5`;
          return (
            <div key={idx} className="relative shrink-0 w-64 md:w-72 snap-start flex flex-col group/unit font-sans cursor-zoom-in" onClick={() => onImageClick(shot.url)}>
              <div className="bg-slate-50/30 p-2 rounded-[1.8rem] border border-transparent group-hover/unit:border-slate-100 group-hover/unit:bg-white transition-all duration-300">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-100 shadow-sm group/shot">
                  <img src={shot.url} alt="하이라이트" className="w-full h-full object-cover transition-transform duration-500 group-hover/shot:scale-105" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-[#1E1F22]/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg font-sans">
                    <div className="w-4 h-4 rounded-full overflow-hidden border border-white/20 bg-[#EB459E]"><img src={profileImage} alt="" className="w-full h-full object-cover" /></div>
                    <span className="text-[9px] font-bold text-[#DBDEE1]">{shot.user}</span>
                  </div>
                  <DownloadButton url={shot.url} className="absolute top-2 right-2 opacity-0 group-hover/shot:opacity-100 translate-x-2 group-hover/shot:translate-x-0 transition-all duration-300" />
                </div>
                {shot.comment && <PhotoCaption text={shot.comment} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GameCommentInput = ({ sessionId, gameTitle, data }: any) => {
  const { data: session }: any = useSession();
  const [text, setText] = useState("");
  const myId = session?.user?.id;
  const myServerName = (myId && data.displayNames[myId]) || session?.user?.name;
  const myServerImage = (myId && data.profileImages[myId]) || session?.user?.image;

  const handleSubmit = async () => {
    if (!text.trim() || !session) return;
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = data.games.map((g: any) => {
        if (g.title === gameTitle) {
          return {
            ...g,
            comments: [...(g.comments || []), { 
              userId: session.user.id, 
              user: myServerName, 
              image: myServerImage, 
              text: text.trim(),
              reactions: {},
              replies: []
            }]
          };
        }
        return g;
      });
      await updateDoc(sessionRef, { games: updatedGames });
      setText("");
    } catch (err) { console.error("댓글 등록 실패:", err); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  if (!session) return (
    <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center font-sans">
      <p className="text-[10px] font-bold text-gray-400">댓글을 남기려면 로그인이 필요합니다.</p>
    </div>
  );

  return (
    <div className="mt-2 flex items-center gap-3 p-2 bg-white rounded-2xl border border-slate-100 shadow-inner group/input font-sans">
      <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-50">
        <img src={myServerImage || ""} alt="" className="w-full h-full" />
      </div>
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} placeholder={`${myServerName}님, 한줄평을 남겨주세요...`} className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-gray-500 placeholder:text-gray-300" />
      <button onClick={handleSubmit} className={`text-[10px] font-black px-3 py-1 rounded-full transition-opacity cursor-pointer ${text.trim() ? 'bg-[#1A1D1F] text-white opacity-100' : 'bg-[#F0F2F5] text-[#1A1D1F] opacity-0 group-hover/input:opacity-100'}`}>등록</button>
    </div>
  );
};

const DiaryCard = ({ data, playersSet, sessionId, onDelete, onImageClick }: any) => {
  const { data: session }: any = useSession();
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setNewTitle] = useState(data.sessionTitle);

  const calculateMVPs = () => {
    const playTimes: { [userId: string]: number } = {};
    const shotCounts: { [userId: string]: number } = {};
    data.games.forEach((game: any) => {
      Object.entries(game.playerPlayTimes || {}).forEach(([userId, minutes]: [string, any]) => {
        playTimes[userId] = (playTimes[userId] || 0) + minutes;
      });
    });
    (data.unclassifiedScreenshots || []).forEach((shot: any) => {
      const uploaderId = Object.keys(data.displayNames || {}).find(key => data.displayNames[key] === shot.user) || shot.user;
      shotCounts[uploaderId] = (shotCounts[uploaderId] || 0) + 1;
    });
    const timeMvpId = Object.keys(playTimes).reduce((a, b) => playTimes[a] > playTimes[b] ? a : b, "");
    const shotMvpId = Object.keys(shotCounts).reduce((a, b) => shotCounts[a] > shotCounts[b] ? a : b, "");
    return {
      timeMvp: timeMvpId ? { id: timeMvpId, score: playTimes[timeMvpId] } : null,
      shotMvp: shotMvpId ? { id: shotMvpId, score: shotCounts[shotMvpId] } : null
    };
  };

  const mvps = calculateMVPs();

  useEffect(() => { setNewTitle(data.sessionTitle); }, [data]);

  const handleUpdateTitle = async () => {
    if (!tempTitle.trim() || tempTitle === data.sessionTitle) { setIsEditingTitle(false); return; }
    try { await updateDoc(doc(db, "sessions", sessionId), { sessionTitle: tempTitle.trim() }); setIsEditingTitle(false); } catch (err) { console.error(err); }
  };

  const handleAddReaction = async (gameIdx: number, commentIdx: number, emoji: string) => {
    if (!session) return alert("로그인이 필요합니다.");
    const myId = session.user.id;
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = [...data.games];
      const comment = updatedGames[gameIdx].comments[commentIdx];
      if (!comment.reactions) comment.reactions = {};
      if (!comment.reactions[emoji]) comment.reactions[emoji] = [];
      
      if (comment.reactions[emoji].includes(myId)) {
        comment.reactions[emoji] = comment.reactions[emoji].filter((id: string) => id !== myId);
        if (comment.reactions[emoji].length === 0) delete comment.reactions[emoji];
      } else {
        comment.reactions[emoji].push(myId);
      }
      
      await updateDoc(sessionRef, { games: updatedGames });
    } catch (err) { console.error(err); }
  };

  const handleAddReply = async (gameIdx: number, commentIdx: number, text: string) => {
    if (!session) return alert("로그인이 필요합니다.");
    const myId = session.user.id;
    const myServerName = data.displayNames[myId] || session.user.name;
    const myServerImage = data.profileImages[myId] || session.user.image;

    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = [...data.games];
      const comment = updatedGames[gameIdx].comments[commentIdx];
      if (!comment.replies) comment.replies = [];
      
      comment.replies.push({
        userId: myId,
        user: myServerName,
        image: myServerImage,
        text: text,
        createdAt: new Date().toISOString()
      });
      
      await updateDoc(sessionRef, { games: updatedGames });
    } catch (err) { console.error(err); }
  };

  const handleShare = () => {
    const textArea = document.createElement("textarea");
    textArea.value = window.location.href;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert("링크가 복사되었습니다!");
  };

  return (
    <article className="bg-white/70 backdrop-blur-md border border-white p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] shadow-[0_20px_50px_rgb(0,0,0,0.05)] mb-10 font-sans text-[#1A1D1F]">
      <div className="flex flex-col gap-6 mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <span className="font-black bg-[#1A1D1F] text-white px-3 py-1 rounded-full uppercase tracking-tighter shrink-0 text-[10px] md:text-xs font-sans w-fit">{formatDate(data.date)}</span>
            {isEditingTitle ? (
              <input type="text" value={tempTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()} onBlur={handleUpdateTitle} autoFocus className="font-black tracking-tight text-xl md:text-2xl font-sans bg-slate-50 border-b-2 border-[#1A1D1F] outline-none px-1 py-0.5" />
            ) : (
              <h2 className="font-black tracking-tight text-xl md:text-2xl font-sans">{data.sessionTitle}</h2>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setIsEditingTitle(true)} className="p-2.5 bg-[#F0F2F5] hover:bg-[#E2E8F0] rounded-full transition-all border border-slate-200 cursor-pointer"><svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
            <button onClick={handleShare} className="p-2.5 bg-[#F0F2F5] hover:bg-[#E2E8F0] rounded-full transition-all border border-slate-200 cursor-pointer"><svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg></button>
            <button onClick={() => onDelete(sessionId)} className="p-2.5 bg-red-50 hover:bg-red-100 rounded-full transition-all border border-red-100 cursor-pointer"><svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
          </div>
        </div>

        <div className="flex flex-col gap-4 bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100/50 transition-all hover:bg-white hover:shadow-md">
          <div className="flex flex-wrap items-center gap-6 md:gap-12">
            <div className="flex flex-col md:border-r md:border-slate-200 md:pr-8 shrink-0">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5 font-sans">총 대화 시간</span>
              <div className="flex items-baseline gap-1 text-[#1A1D1F]"><span className="text-xl font-black font-sans">{formatDurationText(data.totalDurationMin)}</span></div>
            </div>
            {/* 🏆 MVP 섹션 */}
            <div className="flex gap-4 md:gap-8 overflow-x-auto scrollbar-hide py-1">
              {mvps.timeMvp && (
                <Link href={`/profile/${mvps.timeMvp.id}`} className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-yellow-100 shadow-sm shrink-0 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-yellow-400 shadow-inner shrink-0">
                    <img src={data.profileImages?.[mvps.timeMvp.id] || ""} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-yellow-600 uppercase tracking-tighter mb-0.5">🥇 오늘의 게임 폐인</span>
                    <span className="text-[11px] font-black text-gray-800 leading-none">{data.displayNames?.[mvps.timeMvp.id]} ({mvps.timeMvp.score}분)</span>
                  </div>
                </Link>
              )}
              {mvps.shotMvp && (
                <Link href={`/profile/${mvps.shotMvp.id}`} className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-blue-100 shadow-sm shrink-0 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-400 shadow-inner shrink-0">
                    <img src={data.profileImages?.[mvps.shotMvp.id] || ""} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter mb-0.5">📸 오늘의 포토그래퍼</span>
                    <span className="text-[11px] font-black text-gray-800 leading-none">{data.displayNames?.[mvps.shotMvp.id]} ({mvps.shotMvp.score}장)</span>
                  </div>
                </Link>
              )}
            </div>

            <div className="flex flex-col ml-auto">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2 font-sans px-0.5">함께한 친구들</span>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5 font-sans">
                  {data.participants.slice(0, 4).map((p: string, i: number) => (
                    <Link key={p} href={`/profile/${p}`} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-sm font-sans hover:scale-110 transition-transform" style={{ zIndex: 10 - i }}>
                      <img src={data.profileImages?.[p] || ""} alt={p} className="w-full h-full object-cover" />
                    </Link>
                  ))}
                  {data.participants.length > 4 && <div className="w-8 h-8 rounded-full border-2 border-white bg-[#1A1D1F] text-white flex items-center justify-center text-[9px] font-black z-0 shadow-sm font-sans">+{data.participants.length - 4}</div>}
                </div>
                <button onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)} className={`p-1.5 rounded-full transition-all cursor-pointer ${isParticipantsExpanded ? 'bg-[#1A1D1F] text-white rotate-180' : 'bg-white text-gray-400 border border-slate-100 shadow-sm'}`}><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
              </div>
            </div>
            </div>
            {isParticipantsExpanded && (
            <div className="pt-4 mt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 font-sans">
              {data.participants.map((p: string) => (
                <Link key={p} href={`/profile/${p}`} className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl border transition-all hover:shadow-md ${playersSet.has(p) ? 'bg-yellow-50 border-yellow-200/50 text-yellow-800' : 'bg-white border-slate-100 text-gray-400'}`}>
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-white shadow-sm shrink-0 font-sans"><img src={data.profileImages?.[p] || ""} alt={p} className="w-full h-full object-cover" /></div>
                  <div className="flex flex-col min-w-0 font-sans"><span className="text-[11px] font-black truncate leading-none mb-0.5 font-sans">{data.displayNames[p] || p}</span><span className="text-[8px] font-bold uppercase tracking-tighter opacity-60 font-sans">{playersSet.has(p) ? 'Playing' : 'Spectating'}</span></div>
                </Link>
              ))}
            </div>
            )}

        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 mb-16 font-sans">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 px-1 font-sans">플레이 기록</p>
        {data.games.map((game: any, gameIdx: number) => {
          const gameShots = (data.unclassifiedScreenshots || []).filter((s: any) => s.gameTitle === game.title);
          return (
            <div key={gameIdx} className="group relative bg-white border border-slate-100 shadow-sm p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] font-sans">
              <div className="flex flex-col md:flex-row justify-between gap-6 mb-8 font-sans">
                <div className="flex gap-4 text-[#1A1D1F] font-sans">
                  <div className="flex flex-col items-center shrink-0 justify-center font-sans"><div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-[#F8F9FA] flex items-center justify-center border border-slate-100 shadow-inner overflow-hidden font-sans">{game.iconURL ? <img src={game.iconURL} alt="" className="w-full h-full object-contain" /> : <span className="text-xl md:text-2xl font-sans">🕹️</span>}</div></div>
                  <div className="font-sans min-w-0">
                    <h4 className="font-black tracking-tight mb-2 md:mb-3 uppercase text-base md:text-lg font-sans truncate">{game.title}</h4>
                    <div className="flex flex-wrap gap-x-2 gap-y-1.5 font-sans">
                      {game.players?.map((player: string) => (
                        <Link key={player} href={`/profile/${player}`} className="flex items-center gap-1.5 bg-[#1E1F22] px-2 py-0.5 md:py-1 rounded-full shadow-sm text-[#DBDEE1] font-sans hover:bg-[#313338] transition-colors">
                          <div className="w-4 h-4 md:w-5 md:h-5 rounded-full overflow-hidden border border-white/10 font-sans">
                            <img src={data.profileImages?.[player] || ""} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[9px] md:text-[10px] font-bold font-sans truncate max-w-[60px] md:max-w-none">{data.displayNames[player] || player}</span>
                          <span className="text-[9px] md:text-[10px] font-black text-[#949BA4] ml-1 font-sans">{formatDurationText(game.playerPlayTimes?.[player] || 0)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="md:text-right shrink-0 flex flex-col justify-center font-sans text-[#1A1D1F]">
                  <div className="text-[9px] font-black text-gray-400 uppercase mb-0.5 font-sans">총 플레이 시간</div>
                  <div className="font-black text-[#1A1D1F] text-xl md:text-2xl font-sans">{formatDurationText(game.playTimeMin)}</div>
                </div>
              </div>
              <ScreenshotSlider screenshots={gameShots} data={data} onImageClick={onImageClick} />
              <div className="mt-2 pt-4 border-t border-slate-50 font-sans text-[#1A1D1F]">
                <div className="space-y-0 font-sans">
                  {game.comments && game.comments.map((comm: any, commentIdx: number) => (
                    <CommentItem 
                      key={commentIdx} 
                      comment={comm} 
                      onAddReaction={(emoji: string) => handleAddReaction(gameIdx, commentIdx, emoji)}
                      onAddReply={(text: string) => handleAddReply(gameIdx, commentIdx, text)}
                    />
                  ))}
                  <GameCommentInput sessionId={sessionId} gameTitle={game.title} data={data} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* ... Unclassified Moment Grid ... */}
      <div className="space-y-6 font-sans text-[#1A1D1F]">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 font-sans px-1">분류되지 않은 순간들</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 font-sans">
          {(data.unclassifiedScreenshots || []).filter((s:any) => !s.gameTitle || s.gameTitle === "미지정").map((snap: any) => {
            const uploaderId = Object.keys(data.displayNames || {}).find(key => data.displayNames[key] === snap.user) || snap.user;
            const profileImg = data.profileImages?.[uploaderId] || "";
            return (
              <div key={snap.url} className="bg-white p-3 md:p-4 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-50 shadow-sm relative group/snap-unit font-sans transition-all hover:shadow-md cursor-zoom-in" onClick={() => onImageClick(snap.url)}>
                <div className="relative aspect-video rounded-[1.2rem] md:rounded-[1.8rem] overflow-hidden border border-slate-100 shadow-inner group/snap font-sans">
                  <img src={snap.url} alt="" className="w-full h-full object-cover transition-transform group-hover/snap:scale-105" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-[#1E1F22]/90 rounded-full border border-white/10 shadow-xl font-sans">
                    <div className="w-4 h-4 rounded-full overflow-hidden border border-white/20 font-sans"><img src={profileImg} alt="" className="w-full h-full object-cover" /></div>
                    <span className="text-[9px] font-bold text-[#DBDEE1] font-sans">{snap.user}</span>
                  </div>
                  <DownloadButton url={snap.url} className="absolute top-3 right-3 opacity-100 md:opacity-0 group-hover/snap:opacity-100 transition-all font-sans" />
                </div>
                {snap.comment && <PhotoCaption text={snap.comment} />}
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
};

export default function Home() {
  const { data: session }: any = useSession();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("startTime", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.startTime?.seconds ? new Date(d.startTime.seconds * 1000).toLocaleDateString() : "DATE UNKNOWN",
          channelName: d.channelName,
          sessionTitle: d.sessionTitle || `#${d.channelName} 기록`,
          serverName: d.guildName || "연동된 서버",
          serverIconURL: d.guildIcon,
          totalDurationMin: d.totalDurationMin || 0,
          participants: d.participants || [],
          displayNames: d.displayNames || {},
          profileImages: d.profileImages || {},
          games: d.games || [],
          unclassifiedScreenshots: d.screenshots || []
        };
      });
      setSessions(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm("정말로 이 일기를 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try { await deleteDoc(doc(db, "sessions", id)); } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (loading) return;
    if (sessions.length > 0) {
      const selectedExists = sessions.some(s => s.id === selectedId);
      if (!selectedId || !selectedExists) setSelectedId(sessions[0].id);
    } else setSelectedId(null);
  }, [sessions, loading, selectedId]);

  const filteredSessions = sessions.filter(s => 
    s.sessionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.serverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.games.some((g:any) => g.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const current = sessions.find(s => s.id === selectedId) || sessions[0];
  const playedUsers = new Set(current?.games.flatMap((g: any) => g.players || []));

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black bg-[#F0F2F5] text-[#1A1D1F] font-sans">LOADING DIARY...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F2F5] text-[#1A1D1F] font-sans">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <aside className={`fixed md:relative z-40 h-[calc(100vh-64px)] bg-[#F8F9FA] border-r border-[#E2E8F0] p-6 flex flex-col gap-6 font-sans transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72 left-0' : 'w-0 -left-72 md:left-0 md:w-0 overflow-hidden'}`}>
          <div className="space-y-4 font-sans shrink-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1 font-sans">일기 검색</p>
            <div className="relative">
              <input type="text" placeholder="제목, 서버, 게임 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-[#1A1D1F] transition-all shadow-sm" />
              <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 font-sans">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-1 font-sans">이전 일기 기록 ({filteredSessions.length})</p>
            <div className="space-y-2 overflow-y-auto pr-2 scrollbar-hide font-sans">
              {filteredSessions.map(s => (
                <button key={s.id} onClick={() => { setSelectedId(s.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left p-3 rounded-2xl border transition-all group font-sans ${selectedId === s.id ? 'bg-white border-[#1A1D1F]/10 shadow-md translate-x-1' : 'bg-transparent border-transparent hover:bg-white/50 grayscale hover:grayscale-0'}`}>
                  <div className="flex items-start gap-3 font-sans">
                    <ServerIcon url={s.serverIconURL} name={s.serverName} className="w-8 h-8 rounded-lg shrink-0 shadow-sm" />
                    <div className="flex flex-col min-w-0 font-sans"><span className="text-[9px] font-black text-gray-400 uppercase mb-0.5 font-sans">{formatDate(s.date)}</span><span className={`text-[12px] font-bold truncate leading-tight transition-colors font-sans ${selectedId === s.id ? 'text-[#1A1D1F]' : 'text-gray-500'}`}>{s.sessionTitle}</span></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section className="flex-1 h-[calc(100vh-64px)] overflow-y-auto p-4 md:p-8 font-sans text-[#1A1D1F] transition-all duration-300 relative">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="absolute left-4 top-4 z-30 p-2.5 bg-white rounded-full shadow-md border border-slate-200 text-gray-500 hover:bg-slate-50 transition-all active:scale-90"><svg className={`w-5 h-5 transition-transform ${!isSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg></button>
          <div className="max-w-5xl mx-auto pt-10">{current ? (<DiaryCard key={current.id} data={current} playersSet={playedUsers} sessionId={current.id} onDelete={handleDeleteSession} onImageClick={(url:string) => setActiveImageUrl(url)} />) : (<div className="flex items-center justify-center h-64 text-gray-400 font-bold">검색 결과가 없습니다.</div>)}</div>
        </section>
      </div>
      {activeImageUrl && (<Lightbox imageUrl={activeImageUrl} onClose={() => setActiveImageUrl(null)} />)}
    </div>
  );
}
