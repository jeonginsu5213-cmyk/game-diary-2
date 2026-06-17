"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from "@/src/lib/supabase"; 
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Lightbox from '@/components/Lightbox';
import CommentItem from '@/components/CommentItem';
import { formatDurationText, formatDate, formatTime, getObjectParticle, maskNickname } from "@/src/lib/utils";
import DiarySidebar from '@/components/diary/DiarySidebar';
import DiaryHeader from '@/components/diary/DiaryHeader';
import { BentoGrid, BentoItem } from '@/components/diary/BentoGrid';
import { Gamepad2, Camera, MessageCircleMore, Clock, ChevronDown, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FolderInput, Pin, Calendar, Star } from 'lucide-react';
import { Pagination } from "@ark-ui/react/pagination";
import SidebarSortDropdown from '@/components/diary/SidebarSortDropdown';
import SidebarPagination from '@/components/diary/SidebarPagination';
import MoveModal from '@/components/diary/MoveModal';
import UploadEditModal from '@/components/diary/UploadEditModal';
import UploadPlaceholder from '@/components/diary/UploadPlaceholder';
import GameCommentInput from '@/components/diary/GameCommentInput';
import GameCommentList from '@/components/diary/GameCommentList';
import DownloadButton, { handleDownload } from '@/components/diary/DownloadButton';
import ScreenshotItem from '@/components/diary/ScreenshotItem';
import FloatingScreenshotPreview from '@/components/diary/FloatingScreenshotPreview';
import BackgroundPreview from '@/components/diary/BackgroundPreview';
import { Drawer, DrawerPopup, DrawerHeader, DrawerTitle, DrawerDescription, DrawerPanel, DrawerTrigger, DrawerClose, Button } from '@/components/diary/Drawer';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import MobileScreenshotCarousel from '@/components/diary/MobileScreenshotCarousel';

// --- Diary List Item Component (Swipe to Favorite) ---

interface DiaryListItemProps {
  session: any;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
}

function DiaryListItem({ session: s, isSelected, isFavorite, onSelect, onToggleFavorite }: DiaryListItemProps) {
  const x = useMotionValue(0);
  const iconScale = useTransform(x, [0, -50], [0.6, 1.15]);
  const iconOpacity = useTransform(x, [0, -40], [0, 1]);

  return (
    <div className="relative overflow-hidden rounded-lg w-full flex items-center">
      {/* Swipe Star Icon Background (Right-aligned for left swipe) */}
      <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-3 pointer-events-none z-0">
        <motion.div 
          style={{ scale: iconScale, opacity: iconOpacity }}
          className="w-7 h-7 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500"
        >
          <Star className="w-3.5 h-3.5 fill-yellow-500" strokeWidth={3} />
        </motion.div>
      </div>

      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 28 }}
        style={{ x }}
        onDragEnd={(event, info) => {
          if (x.get() < -50) {
            onToggleFavorite(s.id, isFavorite);
            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate(30);
            }
          }
        }}
        className="w-full relative z-10 !touch-pan-y"
      >
        <button 
          onClick={() => onSelect(s.id)} 
          className={`w-full text-left pl-3 pr-4 py-2 rounded-lg flex items-center gap-2.5 transition-all duration-200 ${isSelected ? 'bg-muted/80 text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
        >
          <div className="w-5 h-5 rounded-md overflow-hidden bg-background border border-border/50 shrink-0 flex items-center justify-center shadow-sm">
            {s.guild_icon ? (
              <img src={s.guild_icon} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">
                {s.guild_name?.charAt(0) || 'G'}
              </div>
            )}
          </div>
          <span className={`text-[12px] truncate tracking-tight transition-all flex-1 ${isSelected ? 'font-semibold' : 'font-medium'}`}>{s.title}</span>
          <span className={`text-[10px] font-mono tracking-tighter opacity-30 shrink-0 flex items-center gap-1.5`}>
            {isFavorite && (
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 shrink-0" strokeWidth={2.5} />
            )}
            {new Date(s.start_time).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
          </span>
        </button>
      </motion.div>
    </div>
  );
}

// --- Main Content Component ---

function HomeContent() {
  const { data: session, status }: any = useSession();
  const router = useRouter();

  const renderChecklist = (game: any) => {
    const checklistComments = game.comments?.filter((c: any) => c.is_checklist) || [];
    if (checklistComments.length === 0) return null;
    
    return (
      <div className="mb-0 space-y-1.5 px-0 animate-in fade-in duration-300">
        {checklistComments.map((c: any) => {
          const hasLoggedIn = !!profiles?.[c.user_id]?.has_logged_in;
          const displayName = hasLoggedIn 
            ? (profiles?.[c.user_id]?.display_name || 'Anonymous') 
            : maskNickname(profiles?.[c.user_id]?.display_name || 'Anonymous');
          
          return (
            <div 
              key={c.id} 
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-xl bg-primary/5 border border-primary/10 group animate-in fade-in duration-300"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Avatar */}
                <div className="w-5 h-5 rounded-full overflow-hidden border border-border/30 shrink-0">
                  {profiles?.[c.user_id]?.avatar_url ? (
                    <img 
                      src={profiles[c.user_id].avatar_url} 
                      className="w-full h-full object-cover" 
                      alt="" 
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[8px] font-black text-primary uppercase">
                      {displayName.charAt(0)}
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-medium text-foreground/90 break-words flex-1 leading-normal translate-y-[1px]">
                  <span className="font-bold text-foreground mr-1.5">{displayName}:</span>
                  {c.content}
                </span>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Delete button */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={async () => { 
                      if (window.confirm("삭제할까요?")) { 
                        await supabase.from('comments').delete().eq('id', c.id); 
                        fetchData(); 
                      } 
                    }}
                    className="text-[9px] font-bold text-muted-foreground/60 hover:text-red-500 transition-colors px-1"
                  >
                    삭제
                  </button>
                </div>

                {/* Pin Toggle Button on the Right */}
                <button 
                  onClick={() => handleToggleChecklist(c.id, c.is_checklist, game.id)}
                  className="w-5 h-5 rounded-md border border-primary/30 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/95 transition-colors shrink-0"
                  title="고정 해제"
                >
                  <Pin className="w-3 h-3 rotate-45" strokeWidth={3} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  // Prevent main layout scroll container from interfering with our custom scroll columns
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.remove('overflow-y-auto');
      mainEl.classList.add('overflow-hidden', 'h-full');
    }
    return () => {
      if (mainEl) {
        mainEl.classList.remove('overflow-hidden', 'h-full');
        mainEl.classList.add('overflow-y-auto');
      }
    };
  }, []);

  const [sessions, setSessions] = useState<any[]>([]);
  const [favoriteSessionIds, setFavoriteSessionIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeShot, setActiveShot] = useState<any | null>(null);
  const [hoveredShot, setHoveredShot] = useState<any | null>(null);
  const [hoveredUncatShot, setHoveredUncatShot] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setNewTitle] = useState("");
  const [pendingUpload, setPendingUpload] = useState<{file: File, defaultGame: string} | null>(null);
  const [movingShot, setMovingShot] = useState<any | null>(null);
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({});
  const [activeMoveShotId, setActiveMoveShotId] = useState<string | null>(null);
  const [screenshotPages, setScreenshotPages] = useState<Record<string, number>>({});
  const [newShotId, setNewShotId] = useState<string | null>(null);
  const [isUncatDrawerOpen, setIsUncatDrawerOpen] = useState(false);
  const [uncatCarouselApi, setUncatCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeReply, setActiveReply] = useState<{
    gameId: string;
    commentId: string;
    userName: string;
  } | null>(null);

  // 모바일 리액션 상세 바텀 시트 상태
  const [reactionDetailOpen, setReactionDetailOpen] = useState(false);
  const [reactionDetailCommentId, setReactionDetailCommentId] = useState<string | null>(null);
  const [reactionDetailEmoji, setReactionDetailEmoji] = useState<string | null>(null);

  const activeReactionComment = useMemo(() => {
    if (!reactionDetailCommentId) return null;
    for (const s of sessions) {
      for (const sg of s.session_games || []) {
        for (const c of sg.comments || []) {
          if (c.id === reactionDetailCommentId) return c;
        }
      }
    }
    return null;
  }, [reactionDetailCommentId, sessions]);

  const handleOpenReactionDetail = (commentId: string, emoji: string) => {
    setReactionDetailCommentId(commentId);
    setReactionDetailEmoji(emoji);
    setReactionDetailOpen(true);
  };

  useEffect(() => {
    setActiveReply(null);
  }, [selectedId]);

  // Sync Carousel states for immediate button responsiveness
  useEffect(() => {
    if (!uncatCarouselApi) return;

    const onSelect = () => {
      setCanScrollPrev(uncatCarouselApi.canScrollPrev());
      setCanScrollNext(uncatCarouselApi.canScrollNext());
      setCurrentSlide(uncatCarouselApi.selectedScrollSnap());
    };

    onSelect();
    uncatCarouselApi.on("select", onSelect);
    uncatCarouselApi.on("scroll", onSelect); // Update while dragging too

    return () => {
      uncatCarouselApi.off("select", onSelect);
      uncatCarouselApi.off("scroll", onSelect);
    };
  }, [uncatCarouselApi]);
  
  const [viewMode, setViewMode] = useState<'list' | 'diary'>('list');
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'desc' | 'asc' | 'playtime' | 'favorites'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const searchParams = useSearchParams();
  const pageSize = 10;
  const viewParam = searchParams?.get('view');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setVisibleCount(15);
  }, [searchTerm, sortBy]);

  useEffect(() => {
    if (viewParam === 'diary') {
      setViewMode('diary');
    } else {
      setViewMode('list');
    }
  }, [viewParam]);

  const fetchFavorites = async () => {
    if (!supabase || !session?.user?.id) {
      setFavoriteSessionIds(new Set());
      return;
    }
    const { data } = await supabase
      .from('session_favorites')
      .select('session_id')
      .eq('user_id', session.user.id);
    if (data) {
      setFavoriteSessionIds(new Set(data.map((f: any) => f.session_id)));
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [session]);

  // 1. Core Data Fetching
  const fetchData = async () => {
    console.log("Fetching data from Supabase...");
    
    // Safety Check: Verify supabase object
    if (!supabase || !(supabase as any).supabaseUrl) {
      console.error("❌ Supabase client is not properly initialized!", supabase);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('sessions')
      .select('*, session_games(*, comments(*), session_game_players(*)), screenshots(*), session_participants(*)')
      .order('start_time', { ascending: false });

    if (error) {
      console.error("Supabase fetching error:", error.message, error.details, error.hint);
      setLoading(false);
      return;
    }

    if (data) {
      console.log("Data fetched successfully:", data.length, "sessions found.");
      setSessions(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channels = supabase.channel('diary-realtime-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screenshots' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_favorites' }, fetchFavorites)
      .subscribe();
    return () => { supabase.removeChannel(channels); };
  }, [session]);

  // 2. Computed States
  const [profiles, setProfiles] = useState<any>({});
  useEffect(() => {
    async function fetchProfiles() {
      const { data } = await supabase.from('profiles').select('*');
      if (data) setProfiles(data.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {}));
    }
    fetchProfiles();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchesSearch = (s.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUser = session?.user?.id 
        ? s.session_participants?.some((p: any) => p.user_id === session.user.id)
        : false;
      return matchesSearch && matchesUser;
    });
  }, [sessions, searchTerm, session]);

  const sortedSessions = useMemo(() => {
    let list = [...filteredSessions];
    if (sortBy === 'favorites') {
      list = list.filter(s => favoriteSessionIds.has(s.id));
    }
    return list.sort((a, b) => {
      if (sortBy === 'playtime') {
        return (b.total_duration_min || 0) - (a.total_duration_min || 0);
      }
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return sortBy === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }, [filteredSessions, sortBy, favoriteSessionIds]);

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedSessions.slice(start, start + pageSize);
  }, [sortedSessions, currentPage]);

  const mobileSessions = useMemo(() => {
    return sortedSessions.slice(0, visibleCount);
  }, [sortedSessions, visibleCount]);

  const current = useMemo(() => {
    const s = sortedSessions.find(s => s.id === selectedId) || sortedSessions[0];
    if (s) {
      s.session_games?.forEach((g: any) => {
        g.comments?.sort((a: any, b: any) => {
          if (a.is_checklist && !b.is_checklist) return -1;
          if (!a.is_checklist && b.is_checklist) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      });
    }
    return s;
  }, [sortedSessions, selectedId]);

  const sortedParticipants = useMemo(() => {
    if (!current?.session_participants) return [];
    return [...current.session_participants].sort((a: any, b: any) => 
      (b.duration_min || 0) - (a.duration_min || 0)
    );
  }, [current?.session_participants]);

  // 3. Dependent Side Effects (Placed AFTER 'current' definition)
  
  // Reset pagination when search or sort changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy]);

  // Reset screenshot gallery pages when diary changes
  useEffect(() => { setScreenshotPages({}); }, [selectedId]);

  // 3. Derived states for pagination stability
  const normalizedScreenshotPages = useMemo(() => {
    if (!current) return {};
    const SHOTS_PER_PAGE = 5;
    const normalized: Record<string, number> = { ...screenshotPages };

    const validate = (key: string, items: any[]) => {
      const totalPages = Math.ceil((items.length + 1) / SHOTS_PER_PAGE);
      const currentPage = screenshotPages[key] || 1;
      if (currentPage > totalPages) normalized[key] = Math.max(1, totalPages);
      else if (totalPages === 1) normalized[key] = 1;
    };

    current.session_games?.forEach((g: any) => {
      const shots = current.screenshots?.filter((s: any) => s.game_title === g.title) || [];
      validate(g.id, shots);
    });

    const uncatShots = current.screenshots?.filter((s: any) => !s.game_title) || [];
    const UNCAT_SHOTS_PER_PAGE = 12;
    const totalUncatPages = Math.ceil((uncatShots.length + 1) / UNCAT_SHOTS_PER_PAGE);
    const currentUncatPage = screenshotPages['uncategorized'] || 1;
    if (currentUncatPage > totalUncatPages) normalized['uncategorized'] = Math.max(1, totalUncatPages);
    else if (totalUncatPages === 1) normalized['uncategorized'] = 1;

    return normalized;
  }, [current, screenshotPages]);

  const playedUsersSet = useMemo(() => {    if (!current) return new Set();
    return new Set(current.session_games?.flatMap((g: any) => g.session_game_players?.map((p: any) => p.user_id)));
  }, [current]);

  const players = useMemo(() => {
    return sortedParticipants.filter((p: any) => playedUsersSet.has(p.user_id));
  }, [sortedParticipants, playedUsersSet]);

  const observers = useMemo(() => {
    return sortedParticipants.filter((p: any) => !playedUsersSet.has(p.user_id));
  }, [sortedParticipants, playedUsersSet]);

  useEffect(() => {
    if (loading) return;
    const urlId = searchParams?.get('id');
    if (urlId && sortedSessions.some(s => s.id === urlId)) setSelectedId(urlId);
    else if (sortedSessions.length > 0 && !selectedId) setSelectedId(sortedSessions[0].id);
  }, [sortedSessions, loading, searchParams, selectedId]);

  useEffect(() => { if (current) setNewTitle(current.title); }, [current]);

  // 4. Action Handlers
  const handleUpdateTitle = async () => {
    if (!current || !tempTitle.trim() || tempTitle === current.title) { setIsEditingTitle(false); return; }
    try {
      await supabase.from('sessions').update({ title: tempTitle.trim() }).eq('id', current.id);
      setIsEditingTitle(false);
      fetchData();
    } catch (err) { setIsEditingTitle(false); }
  };

  const handleToggleFavorite = async (sessionId: string, isFav: boolean) => {
    if (!session?.user?.id) return alert("로그인이 필요합니다.");
    try {
      if (isFav) {
        await supabase
          .from('session_favorites')
          .delete()
          .eq('user_id', session.user.id)
          .eq('session_id', sessionId);
      } else {
        await supabase
          .from('session_favorites')
          .insert({ user_id: session.user.id, session_id: sessionId });
      }
      fetchFavorites();
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleDiarySelect = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth < 768) {
      setViewMode('diary');
      router.push(`/diary?id=${id}&view=diary`);
    }
  };

  const handleAddReaction = async (commentId: string, emoji: string) => {
    if (!session) return alert("로그인이 필요합니다.");
    try {
      const myId = session.user.id;
      const { data: comment, error: fetchError } = await supabase
        .from('comments')
        .select('reactions')
        .eq('id', commentId)
        .single();

      if (fetchError) throw fetchError;

      let reactions = comment?.reactions || {};
      if (!reactions[emoji]) reactions[emoji] = [];
      if (reactions[emoji].includes(myId)) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== myId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji].push(myId);
      }

      const { error: updateError } = await supabase
        .from('comments')
        .update({ reactions })
        .eq('id', commentId);

      if (updateError) throw updateError;
      await fetchData();
    } catch (err: any) {
      console.error("❌ Failed to add reaction:", err);
      alert(`반응 추가 중 오류가 발생했습니다: ${err.message || "알 수 없는 에러"}`);
    }
  };

  const handleAddReply = async (commentId: string, text: string) => {
    if (!session) return alert("로그인이 필요합니다.");
    try {
      const { data: comment, error: fetchError } = await supabase
        .from('comments')
        .select('replies')
        .eq('id', commentId)
        .single();

      if (fetchError) throw fetchError;

      const replies = comment?.replies || [];
      const newReply = { 
        userId: session.user.id, 
        user: session.user.name, 
        image: session.user.image, 
        text: text.trim(), 
        createdAt: new Date().toISOString(), 
        reactions: {} 
      };

      const { error: updateError } = await supabase
        .from('comments')
        .update({ replies: [...replies, newReply] })
        .eq('id', commentId);

      if (updateError) throw updateError;
      await fetchData();
    } catch (err: any) {
      console.error("❌ Failed to add reply:", err);
      alert(`답글 등록 중 오류가 발생했습니다: ${err.message || "알 수 없는 에러"}`);
    }
  };

  const handleDeleteReply = async (commentId: string, replyIdx: number) => {
    if (!session) return alert("로그인이 필요합니다.");
    try {
      const { data: comment, error: fetchError } = await supabase
        .from('comments')
        .select('replies')
        .eq('id', commentId)
        .single();

      if (fetchError) throw fetchError;

      const replies = comment?.replies || [];
      const newReplies = replies.filter((_: any, idx: number) => idx !== replyIdx);

      const { error: updateError } = await supabase
        .from('comments')
        .update({ replies: newReplies })
        .eq('id', commentId);

      if (updateError) throw updateError;
      await fetchData();
    } catch (err: any) {
      console.error("❌ Failed to delete reply:", err);
      alert(`답글 삭제 중 오류가 발생했습니다: ${err.message || "알 수 없는 에러"}`);
    }
  };

  const handleToggleChecklist = async (commentId: string, currentStatus: boolean, gameId: string) => {
    if (!session) return alert("로그인이 필요합니다.");
    
    try {
      if (currentStatus) {
        if (!window.confirm("체크리스트 설정을 해제하시겠습니까?")) {
          return;
        }
      } else {
        // 고정하려는 경우: 1인당 1개 제한 체크
        const { data: existingPins } = await supabase
          .from('comments')
          .select('id')
          .eq('game_id', gameId)
          .eq('user_id', session.user.id)
          .eq('is_checklist', true);

        if (existingPins && existingPins.length > 0) {
          if (!window.confirm("이미 고정된 메시지가 있습니다. 새로운 메시지로 교체하시겠습니까?")) {
            return;
          }
          // 기존 고정 메시지들 해제
          await supabase
            .from('comments')
            .update({ is_checklist: false })
            .eq('game_id', gameId)
            .eq('user_id', session.user.id)
            .eq('is_checklist', true);
        }
      }

      await supabase.from('comments').update({ is_checklist: !currentStatus }).eq('id', commentId);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleImageDelete = async (shotId: string) => {
    if (window.confirm("정말로 이 사진을 삭제하시겠습니까?")) {
      await supabase.from('screenshots').delete().eq('id', shotId);
      fetchData();
    }
  };

  const handleImageMove = async (newGameTitle: string | null) => {
    if (!movingShot) return;
    await supabase.from('screenshots').update({ game_title: newGameTitle }).eq('id', movingShot.id);
    fetchData();
    setMovingShot(null);
  };

  const handleUploadComplete = (shotId?: string) => {
    fetchData();
    if (shotId) {
      // Find the new shot and jump to its page
      setNewShotId(shotId);
      
      setTimeout(async () => {
        const { data: latestShots } = await supabase
          .from('screenshots')
          .select('id, game_title')
          .eq('session_id', current?.id)
          .order('created_at', { ascending: true });

        if (latestShots) {
          const index = latestShots.findIndex((s: any) => s.id === shotId);
          if (index !== -1) {
            const shot = latestShots[index];
            const gameKey = shot.game_title || 'uncategorized';
            const gameSpecificShots = latestShots.filter((s: any) => (s.game_title || 'uncategorized') === gameKey);
            const gameSpecificIndex = gameSpecificShots.findIndex((s: any) => s.id === shotId);
            const pageSize = gameKey === 'uncategorized' ? 12 : 5;
            const targetPage = Math.floor(gameSpecificIndex / pageSize) + 1;
            setScreenshotPages(prev => ({ ...prev, [gameKey]: targetPage }));
          }
        }
      }, 500);

      setTimeout(() => setNewShotId(null), 3000);
    }
  };

  const toggleGameStats = (gameId: string) => {
    setExpandedGames(prev => ({ ...prev, [gameId]: !prev[gameId] }));
  };



  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
      setVisibleCount(prev => Math.min(prev + 15, sortedSessions.length));
    }
  };

  const displayNamesMap = Object.keys(profiles).reduce((acc: any, k) => ({...acc, [k]: profiles[k].display_name}), {});

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-6">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="font-semibold text-[14px] uppercase animate-pulse opacity-40">일기장 불러오는 중...</p>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden selection:bg-primary/20 pb-16 md:pb-0 relative">
      {/* 1. Sidebar: Detailed List Navigation (Main Navigation) */}
      <aside className={`w-full bg-background md:bg-sidebar/40 border-r border-border flex flex-col h-full shrink-0 transition-transform duration-300 ease-in-out absolute left-0 top-0 md:relative md:left-auto md:top-auto md:w-[312px] ${
        viewMode === 'list' ? 'translate-x-0 pointer-events-auto z-20 md:z-auto' : '-translate-x-full pointer-events-none z-10 md:translate-x-0 md:pointer-events-auto md:z-auto'
      }`}>
        <div className="h-16 hidden md:flex items-center px-4 border-b border-border shrink-0">
          <Link href="/?landing=true" className="flex items-center gap-2 group transition-all">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[14px] font-black text-foreground tracking-tight group-hover:text-primary transition-colors">Game Diary</span>
          </Link>
        </div>
        <div className="px-4 py-4 shrink-0">
          <div className="relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              placeholder="일기 제목 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white rounded-xl pl-9 pr-4 py-2 text-[16px] md:text-[12px] font-medium text-foreground focus:outline-none transition-all placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-card rounded-2xl mb-3 p-3 min-h-0 md:bg-transparent md:rounded-none md:border-none md:shadow-none md:mx-0 md:mb-0 md:p-0 md:flex-1 md:flex md:flex-col md:min-h-0">
          <div className="h-8 flex items-center justify-end px-2 md:px-5 shrink-0">
            <SidebarSortDropdown currentSort={sortBy} onSortChange={setSortBy} />
          </div>
          <div 
            onScroll={isMobile ? handleScroll : undefined}
            className="flex-1 overflow-y-auto scrollbar-hide px-1 md:px-3 py-1 pb-4 md:pb-1 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]"
          >
            <div className="space-y-1 min-h-[396px]">
              {(isMobile ? mobileSessions : paginatedSessions).map(s => (
                <DiaryListItem 
                  key={s.id}
                  session={s}
                  isSelected={selectedId === s.id}
                  isFavorite={favoriteSessionIds.has(s.id)}
                  onSelect={handleDiarySelect}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>

            {!isMobile && (
              <SidebarPagination 
                totalCount={sortedSessions.length} 
                pageSize={pageSize} 
                page={currentPage} 
                onPageChange={setCurrentPage} 
              />
            )}

            {/* Haptic/Visual spacer to push content above the 88px mobile dock */}
            <div className="h-28 md:hidden shrink-0" />
          </div>
        </div>
        <div className="hidden md:flex p-4 border-t border-border items-center gap-3 bg-card/20 backdrop-blur-sm">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-border shadow-sm ring-2 ring-background/50 shrink-0">
            <img src={session?.user?.image || ""} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-black text-foreground truncate leading-none mb-1">{session?.user?.name}</span>
            <span className="text-[9px] text-muted-foreground font-black tracking-[0.1em] uppercase opacity-50 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Online
            </span>
          </div>
        </div>
      </aside>

      {/* 3. Main Content Area */}
      <section className={`flex-1 flex flex-col min-w-0 transition-transform duration-300 ease-in-out absolute left-0 top-0 w-full h-full md:relative md:left-auto md:top-auto md:w-auto md:h-full bg-background ${
        viewMode === 'diary' ? 'translate-x-0 pointer-events-auto z-20 md:z-auto' : 'translate-x-full pointer-events-none z-10 md:translate-x-0 md:pointer-events-auto md:z-auto'
      }`}>
        <DiaryHeader 
          current={{ ...current, sessionTitle: current?.title, date: current?.start_time }}
          profiles={profiles}
          isEditingTitle={isEditingTitle}
          tempTitle={tempTitle}
          onTitleClick={() => setIsEditingTitle(true)}
          onTitleChange={setNewTitle}
          onTitleUpdate={handleUpdateTitle}
          onShare={() => { navigator.clipboard.writeText(window.location.href); alert("공유 링크가 복사되었습니다!"); }}
          onDelete={async () => { if(current && window.confirm("일기 전체를 삭제할까요?")) { await supabase.from('sessions').delete().eq('id', current.id); fetchData(); } }}
          viewMode={viewMode}
        />

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="w-full pb-72">
            {current ? (
              <div className="w-full">
                {/* Mobile-only collapsible Toss-style Metadata Card */}
                <div className="md:hidden px-3 pt-2 pb-0">
                  <div 
                    onClick={!isMetadataExpanded ? () => setIsMetadataExpanded(true) : undefined}
                    className={`relative rounded-2xl overflow-hidden py-2.5 px-4 bg-card backdrop-blur-sm transition-all duration-200 ${
                      !isMetadataExpanded ? 'cursor-pointer select-none active:scale-[0.995] active:bg-muted/30' : ''
                    }`}
                  >
                    {/* Background Pattern (Subtle dots) */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,93,56,1)_1px,transparent_1px)] bg-[length:24px_24px]" />
                    </div>
                    
                    {/* Content */}
                    <div className="relative z-0 flex flex-col">
                      <div 
                        onClick={isMetadataExpanded ? () => setIsMetadataExpanded(false) : undefined}
                        className={`flex items-center justify-between ${
                          isMetadataExpanded ? 'cursor-pointer select-none' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span 
                            className="font-mono font-bold text-muted-foreground text-[13px] leading-none translate-y-[-0.5px] pl-1 inline-block shrink-0 select-none"
                            style={{ wordSpacing: '-0.18em' }}
                          >
                            {formatDate(current.start_time || current.date)}
                          </span>
                          {!isMetadataExpanded && (
                            <motion.span 
                              layoutId="duration-badge"
                              transition={{ type: "spring", stiffness: 400, damping: 38 }}
                              className="inline-flex items-center justify-center bg-[#e05d38] text-white font-sans font-bold text-[10px] px-2.5 py-1.5 rounded-full tracking-widest uppercase select-none leading-none shrink-0"
                            >
                              <span className="translate-y-[-0.5px]">{formatDurationText(current.total_duration_min)}</span>
                            </motion.span>
                          )}
                        </div>
                        
                        {/* Right button / Badge when expanded */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {isMetadataExpanded ? (
                            <>
                              <span 
                                className="text-[11px] font-bold text-muted-foreground/50 font-mono select-none translate-y-[-0.5px] shrink-0"
                                style={{ wordSpacing: '-0.18em' }}
                              >
                                {formatTime(current.start_time)} — {formatTime(current.end_time)}
                              </span>
                              <motion.span 
                                layoutId="duration-badge"
                                transition={{ type: "spring", stiffness: 400, damping: 38 }}
                                className="inline-flex items-center justify-center bg-[#e05d38] text-white font-sans font-bold text-[10px] px-2.5 py-1.5 rounded-full tracking-widest uppercase select-none leading-none"
                              >
                                <span className="translate-y-[-0.5px]">{formatDurationText(current.total_duration_min)}</span>
                              </motion.span>
                            </>
                          ) : (
                            <button 
                              onClick={() => setIsMetadataExpanded(true)}
                              className="flex items-center gap-0.5 text-muted-foreground/50 hover:text-muted-foreground/90 font-bold text-[12px] transition-all duration-200 select-none"
                            >
                              <span>상세보기</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {isMetadataExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="pt-1 mt-4.5 flex flex-col gap-3.5">
                              {/* Players Row */}
                              {players.length > 0 && (
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <span className="text-[10px] font-bold text-muted-foreground/60 tracking-tight uppercase shrink-0">참여자</span>
                                  <div className="flex flex-col items-center gap-1.5">
                                    {players.map((p: any) => {
                                      const profile = profiles?.[p.user_id];
                                      const hasLoggedIn = !!profile?.has_logged_in;
                                      const displayName = hasLoggedIn 
                                        ? (profile?.display_name || 'Anonymous') 
                                        : maskNickname(profile?.display_name || 'Anonymous');
                                      return (
                                        <div key={p.user_id} className="flex items-center gap-1.5 bg-muted/70 pl-1.5 pr-2.5 py-1.5 rounded-full text-[11px] font-bold text-foreground/80 shadow-xs leading-none">
                                          <div className="w-4.5 h-4.5 rounded-full overflow-hidden shrink-0 isolate">
                                            <img 
                                              src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.user_id}`} 
                                              className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`} 
                                              alt="" 
                                            />
                                          </div>
                                          <span className="translate-y-[-0.5px]">{displayName}</span>
                                          <span className="text-primary/60 font-bold font-sans text-[9.5px] ml-0.5 translate-y-[-0.5px]">{formatDurationText(p.duration_min || 0)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Observers Row */}
                              {observers.length > 0 && (
                                <div className="flex flex-col items-center justify-center gap-2 mt-2">
                                  <span className="text-[10px] font-bold text-muted-foreground/60 tracking-tight uppercase shrink-0">관전자</span>
                                  <div className="flex flex-col items-center gap-1.5">
                                    {observers.map((p: any) => {
                                      const profile = profiles?.[p.user_id];
                                      const hasLoggedIn = !!profile?.has_logged_in;
                                      const displayName = hasLoggedIn 
                                        ? (profile?.display_name || 'Anonymous') 
                                        : maskNickname(profile?.display_name || 'Anonymous');
                                      return (
                                        <div key={p.user_id} className="flex items-center gap-1.5 bg-muted/70 pl-1.5 pr-2.5 py-1.5 rounded-full text-[11px] font-bold text-foreground/80 shadow-xs leading-none">
                                          <div className="w-4.5 h-4.5 rounded-full overflow-hidden shrink-0 isolate">
                                            <img 
                                              src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.user_id}`} 
                                              className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`} 
                                              alt="" 
                                            />
                                          </div>
                                          <span className="translate-y-[-0.5px]">{displayName}</span>
                                          <span className="text-primary/60 font-bold font-sans text-[9.5px] ml-0.5 translate-y-[-0.5px]">{formatDurationText(p.duration_min || 0)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-end mt-1">
                                <button 
                                  onClick={() => setIsMetadataExpanded(false)}
                                  className="flex items-center gap-0.5 text-muted-foreground/50 hover:text-muted-foreground/90 font-bold text-[12px] transition-all duration-200 select-none"
                                >
                                  <span>접기</span>
                                  <ChevronRight className="w-3 h-3 -rotate-90" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* --- Bento Grid Start --- */}
                <BentoGrid 
                  items={[
                    // 1. Map Each Game and its Screenshots
                    ...(current.session_games?.flatMap((game: any) => {
                      const gameShots = current.screenshots?.filter((s: any) => s.game_title === game.title) || [];
                      const isExpanded = expandedGames[game.id];

                      return [
                        // Left Card: Detailed Game Info & Screenshots (2 cols)
                        {
                          title: game.title,
                          icon: game.icon_url ? <img src={game.icon_url} className="w-10 h-10 object-contain" alt="" /> : <Gamepad2 className="w-10 h-10 text-primary" />,
                          meta: (
                            <div className="flex items-center gap-1.5 leading-none">
                              <Clock className="hidden md:block w-2.5 h-2.5 opacity-40" />
                              <span className="translate-y-[-0.5px]">{formatTime(game.start_time)} — {formatTime(game.end_time)}</span>
                            </div>
                          ),
                          status: (
                            <div className="relative">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleGameStats(game.id); }}
                                className={`group/btn flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all text-[10px] font-sans font-bold uppercase tracking-widest leading-none ${isExpanded ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-primary/5 text-primary hover:bg-primary/10 hover:scale-105 active:scale-95'}`}
                              >
                                <span className="translate-y-[-0.5px]">{formatDurationText(game.play_time_min)}</span>
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                                >
                                  <ChevronDown className="w-3 h-3" strokeWidth={4} />
                                </motion.div>
                              </button>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                    className="absolute top-[calc(100%+0.25rem)] right-0 z-50 w-48 overflow-hidden rounded-lg bg-card shadow-xl shadow-black/10"
                                  >
                                    <div className="flex flex-col p-1">
                                      {[...(game.session_game_players || [])]
                                        .sort((a: any, b: any) => (b.play_time_min || 0) - (a.play_time_min || 0))
                                        .map((p: any) => (
                                          <div key={p.user_id} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors gap-4">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              <div className="w-4.5 h-4.5 rounded-full overflow-hidden shrink-0 border border-border/30 isolate">
                                                <img 
                                                  src={profiles[p.user_id]?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.user_id}`} 
                                                  className={`w-full h-full object-cover ${!profiles[p.user_id]?.has_logged_in ? 'blur-xs scale-110' : ''}`} 
                                                  alt="" 
                                                />
                                              </div>
                                              <span className="text-[11px] font-bold text-foreground/80 truncate translate-y-[-0.5px]">
                                                {profiles[p.user_id]?.has_logged_in 
                                                  ? (profiles[p.user_id]?.display_name || '알 수 없음') 
                                                  : maskNickname(profiles[p.user_id]?.display_name || '알 수 없음')}
                                              </span>
                                            </div>
                                            <span className="text-[9.5px] font-sans font-bold text-primary/60 shrink-0 whitespace-nowrap translate-y-[-0.5px]">{formatDurationText(p.play_time_min)}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ),
                          colSpan: 2,
                          content: (
                            <div className="flex flex-col h-auto md:h-[450px]">
                              {/* Header (Desktop only) */}
                              <div className="hidden md:flex items-center mb-2 pl-[6px]">
                                <motion.div 
                                  whileHover="hover"
                                  className="flex items-center gap-1 group/label cursor-pointer select-none"
                                >
                                  <span className="text-[12px] font-bold tracking-tight text-primary/60 group-hover/label:text-primary transition-colors duration-200">
                                    하이라이트
                                  </span>
                                  <motion.div
                                    variants={{
                                      hover: { x: 2 }
                                    }}
                                    transition={{ type: "spring", stiffness: 600, damping: 30 }}
                                    className="text-primary/60 group-hover/label:text-primary transition-colors duration-200 flex items-center"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </motion.div>
                                </motion.div>
                              </div>

                              <div className="flex-1">
                                {/* Desktop Grid View */}
                                <div className="hidden md:grid grid-cols-3 gap-3">
                                  {(() => {
                                    const SHOTS_PER_PAGE = 5;
                                    const currentPage = normalizedScreenshotPages[game.id] || 1;
                                    const startIndex = (currentPage - 1) * SHOTS_PER_PAGE;
                                    const slicedShots = gameShots.slice(startIndex, startIndex + SHOTS_PER_PAGE);                                    
                                    return (
                                      <>
                                        {slicedShots.map((shot: any) => (
                                          <ScreenshotItem 
                                            key={shot.id}
                                            shot={shot}
                                            profiles={profiles}
                                            current={current}
                                            session={session}
                                            isNew={newShotId === shot.id}
                                            activeMoveShotId={activeMoveShotId}
                                            setActiveMoveShotId={setActiveMoveShotId}
                                            setActiveShot={setActiveShot}
                                            setHoveredShot={setHoveredShot}
                                            handleDownload={handleDownload}
                                            handleImageDelete={handleImageDelete}
                                            fetchData={fetchData}
                                          />
                                        ))}
                                        <UploadPlaceholder 
                                          key={pendingUpload ? 'active' : 'idle'}
                                          onFileSelect={(file: File) => setPendingUpload({ file, defaultGame: game.title })} 
                                        />
                                      </>
                                    );
                                  })()}
                                </div>

                                {/* Mobile Carousel View */}
                                <div className="block md:hidden">
                                  <MobileScreenshotCarousel
                                    gameShots={gameShots}
                                    profiles={profiles}
                                    current={current}
                                    session={session}
                                    newShotId={newShotId}
                                    activeMoveShotId={activeMoveShotId}
                                    setActiveMoveShotId={setActiveMoveShotId}
                                    setActiveShot={setActiveShot}
                                    setHoveredShot={setHoveredShot}
                                    handleDownload={handleDownload}
                                    handleImageDelete={handleImageDelete}
                                    fetchData={fetchData}
                                    onFileSelect={(file: File) => setPendingUpload({ file, defaultGame: game.title })}
                                  />
                                </div>
                              </div>
                                
                              {gameShots.length > 5 && (
                                <div className="hidden md:flex justify-end mt-auto pt-6">
                                  <Pagination.Root
                                    count={gameShots.length + 1}
                                    pageSize={5}
                                    page={normalizedScreenshotPages[game.id] || 1}
                                    siblingCount={1}
                                    onPageChange={(details) => setScreenshotPages(prev => ({ ...prev, [game.id]: details.page }))}
                                    className="flex items-center gap-1 select-none"
                                  >
                                    <Pagination.Context>
                                      {(pagination) => (
                                        <button
                                          onClick={() => pagination.goToFirstPage()}
                                          disabled={pagination.page === 1}
                                          className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground/40 hover:text-primary rounded-lg transition-colors disabled:opacity-10 disabled:pointer-events-none"
                                        >
                                          <ChevronsLeft className="w-4 h-4 stroke-[2.5]" />
                                        </button>
                                      )}
                                    </Pagination.Context>

                                    <Pagination.PrevTrigger className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground/40 hover:text-primary rounded-lg transition-colors data-disabled:opacity-10 data-disabled:pointer-events-none">
                                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                                    </Pagination.PrevTrigger>

                                    <Pagination.Context>
                                      {(pagination) =>
                                        pagination.pages.map((page, index) =>
                                          page.type === "page" ? (
                                            <Pagination.Item
                                              key={index}
                                              {...page}
                                              className="inline-flex items-center justify-center w-8 h-8 text-[11px] font-black tabular-nums rounded-lg transition-all cursor-pointer hover:bg-muted
                                                         data-selected:bg-primary data-selected:text-primary-foreground data-selected:shadow-md data-selected:shadow-primary/20"
                                            >
                                              {page.value}
                                            </Pagination.Item>
                                          ) : (
                                            <Pagination.Ellipsis
                                              key={index}
                                              index={index}
                                              className="inline-flex items-center justify-center w-8 h-8 text-[10px] font-black text-muted-foreground/20 tracking-tighter"
                                            >
                                              &#8230;
                                            </Pagination.Ellipsis>
                                          )
                                        )
                                      }
                                    </Pagination.Context>

                                    <Pagination.NextTrigger className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground/40 hover:text-primary rounded-lg transition-colors data-disabled:opacity-10 data-disabled:pointer-events-none">
                                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                                    </Pagination.NextTrigger>

                                    <Pagination.Context>
                                      {(pagination) => (
                                        <button
                                          onClick={() => pagination.goToLastPage()}
                                          disabled={pagination.page === pagination.totalPages}
                                          className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground/40 hover:text-primary rounded-lg transition-colors disabled:opacity-10 disabled:pointer-events-none"
                                        >
                                          <ChevronsRight className="w-4 h-4 stroke-[2.5]" />
                                        </button>
                                      )}
                                    </Pagination.Context>
                                  </Pagination.Root>
                                </div>
                              )}

                              {/* Mobile Comments Section (Embedded inside Highlight Card on mobile) */}
                              <div className="block md:hidden mt-4 -mx-4 -mb-4 pt-4 pb-4 px-0 bg-muted rounded-2xl border border-border/40 animate-in fade-in duration-300">
                                <div className="flex items-center mb-4 px-4">
                                  <h3 className="font-semibold text-foreground tracking-tight text-lg leading-none">
                                    댓글
                                  </h3>
                                </div>
                                <div className="px-4">
                                  {renderChecklist(game)}
                                </div>
                                <div className={`flex flex-col ${game.comments?.length > 5 ? "h-[320px]" : "h-auto"}`}>
                                  <GameCommentList 
                                    game={game}
                                    profiles={profiles}
                                    displayNamesMap={displayNamesMap}
                                    handleAddReaction={handleAddReaction}
                                    handleAddReply={handleAddReply}
                                    handleToggleChecklist={handleToggleChecklist}
                                    fetchData={fetchData}
                                    className="flex-1 min-h-0 scrollbar-hide px-4"
                                    onMobileReply={(commentId: string, userName: string) => setActiveReply({ gameId: game.id, commentId, userName })}
                                    activeReplyId={activeReply?.gameId === game.id ? activeReply?.commentId : null}
                                    handleDeleteReply={handleDeleteReply}
                                    onOpenReactionDetail={handleOpenReactionDetail}
                                  />
                                  <div className="mt-2 px-4 bg-transparent">
                                    <GameCommentInput 
                                      gameId={game.id} 
                                      gameTitle={game.title} 
                                      onComplete={fetchData} 
                                      activeReply={activeReply?.gameId === game.id ? activeReply : null}
                                      onCancelReply={() => setActiveReply(null)}
                                      onAddReply={handleAddReply}
                                      isMobile={true}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ),
                        },
                        // Right Card: Dedicated Comments Section (1 col)
                        {
                          title: "댓글",
                          colSpan: 1,
                          isCommentSection: true,
                          className: "hidden md:flex border border-border/40",
                          content: (
                            <div className="flex flex-col h-[450px]">
                              {renderChecklist(game)}
                              <GameCommentList 
                                game={game}
                                profiles={profiles}
                                displayNamesMap={displayNamesMap}
                                handleAddReaction={handleAddReaction}
                                handleAddReply={handleAddReply}
                                handleToggleChecklist={handleToggleChecklist}
                                fetchData={fetchData}
                                className="flex-1 min-h-0"
                                onMobileReply={(commentId: string, userName: string) => setActiveReply({ gameId: game.id, commentId, userName })}
                                activeReplyId={activeReply?.gameId === game.id ? activeReply?.commentId : null}
                                handleDeleteReply={handleDeleteReply}
                                onOpenReactionDetail={handleOpenReactionDetail}
                              />
                              {/* Fixed Bottom Input: Flush to card edges */}
                              <div className="mt-2 shrink-0 bg-card/90 backdrop-blur-sm">
                                <GameCommentInput 
                                  gameId={game.id} 
                                  gameTitle={game.title} 
                                  onComplete={fetchData} 
                                  activeReply={activeReply?.gameId === game.id ? activeReply : null}
                                  onCancelReply={() => setActiveReply(null)}
                                  onAddReply={handleAddReply}
                                />
                              </div>
                            </div>
                          )
                        }
                      ];
                    }) || []),
                  ]} 
                />
                {/* --- Bento Grid End --- */}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh]">
                <span className="text-[100px] mb-8 opacity-10">🎮</span>
                <p className="text-2xl font-black italic tracking-tighter text-muted-foreground/20 uppercase">No Session Selected</p>
              </div>
            )}
          </div>
        </div>
        {/* --- Floating Action Button: Uncategorized Moments (Bottom Right) --- */}
        {current && current.screenshots?.some((s: any) => !s.game_title) && (
          <div className="absolute bottom-8 right-8 z-40">
            <Drawer 
              open={!!isUncatDrawerOpen} 
              onOpenChange={(open: boolean) => setIsUncatDrawerOpen(open)}
            >
              <div className="relative group">
                <button 
                  onClick={() => setIsUncatDrawerOpen(true)}
                  className="w-16 h-16 flex-none rounded-full bg-primary text-white shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-none group relative overflow-visible p-0 aspect-square"
                >
                  <FolderInput className="w-6.5 h-6.5" />
                  
                  {/* Notification Badge: Scaled down for smaller FAB */}
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white text-primary text-[12px] flex items-center justify-center font-black shadow-lg ring-4 ring-background border-none animate-in zoom-in duration-300">
                    {current.screenshots.filter((s: any) => !s.game_title).length}
                  </div>

                  {/* Hover Label: Redesigned for Design Guide Consistency */}
                  <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-2xl bg-card/80 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-black/10 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap z-50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[12px] font-black tracking-tight text-foreground">
                        미분류된 하이라이트가 있어요!
                      </span>
                    </div>
                  </div>
                </button>
              </div>
              <DrawerPopup position="bottom" showCloseButton showBar>
                <DrawerHeader>
                  <div className="flex items-end justify-between w-full">
                    <div className="flex flex-col gap-1">
                      <DrawerTitle>미분류 순간들</DrawerTitle>
                      <DrawerDescription>게임이 지정되지 않은 스크린샷들을 관리하고 분류할 수 있습니다.</DrawerDescription>
                    </div>
                    {/* Carousel Controls */}
                    <div className="flex items-center gap-2 mb-1">
                      <button 
                        onClick={() => uncatCarouselApi?.scrollPrev()}
                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                        disabled={!canScrollPrev}
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => uncatCarouselApi?.scrollNext()}
                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                        disabled={!canScrollNext}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </DrawerHeader>
                <DrawerPanel scrollable={false}>
                  <div className="py-4">
                    <Carousel setApi={setUncatCarouselApi} opts={{ align: "start", dragFree: true }}>
                      <CarouselContent className="-ml-4 px-4">
                        {(() => {
                          const uncategorizedShots = current.screenshots.filter((s: any) => !s.game_title);
                          
                          return (
                            <>
                              {uncategorizedShots.map((shot: any) => (
                                <CarouselItem key={shot.id} className="pl-4 basis-auto">
                                  <div className="w-[240px]">
                                    <ScreenshotItem 
                                      shot={shot}
                                      profiles={profiles}
                                      current={current}
                                      session={session}
                                      isNew={newShotId === shot.id}
                                      activeMoveShotId={activeMoveShotId}
                                      setActiveMoveShotId={setActiveMoveShotId}
                                      setActiveShot={setActiveShot}
                                      setHoveredShot={setHoveredUncatShot}
                                      handleDownload={handleDownload}
                                      handleImageDelete={handleImageDelete}
                                      fetchData={fetchData}
                                      isDrawer={true}
                                      positionHint="center"
                                    />
                                  </div>
                                </CarouselItem>
                              ))}
                              <CarouselItem className="pl-4 basis-auto">
                                <div className="w-[240px]">
                                  <UploadPlaceholder 
                                    key={pendingUpload ? 'active-uncat-drawer' : 'idle-uncat-drawer'}
                                    onFileSelect={(file: File) => setPendingUpload({ file, defaultGame: "" })} 
                                  />
                                </div>
                              </CarouselItem>
                            </>
                          );
                        })()}
                      </CarouselContent>
                    </Carousel>
                  </div>
                </DrawerPanel>
              </DrawerPopup>
            </Drawer>
          </div>
        )}
      </section>

      {movingShot && (
        <MoveModal shot={movingShot} games={current?.session_games || []} onClose={() => setMovingShot(null)} onMove={handleImageMove} />
      )}

      {pendingUpload && (
        <UploadEditModal 
          file={pendingUpload.file} 
          sessionId={current?.id} 
          defaultGame={pendingUpload.defaultGame} 
          onClose={() => setPendingUpload(null)} 
          games={current?.session_games || []} 
          onComplete={handleUploadComplete} 
        />
      )}

      <FloatingScreenshotPreview hoveredShot={hoveredShot} profiles={profiles} />
      <BackgroundPreview hoveredShot={hoveredUncatShot} profiles={profiles} />

      {activeShot && (
        <Lightbox 
          imageUrl={activeShot.url} 
          uploader={{
            name: profiles[activeShot.uploader_id]?.has_logged_in
              ? (profiles[activeShot.uploader_id]?.display_name || activeShot.uploader_id)
              : maskNickname(profiles[activeShot.uploader_id]?.display_name || activeShot.uploader_id),
            avatar: profiles[activeShot.uploader_id]?.avatar_url,
            isBlurred: !profiles[activeShot.uploader_id]?.has_logged_in
          }}
          comment={activeShot.comment}
          onClose={() => setActiveShot(null)} 
        />
      )}

      {/* 모바일 리액션 상세 바텀 시트 */}
      <Drawer open={reactionDetailOpen} onOpenChange={setReactionDetailOpen}>
        <DrawerPopup position="bottom" showBar className="bg-[#F4F5F6]" backdropClassName="backdrop-blur-none bg-black/15">
          <DrawerPanel scrollable={false} className="px-3 pb-6 pt-6 select-none font-sans h-[50vh] flex flex-col">
            <div className="text-center font-medium text-base text-foreground mb-4 shrink-0">리액션</div>
            
            {/* 이모지 탭 리스트 */}
            {activeReactionComment?.reactions && (
              <div className="flex gap-2 overflow-x-auto justify-start pb-4 border-b border-border/10 mb-4 no-scrollbar shrink-0 px-1">
                {Object.entries(activeReactionComment.reactions).map(([emoji, users]: [string, any]) => {
                  const isSelected = reactionDetailEmoji === emoji;
                  return (
                    <button
                      key={emoji}
                      onClick={() => setReactionDetailEmoji(emoji)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        isSelected 
                          ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                          : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/85 hover:border-muted-foreground/30'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{users.length}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 현재 선택된 이모지에 반응을 남긴 유저 목록 */}
            {activeReactionComment && reactionDetailEmoji && activeReactionComment.reactions?.[reactionDetailEmoji] && (
              <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto px-1 custom-scrollbar">
                {(activeReactionComment.reactions[reactionDetailEmoji] as string[]).map((uid) => {
                  const userProfile = profiles[uid];
                  const isMe = session?.user?.id === uid;
                  const isLoggedIn = !!userProfile?.has_logged_in;
                  const displayName = userProfile?.display_name || displayNamesMap[uid] || uid || "알 수 없음";
                  const maskedName = isLoggedIn ? displayName : maskNickname(displayName);

                  return (
                    <div key={uid} className="flex items-center gap-3 py-2 border-b border-border/5 last:border-0">
                      {/* 아바타 */}
                      {userProfile?.avatar_url ? (
                        <img 
                          src={userProfile.avatar_url} 
                          alt={maskedName} 
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-border/20 shadow-sm"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-black text-xs text-muted-foreground shrink-0 border border-border/20 shadow-sm">
                          {maskedName.slice(0, 1)}
                        </div>
                      )}
                      
                      {/* 닉네임 및 '나' 뱃지 */}
                      <div className="flex items-center gap-2">
                        {isMe && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-black text-muted-foreground/80 shrink-0">
                            나
                          </span>
                        )}
                        <span className="text-sm font-bold text-foreground">{maskedName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-6">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="font-black text-xs tracking-[0.4em] uppercase animate-pulse opacity-40">Loading...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
