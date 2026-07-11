"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'framer-motion';
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
import { Gamepad2, Camera, MessageCircleMore, MessageCircle, Clock, ChevronDown, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FolderInput, Pin, Calendar, Star, Home as HomeIcon, Inbox, List, Bell, Settings, ArrowLeftRight, Info, RotateCcw, Plus, MoreHorizontal, HelpCircle, LogOut } from 'lucide-react';
import { Pagination } from "@ark-ui/react/pagination";
import SidebarSortDropdown from '@/components/diary/SidebarSortDropdown';
import SettingsView from '@/components/diary/SettingsView';

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
import DesktopScreenshotCarousel from '@/components/diary/DesktopScreenshotCarousel';

// --- Diary List Item Component (Swipe to Favorite or Trash layout) ---

interface DiaryListItemProps {
  session: any;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
  isTrash?: boolean;
  currentUserId?: string;
  onRestore?: (id: string) => Promise<void>;
  onPermanentDelete?: (id: string) => Promise<void>;
  creatorAvatarUrl?: string;
}

function DiaryListItem({ 
  session: s, 
  isSelected, 
  isFavorite, 
  onSelect, 
  onToggleFavorite, 
  isTrash = false, 
  currentUserId,
  onRestore,
  onPermanentDelete,
  creatorAvatarUrl
}: DiaryListItemProps) {
  const x = useMotionValue(0);
  const iconScale = useTransform(x, [0, -50], [0.6, 1.15]);
  const iconOpacity = useTransform(x, [0, -40], [0, 1]);

  return (
    <div className="relative overflow-hidden rounded-lg w-full flex items-center">
      {/* Swipe Star Icon Background (Right-aligned for left swipe) - Only for active lists */}
      {!isTrash && (
        <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-3 pointer-events-none z-0">
          <motion.div 
            style={{ scale: iconScale, opacity: iconOpacity }}
            className="w-7 h-7 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500"
          >
            <Star className="w-3.5 h-3.5 fill-yellow-500" strokeWidth={3} />
          </motion.div>
        </div>
      )}

      <motion.div 
        drag={isTrash ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 28 }}
        style={{ x }}
        onDragEnd={(event, info) => {
          if (!isTrash && x.get() < -50) {
            onToggleFavorite(s.id, isFavorite);
            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate(30);
            }
          }
        }}
        className="w-full relative z-10 !touch-pan-y"
      >
        <div 
          role="button"
          tabIndex={0}
          onClick={() => onSelect(s.id)} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(s.id);
            }
          }}
          className={`w-full text-left px-4 py-3 md:p-2 rounded-lg flex items-center gap-3 transition-all duration-200 cursor-pointer select-none active:scale-[0.97] active:bg-muted/80 origin-center ${
            isSelected 
              ? 'bg-transparent md:bg-[#e8ebed] text-foreground shadow-xs md:shadow-none' 
              : 'bg-transparent text-muted-foreground hover:bg-muted/50 md:hover:bg-[#e8ebed] hover:text-foreground'
          }`}
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-background border border-border/50 shrink-0 flex items-center justify-center shadow-xs">
            {s.guild_name && s.guild_name !== '개인' ? (
              s.guild_icon ? (
                <img src={s.guild_icon} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                  {s.guild_name.charAt(0)}
                </div>
              )
            ) : (
              <img 
                src={creatorAvatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.session_participants?.[0]?.user_id || s.id}`} 
                className="w-full h-full object-cover" 
                alt="" 
              />
            )}
          </div>
          <span className={`text-[13.5px] truncate tracking-tight transition-all flex-1 font-medium ${isSelected ? 'text-foreground' : ''}`}>
            {s.title}
          </span>
          <span className="text-[11px] font-sans tracking-tighter opacity-70 shrink-0 flex items-center gap-1 select-none">
            {isTrash ? (
              <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* 되돌리기 (복원) 버튼 */}
                <button
                  onClick={async () => {
                    if (window.confirm("이 일기를 복원할까요?")) {
                      if (onRestore) await onRestore(s.id);
                    }
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#e8ebed]/60 dark:bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-all active:scale-90"
                  title="일기 복원"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                {/* 완전 삭제 (영구 삭제) 버튼 */}
                <button
                  onClick={async () => {
                    if (window.confirm("이 일기를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) {
                      if (onPermanentDelete) await onPermanentDelete(s.id);
                    }
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#e8ebed]/60 dark:bg-muted/40 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-90"
                  title="영구 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ) : (
              <>
                {isFavorite && (
                  <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500 shrink-0 animate-in zoom-in duration-200" strokeWidth={2.5} />
                )}
                <span className="opacity-55 w-[34px] text-right tabular-nums font-sans">
                  {new Date(s.start_time).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
                </span>
              </>
            )}
          </span>
        </div>
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
      <div className="mb-0 space-y-1.5 px-0 md:px-4 animate-in fade-in duration-300">
        {checklistComments.map((c: any) => {
          const hasLoggedIn = !!profiles?.[c.user_id]?.has_logged_in;
          const displayName = hasLoggedIn 
            ? (profiles?.[c.user_id]?.display_name || 'Anonymous') 
            : maskNickname(profiles?.[c.user_id]?.display_name || 'Anonymous');
          
          return (
            <div 
              key={c.id} 
              className="flex items-center justify-between gap-3 px-2 py-1 rounded-xl bg-primary/5 border border-primary/10 group animate-in fade-in duration-300"
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
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[8px] font-black text-foreground uppercase">
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
              {!isDeleted && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Delete button */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity md:hidden">
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
                    className="w-6 h-6 rounded-full border border-primary/30 flex items-center justify-center bg-primary text-white hover:bg-primary/95 transition-colors shrink-0"
                    title="고정 해제"
                  >
                    <Pin className="w-3.5 h-3.5 rotate-45 text-white" strokeWidth={2.5} />
                  </button>
                </div>
              )}
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

  const [isCalendarMounted, setIsCalendarMounted] = useState(false);
  useEffect(() => {
    setIsCalendarMounted(true);
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

  // Pull-to-refresh state & refs
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isPulling = useRef(false);
  const pullDistanceRef = useRef(0);

  const sidebarNodeRef = useRef<HTMLDivElement | null>(null);
  const detailNodeRef = useRef<HTMLDivElement | null>(null);
  const calendarMonthInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state values to refs
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const handleTouchStartNative = useCallback((e: TouchEvent) => {
    const parent = e.currentTarget as HTMLElement;
    const scrollContainer = parent.querySelector('[data-scroll-container="true"]') as HTMLDivElement;
    if (!scrollContainer) return;

    if (scrollContainer.scrollTop === 0 && !isRefreshingRef.current) {
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      isPulling.current = true;
      pullDistanceRef.current = 0;

      const indicator = scrollContainer.querySelector('[data-pull-indicator="true"]') as HTMLDivElement;
      const icon = scrollContainer.querySelector('[data-pull-icon="true"]') as HTMLElement;
      if (indicator) {
        indicator.style.transition = 'none';
      }
      if (icon) {
        icon.style.transition = 'none';
        icon.style.removeProperty('--start-angle');
      }
    } else {
      isPulling.current = false;
    }
  }, []);

  const handleTouchMoveNative = useCallback((e: TouchEvent) => {
    if (!isPulling.current || isRefreshingRef.current) return;
    
    const parent = e.currentTarget as HTMLElement;
    const scrollContainer = parent.querySelector('[data-scroll-container="true"]') as HTMLDivElement;
    if (!scrollContainer) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // Resolve horizontal gesture conflict:
    // If movement is primarily horizontal, cancel vertical pull-to-refresh
    if (Math.abs(diffX) > Math.abs(diffY)) {
      isPulling.current = false;
      pullDistanceRef.current = 0;
      const indicator = scrollContainer.querySelector('[data-pull-indicator="true"]') as HTMLDivElement;
      if (indicator) {
        indicator.style.transition = 'height 0.2s ease-out, opacity 0.2s ease-out';
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
      }
      return;
    }

    if (scrollContainer.scrollTop > 0) {
      isPulling.current = false;
      pullDistanceRef.current = 0;
      const indicator = scrollContainer.querySelector('[data-pull-indicator="true"]') as HTMLDivElement;
      if (indicator) {
        indicator.style.transition = 'height 0.2s ease-out, opacity 0.2s ease-out';
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
      }
      return;
    }

    if (diffY > 0) {
      const distance = diffY * 0.4;
      pullDistanceRef.current = distance;

      const indicator = scrollContainer.querySelector('[data-pull-indicator="true"]') as HTMLDivElement;
      const icon = scrollContainer.querySelector('[data-pull-icon="true"]') as HTMLElement;
      if (indicator) {
        indicator.style.height = `${distance}px`;
        indicator.style.opacity = `${Math.min(1, distance / 40)}`;
      }
      if (icon) {
        icon.style.transform = `rotate(${-distance * 6}deg)`;
      }
      
      if (diffY > 10 && e.cancelable) {
        e.preventDefault();
      }
    } else {
      pullDistanceRef.current = 0;
      const indicator = scrollContainer.querySelector('[data-pull-indicator="true"]') as HTMLDivElement;
      if (indicator) {
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
      }
    }
  }, []);

  const handleTouchEndNative = useCallback(async (e: TouchEvent) => {
    if (!isPulling.current || isRefreshingRef.current) return;
    isPulling.current = false;

    const parent = e.currentTarget as HTMLElement;
    const scrollContainer = parent.querySelector('[data-scroll-container="true"]') as HTMLDivElement;
    if (!scrollContainer) return;

    const indicator = scrollContainer.querySelector('[data-pull-indicator="true"]') as HTMLDivElement;
    const icon = scrollContainer.querySelector('[data-pull-icon="true"]') as HTMLElement;
    const finalDistance = pullDistanceRef.current;

    if (finalDistance >= 50) {
      setIsRefreshing(true);
      if (indicator) {
        indicator.style.transition = 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        indicator.style.height = '50px';
        indicator.style.opacity = '1';
      }
      if (icon) {
        icon.style.setProperty('--start-angle', `${-finalDistance * 6}deg`);
        icon.style.transform = '';
      }
      try {
        await fetchData();
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (err) {
        console.error("Refresh failed:", err);
      } finally {
        setIsRefreshing(false);
        pullDistanceRef.current = 0;
        if (indicator) {
          indicator.style.transition = 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
          indicator.style.height = '0px';
          indicator.style.opacity = '0';
        }
        if (icon) {
          icon.style.transform = '';
          icon.style.removeProperty('--start-angle');
        }
      }
    } else {
      pullDistanceRef.current = 0;
      if (indicator) {
        indicator.style.transition = 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
      }
      if (icon) {
        icon.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        icon.style.transform = 'rotate(0deg)';
      }
    }
  }, []);


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
  const [isMobile, setIsMobile] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const [listTab, setListTab] = useState<'active' | 'calendar' | 'trash' | 'notifications'>('active');
  const [direction, setDirection] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month'>('month');
  const [calendarDirection, setCalendarDirection] = useState(0);
  const [calendarTouchStart, setCalendarTouchStart] = useState<number | null>(null);

  const handleCalendarTouchStart = (e: React.TouchEvent) => {
    setCalendarTouchStart(e.touches[0].clientX);
  };

  const handleCalendarTouchEnd = (e: React.TouchEvent) => {
    if (calendarTouchStart === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = calendarTouchStart - touchEndX;

    if (diffX > 50) {
      setCalendarDirection(1);
      if (calendarViewMode === 'week') {
        setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
        setSelectedCalendarDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7) : null);
      } else {
        setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      }
    } else if (diffX < -50) {
      setCalendarDirection(-1);
      if (calendarViewMode === 'week') {
        setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
        setSelectedCalendarDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7) : null);
      } else {
        setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
      }
    }
    setCalendarTouchStart(null);
  };



  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  const tabIndices: Record<string, number> = {
    active: 0,
    calendar: 1,
    trash: 2,
    notifications: 3,
  };

  const handleTabChange = useCallback((newTab: 'active' | 'calendar' | 'trash' | 'notifications') => {
    setListTab((currentTab) => {
      if (newTab === currentTab) return currentTab;
      
      if (currentTab === 'active' || newTab === 'active') {
        setDirection(0);
      } else {
        const prevIndex = tabIndices[currentTab] ?? 0;
        const currentIndex = tabIndices[newTab] ?? 0;
        const newDirection = currentIndex > prevIndex ? 1 : -1;
        setDirection(newDirection);
      }
      
      setSelectedId(null);
      return newTab;
    });
  }, []);

  const searchParams = useSearchParams();
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

    // Automatically purge expired sessions before fetching
    try {
      await supabase.rpc('purge_expired_sessions');
    } catch (e) {
      console.error("Error purging expired sessions:", e);
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

    // Fetch notifications for current user
    const currentUserId = session?.user?.id;
    if (currentUserId) {
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', currentUserId)
        .order('created_at', { ascending: false });

      if (!notifError && notifData) {
        setNotifications(notifData);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channels = supabase.channel('diary-realtime-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screenshots' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchData)
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
      if (!matchesSearch || !matchesUser) return false;

      const participant = s.session_participants?.find((p: any) => p.user_id === session?.user?.id);
      const isDeletedParticipant = !!participant?.is_deleted;
      
      if (listTab === 'active' || listTab === 'calendar') {
        return !isDeletedParticipant;
      } else if (listTab === 'trash') {
        if (!isDeletedParticipant) return false;
        if (!participant.deleted_at) return true;
        const diffDays = (new Date().getTime() - new Date(participant.deleted_at).getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 8;
      } else {
        return false;
      }
    });
  }, [sessions, searchTerm, session, listTab]);

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

  const calendarSessions = useMemo(() => {
    return sessions
      .filter(s => {
        const matchesUser = session?.user?.id 
          ? s.session_participants?.some((p: any) => p.user_id === session.user.id)
          : false;
        if (!matchesUser) return false;

        const participant = s.session_participants?.find((p: any) => p.user_id === session?.user?.id);
        return !participant?.is_deleted;
      })
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [sessions, session]);

  const current = useMemo(() => {
    const s = (selectedId ? sessions.find(s => s.id === selectedId) : null) || sortedSessions[0];
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
  }, [sortedSessions, sessions, selectedId]);

  const isDeleted = useMemo(() => {
    if (!current || !session?.user?.id) return false;
    const participant = current.session_participants?.find((p: any) => p.user_id === session.user.id);
    return !!participant?.is_deleted;
  }, [current, session]);

  const sortedParticipants = useMemo(() => {
    if (!current?.session_participants) return [];
    return [...current.session_participants].sort((a: any, b: any) => 
      (b.duration_min || 0) - (a.duration_min || 0)
    );
  }, [current?.session_participants]);

  // 3. Dependent Side Effects (Placed AFTER 'current' definition)
  
  // Dynamic native touch listeners for Sidebar parent container
  useEffect(() => {
    const parentEl = sidebarNodeRef.current;
    if (parentEl && listTab !== 'calendar') {
      parentEl.addEventListener('touchstart', handleTouchStartNative, { passive: true });
      parentEl.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
      parentEl.addEventListener('touchend', handleTouchEndNative, { passive: true });
    }
    return () => {
      if (parentEl) {
        parentEl.removeEventListener('touchstart', handleTouchStartNative);
        parentEl.removeEventListener('touchmove', handleTouchMoveNative);
        parentEl.removeEventListener('touchend', handleTouchEndNative);
      }
    };
  }, [listTab, handleTouchStartNative, handleTouchMoveNative, handleTouchEndNative]);

  // Dynamic native touch listeners for Detail parent container
  useEffect(() => {
    const parentEl = detailNodeRef.current;
    if (parentEl) {
      parentEl.addEventListener('touchstart', handleTouchStartNative, { passive: true });
      parentEl.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
      parentEl.addEventListener('touchend', handleTouchEndNative, { passive: true });
    }
    return () => {
      if (parentEl) {
        parentEl.removeEventListener('touchstart', handleTouchStartNative);
        parentEl.removeEventListener('touchmove', handleTouchMoveNative);
        parentEl.removeEventListener('touchend', handleTouchEndNative);
      }
    };
  }, [current?.id, viewMode, handleTouchStartNative, handleTouchMoveNative, handleTouchEndNative]);
  


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

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'unread') {
      return notifications.filter(n => !n.is_read);
    }
    return notifications;
  }, [notifications, notifFilter]);

  useEffect(() => {
    if (loading) return;
    const urlId = searchParams?.get('id');
    if (urlId && sessions.some(s => s.id === urlId)) setSelectedId(urlId);
    else if (sortedSessions.length > 0 && !selectedId) setSelectedId(sortedSessions[0].id);
  }, [sortedSessions, sessions, loading, searchParams, selectedId]);

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

  const findSessionIdForNotification = (notif: any) => {
    if (notif.type === 'session_created') {
      return notif.source_id;
    }
    const commentId = notif.source_id;
    for (const s of sessions) {
      for (const sg of s.session_games || []) {
        for (const c of sg.comments || []) {
          if (c.id === commentId) {
            return s.id;
          }
        }
      }
    }
    return null;
  };

  const handleNotificationClick = async (notif: any) => {
    const backup = [...notifications];
    try {
      if (!notif.is_read) {
        // 즉시 로컬 상태 업데이트 (Optimistic Update)
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));

        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notif.id);
        if (error) throw error;
        fetchData();
      }

      const sessionId = findSessionIdForNotification(notif);
      if (sessionId) {
        handleTabChange('active');
        handleDiarySelect(sessionId);
      } else {
        alert("관련된 일기장을 찾을 수 없습니다.");
      }
    } catch (err: any) {
      console.error("Failed to handle notification click:", err.message);
      setNotifications(backup); // 실패 시 롤백
    }
  };

  const handleMarkAllAsRead = async () => {
    const backup = [...notifications];
    try {
      const unreadNotifs = notifications.filter(n => !n.is_read);
      if (unreadNotifs.length === 0) return;

      // 즉시 로컬 상태 업데이트 (Optimistic Update)
      setNotifications(prev => prev.map(n => n.is_read ? n : { ...n, is_read: true }));

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadNotifs.map(n => n.id));

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error("Failed to mark all notifications as read:", err.message);
      setNotifications(backup); // 실패 시 롤백
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
        if (!window.confirm("상단 고정을 해제할까요?")) {
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
          if (!window.confirm("이미 고정해 둔 댓글이 있어요. 새로운 댓글로 바꿀까요?")) {
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

  const handleMoveToTrash = async (sessionId: string) => {
    if (!supabase || !session?.user?.id) return;
    try {
      const { error } = await supabase
        .from('session_participants')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', session.user.id);
        
      if (error) {
        console.error("Error moving to trash:", error.message);
        alert("삭제 중 오류가 발생했습니다.");
      } else {
        if (selectedId === sessionId) {
          setSelectedId(null);
          setViewMode('list');
        }
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreDiary = async (sessionId: string) => {
    if (!supabase || !session?.user?.id) return;
    try {
      const { error } = await supabase
        .from('session_participants')
        .update({ is_deleted: false, deleted_at: null })
        .eq('session_id', sessionId)
        .eq('user_id', session.user.id);
        
      if (error) {
        console.error("Error restoring session:", error.message);
        alert("복구 중 오류가 발생했습니다.");
      } else {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePermanentDeleteDiary = async (sessionId: string) => {
    if (!supabase || !session?.user?.id) return;
    if (!window.confirm("이 일기를 영구히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    try {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      
      const { error } = await supabase
        .from('session_participants')
        .update({ is_deleted: true, deleted_at: eightDaysAgo.toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', session.user.id);
        
      if (error) {
        console.error("Error marking permanent delete:", error.message);
        alert("삭제 중 오류가 발생했습니다.");
        return;
      }
      
      const { error: rpcError } = await supabase.rpc('purge_expired_sessions');
      if (rpcError) {
        console.error("Error running database purge RPC:", rpcError.message);
      }
      
      if (selectedId === sessionId) {
        setSelectedId(null);
        setViewMode('list');
      }
      await fetchData();
    } catch (e) {
      console.error(e);
    }
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

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-playtime-toggle="true"]') && !target.closest('[data-playtime-dropdown="true"]')) {
        setExpandedGames({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // 인풋이 키보드 가상 영역에 가려지지 않으면서 너무 많이 올라가지 않도록 적절한 오프셋(하단 80px 여백)으로 정렬하는 함수
  const scrollInputIntoView = (target: HTMLElement) => {
    const scrollContainer = target.closest('.overflow-y-auto');
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      
      // 타겟(입력창)의 아래쪽 경계가 스크롤 컨테이너 아래에서 80px 높이에 위치하도록 조정 (키보드 툴바 여백 확보)
      const targetBottomRelative = targetRect.bottom - containerRect.top;
      const desiredBottom = containerRect.height - 80;
      const diff = targetBottomRelative - desiredBottom;
      
      if (diff > 0) {
        scrollContainer.scrollBy({ top: diff, behavior: 'smooth' });
      }
    } else {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  // 모바일 가상 키보드 대응: visualViewport 크기가 변경될 때 컨테이너 높이를 맞춰주어 상단 고정바가 밀려나지 않도록 처리
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      document.documentElement.style.setProperty('--visual-viewport-height', `${vv.height}px`);
      
      // 키보드가 올라왔을 때 윈도우 스크롤이 강제로 이동하는 현상 방지
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        window.scrollTo(0, 0);
        // 포커스된 입력창이 키보드에 가려지지 않도록 스크롤링
        const activeEl = document.activeElement as HTMLElement;
        setTimeout(() => {
          scrollInputIntoView(activeEl);
        }, 100);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // 인풋 포커스 시 브라우저가 화면을 강제로 올리는 기본 스크롤 동작 방지 및 고정
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const resetScroll = () => {
      window.scrollTo(0, 0);
    };

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        resetScroll();
        // 브라우저의 기본 포커스 동작 완료 후에도 스크롤 상태를 제어하기 위해 딜레이 실행
        setTimeout(resetScroll, 50);
        setTimeout(resetScroll, 150);
        setTimeout(resetScroll, 300);

        // 포커스된 인풋이 가려지지 않도록 스크롤하여 보이게 함
        setTimeout(() => {
          scrollInputIntoView(target);
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('focusin', handleFocus);
    };
  }, []);

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
    <div className="flex h-[var(--visual-viewport-height,100vh)] w-full bg-background text-foreground font-sans overflow-hidden selection:bg-primary/20 pb-16 md:pb-0 relative">
      {/* 1. Sidebar: Detailed List Navigation (Main Navigation) */}
      <aside className={`w-full bg-background md:border-r md:border-border flex flex-col h-full shrink-0 transition-transform duration-300 ease-in-out absolute left-0 top-0 md:relative md:left-auto md:top-auto md:w-[312px] ${
        viewMode === 'list' ? 'translate-x-0 pointer-events-auto z-10 md:z-auto' : '-translate-x-full pointer-events-none z-10 md:translate-x-0 md:pointer-events-auto md:z-auto'
      }`}>


        {/* Tab Bar (IMG_4513.jpg Style) */}
        <div className="w-full px-4 pt-4 pb-4 flex items-center gap-2.5 shrink-0 overflow-visible relative z-30">
          {/* 1. 디스코드 프로필 이미지 */}
          <div className="relative w-10 h-10 shrink-0 md:hidden">
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-full bg-white border-2 border-[#e8ebed] dark:border-muted flex items-center justify-center shadow-xs overflow-hidden shrink-0 focus:outline-none cursor-pointer active:scale-95 transition-transform"
            >
              {session?.user?.image ? (
                <img src={session.user.image} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-[12px] font-black text-foreground">
                  {session?.user?.name?.charAt(0) || '정'}
                </span>
              )}
            </button>
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'settings') {
                  setIsSettingsOpen(true);
                } else if (val === 'help') {
                  setIsHelpOpen(true);
                } else if (val === 'logout') {
                  signOut();
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20 md:hidden"
              style={{ WebkitAppearance: 'none' }}
            >
              <option value="" disabled>프로필 메뉴</option>
              <option value="settings">설정</option>
              <option value="help">도움말 및 지원</option>
              <option value="logout">로그아웃</option>
            </select>
          </div>

          {/* 2. 목록 탭 (active) */}
          <motion.button 
            layout
            onClick={() => handleTabChange('active')}
            className={`h-10 rounded-full font-bold text-[14px] transition-colors duration-200 shrink-0 relative flex items-center justify-center gap-1.5 focus:outline-none bg-[#e8ebed] dark:bg-muted ${
              listTab === 'active' 
                ? 'flex-1 text-foreground px-5' 
                : 'w-14 hover:bg-[#e8ebed]/80 dark:hover:bg-muted/80 text-muted-foreground'
            }`}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            title="목록"
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <List className={`w-4 h-4 ${listTab === 'active' ? 'fill-foreground text-foreground' : ''}`} />
              {listTab === 'active' && <span className="md:hidden">목록</span>}
            </span>
          </motion.button>

          {/* 3. 캘린더 탭 (calendar) */}
          <motion.button 
            layout
            onClick={() => handleTabChange('calendar')}
            className={`h-10 rounded-full font-bold text-[14px] transition-colors duration-200 shrink-0 relative flex items-center justify-center gap-1.5 focus:outline-none bg-[#e8ebed] dark:bg-muted ${
              listTab === 'calendar' 
                ? 'flex-1 text-foreground px-5' 
                : 'w-14 hover:bg-[#e8ebed]/80 dark:hover:bg-muted/80 text-muted-foreground'
            }`}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            title="캘린더"
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Calendar className={`w-4 h-4 ${listTab === 'calendar' ? 'fill-foreground text-foreground' : ''}`} />
              {listTab === 'calendar' && <span className="md:hidden">캘린더</span>}
            </span>
          </motion.button>

          {/* 4. 휴지통 탭 (trash) */}
          <motion.button 
            layout
            onClick={() => handleTabChange('trash')}
            className={`h-10 rounded-full font-bold text-[14px] transition-colors duration-200 shrink-0 relative flex items-center justify-center gap-1.5 focus:outline-none bg-[#e8ebed] dark:bg-muted ${
              listTab === 'trash' 
                ? 'flex-1 text-foreground px-5' 
                : 'w-14 hover:bg-[#e8ebed]/80 dark:hover:bg-muted/80 text-muted-foreground'
            }`}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            title="휴지통"
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Trash2 className={`w-4 h-4 ${listTab === 'trash' ? 'fill-foreground text-foreground' : ''}`} />
              {listTab === 'trash' && <span className="md:hidden">휴지통</span>}
            </span>
          </motion.button>

          {/* 5. 알림 탭 (notifications) */}
          <motion.button 
            layout
            onClick={() => handleTabChange('notifications')}
            className={`h-10 rounded-full font-bold text-[14px] transition-colors duration-200 shrink-0 relative flex items-center justify-center gap-1.5 focus:outline-none bg-[#e8ebed] dark:bg-muted ${
              listTab === 'notifications' 
                ? 'flex-1 text-foreground px-5' 
                : 'w-14 hover:bg-[#e8ebed]/80 dark:hover:bg-muted/80 text-muted-foreground'
            }`}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            title="알림"
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <span className="relative">
                <Bell className={`w-4 h-4 ${listTab === 'notifications' ? 'fill-foreground text-foreground' : ''}`} />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#ef4444] rounded-full border border-white dark:border-muted z-20 pointer-events-none" />
                )}
              </span>
              {listTab === 'notifications' && <span className="md:hidden">알림</span>}
            </span>
          </motion.button>

          {/* 프로필 확장 모달 (Circular Reveal) */}
          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsProfileOpen(false)}
                />
                 <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute top-4 left-4 z-50 w-48 overflow-hidden rounded-xl bg-card shadow-lg shadow-black/5 flex flex-col p-1 origin-top-left border border-border/30 md:hidden"
                >
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-[13.5px] font-bold rounded-lg transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center gap-2.5 focus:outline-none"
                  >
                    <Settings className="w-4 h-4 opacity-60 shrink-0" />
                    <span>설정</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsHelpOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-[13.5px] font-bold rounded-lg transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center gap-2.5 focus:outline-none"
                  >
                    <HelpCircle className="w-4 h-4 opacity-60 shrink-0" />
                    <span>도움말 및 지원</span>
                  </button>
                  <div className="h-[1px] bg-border/40 my-1 mx-2" />
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      signOut();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-[13.5px] font-bold rounded-lg transition-colors text-red-500 hover:bg-red-500/10 hover:text-red-600 flex items-center gap-2.5 focus:outline-none"
                  >
                    <LogOut className="w-4 h-4 opacity-80 shrink-0" />
                    <span>로그아웃</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div 
          className={`w-full px-4 flex items-center shrink-0 relative z-10 transition-all duration-300 ${
            listTab === 'active' 
              ? 'h-14 pb-4 md:h-10 md:pb-0 opacity-100 pointer-events-auto' 
              : 'h-0 pb-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="relative group w-full">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground/40 group-focus-within:text-primary transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              placeholder="일기 제목 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white rounded-xl pl-9 pr-8 py-2 text-[16px] md:text-[12px] font-medium text-foreground focus:outline-none transition-all placeholder:text-muted-foreground/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-2.5 my-auto w-5 h-5 rounded-full bg-[#e8ebed] dark:bg-muted hover:bg-[#dddfe2] dark:hover:bg-muted/80 text-muted-foreground/60 hover:text-foreground flex items-center justify-center transition-colors focus:outline-none cursor-pointer active:scale-95 z-20"
                title="검색어 지우기"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <motion.div 
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="flex-1 relative overflow-hidden md:overflow-visible min-h-0 md:flex md:flex-col bg-card rounded-t-2xl rounded-b-none mb-0 pt-0 px-0 pb-0 md:bg-transparent md:rounded-none md:border-none md:shadow-none md:mx-0 md:mb-0 md:p-0 z-20"
        >
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              ref={sidebarNodeRef}
              key={listTab}
              custom={direction}
              variants={{
                enter: (dir: number) => ({
                  x: dir === 0 ? 0 : (dir > 0 ? '100%' : '-100%'),
                  opacity: 0
                }),
                center: {
                  x: 0,
                  opacity: 1
                },
                exit: (dir: number) => ({
                  x: dir === 0 ? 0 : (dir > 0 ? '-100%' : '100%'),
                  opacity: 0
                })
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 380, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="absolute inset-0 flex flex-col px-0 pb-0 min-h-0 md:relative md:flex-1 md:flex md:flex-col md:min-h-0 pt-0"
            >
              {/* 1. If listTab === 'notifications', render absolute notification switcher header! */}
              {listTab === 'notifications' && (
                <div className="absolute top-0 left-0 right-0 bg-transparent z-20 select-none pointer-events-auto md:relative md:top-auto md:left-auto md:right-auto md:z-20 shrink-0">
                  {/* Stationary Gradient Overlay (Mobile Only) */}
                  <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-card via-card/85 to-transparent pointer-events-none z-10 md:hidden" />

                  {/* Switcher Buttons Row */}
                  <div className="relative z-20 pt-3 pb-1.5 px-3 flex items-center justify-between w-full md:pt-0 md:pb-2">
                    <div className="flex items-center gap-1.5 w-max ml-1 mt-1 select-none">
                      <button
                        onClick={() => setNotifFilter('all')}
                        className={`px-3.5 rounded-full text-[12px] h-7 flex items-center justify-center relative cursor-pointer focus:outline-none transition-all duration-200 ${
                          notifFilter === 'all'
                            ? 'text-white font-bold shadow-xs z-10'
                            : 'bg-muted text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 shadow-xs z-0'
                        }`}
                      >
                        {notifFilter === 'all' && (
                          <motion.div 
                            layoutId="notifTabBg" 
                            className="absolute inset-0 bg-[#e94a44] rounded-full shadow-xs z-0" 
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">모든 알림</span>
                      </button>
                      <button
                        onClick={() => setNotifFilter('unread')}
                        className={`px-3.5 rounded-full text-[12px] h-7 flex items-center justify-center relative cursor-pointer focus:outline-none transition-all duration-200 ${
                          notifFilter === 'unread'
                            ? 'text-white font-bold shadow-xs z-10'
                            : 'bg-muted text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 shadow-xs z-0'
                        }`}
                      >
                        {notifFilter === 'unread' && (
                          <motion.div 
                            layoutId="notifTabBg" 
                            className="absolute inset-0 bg-[#e94a44] rounded-full shadow-xs z-0" 
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">읽지 않은 알림</span>
                      </button>
                    </div>
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-bold text-muted-foreground/60 hover:text-[#e94a44] underline transition-colors px-1 select-none cursor-pointer active:scale-95 mr-1"
                    >
                      모두 확인
                    </button>
                  </div>
                </div>
              )}

              {/* 2. If listTab === 'active', render absolute sort bar! */}
              {listTab === 'active' && (
                <div className="absolute top-0 left-0 right-0 bg-transparent z-20 h-8 flex items-center justify-between pl-2 pr-[14px] md:relative md:top-auto md:left-auto md:right-auto md:h-9 md:pl-5 md:pr-[16px] md:z-20 shrink-0">
                  {/* Stationary Gradient Overlay (Mobile Only) */}
                  <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-card via-card/85 to-transparent pointer-events-none z-10 md:hidden" />
                  <div />
                  <SidebarSortDropdown className="translate-y-2 z-20 md:translate-y-0" currentSort={sortBy} onSortChange={setSortBy} />
                </div>
              )}

              {/* 3. If listTab === 'trash', render static header with text and divider matching calendar tab */}
              {listTab === 'trash' && (
                <div className="shrink-0 flex flex-col pt-0 pb-0 select-none animate-in fade-in duration-300">
                  <div className="flex items-center gap-1.5 text-muted-foreground/60 pl-5 relative z-20 pb-2.5">
                    <Info className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="text-[11px] font-medium">삭제된 일기는 나에게서만 삭제되며 7일 후 영구 삭제됩니다.</span>
                  </div>
                  {/* Divider matching the calendar tab divider exactly */}
                  <div className="mx-4 md:mx-5 border-b border-border/60 shrink-0" />
                </div>
              )}

              {listTab === 'calendar' ? (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 pt-4 md:pt-0 px-2 md:px-3">
                  {/* Calendar Widget (Fixed at the top) */}
                  <div className="shrink-0 animate-in fade-in duration-300 select-none pb-0">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div 
                          onClick={() => {
                            if (calendarMonthInputRef.current) {
                              try {
                                calendarMonthInputRef.current.showPicker();
                              } catch (err) {
                                calendarMonthInputRef.current.click();
                              }
                            }
                          }}
                          className="relative flex items-center justify-center bg-[#e8ebed]/60 dark:bg-muted/40 text-foreground w-[96px] shrink-0 h-[28px] rounded-full select-none ml-2 md:ml-0 cursor-pointer active:scale-95 transition-transform duration-100"
                        >
                          <span className="text-[12.5px] font-bold relative z-10">
                            {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
                          </span>
                          <input 
                            ref={calendarMonthInputRef}
                            type="month"
                            value={`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                const [year, month] = val.split('-').map(Number);
                                const newDate = new Date(year, month - 1, 1);
                                setCalendarMonth(newDate);
                                setSelectedCalendarDate(newDate);
                              }
                            }}
                            className="absolute inset-0 opacity-0 w-full h-full z-20 pointer-events-none"
                            style={{ WebkitAppearance: 'none' }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-0 w-max h-[28px] select-none md:bg-[#e8ebed]/60 md:dark:bg-muted/40 md:p-[2px] md:rounded-full">
                          <button
                            onClick={() => {
                              setCalendarDirection(0);
                              setCalendarViewMode('week');
                            }}
                            className={`px-3 md:px-2.5 rounded-full text-[11.5px] h-full flex items-center justify-center relative cursor-pointer focus:outline-none transition-all duration-200 ${
                              calendarViewMode === 'week'
                                ? 'text-white font-bold shadow-xs md:shadow-none z-10'
                                : 'bg-muted md:bg-transparent text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 md:hover:bg-transparent shadow-xs md:shadow-none z-0'
                            }`}
                          >
                            {calendarViewMode === 'week' && (
                              <motion.div 
                                layoutId="calendarTabBg" 
                                className="absolute inset-0 bg-[#e94a44] rounded-full shadow-xs md:shadow-none z-0" 
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}
                            <span className="relative z-10 md:hidden">주간</span>
                            <span className="relative z-10 hidden md:inline">주</span>
                          </button>
                          <button
                            onClick={() => {
                              setCalendarDirection(0);
                              setCalendarViewMode('month');
                            }}
                            className={`px-3 md:px-2.5 rounded-full text-[11.5px] h-full flex items-center justify-center relative cursor-pointer focus:outline-none transition-all duration-200 ${
                              calendarViewMode === 'month'
                                ? 'text-white font-bold shadow-xs md:shadow-none z-10'
                                : 'bg-muted md:bg-transparent text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 md:hover:bg-transparent shadow-xs md:shadow-none z-0'
                            }`}
                          >
                            {calendarViewMode === 'month' && (
                              <motion.div 
                                layoutId="calendarTabBg" 
                                className="absolute inset-0 bg-[#e94a44] rounded-full shadow-xs md:shadow-none z-0" 
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}
                            <span className="relative z-10 md:hidden">월간</span>
                            <span className="relative z-10 hidden md:inline">월</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3.5">
                        <button
                          onClick={() => {
                            setCalendarDirection(-1);
                            if (calendarViewMode === 'week') {
                              setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
                              setSelectedCalendarDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7) : null);
                            } else {
                              setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                            }
                          }}
                          className="w-7 h-7 rounded-full text-muted-foreground flex items-center justify-center transition-all hover:bg-muted/50 hover:text-foreground active:scale-95"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setCalendarDirection(0);
                            const today = new Date();
                            setCalendarMonth(today);
                            setSelectedCalendarDate(today);
                          }}
                          className="px-1 py-1 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground active:scale-95 underline"
                        >
                          오늘
                        </button>
                        <button
                          onClick={() => {
                            setCalendarDirection(1);
                            if (calendarViewMode === 'week') {
                              setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
                              setSelectedCalendarDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7) : null);
                            } else {
                              setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                            }
                          }}
                          className="w-7 h-7 rounded-full text-muted-foreground flex items-center justify-center transition-all hover:bg-muted/50 hover:text-foreground active:scale-95"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 text-center select-none mb-0 pb-0 border-none">
                      {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                        <span 
                          key={d} 
                          className="font-bold tracking-tight text-[11px] font-medium text-foreground"
                        >
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* Swipable Calendar Content Block */}
                    <div 
                      className="flex flex-col overflow-hidden"
                      onTouchStart={handleCalendarTouchStart}
                      onTouchEnd={handleCalendarTouchEnd}
                    >
                      <AnimatePresence mode="popLayout" initial={false} custom={calendarDirection}>
                        <motion.div
                          key={(() => {
                            if (calendarViewMode === 'week') {
                              const baseDate = selectedCalendarDate || new Date();
                              const day = baseDate.getDay();
                              const Sunday = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - day);
                              return 'week-' + Sunday.toDateString();
                            }
                            return 'month-' + calendarMonth.getFullYear() + '-' + calendarMonth.getMonth();
                          })()}
                          custom={calendarDirection}
                          variants={{
                            enter: (dir: number) => ({
                              x: dir === 0 ? 0 : (dir > 0 ? '100%' : '-100%'),
                              opacity: 0
                            }),
                            center: {
                              x: 0,
                              opacity: 1
                            },
                            exit: (dir: number) => ({
                              x: dir === 0 ? 0 : (dir > 0 ? '-100%' : '100%'),
                              opacity: 0
                            })
                          }}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{
                            x: { type: "spring", stiffness: 400, damping: 38 },
                            opacity: { duration: calendarDirection === 0 ? 0 : 0.25 }
                          }}
                          className="flex flex-col w-full"
                        >

                          {/* Date Grid */}
                          {(() => {
                            const renderCell = (cell: any) => {
                              if (cell.type === 'empty') {
                                return (
                                  <div 
                                    key={cell.id} 
                                    className="h-[70px] flex items-start justify-center px-0.5 pb-0.5 pt-[6px]" 
                                  />
                                );
                              }
                              const dateObj = cell.dateObj;
                              const isToday = new Date().toDateString() === dateObj.toDateString();
                              const isSelected = selectedCalendarDate && selectedCalendarDate.toDateString() === dateObj.toDateString();
                              const dayOfWeek = dateObj.getDay();

                              const daySessions = calendarSessions.filter(s => {
                                const dateStr = s.start_time || s.date;
                                if (!dateStr) return false;
                                const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T'));
                                if (isNaN(d.getTime())) return false;
                                return d.getFullYear() === dateObj.getFullYear() &&
                                       d.getMonth() === dateObj.getMonth() &&
                                       d.getDate() === dateObj.getDate();
                              });

                              const firstSession = daySessions[0];
                              let sessionIcon = null;
                              if (firstSession) {
                                if (firstSession.guild_name && firstSession.guild_name !== '개인') {
                                  if (firstSession.guild_icon) {
                                    sessionIcon = (
                                      <img src={firstSession.guild_icon} className="w-full h-full object-cover rounded-full block" alt="" />
                                    );
                                  } else {
                                    sessionIcon = (
                                      <div className="w-full h-full bg-primary/20 flex items-center justify-center text-[5px] font-black text-primary rounded-full block">
                                        {firstSession.guild_name.charAt(0)}
                                      </div>
                                    );
                                  }
                                } else {
                                  const participantId = firstSession.session_participants?.[0]?.user_id || firstSession.id;
                                  const avatarUrl = profiles[participantId]?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${participantId}`;
                                  sessionIcon = (
                                    <img src={avatarUrl} className="w-full h-full object-cover rounded-full block" alt="" />
                                  );
                                }
                              }

                              return (
                                <div 
                                  key={cell.id} 
                                  className="h-[70px] flex items-start justify-center px-0.5 pb-0.5 pt-[6px] relative z-10"
                                >
                                  <button
                                    onClick={() => {
                                      setSelectedCalendarDate(dateObj);
                                      setCalendarMonth(dateObj);
                                    }}
                                    className={`w-9 h-9 md:shrink-0 md:aspect-square rounded-full flex items-center justify-center relative transition-all duration-200 focus:outline-none active:scale-95 ${
                                      isSelected 
                                        ? isToday
                                          ? 'bg-[#e94a44] text-white font-bold shadow-sm z-10'
                                          : 'bg-black text-white font-bold shadow-sm z-10' 
                                        : isToday
                                          ? 'text-[#e94a44] font-bold hover:bg-muted/30 z-10'
                                          : dayOfWeek === 0 || dayOfWeek === 6
                                            ? 'text-[#999999] hover:bg-muted/30 font-medium'
                                            : 'text-[#222222] hover:bg-muted/30 font-medium'
                                    }`}
                                    style={{ fontSize: '17px' }}
                                  >
                                    {cell.day}
                                  </button>
                                  {sessionIcon && (
                                    <div className="absolute top-[47px] left-1/2 -translate-x-1/2 flex items-center gap-0.5 z-20">
                                      <div 
                                        className="rounded-full overflow-hidden bg-card ring-[1px] ring-background shrink-0 aspect-square"
                                        style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px', maxWidth: '14px', maxHeight: '14px' }}
                                      >
                                        {sessionIcon}
                                      </div>
                                      {daySessions.length > 1 && (
                                        <div 
                                          className="rounded-full flex items-center justify-center bg-card ring-[1px] ring-background shrink-0 select-none overflow-hidden aspect-square"
                                          style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px', maxWidth: '14px', maxHeight: '14px' }}
                                        >
                                          <span className="text-[9px] font-black text-primary font-mono leading-none tracking-tighter" style={{ fontSize: '9px', lineHeight: '1' }}>
                                            +{daySessions.length - 1}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            };

                            let firstRowCells: any[] = [];
                            
                            // Generate monthly grid cells to always have them available for smooth collapse transitions
                            const emptyDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
                            const totalDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
                            
                            const allCells: any[] = [];
                            for (let i = 0; i < emptyDays; i++) {
                              allCells.push({ type: 'empty', id: `empty-${i}` });
                            }
                            for (let i = 1; i <= totalDays; i++) {
                              const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i);
                              allCells.push({ type: 'day', day: i, dateObj, id: `day-${i}` });
                            }
                            const trailingCount = 42 - emptyDays - totalDays;
                            for (let i = 0; i < trailingCount; i++) {
                              allCells.push({ type: 'empty', id: `trailing-empty-${i}` });
                            }

                            const remainingCells = allCells.slice(7);
                            const totalRowsCount = Math.ceil((emptyDays + totalDays) / 7);
                            const remainingHeight = (totalRowsCount - 1) * 70;

                            if (calendarViewMode === 'week') {
                              const baseDate = selectedCalendarDate || new Date();
                              const day = baseDate.getDay();
                              const Sunday = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - day);
                              for (let i = 0; i < 7; i++) {
                                const dateObj = new Date(Sunday.getFullYear(), Sunday.getMonth(), Sunday.getDate() + i);
                                firstRowCells.push({
                                  type: 'day',
                                  day: dateObj.getDate(),
                                  dateObj,
                                  id: `day-week-${i}`
                                });
                              }
                              
                              return (
                                <div className="flex flex-col w-full">
                                  <div className="grid grid-cols-7 gap-x-1 gap-y-0 h-[70px] shrink-0">
                                    {firstRowCells.map(renderCell)}
                                  </div>
                                </div>
                              );
                            }

                            // Month View: partition allCells into 6 rows of 7 cells
                            const rows: any[][] = [];
                            for (let i = 0; i < 6; i++) {
                              rows.push(allCells.slice(i * 7, (i + 1) * 7));
                            }

                            return (
                              <div className="flex flex-col w-full">
                                {rows.map((rowCells, idx) => (
                                  <div 
                                    key={`row-${idx}`}
                                    className={`grid grid-cols-7 gap-x-1 gap-y-0 h-[70px] shrink-0 ${
                                      idx < 5 ? 'border-b border-border/40' : ''
                                    }`}
                                  >
                                    {rowCells.map(renderCell)}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Fixed Date Label & Divider Wrapper */}
                  <div className="shrink-0">
                    {selectedCalendarDate && (
                      <div className={`shrink-0 pb-2 pl-3 md:pl-2 pr-3 select-none flex items-center justify-between transition-all duration-200 ${
                        calendarViewMode === 'week' ? 'pt-[32px]' : 'pt-2'
                      }`}>
                        <h4 className="text-[14px] font-semibold text-black dark:text-white tracking-tight">
                          {selectedCalendarDate.getFullYear()}년 {selectedCalendarDate.getMonth() + 1}월 {selectedCalendarDate.getDate()}일의 일기
                        </h4>
                        <button
                          onClick={async () => {
                            if (isRefreshing) return;
                            setIsRefreshing(true);
                            try {
                              await fetchData();
                            } catch (err) {
                              console.error("Refresh failed:", err);
                            } finally {
                              setIsRefreshing(false);
                            }
                          }}
                          disabled={isRefreshing}
                          className="w-6 h-6 rounded-full bg-[#e8ebed]/60 dark:bg-muted/40 text-muted-foreground/60 hover:text-primary hover:bg-[#e8ebed] dark:hover:bg-muted transition-all active:scale-95 duration-100 flex items-center justify-center cursor-pointer focus:outline-none"
                          title="일기 새로고침"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin-reverse' : ''}`} />
                        </button>
                      </div>
                    )}

                    {/* Divider with 8px margin on each side */}
                    <div className="mx-2 border-b border-border/60 shrink-0" />
                  </div>

                  {/* Daily Diary List (Scrollable) */}
                  {(() => {
                    const selectedDateSessions = selectedCalendarDate ? calendarSessions.filter(s => {
                      const dateStr = s.start_time || s.date;
                      if (!dateStr) return false;
                      const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T'));
                      if (isNaN(d.getTime())) return false;
                      return d.getFullYear() === selectedCalendarDate.getFullYear() &&
                             d.getMonth() === selectedCalendarDate.getMonth() &&
                             d.getDate() === selectedCalendarDate.getDate();
                    }) : [];

                    const hasDiaries = selectedDateSessions.length > 0;
                    const isMonthMode = calendarViewMode === 'month';
                    
                    // 각 아이템 높이가 약 52px이므로, 3개 높이는 약 156px입니다. 
                    // 4개부터는 스크롤되도록 max-h-[160px] 설정 (패딩 고려)
                    const containerStyle = isMonthMode && hasDiaries
                      ? { maxHeight: '160px' }
                      : undefined;

                    const containerClass = `overflow-x-hidden scrollbar-hide touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] pt-1 ${
                      isMonthMode && selectedDateSessions.length <= 3
                        ? 'overflow-y-hidden'
                        : 'overflow-y-auto flex-1 pb-4'
                    }`;

                    return (
                      <div 
                        data-scroll-container="true"
                        style={containerStyle}
                        className={containerClass}
                      >
                        {selectedCalendarDate && (
                          <div className="pt-0 animate-in slide-in-from-bottom-1 duration-200">
                            <motion.div 
                              animate={isRefreshing ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
                              transition={isRefreshing ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.2 }}
                              className="space-y-1"
                            >
                              {selectedDateSessions.length === 0 ? (
                                <p className={`text-[11px] font-bold text-muted-foreground/30 text-center pb-4 select-none ${
                                  calendarViewMode === 'week' ? 'pt-[240px]' : 'pt-[80px]'
                                }`}>생성된 일기가 없습니다.</p>
                              ) : (
                                selectedDateSessions.map(s => (
                                  <DiaryListItem 
                                    key={s.id}
                                    session={s}
                                    isSelected={selectedId === s.id}
                                    isFavorite={favoriteSessionIds.has(s.id)}
                                    onSelect={handleDiarySelect}
                                    onToggleFavorite={handleToggleFavorite}
                                    isTrash={false}
                                    currentUserId={session?.user?.id}
                                    creatorAvatarUrl={profiles[s.session_participants?.[0]?.user_id]?.avatar_url}
                                  />
                                ))
                              )}
                            </motion.div>
                          </div>
                        )}

                        {/* Haptic/Visual spacer to push content above the 88px mobile dock - 월간뷰에서는 과도한 스크롤 방지를 위해 비활성화 */}
                        {!isMonthMode && (
                          <div className="h-40 md:hidden shrink-0" />
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div 
                  data-scroll-container="true"
                  className={`flex-1 mt-0 overflow-y-auto overflow-x-hidden scrollbar-hide pb-4 md:pt-0 md:pb-0 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] md:flex md:flex-col ${
                    listTab === 'notifications' 
                      ? 'px-1 md:px-2 pt-12' 
                      : listTab === 'trash'
                        ? 'px-2 md:px-3 pt-2 md:pt-0'
                        : 'px-2 md:px-3 pt-8 md:pt-0'
                  }`}
                >
                  {/* Pull-to-refresh Indicator */}
                  <div 
                    data-pull-indicator="true"
                    className="w-full flex items-center justify-center overflow-hidden h-0 opacity-0"
                    style={{
                      height: isRefreshing ? '50px' : undefined,
                      opacity: isRefreshing ? 1 : undefined
                    }}
                  >
                    <div className="flex items-center justify-center py-2">
                      <RotateCcw 
                        data-pull-icon="true"
                        strokeWidth={2.75}
                        className={`w-[22px] h-[22px] text-[#e94a44] ${isRefreshing ? 'animate-spin-reverse' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-0 min-h-[396px] md:min-h-0 w-full md:flex-1 md:flex md:flex-col md:h-full">
                    {listTab === 'notifications' ? (
                      <div className="flex flex-col gap-3.5 px-1 pb-4 animate-in fade-in duration-300 select-none relative">
                        {filteredNotifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center min-h-[480px] text-muted-foreground/40 gap-2 select-none">
                            <Bell className="w-8 h-8 opacity-50" />
                            <p className="text-[12px] font-bold tracking-tight">
                              {notifFilter === 'unread' ? '읽지 않은 알림이 없습니다' : '새로운 알림이 없습니다'}
                            </p>
                          </div>
                        ) : (
                          <motion.div 
                            animate={isRefreshing ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
                            transition={isRefreshing ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.2 }}
                            className="flex flex-col gap-2.5"
                          >
                            {filteredNotifications.map((notif) => {
                              const isUnread = !notif.is_read;
                              const dateObj = new Date(notif.created_at);
                              const now = new Date();
                              const diffMs = now.getTime() - dateObj.getTime();
                              const diffMins = Math.floor(diffMs / (60 * 1000));
                              const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

                              let formattedDate = "";
                              if (diffMins < 1) {
                                formattedDate = "방금 전";
                              } else if (diffMins < 60) {
                                formattedDate = `${diffMins}분 전`;
                              } else if (diffHours < 24) {
                                formattedDate = `${diffHours}시간 전`;
                              } else {
                                formattedDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;
                              }

                              const parts = notif.content.split(': "');
                              const isReplyNotification = (notif.type === 'reply' || notif.type === 'session_comment') && parts.length > 1;
                              const isSessionCreatedNotification = notif.type === 'session_created' && parts.length > 1;
                              const targetSession = notif.type === 'session_created'
                                ? sessions.find(s => s.id === notif.source_id)
                                : null;

                              return (
                                <div 
                                  key={notif.id}
                                  onClick={() => handleNotificationClick(notif)}
                                  className="flex flex-col py-3 px-4 md:p-2 hover:bg-muted/20 rounded-xl cursor-pointer border-b border-border/10 last:border-b-0 transition-all duration-200 relative group overflow-hidden"
                                >
                                  <div className="flex items-center justify-between gap-3 w-full">
                                    {isReplyNotification ? (
                                      <span className={`text-[13px] font-medium text-foreground leading-relaxed break-all truncate flex-1 ${isUnread ? '' : 'opacity-70'}`}>
                                        {parts[0]}:
                                      </span>
                                    ) : isSessionCreatedNotification ? (
                                      <span className={`text-[13px] font-medium text-foreground leading-relaxed break-all truncate flex-1 ${isUnread ? '' : 'opacity-70'}`}>
                                        {parts[0].replace(/^\[.*?\]\s*/, '')}
                                      </span>
                                    ) : (
                                      <span className={`text-[13px] font-medium text-foreground leading-relaxed break-all truncate flex-1 ${isUnread ? '' : 'opacity-70'}`}>
                                        {notif.content}
                                      </span>
                                    )}

                                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                                      <span className="text-[10px] text-muted-foreground/45 font-sans font-medium">
                                        {formattedDate}
                                      </span>
                                      {isUnread && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                                      )}
                                    </div>
                                  </div>

                                  {isReplyNotification && (
                                    <p className={`text-[13px] text-muted-foreground/75 dark:text-muted-foreground/65 mt-1 whitespace-pre-wrap w-full ${isUnread ? '' : 'opacity-70'}`}>
                                      &ldquo;{parts.slice(1).join(': "').slice(0, -1)}&rdquo;
                                    </p>
                                  )}

                                  {isSessionCreatedNotification && (
                                    <div className={`mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#e8ebed]/50 md:bg-[#e8ebed]/80 dark:bg-muted/30 hover:bg-[#e8ebed]/80 md:hover:bg-[#e8ebed]/90 dark:hover:bg-muted/40 transition-colors w-[calc(100%+8px)] -mx-1 ${isUnread ? '' : 'opacity-70'}`}>
                                      <div className="w-6 h-6 rounded-full overflow-hidden bg-background border border-border/50 shrink-0 flex items-center justify-center shadow-xs">
                                        {targetSession?.guild_icon ? (
                                          <img src={targetSession.guild_icon} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                          <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                            {targetSession?.guild_name?.charAt(0) || 'G'}
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-[13px] font-bold text-foreground/90 truncate flex-1">
                                        {targetSession?.title || parts.slice(1).join(': "').slice(0, -1)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </div>
                    ) : (
                      sortedSessions.length === 0 ? (
                        listTab === 'trash' ? (
                          <div className="flex flex-col items-center justify-center min-h-[480px] text-muted-foreground/40 gap-2 select-none animate-in fade-in duration-300">
                            <Trash2 className="w-8 h-8 opacity-50" />
                            <p className="text-[12px] font-bold tracking-tight">휴지통이 비어 있습니다</p>
                          </div>
                        ) : calendarSessions.length === 0 ? (
                          <>
                            {/* Mobile-only: Keep original sidebar invite guide block (Untouched design rule) */}
                            <div className="md:hidden flex flex-col items-center justify-center min-h-[480px] px-6 py-12 text-center select-none animate-in fade-in duration-300 gap-6">
                              <div className="space-y-1.5 max-w-[340px]">
                                <h3 className="text-[18px] font-bold text-foreground">
                                  {session?.user?.name || '유저'}님 반가워요 👋🏻
                                </h3>
                                <p className="text-[12px] text-muted-foreground leading-normal px-1 break-keep">
                                  일기 작성을 도와줄 봇을 디스코드 서버에 초대해 보세요.
                                  <br />
                                  음성 채널 대화와 스크린샷이 모여 일기로 자동 작성됩니다.
                                </p>
                              </div>
                              <div className="w-full flex flex-col items-center gap-2">
                                <a
                                  href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1500540191910264984'}&permissions=8&scope=bot%20applications.commands`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full max-w-[280px] py-3 bg-primary hover:bg-primary/95 active:scale-[0.98] text-white font-bold text-[13px] rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-primary/10 cursor-pointer"
                                >
                                  디스코드 봇 초대하기
                                </a>
                                <p className="text-[12px] text-muted-foreground">
                                  혼자서 사용할 계획이신가요?{' '}
                                  <a
                                    href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1500540191910264984'}&integration_type=1&scope=applications.commands`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline hover:text-primary/90 font-medium cursor-pointer"
                                  >
                                    봇 추가하기
                                  </a>
                                </p>
                              </div>
                            </div>

                            {/* Desktop-only: Show compact empty state in sidebar */}
                            <div className="hidden md:flex flex-col items-center justify-center flex-1 w-full text-muted-foreground/30 select-none animate-in fade-in duration-300">
                              <p className="text-[12px] font-bold tracking-tight">기록된 일기가 없습니다</p>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center min-h-[480px] text-muted-foreground/40 gap-2 select-none animate-in fade-in duration-300">
                            <Inbox className="w-8 h-8 opacity-50" />
                            <p className="text-[12px] font-bold tracking-tight">검색 결과가 없습니다</p>
                          </div>
                        )
                      ) : (
                        <motion.div
                          animate={isRefreshing ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
                          transition={isRefreshing ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.2 }}
                          className="space-y-1"
                        >
                          {sortedSessions.map(s => (
                            <DiaryListItem 
                              key={s.id}
                              session={s}
                              isSelected={selectedId === s.id}
                              isFavorite={favoriteSessionIds.has(s.id)}
                              onSelect={handleDiarySelect}
                              onToggleFavorite={handleToggleFavorite}
                              isTrash={listTab === 'trash'}
                              currentUserId={session?.user?.id}
                              onRestore={handleRestoreDiary}
                              onPermanentDelete={handlePermanentDeleteDiary}
                              creatorAvatarUrl={profiles[s.session_participants?.[0]?.user_id]?.avatar_url}
                            />
                          ))}
                        </motion.div>
                      )
                    )}
                  </div>

                  {/* Haptic/Visual spacer to push content above the 88px mobile dock */}
                  <div className="h-40 md:hidden shrink-0" />
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Bottom profile container (desktop only) */}
        <div className="hidden md:flex pt-2 pb-4 px-4 items-center justify-between bg-transparent relative z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-[30px] h-[30px] rounded-full bg-white border border-border flex items-center justify-center overflow-hidden">
                {session?.user?.image ? (
                  <img src={session.user.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-[11px] font-black text-foreground">
                    {session?.user?.name?.charAt(0) || '정'}
                  </span>
                )}
              </div>
            </div>
            {/* Name */}
            <span className="text-[14px] font-bold text-foreground truncate max-w-[150px]">
              {session?.user?.name}
            </span>
          </div>

          {/* Settings gear icon to open popover */}
          <button 
            onClick={() => setIsProfileOpen(prev => !prev)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer"
            title="설정 메뉴"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Desktop Profile Popover */}
          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsProfileOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute bottom-16 right-4 z-50 w-48 overflow-hidden rounded-lg bg-card shadow-lg shadow-black/5 flex flex-col p-1 origin-bottom-right"
                >
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[12px] font-bold rounded-md transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center gap-2 focus:outline-none"
                  >
                    <Settings className="w-4 h-4 opacity-60 shrink-0" />
                    <span>설정</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsHelpOpen(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[12px] font-bold rounded-md transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center gap-2 focus:outline-none"
                  >
                    <HelpCircle className="w-4 h-4 opacity-60 shrink-0" />
                    <span>도움말 및 지원</span>
                  </button>
                  <div className="h-[1px] bg-border/40 my-1 mx-2" />
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      signOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[12px] font-bold rounded-md transition-colors text-red-500 hover:bg-red-500/10 hover:text-red-600 flex items-center gap-2 focus:outline-none"
                  >
                    <LogOut className="w-4 h-4 opacity-80 shrink-0" />
                    <span>로그아웃</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* 3. Main Content Area */}
      <section 
        ref={detailNodeRef}
        className={`flex-1 flex flex-col min-w-0 transition-transform duration-300 ease-in-out absolute left-0 top-0 w-full h-full md:relative md:left-auto md:top-auto md:w-auto md:h-full bg-background ${
          viewMode === 'diary' ? 'translate-x-0 pointer-events-auto z-20 md:z-auto' : 'translate-x-full pointer-events-none z-10 md:translate-x-0 md:pointer-events-auto md:z-auto'
        }`}
      >
        {(!isMobile || viewMode === 'diary') ? (
          <>
            {current && (
              <div className="absolute top-0 left-0 right-0 z-30 flex flex-col">
                <DiaryHeader 
                  current={{ ...current, sessionTitle: current?.title, date: current?.start_time }}
                  profiles={profiles}
                  isEditingTitle={isEditingTitle}
                  tempTitle={tempTitle}
                  onTitleClick={() => setIsEditingTitle(true)}
                  onTitleChange={setNewTitle}
                  onTitleUpdate={handleUpdateTitle}
                  onShare={() => { navigator.clipboard.writeText(window.location.href); alert("공유 링크가 복사되었습니다!"); }}
                  onDelete={async () => { 
                    if (current) { 
                      if (window.confirm("일기를 삭제할까요?\n삭제된 일기는 휴지통으로 이동하며 7일간 보관됩니다.")) { 
                        await handleMoveToTrash(current.id); 
                      } 
                    } 
                  }}
                  viewMode={viewMode}
                  isDeleted={isDeleted}
                />

                {/* Restore/Permanent Delete Warning Banner for Deleted Diaries */}
                {isDeleted && (
                  <div className="bg-[#e94a44] px-4 py-1.5 flex items-center justify-center gap-3 animate-in fade-in duration-200 shrink-0 shadow-sm">
                    <button 
                      onClick={() => handleRestoreDiary(current.id)}
                      className="px-3.5 py-1.5 bg-white/15 text-white rounded-lg text-[11px] font-black hover:bg-white/25 transition-colors active:scale-[0.98] origin-center flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>일기 복원</span>
                    </button>
                    <button 
                      onClick={() => handlePermanentDeleteDiary(current.id)}
                      className="px-3.5 py-1.5 bg-white/15 text-white rounded-lg text-[11px] font-black hover:bg-white/25 transition-colors active:scale-[0.98] origin-center flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>영구 삭제</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {current ? (
              <div 
                data-scroll-container="true"
                className={`flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide ${isDeleted ? 'pt-[104px]' : 'pt-16'}`}
              >
                {/* Pull-to-refresh Indicator */}
                <div 
                  data-pull-indicator="true"
                  className="w-full flex items-center justify-center overflow-hidden h-0 opacity-0"
                  style={{
                    height: isRefreshing ? '50px' : undefined,
                    opacity: isRefreshing ? 1 : undefined
                  }}
                >
                  <div className="flex items-center justify-center py-2">
                    <RotateCcw 
                      data-pull-icon="true"
                      strokeWidth={2.75}
                      className={`w-[22px] h-[22px] text-[#e94a44] ${isRefreshing ? 'animate-spin-reverse' : ''}`}
                    />
                  </div>
                </div>

                <div className="w-full pb-72">
                  <div className="w-full">
                    {/* Mobile-only collapsible Toss-style Metadata Card */}
                    <div className="md:hidden px-3 pt-2 pb-0">
                      <div 
                        onClick={!isMetadataExpanded ? () => setIsMetadataExpanded(true) : undefined}
                        className={`relative rounded-2xl overflow-hidden py-2 px-4 bg-card backdrop-blur-sm transition-all duration-200 ${
                          !isMetadataExpanded ? 'cursor-pointer select-none active:scale-[0.995] active:bg-muted/30' : ''
                        }`}
                      >
                        {/* Background Pattern (Subtle dots) */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(233,74,68,1)_1px,transparent_1px)] bg-[length:24px_24px]" />
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
                                className="font-sans font-bold text-muted-foreground text-[13px] leading-none translate-y-[-0.5px] pl-1 inline-block shrink-0 select-none"
                              >
                                {formatDate(current.start_time || current.date)}
                              </span>
                              {!isMetadataExpanded && (
                                <motion.span 
                                  layoutId="duration-badge"
                                  transition={{ type: "spring", stiffness: 400, damping: 38 }}
                                  className="inline-flex items-center justify-center bg-[#e94a44] text-white font-sans font-bold text-[11px] px-2.5 py-1.5 rounded-full select-none leading-none shrink-0"
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
                                    className="text-[11px] font-bold text-muted-foreground/50 font-sans select-none translate-y-[-0.5px] shrink-0"
                                  >
                                    {formatTime(current.start_time)} - {formatTime(current.end_time)}
                                  </span>
                                  <motion.span 
                                    layoutId="duration-badge"
                                    transition={{ type: "spring", stiffness: 400, damping: 38 }}
                                    className="inline-flex items-center justify-center bg-[#e94a44] text-white font-sans font-bold text-[11px] px-2.5 py-1.5 rounded-full select-none leading-none"
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
                                  {/* Participants (Unified) */}
                                  {sortedParticipants.length > 0 && (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                      <span className="text-[10px] font-bold text-muted-foreground/60 tracking-tight uppercase shrink-0">참여자</span>
                                      <div className="flex flex-col items-center gap-1.5">
                                        {sortedParticipants.map((p: any) => {
                                          const profile = profiles?.[p.user_id];
                                          const hasLoggedIn = !!profile?.has_logged_in;
                                          const displayName = hasLoggedIn 
                                            ? (profile?.display_name || 'Anonymous') 
                                            : maskNickname(profile?.display_name || 'Anonymous');
                                          return (
                                            <div key={p.user_id} className="flex items-center gap-1.5 bg-muted pl-1.5 pr-2.5 py-1.5 rounded-full text-[11px] font-bold text-foreground/80 leading-none">
                                              <div className="w-4.5 h-4.5 rounded-full overflow-hidden shrink-0 isolate">
                                                <img 
                                                  src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.user_id}`} 
                                                  className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`} 
                                                  alt="" 
                                                />
                                              </div>
                                              <span className="translate-y-[-0.5px]">{displayName}</span>
                                              <span className="text-primary font-bold font-sans text-[9.5px] ml-0.5 translate-y-[-0.5px]">{formatDurationText(p.duration_min || 0)}</span>
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
                              icon: game.icon_url ? <img src={game.icon_url} className="w-10 h-10 object-contain" alt="" /> : <Gamepad2 className="w-10 h-10 text-foreground" />,
                              meta: (
                                <div className="flex items-center leading-none">
                                  <span className="translate-y-[-0.5px]">{formatTime(game.start_time)} - {formatTime(game.end_time)}</span>
                                </div>
                              ),
                              status: (
                                <div className="relative">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleGameStats(game.id); }}
                                    data-playtime-toggle="true"
                                    className={`group/btn flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all text-[11px] font-sans font-bold leading-none ${isExpanded ? 'bg-primary text-white shadow-lg' : 'bg-primary/5 text-primary hover:bg-primary/10 hover:scale-105 active:scale-95'}`}
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
                                        data-playtime-dropdown="true"
                                        className="absolute top-[calc(100%+0.25rem)] right-0 z-50 w-max max-w-[14rem] min-w-28 overflow-hidden rounded-2xl bg-card shadow-xl shadow-black/10"
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
                                                <span className="text-[9.5px] font-sans font-bold text-primary shrink-0 whitespace-nowrap translate-y-[-0.5px]">{formatDurationText(p.play_time_min)}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ),
                              colSpan: 3,
                              content: (
                                <div className="flex flex-col h-auto md:h-[450px] md:pr-[424px]">
                                  {/* Header (Desktop only) */}
                                  <div className="hidden md:flex items-center justify-center mb-4 w-[480px] mx-auto">
                                    {!isDeleted && gameShots.length > 0 && (
                                      <div>
                                        <input 
                                          type="file" 
                                          id={`file-upload-desktop-${game.id}`}
                                          className="hidden" 
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) setPendingUpload({ file, defaultGame: game.title });
                                          }}
                                        />
                                        <button 
                                          onClick={() => document.getElementById(`file-upload-desktop-${game.id}`)?.click()}
                                          className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-border bg-card hover:bg-muted text-[11px] font-bold transition-all text-muted-foreground hover:text-foreground cursor-pointer shadow-xs"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>스크린샷 추가</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex-1 min-h-0 flex flex-col justify-start">
                                    {/* Desktop 3D Carousel View */}
                                    <div className="hidden md:block">
                                      {gameShots.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center border border-dashed border-border/60 rounded-2xl p-8 bg-muted/5 text-muted-foreground w-[480px] h-[260px] mx-auto mt-2">
                                          <Camera className="w-8 h-8 opacity-25 mb-2" />
                                          <p className="text-[11px] font-black tracking-tight mb-3">등록된 스크린샷이 없습니다.</p>
                                          {!isDeleted && (
                                            <>
                                              <input 
                                                type="file" 
                                                id={`file-upload-desktop-empty-${game.id}`}
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) setPendingUpload({ file, defaultGame: game.title });
                                                }}
                                              />
                                              <button 
                                                onClick={() => document.getElementById(`file-upload-desktop-empty-${game.id}`)?.click()}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 text-[11px] font-black transition-all cursor-pointer shadow-md"
                                              >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>첫 스크린샷 올리기</span>
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      ) : (
                                        <DesktopScreenshotCarousel
                                          gameShots={gameShots}
                                          session={session}
                                          profiles={profiles}
                                          current={current}
                                          fetchData={fetchData}
                                          onAction={setActiveShot}
                                          onDownload={handleDownload}
                                          onDelete={handleImageDelete}
                                          isDeleted={isDeleted}
                                        />
                                      )}
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
                                        isDeleted={isDeleted}
                                      />
                                    </div>
                                  </div>

                                  {/* Mobile Comments Section (Embedded inside Highlight Card on mobile) */}
                                  <div className="block md:hidden mt-4 -mx-4 -mb-4 pt-4 pb-4 px-0 bg-muted rounded-2xl border border-border/40 animate-in fade-in duration-300">
                                    <div className="flex items-center mb-4 px-4">
                                      <h3 className="font-semibold text-foreground tracking-tight text-lg leading-none">
                                        댓글
                                      </h3>
                                    </div>
                                    <div className="px-3.5">
                                      {renderChecklist(game)}
                                    </div>
                                    <div className={`flex flex-col ${(game.comments?.filter((c: any) => !c.is_checklist) || []).reduce((acc: number, c: any) => acc + 1 + (c.replies?.length || 0), 0) > 5 ? "h-[320px]" : "h-auto"}`}>
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
                                      {!isDeleted && (
                                        <div className="px-4 bg-transparent">
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
                                      )}
                                    </div>
                                  </div>

                                  {/* Desktop Comments Section (Overlay inside Highlight Card on desktop) */}
                                  <div className="hidden md:flex absolute -right-6 -top-4 -bottom-6 w-[400px] bg-card border-l border-border/40 rounded-l-2xl flex flex-col pt-4 pb-0 px-0 z-20 shadow-xs overflow-hidden">
                                    <div className="flex items-center h-10 mb-4 px-6 shrink-0">
                                      <h3 className="font-semibold text-foreground tracking-tight text-[20px] leading-none">
                                        댓글
                                      </h3>
                                    </div>
                                    <div className="flex-1 flex flex-col min-h-0">
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
                                      {!isDeleted && (
                                        <div className="mt-2 md:mt-0 md:mx-4 md:mb-4 shrink-0 bg-card/90 backdrop-blur-sm">
                                          <GameCommentInput 
                                            gameId={game.id} 
                                            gameTitle={game.title} 
                                            onComplete={fetchData} 
                                            activeReply={activeReply?.gameId === game.id ? activeReply : null}
                                            onCancelReply={() => setActiveReply(null)}
                                            onAddReply={handleAddReply}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ),
                            }
                          ];
                        }) || []),
                      ]} 
                    />
                    {/* --- Bento Grid End --- */}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center w-full h-full px-6">
                {sortedSessions.length === 0 ? (
                  /* Desktop-only Discord Bot Invite Guide centered */
                  <div className="hidden md:flex flex-col items-center justify-center text-center select-none animate-in fade-in duration-300 gap-8 max-w-[460px] mx-auto">
                    <div className="space-y-3">
                      <h3 className="text-[24px] font-bold text-foreground tracking-tight">
                        {session?.user?.name || '유저'}님 반가워요 👋🏻
                      </h3>
                      <p className="text-[14px] text-muted-foreground leading-relaxed px-2 break-keep">
                        일기 작성을 도와줄 봇을 디스코드 서버에 초대해 보세요.
                        <br />
                        음성 채널 대화와 스크린샷이 모여 일기로 자동 작성됩니다.
                      </p>
                    </div>
                    <div className="w-full flex flex-col items-center gap-3">
                      <a
                        href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1500540191910264984'}&permissions=8&scope=bot%20applications.commands`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full max-w-[340px] h-14 bg-primary hover:bg-primary/95 active:scale-[0.98] text-white font-bold text-[18px] rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        디스코드 봇 초대하기
                      </a>
                      <p className="text-[14px] text-muted-foreground">
                        혼자서 사용할 계획이신가요?{' '}
                        <a
                          href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1500540191910264984'}&integration_type=1&scope=applications.commands`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline hover:text-primary/90 font-semibold cursor-pointer"
                        >
                          봇 추가하기
                        </a>
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Default No Session Selected state */
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[100px] mb-8 opacity-10">🎮</span>
                    <p className="text-2xl font-black italic tracking-tighter text-muted-foreground/20 uppercase">No Session Selected</p>
                  </div>
                )}
              </div>
            )}
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
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white text-foreground text-[12px] flex items-center justify-center font-black shadow-lg ring-4 ring-background border-none animate-in zoom-in duration-300">
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
                            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                            disabled={!canScrollPrev}
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => uncatCarouselApi?.scrollNext()}
                            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
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
                                          isDeleted={isDeleted}
                                        />
                                      </div>
                                    </CarouselItem>
                                  ))}
                                  {!isDeleted && (
                                    <CarouselItem className="pl-4 basis-auto">
                                      <div className="w-[240px]">
                                        <UploadPlaceholder 
                                          key={pendingUpload ? 'active-uncat-drawer' : 'idle-uncat-drawer'}
                                          onFileSelect={(file: File) => setPendingUpload({ file, defaultGame: "" })} 
                                        />
                                      </div>
                                    </CarouselItem>
                                  )}
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
          </>
        ) : (
          <div className="flex-1 bg-background" />
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
            <div className="text-center font-medium text-base text-foreground mb-6 shrink-0">리액션</div>
            
            {/* 이모지 탭 리스트 */}
            {activeReactionComment?.reactions && (
              <div className="flex gap-2 overflow-x-auto justify-start pb-3 border-b border-border/10 mb-3 no-scrollbar shrink-0 px-1">
                {Object.entries(activeReactionComment.reactions).map(([emoji, users]: [string, any]) => {
                  const isSelected = reactionDetailEmoji === emoji;
                  return (
                    <button
                      key={emoji}
                      onClick={() => setReactionDetailEmoji(emoji)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        isSelected 
                          ? 'bg-primary/10 border-primary text-foreground shadow-sm' 
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
              <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-1 custom-scrollbar">
                {(activeReactionComment.reactions[reactionDetailEmoji] as string[]).map((uid) => {
                  const userProfile = profiles[uid];
                  const isMe = session?.user?.id === uid;
                  const isLoggedIn = !!userProfile?.has_logged_in;
                  const displayName = userProfile?.display_name || displayNamesMap[uid] || uid || "알 수 없음";
                  const maskedName = isLoggedIn ? displayName : maskNickname(displayName);

                  return (
                    <div key={uid} className="flex items-center gap-3 py-2 first:pt-0 border-b border-border/5 last:border-0">
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

      {/* 도움말 및 지원 모달 (임시) */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-64 overflow-hidden rounded-xl bg-card/75 dark:bg-card/45 backdrop-blur-2xl border border-white/20 dark:border-border/35 p-4 shadow-2xl shadow-black/10 flex flex-col items-center text-center gap-4 z-10"
            >
              <p className="text-[12px] text-muted-foreground whitespace-pre-line leading-relaxed my-2">
                <span className="font-bold text-foreground">꼬우면 전화해</span>{"\n"}
                <span className="font-mono font-bold text-foreground text-[13px]">010-7109-8131</span>
              </p>
              <div className="flex flex-col w-full gap-1.5">
                <a 
                  href="tel:010-7109-8131"
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-primary text-foreground-foreground font-bold text-[12px] shadow-md shadow-primary/10 hover:bg-primary/90 active:scale-98 transition-all"
                >
                  <span>전화걸기</span>
                </a>
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="w-full py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground font-bold text-[12px] active:scale-98 transition-all"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 설정 뷰 */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="fixed inset-0 z-50"
          >
            <SettingsView onClose={() => setIsSettingsOpen(false)} session={session} />
          </motion.div>
        )}
      </AnimatePresence>
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
