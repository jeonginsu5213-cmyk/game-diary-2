"use client";
import { IconArrowNarrowRight } from "@tabler/icons-react";
import { useState, useRef, useId, useEffect, useLayoutEffect } from "react";
import { Trash2, FolderInput, Download, Gamepad2 } from "lucide-react";
import { maskNickname } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";
import { ImageZoom } from "@/components/ui/ImageZoom";
import UploadPlaceholder from "./UploadPlaceholder";
import ScreenshotCommentCard from "./ScreenshotCommentCard";

interface SlideData {
  title: string;
  src: string;
  shot: any;
  isUploader: boolean;
}

interface SlideProps {
  slide: SlideData;
  index: number;
  current: number;
  handleSlideClick: (index: number) => void;
  isDeleted?: boolean;
  currentDiary: any;
  onDownload?: (url: string) => void;
  onDelete?: (shotId: string) => void;
  fetchData: () => void;
  profiles: any;
  /** Fixed height for the entire slide (image + gap + comment) */
  slideHeight: number;
  /** Called when comment is expanded/collapsed so parent can recalculate height */
  onCommentToggle: (isExpanded: boolean) => void;
}

const Slide = ({
  slide,
  index,
  current,
  handleSlideClick,
  isDeleted,
  currentDiary,
  onDownload,
  onDelete,
  fetchData,
  profiles,
  slideHeight,
  onCommentToggle,
}: SlideProps) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [commentExpanded, setCommentExpanded] = useState(false);
  const { src, title, isUploader, shot } = slide;
  const isActive = current === index;

  useEffect(() => {
    if (!isActive) {
      setShowMoveMenu(false);
      // collapse comment when navigating away
      if (commentExpanded) {
        setCommentExpanded(false);
        onCommentToggle(false);
      }
    }
  }, [isActive]);

  const hasComment = !!shot.comment;

  const handleCommentClick = (e: React.MouseEvent) => {
    if (!hasComment || !isActive) return;
    e.stopPropagation();
    const next = !commentExpanded;
    setCommentExpanded(next);
    onCommentToggle(next);
  };

  const profile = profiles?.[shot.uploader_id];
  const hasLoggedIn = profile?.has_logged_in ?? false;
  const displayName = hasLoggedIn
    ? profile?.display_name || "Anonymous"
    : maskNickname(profile?.display_name || "Anonymous");
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`;

  return (
    <div className="[perspective:1200px] [transform-style:preserve-3d] shrink-0">
      <li
        className="flex flex-col w-[480px] mx-[16px] z-10 cursor-pointer"
        style={{
          height: slideHeight,
          transform: !isActive
            ? "scale(0.95) rotateX(8deg)"
            : "scale(1) rotateX(0deg)",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transformOrigin: "bottom",
        }}
        onClick={() => { if (!isActive) handleSlideClick(index); }}
      >
        {/* Image — fixed 16:9 */}
        <div className="w-full h-[270px] shrink-0 bg-[#1D1F2F] rounded-xl overflow-hidden shadow-lg relative">
          <ImageZoom
            src={src}
            alt={title}
            width={480}
            height={270}
            unoptimized
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-600 ease-in-out"
            zoomProps={{ isDisabled: !isActive }}
          />
        </div>

        {/* Gap */}
        <div className="h-2 shrink-0" />

        {/* Comment card — expands/collapses on click */}
        <div
          className={`w-full flex-1 bg-muted rounded-xl py-1.5 px-2.5 flex items-start justify-between gap-2.5 select-none overflow-hidden ${hasComment && isActive ? "cursor-pointer" : ""}`}
          onClick={handleCommentClick}
        >
          {/* Left: avatar + name + comment */}
          <div className={`flex gap-2.5 flex-1 min-w-0 ${commentExpanded ? "items-start" : "items-center"}`}>
            <div
              className={`w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate ${commentExpanded ? "mt-0.5" : ""}`}
            >
              <img
                src={avatarUrl}
                alt=""
                className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
              />
            </div>
            <div className="flex-1 min-w-0 text-[11px] leading-normal text-left">
              {commentExpanded ? (
                <>
                  <span className="font-semibold text-foreground/90 mr-1.5">{displayName}</span>
                  {hasComment && (
                    <span className="font-medium text-muted-foreground/95 italic tracking-tight whitespace-pre-wrap">
                      &ldquo;{shot.comment}&rdquo;
                    </span>
                  )}
                </>
              ) : (
                <p className="truncate leading-normal">
                  <span className="font-semibold text-foreground/90 mr-1.5">{displayName}</span>
                  {hasComment && (
                    <span className="font-medium text-muted-foreground/95 italic tracking-tight">
                      &ldquo;{shot.comment.replace(/\n/g, " ")}&rdquo;
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Right: action buttons — icon-only, no background */}
          <div
            className={`flex items-center gap-1.5 shrink-0 relative transition-opacity duration-300 ${
              isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {!isDeleted && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                className={`w-7 h-7 flex items-center justify-center transition-all cursor-pointer rounded-md hover:bg-muted-foreground/10 ${
                  showMoveMenu ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                title="이미지 이동"
              >
                <FolderInput className="w-3.5 h-3.5" />
              </button>
            )}

            {showMoveMenu && (
              <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-50 w-48 overflow-hidden rounded-xl bg-card border border-border shadow-2xl p-1 flex flex-col text-foreground">
                {currentDiary.session_games?.map((g: any) => (
                  <button
                    key={g.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      supabase
                        .from("screenshots")
                        .update({ game_title: g.title })
                        .eq("id", shot.id)
                        .then(() => { fetchData(); setShowMoveMenu(false); });
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                      shot.game_title === g.title
                        ? "bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {g.icon_url ? (
                      <img src={g.icon_url} className="w-3.5 h-3.5 object-contain shrink-0" alt="" />
                    ) : (
                      <Gamepad2 className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    )}
                    <span className="truncate">{g.title}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); onDownload?.(shot.url); }}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-md transition-all cursor-pointer"
              title="이미지 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {isUploader && !isDeleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("스크린샷을 삭제할까요?")) onDelete?.(shot.id);
                }}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all cursor-pointer"
                title="이미지 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </li>
    </div>
  );
};

const CarouselControl = ({
  type,
  title,
  handleClick,
}: {
  type: string;
  title: string;
  handleClick: () => void;
}) => (
  <button
    className={`w-9 h-9 flex items-center mx-1.5 justify-center bg-card hover:bg-muted border border-border rounded-full focus:outline-none hover:-translate-y-0.5 active:translate-y-0.5 transition duration-200 cursor-pointer ${
      type === "previous" ? "rotate-180" : ""
    }`}
    title={title}
    onClick={handleClick}
  >
    <IconArrowNarrowRight className="text-muted-foreground hover:text-foreground w-4 h-4" />
  </button>
);

interface DesktopScreenshotCarouselProps {
  gameShots: any[];
  session: any;
  profiles: any;
  current: any;
  fetchData: () => void;
  onAction?: (shot: any) => void;
  onDownload?: (url: string) => void;
  onDelete?: (shotId: string) => void;
  isDeleted?: boolean;
  onFileSelect?: (file: File) => void;
}

// Collapsed comment section: single line height
const COLLAPSED_COMMENT_H = 36;
const COLLAPSED_SLIDE_H = Math.max(316, 270 + 8 + COLLAPSED_COMMENT_H); // 314 → 316

export default function DesktopScreenshotCarousel({
  gameShots,
  session,
  profiles,
  current: currentDiary,
  fetchData,
  onDownload,
  onDelete,
  isDeleted,
  onFileSelect,
}: DesktopScreenshotCarouselProps) {
  const [current, setCurrent] = useState(0);

  // Height for the current view: starts at collapsed, grows when comment is expanded
  const [slideHeight, setSlideHeight] = useState(COLLAPSED_SLIDE_H);
  // Per-slide expanded comment heights (measured once)
  const [expandedSlideHeights, setExpandedSlideHeights] = useState<number[]>([]);

  const totalSlides = gameShots.length + (!isDeleted && onFileSelect ? 1 : 0);
  const id = useId();

  // Refs to measure full-comment heights for each slide
  const expandedMeasureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const slides: SlideData[] = gameShots.map((shot) => {
    const uploaderProfile = profiles?.[shot.uploader_id];
    const isUploader = session?.user?.id === shot.uploader_id;
    return {
      title: `${uploaderProfile?.display_name || "게이머"}님의 스크린샷`,
      src: shot.url,
      shot,
      isUploader,
    };
  });

  // Measure every slide's fully-expanded comment height once on mount
  useLayoutEffect(() => {
    if (expandedMeasureRefs.current.length === 0) return;
    const heights = expandedMeasureRefs.current
      .filter(Boolean)
      .map((el) => el!.offsetHeight);
    setExpandedSlideHeights(
      heights.map((h) => Math.max(COLLAPSED_SLIDE_H, 270 + 8 + h))
    );
  }, [gameShots.length]);

  const handlePreviousClick = () =>
    setCurrent((p) => (p <= 0 ? totalSlides - 1 : p - 1));
  const handleNextClick = () =>
    setCurrent((p) => (p >= totalSlides - 1 ? 0 : p + 1));
  const handleSlideClick = (index: number) => {
    setCurrent(index);
    setSlideHeight(COLLAPSED_SLIDE_H);
  };

  /** Called from Slide when user expands/collapses the active comment */
  const handleCommentToggle = (isExpanded: boolean) => {
    if (isExpanded) {
      const expanded = expandedSlideHeights[current] ?? COLLAPSED_SLIDE_H;
      setSlideHeight(expanded);
    } else {
      setSlideHeight(COLLAPSED_SLIDE_H);
    }
  };

  return (
    <div className="relative w-[480px] mx-auto">
      {/* ── Hidden measurement: full-expanded comment heights ──────────── */}
      <div
        className="absolute top-0 left-0 w-[480px] invisible pointer-events-none overflow-hidden"
        style={{ zIndex: -1 }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            ref={(el) => { expandedMeasureRefs.current[i] = el; }}
            className="w-full py-1.5 px-2.5 flex items-start gap-2.5"
          >
            <div className="w-5 h-5 shrink-0 mt-0.5" />
            <div
              className="flex-1 min-w-0 text-[11px] leading-normal break-words text-left whitespace-pre-wrap"
              style={{ paddingRight: 90 }}
            >
              <span className="font-semibold mr-1.5">name</span>
              {slide.shot.comment && (
                <span>&ldquo;{slide.shot.comment}&rdquo;</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Carousel ─────────────────────────────────────────────────────── */}
      <div
        className="relative w-[480px] overflow-visible"
        style={{
          height: slideHeight,
          transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        aria-labelledby={`carousel-heading-${id}`}
      >
        <ul
          className="absolute flex mx-[-16px] h-full"
          style={{
            transition: "transform 1000ms cubic-bezier(0.4, 0, 0.2, 1)",
            transform: `translate3d(-${current * 512}px, 0, 0)`,
          }}
        >
          {slides.map((slide, index) => (
            <Slide
              key={index}
              slide={slide}
              index={index}
              current={current}
              handleSlideClick={handleSlideClick}
              isDeleted={isDeleted}
              currentDiary={currentDiary}
              onDownload={onDownload}
              onDelete={onDelete}
              fetchData={fetchData}
              profiles={profiles}
              slideHeight={slideHeight}
              onCommentToggle={handleCommentToggle}
            />
          ))}

          {/* Upload slot */}
          {!isDeleted && onFileSelect && (
            <div className="[perspective:1200px] [transform-style:preserve-3d] shrink-0">
              <li
                className="flex flex-col w-[480px] mx-[16px] z-10"
                style={{
                  height: slideHeight,
                  transform:
                    current !== slides.length
                      ? "scale(0.95) rotateX(8deg)"
                      : "scale(1) rotateX(0deg)",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  transformOrigin: "bottom",
                }}
              >
                <div className="w-full h-[270px] shrink-0 rounded-xl overflow-hidden">
                  <UploadPlaceholder onFileSelect={onFileSelect} className="h-full" />
                </div>
              </li>
            </div>
          )}
        </ul>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div className="flex justify-center w-full mt-6">
        <CarouselControl
          type="previous"
          title="Go to previous slide"
          handleClick={handlePreviousClick}
        />
        <CarouselControl
          type="next"
          title="Go to next slide"
          handleClick={handleNextClick}
        />
      </div>
    </div>
  );
}
