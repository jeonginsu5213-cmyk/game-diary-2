"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { db, storage } from "../src/lib/firebase"; 

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

/**
 * 한글 조사 자동 선택 (을/를)
 */
const getObjectParticle = (word: string) => {
  if (!word) return "를";
  const lastChar = word.charCodeAt(word.length - 1);
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) return "를"; // 한글이 아닐 경우 기본값
  return (lastChar - 0xAC00) % 28 > 0 ? "을" : "를";
};

const formatTime = (timestamp: any) => {
  if (!timestamp || !timestamp.seconds) return "--:--";
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const DownloadButton = ({ url, className = "" }: { url: string; className?: string }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
    className={`p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg transition-all cursor-pointer group/dl ${className}`}
  >
    <svg className="w-4 h-4 text-white group-hover/dl:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  </button>
);

/**
 * 📂 이미지 이동 모달
 */
const MoveModal = ({ shot, data, sessionId, onClose, onMove }: any) => {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-discord-sidebar w-full max-w-xs rounded-[8px] shadow-2xl overflow-hidden border border-white/5" onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm font-sans flex items-center gap-2">
            <svg className="w-4 h-4 text-discord-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            이동 위치 선택
          </h3>
          <button onClick={onClose} className="text-discord-text-muted hover:text-white transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto discord-scrollbar space-y-1">
          <button 
            onClick={() => onMove("")}
            className={`w-full text-left px-3 py-2 text-sm rounded-[3px] transition-colors flex items-center gap-2 ${!shot.gameTitle ? 'bg-discord-blue/20 text-discord-blue font-bold' : 'text-discord-text-normal hover:bg-discord-blue hover:text-white'}`}
          >
            <span>📂</span> 분류되지 않은 순간들
          </button>
          {data.games.map((g: any) => (
            <button 
              key={g.title} 
              onClick={() => onMove(g.title)}
              className={`w-full text-left px-3 py-2 text-sm rounded-[3px] transition-colors flex items-center gap-2 ${shot.gameTitle === g.title ? 'bg-discord-blue/20 text-discord-blue font-bold' : 'text-discord-text-normal hover:bg-discord-blue hover:text-white'}`}
            >
              <span>🎮</span> {g.title}
            </button>
          ))}
        </div>
        <div className="p-3 bg-black/10 flex justify-end">
          <button onClick={onClose} className="text-xs font-bold text-discord-text-muted hover:text-white transition-colors">닫기</button>
        </div>
      </div>
    </div>
  );
};

/**
 * 📤 수동 업로드 편집 모달
 */
const UploadEditModal = ({ file, data, sessionId, defaultGame = "", onClose }: any) => {
  const { data: session }: any = useSession();
  const [comment, setComment] = useState("");
  const [selectedGame, setSelectedGame] = useState(defaultGame);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleUpload = async () => {
    if (!session) return alert("로그인이 필요합니다.");
    setIsUploading(true);
    try {
      const fileRef = ref(storage, `screenshots/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);

      const sessionRef = doc(db, "sessions", sessionId);
      const newScreenshot = {
        url: downloadUrl,
        user: session.user.name,
        comment: comment.trim(),
        gameTitle: selectedGame,
        createdAt: new Date().toISOString()
      };
      
      await updateDoc(sessionRef, {
        screenshots: arrayUnion(newScreenshot)
      });
      
      onClose();
    } catch (err) {
      console.error("업로드 실패:", err);
      alert("업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-discord-sidebar w-full max-w-lg rounded-[8px] shadow-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-bold text-base font-sans">📸 사진 추가하기</h3>
          <button onClick={onClose} className="text-discord-text-muted hover:text-white transition-colors cursor-pointer">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="relative aspect-video rounded-[4px] overflow-hidden bg-black/20 border border-white/5">
            <img src={previewUrl} alt="미리보기" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-discord-text-muted uppercase font-sans">이미지 코멘트</label>
            <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="이 순간에 대한 설명을 적어주세요..." className="w-full bg-discord-server-list border-none rounded-[4px] px-3 py-2 text-sm text-discord-text-normal focus:outline-none focus:ring-1 focus:ring-discord-blue transition-all" />
            </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-discord-text-muted uppercase font-sans">게임 분류</label>
            <select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)} className="w-full bg-discord-server-list border-none rounded-[4px] px-3 py-2 text-sm text-discord-text-normal focus:outline-none cursor-pointer">
              <option value="">📂 분류되지 않은 순간들</option>
              {data.games.map((g: any) => (
                <option key={g.title} value={g.title}>🎮 {g.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4 bg-black/10 flex items-center justify-end gap-3 font-sans">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-white hover:underline transition-all cursor-pointer">취소</button>
          <button onClick={handleUpload} disabled={isUploading} className={`px-6 py-2 rounded-[3px] text-sm font-bold text-white transition-all shadow-lg ${isUploading ? 'bg-discord-blue/50 cursor-wait' : 'bg-discord-blue hover:bg-discord-blue-hover active:scale-95 cursor-pointer'}`}>{isUploading ? '업로드 중...' : '업로드 완료'}</button>
        </div>
      </div>
    </div>
  );
};

/**
 * ➕ 이미지 업로드 플레이스홀더
 */
const UploadPlaceholder = ({ onFileSelect }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
    } else {
      alert("이미지 파일만 업로드 가능합니다.");
    }
  };

  return (
    <div 
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
      className={`relative aspect-video rounded-[6px] border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 group/upload ${isDragging ? 'bg-discord-blue/10 border-discord-blue' : 'bg-black/5 border-white/5 hover:bg-black/10 hover:border-discord-blue/50'}`}
    >
      <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" accept="image/*" />
      <div className="w-10 h-10 rounded-full bg-discord-sidebar flex items-center justify-center text-discord-text-muted group-hover/upload:text-white group-hover/upload:bg-discord-blue transition-all">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-bold text-white font-sans">사진 추가</p>
        <p className="text-[9px] text-discord-text-muted font-sans hidden sm:block">클릭하거나 파일을 드래그</p>
      </div>
    </div>
  );
};

const ScreenshotItem = ({ shot, data, sessionId, onImageClick }: any) => {
  const { data: session }: any = useSession();
  const [showMoveModal, setShowMoveModal] = useState(false);
  const uploaderId = Object.keys(data.displayNames || {}).find(key => data.displayNames[key] === shot.user) || shot.user;
  const profileImage = data.profileImages?.[uploaderId] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uploaderId}&backgroundColor=f0f2f5`;
  
  const myId = session?.user?.id;
  const myServerName = (myId && data.displayNames[myId]) || session?.user?.name;
  const isAuthor = shot.user === myServerName;

  const handleMove = async (newGameTitle: string) => {
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedScreenshots = data.unclassifiedScreenshots.map((s: any) => {
        if (s.url === shot.url) return { ...s, gameTitle: newGameTitle };
        return s;
      });
      await updateDoc(sessionRef, { screenshots: updatedScreenshots });
      setShowMoveModal(false);
    } catch (err) { console.error("이동 실패:", err); }
  };

  const handleDelete = async () => {
    if (!window.confirm("이 사진을 영구적으로 삭제하시겠습니까?")) return;
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedScreenshots = data.unclassifiedScreenshots.filter((s: any) => s.url !== shot.url);
      await updateDoc(sessionRef, { screenshots: updatedScreenshots });
    } catch (err) { console.error("삭제 실패:", err); }
  };

  return (
    <div className="relative flex flex-col group/unit cursor-zoom-in font-sans" onClick={() => onImageClick(shot.url)}>
      <div className="bg-[#2B2D31] p-1 rounded-[6px] border border-black/20 group-hover/unit:border-white/10 transition-all duration-300 shadow-md relative">
        <div className="relative aspect-video rounded-[3px] overflow-hidden border border-black/40 group/shot">
          <img src={shot.url} alt="기록" className="w-full h-full object-cover transition-transform duration-500 group-hover/shot:scale-105" />
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-[3px] border border-white/5 font-sans z-20">
            <div className="w-3.5 h-3.5 rounded-full overflow-hidden border border-white/10 font-sans"><img src={profileImage} alt="" className="w-full h-full object-cover" /></div>
            <span className="text-[9px] font-bold text-white font-sans">{shot.user}</span>
          </div>
        </div>

        <div className="absolute top-2.5 right-2.5 flex gap-1 z-30 md:opacity-0 md:group-hover/unit:opacity-100 transition-all duration-300 scale-75 md:scale-90 origin-top-right">
          <div className="flex gap-1 items-center">
            {isAuthor && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="p-2 bg-black/60 hover:bg-red-500 backdrop-blur-md rounded-full border border-white/10 shadow-lg transition-all cursor-pointer" title="사진 삭제">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); setShowMoveModal(true); }} className={`p-2 backdrop-blur-md rounded-full border border-white/10 shadow-lg transition-all cursor-pointer ${showMoveModal ? 'bg-discord-blue text-white' : 'bg-black/60 hover:bg-discord-blue text-white'}`} title="다른 게임으로 이동">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
            </button>
          </div>
          <DownloadButton url={shot.url} />
        </div>

        {shot.comment && (
          <div className="mt-1.5 px-1 flex gap-1.5 items-start opacity-90 font-sans">
            <div className="w-[1px] h-2 bg-discord-text-muted rounded-full mt-1 shrink-0 font-sans" />
            <p className="text-[10px] text-discord-text-normal leading-tight font-medium italic font-sans">{shot.comment}</p>
          </div>
        )}
      </div>

      {showMoveModal && <MoveModal shot={shot} data={data} sessionId={sessionId} onClose={() => setShowMoveModal(false)} onMove={handleMove} />}
    </div>
  );
};

const ScreenshotSlider = ({ screenshots, data, sessionId, onImageClick, onFileSelect }: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };
  
  const hasShots = screenshots.length > 0;
  
  return (
    <div className={`relative group/slider mt-1 mb-3 ${!hasShots ? 'hidden md:block' : ''}`}>
      <div className="flex items-center justify-end mb-1 px-1 min-h-[20px]">
        <div className={`flex gap-1.5 opacity-0 group-hover/slider:opacity-100 transition-opacity ${!hasShots ? 'hidden' : ''}`}>
          <button onClick={() => scroll('left')} className="w-5 h-5 bg-discord-sidebar hover:bg-[#3F4147] rounded flex items-center justify-center text-white transition-colors cursor-pointer"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
          <button onClick={() => scroll('right')} className="w-5 h-5 bg-discord-sidebar hover:bg-[#3F4147] rounded flex items-center justify-center text-white transition-colors cursor-pointer"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 discord-scrollbar snap-x snap-mandatory px-1 font-sans">
        {screenshots.map((shot: any, idx: number) => (
          <div key={idx} className="shrink-0 w-60 md:w-72 snap-start">
            <ScreenshotItem shot={shot} data={data} sessionId={sessionId} onImageClick={onImageClick} />
          </div>
        ))}
        <div className={`shrink-0 w-60 md:w-72 snap-start ${!hasShots ? 'hidden md:block' : ''}`}>
          <UploadPlaceholder onFileSelect={onFileSelect} />
        </div>
      </div>
    </div>
  );
};

const GameCommentInput = ({ sessionId, gameTitle, data, allSessions, rootRef }: any) => {
  const { data: session }: any = useSession();
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isChecklistMode, setIsChecklistMode] = useState(false);
  const longPressTimer = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const myId = session?.user?.id;

  let myServerName = data.displayNames?.[myId];
  if (!myServerName && allSessions) {
    for (const s of allSessions) {
      if (s.serverName === data.serverName && s.displayNames?.[myId]) {
        myServerName = s.displayNames[myId];
        break;
      }
    }
  }
  myServerName = myServerName || session?.user?.name;

  let myServerImage = data.profileImages?.[myId];
  if (!myServerImage && allSessions) {
    for (const s of allSessions) {
      if (s.serverName === data.serverName && s.profileImages?.[myId]) {
        myServerImage = s.profileImages[myId];
        break;
      }
    }
  }
  myServerImage = myServerImage || session?.user?.image;

  // 📱 모바일 키보드 대응: VisualViewport API를 사용하여 키보드 높이만큼 입력창을 올림
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || window.innerWidth >= 768) return;

    const handleViewportChange = () => {
      if (isFocused && containerRef.current) {
        // 비주얼 뷰포트의 하단 여백을 계산하여 입력창의 bottom 위치를 조정
        // iOS Safari 등에서 툴바와 키보드 높이를 정확히 반영함
        const offset = window.innerHeight - vv.height - vv.offsetTop;
        containerRef.current.style.bottom = `${Math.max(0, offset)}px`;
      } else if (containerRef.current) {
        containerRef.current.style.bottom = '0px';
      }
    };

    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);
    
    // 키보드가 올라오는 시점에는 약간의 지연이 필요할 수 있음
    const timer = setTimeout(handleViewportChange, 100);

    return () => {
      clearTimeout(timer);
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, [isFocused]);

  useEffect(() => {
    if (isFocused && window.innerWidth < 768 && rootRef?.current) {
      // 입력창 활성화 시 해당 게임 섹션 전체를 최상단으로 올려 다음 게임이 안 보이게 함
      setTimeout(() => {
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [isFocused, rootRef]);

  const handleSubmit = async (isChecklist = false) => {
    const finalChecklist = isChecklist || isChecklistMode;
    if (!text.trim() || !session) return;
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = data.games.map((g: any) => {
        if (g.title === gameTitle) {
          if (finalChecklist) {
            const hasExisting = g.comments?.some((c: any) => c.isChecklist && c.userId === session.user.id);
            if (hasExisting && !window.confirm("이미 작성된 체크리스트가 있습니다. 새로운 내용으로 교체하시겠습니까?")) return g;
            const newComments = (g.comments || []).filter((c: any) => !(c.isChecklist && c.userId === session.user.id));
            return { ...g, comments: [...newComments, { userId: session.user.id, user: myServerName, image: myServerImage, text: text.trim(), createdAt: new Date().toISOString(), isChecklist: true, reactions: {}, replies: [] }]};
          }
          return { ...g, comments: [...(g.comments || []), { userId: session.user.id, user: myServerName, image: myServerImage, text: text.trim(), createdAt: new Date().toISOString(), isChecklist: false, reactions: {}, replies: [] }]};
        }
        return g;
      });
      await updateDoc(sessionRef, { games: updatedGames });
      setText("");
      setIsFocused(false);
      setIsChecklistMode(false);
    } catch (err) { console.error("댓글 등록 실패:", err); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(false); } };

  const handleLongPress = () => {
    if (window.navigator.vibrate) window.navigator.vibrate(50);
    setIsChecklistMode(prev => !prev);
  };

  if (!session) return null;

  return (
    <>
      {/* [Mobile Only] Backdrop: 터치 시 포커스 해제 */}
      {isFocused && (
        <div 
          className="fixed inset-0 z-[190] bg-black/40 md:hidden animate-in fade-in duration-300" 
          onClick={() => { setIsFocused(false); setIsChecklistMode(false); }}
        />
      )}

      {/* Input UI */}
      <div ref={containerRef} className={`
        ${isFocused ? 'fixed bottom-0 left-0 right-0 z-[200] bg-[#313338] p-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] border-t border-white/10 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] flex items-center gap-2 animate-in slide-in-from-bottom duration-300 transition-[bottom] ease-out' : 'mt-3 flex items-center gap-2 p-1.5 bg-[#383A40] rounded-[6px] group/input font-sans relative h-[42px]'}
        md:!static md:!mt-3 md:!flex md:!items-center md:!gap-2 md:!p-1.5 md:!bg-[#383A40] md:!rounded-[6px] md:!h-[42px] md:!shadow-none md:!border-none md:!z-auto md:!animate-none md:!transition-none
      `}>
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-discord-server-list font-sans hidden sm:block">
          <img src={myServerImage || ""} alt="" className="w-full h-full object-cover" />
        </div>
        <input 
          type="text" 
          value={text} 
          onFocus={() => setIsFocused(true)}
          onChange={(e) => setText(e.target.value)} 
          onKeyDown={onKeyDown} 
          autoComplete="off"
          autoCorrect="off"
          inputMode="text"
          enterKeyHint="send"
          placeholder={isChecklistMode ? "체크리스트 등록 모드..." : `${myServerName}님, ${gameTitle} 후기 작성...`} 
          className="flex-1 bg-transparent border-none outline-none text-[16px] md:text-[13px] text-discord-text-normal placeholder:text-discord-text-muted font-sans px-1 h-full" 
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden md:flex items-center gap-1.5">
            <button onClick={() => handleSubmit(true)} className={`text-[11px] font-bold px-3 py-1.5 rounded-[3px] transition-all cursor-pointer border ${text.trim() ? 'bg-discord-blue/10 border-discord-blue text-discord-blue hover:bg-discord-blue hover:text-white' : 'bg-discord-sidebar border-transparent text-discord-text-muted opacity-50'}`}>체크리스트</button>
            <button onClick={() => handleSubmit(false)} className={`text-[11px] font-bold px-4 py-1.5 rounded-[3px] transition-colors cursor-pointer ${text.trim() ? 'bg-discord-blue text-white' : 'bg-discord-sidebar text-discord-text-muted hover:text-white hover:bg-white/10 opacity-50'}`}>등록</button>
          </div>
          {(isFocused || text.trim()) && (
            <button 
              onClick={() => handleSubmit(false)} 
              onTouchStart={() => { longPressTimer.current = setTimeout(handleLongPress, 600); }}
              onTouchEnd={() => { if(longPressTimer.current) clearTimeout(longPressTimer.current); }}
              onMouseDown={() => { longPressTimer.current = setTimeout(handleLongPress, 600); }}
              onMouseUp={() => { if(longPressTimer.current) clearTimeout(longPressTimer.current); }}
              className={`md:hidden flex items-center justify-center transition-all cursor-pointer w-10 h-10 rounded-full shadow-lg ${isChecklistMode ? 'bg-[#F2A359] text-white ring-2 ring-[#F2A359]/30' : 'bg-discord-blue text-white'}`}
            >
              {isChecklistMode ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8m-3 0h6m-8 0c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2M12 12v9" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 6 22 2"></polygon></svg>
              )}
            </button>
          )}
        </div>
      </div>
      {isFocused && <div className="h-[80vh] mt-3 md:hidden" />}
      </>
      );
      };

const GameRecordRow = ({ game, gameIdx, data, sessionId, playersSet, handleAddReaction, handleAddReply, onImageClick, onFileSelect, allSessions }: any) => {
  const [isTimeExpanded, setIsTimeExpanded] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
  const gameRowRef = useRef<HTMLDivElement>(null);
  const gameShots = (data.unclassifiedScreenshots || []).filter((s: any) => s.gameTitle === game.title);

  const handleDeleteComment = async (commentIdx: number) => {
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = [...data.games];
      updatedGames[gameIdx].comments.splice(commentIdx, 1);
      await updateDoc(sessionRef, { games: updatedGames });
    } catch (err) { console.error(err); }
  };

  const handleDeleteReply = async (commentIdx: number, replyIdx: number) => {
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = [...data.games];
      updatedGames[gameIdx].comments[commentIdx].replies.splice(replyIdx, 1);
      await updateDoc(sessionRef, { games: updatedGames });
    } catch (err) { console.error(err); }
  };

  const allComments: any[] = game.comments || [];
  const checklists = allComments.filter(c => c.isChecklist);
  const regularComments = allComments.filter(c => !c.isChecklist);
  const sortedComments = [...checklists, ...regularComments];
  
  const displayComments = isCommentsExpanded ? sortedComments : sortedComments.slice(0, 10);
  const hasMoreComments = sortedComments.length > 10;

  return (
    <div ref={gameRowRef} key={gameIdx} className="bg-black/5 rounded-[6px] border border-white/5 border-l-2 border-l-discord-blue font-sans overflow-hidden mb-4 last:mb-0">
      <div className="p-3 md:p-4 pb-0">
        {/* Mobile Header */}
        <div className="md:hidden flex items-start justify-between gap-2 mb-3">
          <div className="flex gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-[6px] bg-discord-server-list flex items-center justify-center border border-black/20 overflow-hidden shrink-0 font-sans">
              {game.iconURL ? <img src={game.iconURL} alt="" className="w-full h-full object-contain p-1" /> : <span className="text-lg">🕹️</span>}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-white text-[13px] leading-tight truncate mb-1">{game.title}</h4>
              <div className="flex flex-wrap gap-1">
                {game.players?.slice(0, 3).map((player: string) => (
                  <div key={player} className="flex items-center gap-1 bg-[#1E1F22] px-1.5 py-0.5 rounded-[2px] border border-white/5 shrink-0">
                    <img src={data.profileImages?.[player] || ""} alt="" className="w-3 h-3 rounded-full object-cover" />
                    <span className="text-[9px] font-bold text-discord-text-normal truncate max-w-[40px]">{data.displayNames[player] || player}</span>
                    <span className="text-[8px] text-discord-text-muted font-black shrink-0">{formatDurationText(game.playerPlayTimes?.[player] || 0)}</span>
                  </div>
                ))}
                {game.players?.length > 3 && <span className="text-[9px] text-discord-text-muted font-bold flex items-center">+{game.players.length - 3}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="text-right">
                <div className="text-[8px] font-black text-discord-text-muted uppercase leading-none mb-0.5">PLAY TIME</div>
                <div className="text-white text-sm font-bold leading-none">{formatDurationText(game.playTimeMin)}</div>
              </div>
              <button onClick={() => setIsTimeExpanded(!isTimeExpanded)} className={`p-1 rounded-full transition-colors cursor-pointer ${isTimeExpanded ? 'bg-discord-blue text-white' : 'text-discord-text-muted hover:text-white hover:bg-white/10'}`}><svg className={`w-3 h-3 transition-transform ${isTimeExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
            </div>
            {isTimeExpanded && <div className="text-[10px] text-discord-text-muted font-bold mt-1 animate-in fade-in slide-in-from-top-1 duration-200">{formatTime(game.startTime)} ~ {formatTime(game.endTime)}</div>}
          </div>
        </div>

        {/* Desktop Header */}
        <div className={`hidden md:flex flex-col md:flex-row justify-between gap-4 font-sans ${gameShots.length > 0 ? 'mb-3' : 'mb-2'}`}>
          <div className="flex gap-3 font-sans">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-[6px] bg-discord-server-list flex items-center justify-center border border-black/20 overflow-hidden shrink-0 font-sans">
              {game.iconURL ? <img src={game.iconURL} alt="" className="w-full h-full object-contain p-1" /> : <span className="text-xl font-sans">🕹️</span>}
            </div>
            <div className="min-w-0 font-sans">
              <h4 className="font-bold text-white text-sm md:text-base mb-1.5 truncate font-sans">{game.title}</h4>
              <div className="flex flex-wrap gap-1 font-sans">
                {game.players?.map((player: string) => (
                  <Link key={player} href={`/profile/${player}`} className="flex items-center gap-1.5 bg-[#1E1F22] px-2 py-0.5 rounded-[3px] hover:bg-black/40 transition-colors font-sans">
                    <div className="w-4 h-4 rounded-full overflow-hidden border border-white/10 font-sans">
                      <img src={data.profileImages?.[player] || ""} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-bold text-discord-text-normal font-sans truncate">{data.displayNames[player] || player}</span>
                    <span className="text-[8px] text-discord-text-muted font-bold ml-0.5 font-sans">{formatDurationText(game.playerPlayTimes?.[player] || 0)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="md:text-right shrink-0 flex flex-col justify-center font-sans">
            <div className="flex items-center md:justify-end gap-1.5">
              <div className="flex flex-col">
                <div className="text-[9px] font-black text-discord-text-muted uppercase tracking-wider mb-0.5 font-sans">게임 총 플레이</div>
                <div className="text-white text-lg font-bold font-sans">{formatDurationText(game.playTimeMin)}</div>
              </div>
              <button onClick={() => setIsTimeExpanded(!isTimeExpanded)} className={`p-1 rounded-full transition-colors cursor-pointer mt-2 ${isTimeExpanded ? 'bg-discord-blue text-white' : 'text-discord-text-muted hover:text-white hover:bg-white/10'}`}><svg className={`w-3.5 h-3.5 transition-transform ${isTimeExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
            </div>
            {isTimeExpanded && <div className="text-[10px] text-discord-text-muted font-bold mt-1 font-sans animate-in fade-in slide-in-from-top-1 duration-200">{formatTime(game.startTime)} ~ {formatTime(game.endTime)}</div>}
          </div>
        </div>

        <div className={`border-t border-white/5 mt-2 pt-2 ${gameShots.length === 0 ? 'hidden md:block' : ''}`} />
        <ScreenshotSlider screenshots={gameShots} data={data} sessionId={sessionId} onImageClick={onImageClick} onFileSelect={(file: File) => onFileSelect(file, game.title)} allSessions={allSessions} />
      </div>
      <div className="bg-black/20 px-3 py-2 md:px-4 md:py-2.5 border-t border-white/5">
        <p className="text-[10px] font-black text-discord-text-muted uppercase tracking-wider mb-2">우리들의 하소연</p>
        <div className="space-y-0 font-sans">
          {hasMoreComments && !isCommentsExpanded && (
            <button onClick={() => setIsCommentsExpanded(true)} className="w-full py-1.5 mb-3 text-[11px] font-bold text-discord-blue hover:underline bg-discord-blue/5 rounded transition-all cursor-pointer border border-discord-blue/10">이전 댓글 {sortedComments.length - 10}개 더보기</button>
          )}
          {displayComments.map((comm: any) => {
            const originalIdx = allComments.indexOf(comm);
            return (
              <CommentItem 
                key={originalIdx} 
                comment={comm} 
                onAddReaction={(emoji: string) => handleAddReaction(gameIdx, originalIdx, emoji)} 
                onAddReactionReply={(replyIdx: number, emoji: string) => handleAddReaction(gameIdx, originalIdx, emoji, replyIdx)}
                onAddReply={(text: string) => handleAddReply(gameIdx, originalIdx, text)} 
                onDelete={() => handleDeleteComment(originalIdx)} 
                onDeleteReply={(replyIdx: number) => handleDeleteReply(originalIdx, replyIdx)}
                displayNames={data.displayNames} 
              />
            );
          })}
          <GameCommentInput sessionId={sessionId} gameTitle={game.title} data={data} allSessions={allSessions} rootRef={gameRowRef} />
        </div>
      </div>
    </div>
  );
};

const DiaryCard = ({ data, playersSet, sessionId, onImageClick, allSessions }: any) => {
  const { data: session }: any = useSession();
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{file: File, defaultGame: string} | null>(null);
  const unclassifiedShots = (data.unclassifiedScreenshots || []).filter((s: any) => !s.gameTitle || s.gameTitle === "미지정");

  const participantTotalTimes = useMemo(() => {
    const times: { [userId: string]: number } = {};
    if (data.participantLogs && Object.keys(data.participantLogs).length > 0) {
      Object.entries(data.participantLogs).forEach(([userId, logs]: [string, any]) => {
        let totalMs = 0;
        logs.forEach((log: any) => {
          const start = log.joinTime?.seconds ? log.joinTime.seconds * 1000 : (log.joinTime ? new Date(log.joinTime).getTime() : null);
          const end = log.leaveTime?.seconds ? log.leaveTime.seconds * 1000 : (log.leaveTime ? new Date(log.leaveTime).getTime() : (data.endTime?.seconds ? data.endTime.seconds * 1000 : new Date().getTime()));
          
          if (start && end) totalMs += (end - start);
        });
        times[userId] = Math.max(1, Math.round(totalMs / 60000));
      });
    } else {
      // Fallback: everyone gets the total session duration, but at least 1 min if they were present
      const duration = Math.max(1, data.totalDurationMin || 0);
      data.participants.forEach((p: string) => { times[p] = duration; });
    }
    return times;
  }, [data]);

  const handleAddReaction = async (gameIdx: number, commentIdx: number, emoji: string, replyIdx?: number) => {
    if (!session) return alert("로그인이 필요합니다.");
    const myId = session.user.id;
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = [...data.games];
      let target = updatedGames[gameIdx].comments[commentIdx];
      
      if (replyIdx !== undefined) {
        if (!target.replies) target.replies = [];
        target = target.replies[replyIdx];
      }

      if (!target.reactions) target.reactions = {};
      if (!target.reactions[emoji]) target.reactions[emoji] = [];
      if (target.reactions[emoji].includes(myId)) {
        target.reactions[emoji] = target.reactions[emoji].filter((id: string) => id !== myId);
        if (target.reactions[emoji].length === 0) delete target.reactions[emoji];
      } else target.reactions[emoji].push(myId);
      await updateDoc(sessionRef, { games: updatedGames });
    } catch (err) { console.error(err); }
  };

  const handleAddReply = async (gameIdx: number, commentIdx: number, text: string) => {
    if (!session) return alert("로그인이 필요합니다.");
    const myId = session.user.id;
    let myServerName = data.displayNames?.[myId];
    if (!myServerName && allSessions) {
      for (const s of allSessions) {
        if (s.serverName === data.serverName && s.displayNames?.[myId]) {
          myServerName = s.displayNames[myId];
          break;
        }
      }
    }
    myServerName = myServerName || session.user.name;

    let myServerImage = data.profileImages?.[myId];
    if (!myServerImage && allSessions) {
      for (const s of allSessions) {
        if (s.serverName === data.serverName && s.profileImages?.[myId]) {
          myServerImage = s.profileImages[myId];
          break;
        }
      }
    }
    myServerImage = myServerImage || session.user.image;

    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const updatedGames = [...data.games];
      const comment = updatedGames[gameIdx].comments[commentIdx];
      if (!comment.replies) comment.replies = [];
      comment.replies.push({ userId: myId, user: myServerName, image: myServerImage, text: text, createdAt: new Date().toISOString() });
      await updateDoc(sessionRef, { games: updatedGames });
    } catch (err) { console.error(err); }
  };

  return (
    <>
      <div className="flex flex-col gap-3 bg-black/10 p-3 md:p-4 rounded-[8px] border border-white/5 font-sans mb-6">
        <div className="flex flex-wrap items-center gap-4 md:gap-8 font-sans">
          <div className="flex flex-col font-sans shrink-0">
            <span className="text-[10px] font-black text-discord-text-muted uppercase tracking-wider mb-0.5 font-sans">총 대화 시간</span>
            <div className="text-white text-base font-bold font-sans">{formatDurationText(data.totalDurationMin)}</div>
          </div>
          <div className="flex items-center gap-2.5 bg-[#2B2D31] px-3 py-1.5 rounded-[6px] border border-white/5 shrink-0 font-sans">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-discord-text-muted uppercase leading-none mb-1 font-sans">세션 기간</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-white leading-none font-sans">{formatTime(data.startTime)}</span>
                <span className="text-[10px] text-discord-text-muted font-bold font-sans">~</span>
                <span className="text-[12px] font-bold text-white leading-none font-sans">{formatTime(data.endTime)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col ml-auto font-sans">
            <span className="text-[10px] font-black text-discord-text-muted uppercase tracking-wider mb-1.5 font-sans px-1">함께한 친구들</span>
            <div className="flex items-center gap-2 font-sans">
              <div className="flex -space-x-1 font-sans">
                {data.participants.slice(0, 10).map((p: string, i: number) => (
                  <Link key={p} href={`/profile/${p}`} className="w-7 h-7 rounded-full border-2 border-discord-main-content bg-discord-sidebar overflow-hidden hover:scale-110 transition-transform font-sans" style={{ zIndex: 10 - i }}><img src={data.profileImages?.[p] || ""} alt={p} className="w-full h-full object-cover" /></Link>
                ))}
                {data.participants.length > 10 && <div className="w-7 h-7 rounded-full border-2 border-discord-main-content bg-discord-sidebar text-white flex items-center justify-center text-[8px] font-bold z-0 font-sans">+{data.participants.length - 10}</div>}
              </div>
              <button onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)} className={`p-0.5 rounded-full transition-colors cursor-pointer font-sans ${isParticipantsExpanded ? 'bg-discord-blue text-white' : 'text-discord-text-muted hover:text-white hover:bg-white/10'}`}><svg className={`w-3 h-3 transition-transform ${isParticipantsExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
            </div>
          </div>
        </div>
        {isParticipantsExpanded && (
          <div className="pt-3 border-t border-white/5 flex flex-wrap gap-1.5 font-sans">
            {data.participants.map((p: string) => (
              <Link key={p} href={`/profile/${p}`} className="flex items-center gap-1.5 bg-[#1E1F22] px-2 py-0.5 rounded-[3px] hover:bg-black/40 transition-colors font-sans border border-white/5"><div className="w-4 h-4 rounded-full overflow-hidden border border-white/10 font-sans"><img src={data.profileImages?.[p] || ""} alt="" className="w-full h-full object-cover" /></div><div className="flex items-center gap-1 min-w-0 font-sans"><span className="text-[10px] font-bold text-discord-text-normal font-sans truncate">{data.displayNames[p] || p}</span>{!playersSet.has(p) && <span className="text-[8px] text-discord-text-muted font-medium font-sans shrink-0">(관전)</span>}<span className="text-[8px] text-discord-text-muted font-black ml-0.5 font-sans shrink-0">{formatDurationText(participantTotalTimes[p] || 0)}</span></div></Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 mb-8 font-sans">
        <p className="text-[10px] font-black uppercase tracking-widest text-discord-text-muted px-1 font-sans">플레이 기록</p>
        {data.games.length > 0 ? data.games.map((game: any, gameIdx: number) => (
          <GameRecordRow key={gameIdx} game={game} gameIdx={gameIdx} data={data} sessionId={sessionId} playersSet={playersSet} handleAddReaction={handleAddReaction} handleAddReply={handleAddReply} onImageClick={onImageClick} onFileSelect={(file: File, gameTitle: string) => setPendingUpload({file, defaultGame: gameTitle})} allSessions={allSessions} />
        )) : (
          <div className="bg-black/5 rounded-[6px] border border-white/5 border-l-2 border-l-discord-blue p-8 flex items-center justify-center font-sans"><span className="text-discord-text-muted text-sm font-bold italic">오늘은 대화만 나눴네요</span></div>
        )}
      </div>

      <div className="space-y-3 font-sans mt-8">
        <div className="px-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-discord-text-muted font-sans">분류되지 않은 순간들</p>
        </div>
        <div className="font-sans">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {unclassifiedShots.map((shot: any, idx: number) => (
              <ScreenshotItem key={idx} shot={shot} data={data} sessionId={sessionId} onImageClick={onImageClick} allSessions={allSessions} />
            ))}
            <UploadPlaceholder onFileSelect={(file: File) => setPendingUpload({file, defaultGame: ""})} />
          </div>
        </div>
      </div>

      {pendingUpload && (
        <UploadEditModal 
          file={pendingUpload.file} 
          data={data} 
          sessionId={sessionId} 
          defaultGame={pendingUpload.defaultGame}
          onClose={() => setPendingUpload(null)} 
        />
      )}
    </>
  );
};

function HomeContent() {
  const { data: session }: any = useSession();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setNewTitle] = useState("");
  
  // 📱 모바일 뷰 상태 관리
  const [viewMode, setViewMode] = useState<'list' | 'diary'>('list');
  const touchRef = useRef({ startX: 0, startY: 0 });
  const searchParams = useSearchParams();

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
          startTime: d.startTime,
          endTime: d.endTime,
          participants: d.participants || [],
          participantLogs: d.participantLogs || {},
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

  const current = sessions.find(s => s.id === selectedId) || sessions[0];

  useEffect(() => {
    if (loading) return;
    
    // URL 파라미터에서 ID 확인
    const urlId = searchParams?.get('id');
    
    if (sessions.length > 0) {
      if (urlId && sessions.some(s => s.id === urlId)) {
        setSelectedId(urlId);
      } else {
        const selectedExists = sessions.some(s => s.id === selectedId);
        if (!selectedId || !selectedExists) setSelectedId(sessions[0].id);
      }
    } else setSelectedId(null);
  }, [sessions, loading, selectedId, searchParams]);

  useEffect(() => {
    if (current) setNewTitle(current.sessionTitle);
  }, [current]);

  // 📱 모바일 전용 이벤트 핸들러
  useEffect(() => {
    const handlePopState = () => {
      if (window.innerWidth < 768) setViewMode('list');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (viewMode === 'diary') document.body.classList.add('mobile-view-active');
    else document.body.classList.remove('mobile-view-active');
  }, [viewMode]);

  const handleDiarySelect = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth < 768) {
      setViewMode('diary');
      window.history.pushState({ view: 'diary' }, '');
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchRef.current.startX;
    const deltaY = e.changedTouches[0].clientY - touchRef.current.startY;
    // 왼쪽 끝에서 오른쪽으로 스와이프 (뒤로가기 제스처)
    if (deltaX > 100 && Math.abs(deltaY) < 50 && touchRef.current.startX < 40) {
      if (viewMode === 'diary') window.history.back();
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm("정말로 이 일기를 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try { await deleteDoc(doc(db, "sessions", id)); } catch (err) { console.error(err); }
  };

  const handleUpdateTitle = async () => {
    if (!current || !tempTitle.trim() || tempTitle === current.sessionTitle) { setIsEditingTitle(false); return; }
    try { 
      await updateDoc(doc(db, "sessions", current.id), { sessionTitle: tempTitle.trim() }); 
      setIsEditingTitle(false); 
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

  const filteredSessions = sessions.filter(s => 
    s.sessionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.serverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.games.some((g:any) => g.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const playedUsers = new Set(current?.games.flatMap((g: any) => g.players || []));

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black bg-discord-main-content text-white font-sans text-xl animate-pulse">LOADING DIARY...</div>;

  return (
    <div 
      className="flex flex-1 h-full overflow-hidden relative"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Column 2: Sidebar (Previous Diaries) */}
      <aside className={`fixed md:relative z-40 h-full bg-discord-sidebar flex flex-col font-sans transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[calc(100vw-72px)] md:w-60 shrink-0' : 'w-0 overflow-hidden'} ${viewMode === 'diary' ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        <div className="h-12 flex items-center px-4 shadow-sm border-b border-black/20 shrink-0">
          <h1 className="font-black text-sm tracking-tight text-white uppercase truncate">게임 일기장</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto discord-scrollbar p-3 space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-black text-discord-text-muted uppercase tracking-wider px-2 mb-1">일기 검색</p>
            <div className="px-2">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="제목, 서버, 게임 검색..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-discord-server-list border-none rounded-[4px] px-2 py-1.5 text-xs font-medium text-discord-text-normal focus:outline-none transition-all" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            <p className="text-[11px] font-black text-discord-text-muted uppercase tracking-wider px-2 mb-2">이전 기록 ({filteredSessions.length})</p>
            {filteredSessions.map(s => (
              <button 
                key={s.id} 
                onClick={() => handleDiarySelect(s.id)} 
                className={`w-full text-left px-2 py-1 md:py-1.5 rounded-[4px] flex items-center gap-2 group transition-colors ${selectedId === s.id ? 'bg-[#3F4147] text-white' : 'text-discord-text-muted hover:bg-[#35373C] hover:text-discord-text-normal'}`}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-discord-server-list flex items-center justify-center shrink-0">
                  {s.serverIconURL ? (
                    <img src={s.serverIconURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold">{s.serverName.charAt(0)}</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-bold truncate leading-tight">{s.sessionTitle}</span>
                  <span className="text-[10px] font-medium opacity-60">{formatDate(s.date)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* User Info Bar */}
        <div className="bg-[#232428] px-3 md:px-2 py-3 md:py-1.5 flex items-center justify-between shrink-0 group/user">
          {session ? (
            <>
              <div className="flex items-center gap-3 md:gap-2 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 md:w-8 md:h-8 rounded-full overflow-hidden">
                    <img src={session.user?.image || ""} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 md:w-2.5 md:h-2.5 bg-discord-success border-2 border-[#232428] rounded-full z-10" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] md:text-[12px] font-bold text-white truncate leading-none mb-1 md:mb-0.5">{session.user?.name}</span>
                  <span className="text-[11px] md:text-[10px] text-discord-text-muted leading-none">@{session.user?.username || '온라인'}</span>
                </div>
              </div>
              <button 
                onClick={() => signOut()} 
                className="p-1.5 text-discord-text-muted hover:text-white hover:bg-white/10 rounded-[4px] transition-colors cursor-pointer shrink-0"
                title="로그아웃"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            </>
          ) : (
            <button onClick={() => signIn('discord')} className="w-full py-1.5 bg-discord-blue hover:bg-[#4752C4] text-white text-[11px] font-bold rounded-[3px] transition-colors">디스코드 로그인</button>
          )}
        </div>
      </aside>

      {/* Column 3: Main Content */}
      <section className={`flex-1 flex flex-col bg-discord-main-content min-w-0 relative transition-transform duration-300 ease-in-out ${viewMode === 'diary' ? 'translate-x-0' : 'translate-x-full md:translate-x-0 fixed inset-0 md:relative z-50'}`}>
        {/* Header */}
        <header className="h-16 md:h-12 flex items-center justify-between px-4 shadow-sm border-b border-black/20 shrink-0 z-20 pt-[env(safe-area-inset-top)] md:pt-0 box-content">
          <div className="flex items-center gap-3">
            <div className="text-discord-text-muted flex items-center gap-2">
              <span className="text-xl font-light shrink-0">#</span>
              <div className="relative flex items-center md:items-baseline md:gap-2 min-w-0">
                {isEditingTitle ? (
                  <input 
                    type="text" 
                    value={tempTitle} 
                    onChange={(e) => setNewTitle(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()} 
                    onBlur={handleUpdateTitle} 
                    autoFocus 
                    className="bg-[#1E1F22] text-white font-bold text-base outline-none px-2 py-0.5 rounded-[4px] border border-white/10 w-full max-w-[200px] sm:max-w-[300px]" 
                  />
                ) : (
                  <h2 className="text-white font-bold text-base truncate cursor-pointer hover:bg-white/5 px-2 py-0.5 rounded transition-colors" onClick={() => setIsEditingTitle(true)}>{current?.sessionTitle || '기록 없음'}</h2>
                )}
                {current?.date && (
                  <span className="text-[10px] md:text-xs font-medium text-discord-text-muted truncate px-2 md:px-0 absolute md:static top-6 md:top-0 left-0 md:left-auto whitespace-nowrap">
                    {formatDate(current.date)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-discord-text-muted shrink-0">
             <button onClick={handleShare} className="hover:text-white transition-colors p-1" title="공유"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg></button>
             {current && <button onClick={() => handleDeleteSession(current.id)} className="hover:text-red-400 transition-colors p-1" title="삭제"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto discord-scrollbar">
          <div className="w-full pt-6 md:pt-2 pb-24 px-1 md:px-2 lg:px-3">
            {current ? (
              <DiaryCard 
                key={current.id} 
                data={current} 
                playersSet={playedUsers} 
                sessionId={current.id} 
                onImageClick={(url:string) => setActiveImageUrl(url)} 
                allSessions={sessions}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-discord-text-muted">
                <span className="text-6xl mb-4">🔍</span>
                <p className="font-bold">일기를 찾을 수 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {activeImageUrl && (<Lightbox imageUrl={activeImageUrl} onClose={() => setActiveImageUrl(null)} />)}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black bg-discord-main-content text-white font-sans text-xl animate-pulse">LOADING DIARY...</div>}>
      <HomeContent />
    </Suspense>
  );
}
