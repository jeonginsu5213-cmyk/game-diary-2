"use client";
import { IconArrowNarrowRight } from "@tabler/icons-react";
import { useState, useRef, useId, useEffect, useLayoutEffect } from "react";
import { Trash2, FolderInput, Download, Gamepad2 } from "lucide-react";
import { maskNickname } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";
import { ImageZoom } from "@/components/ui/ImageZoom";
import UploadPlaceholder from "./UploadPlaceholder";

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
  slideHeight: number;
  onCommentToggle: (isExpanded: boolean) => void;
}

// ── Constants ───────────────────────────────────────────────────────────────
const IMAGE_H = 270;
const GAP_H = 8;
/** The fixed height of the first (header) row in the comment card */
const FIRST_ROW_H = 38;
const COLLAPSED_SLIDE_H = IMAGE_H + GAP_H + FIRST_ROW_H; // 316

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

  // Collapse when navigating away
  useEffect(() => {
    if (!isActive && commentExpanded) {
      setCommentExpanded(false);
      onCommentToggle(false);
    }
    if (!isActive) setShowMoveMenu(false);
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
        {/* ── Image — fixed 16:9, no shadow ──────────────────────────────── */}
        <div className="w-full shrink-0 bg-[#1D1F2F] rounded-xl overflow-hidden relative"
             style={{ height: IMAGE_H }}>
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

        {/* ── Gap ────────────────────────────────────────────────────────── */}
        <div className="shrink-0" style={{ height: GAP_H }} />

        {/* ── Comment card ───────────────────────────────────────────────── */}
        <div className="w-full flex-1 bg-muted rounded-xl flex flex-col overflow-hidden">

          {/* ── Row 1: fixed height, items-center — NEVER moves ──────────── */}
          <div
            className={`shrink-0 flex items-center gap-2.5 px-2.5 ${hasComment && isActive ? "cursor-pointer" : ""}`}
            style={{ height: FIRST_ROW_H }}
            onClick={handleCommentClick}
          >
            {/* Avatar */}
            <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate">
              <img
                src={avatarUrl}
                alt=""
                className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
              />
            </div>

            {/* Name + comment (collapsed: one-line truncated) */}
            <div className="flex-1 min-w-0 text-[11px] leading-normal">
              <p className="truncate leading-normal">
                <span className="font-semibold text-foreground/90 mr-1.5 select-none">
                  {displayName}
                </span>
                {hasComment && !commentExpanded && (
                  <span className="font-medium text-muted-foreground/95 italic tracking-tight">
                    &ldquo;{shot.comment.replace(/\n/g, " ")}&rdquo;
                  </span>
                )}
              </p>
            </div>

            {/* Action buttons — icon-only, no bg/border */}
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

          {/* ── Expanded comment text (below Row 1, pushes card down) ─────── */}
          {commentExpanded && hasComment && (
            <div
              className="shrink-0 pb-2 text-[11px] leading-relaxed italic text-muted-foreground/95 tracking-tight whitespace-pre-wrap"
              style={{ paddingLeft: 40, paddingRight: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              &ldquo;{shot.comment}&rdquo;
            </div>
          )}
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
  const [slideHeight, setSlideHeight] = useState(COLLAPSED_SLIDE_H);
  // Pre-measured expanded heights per slide
  const [expandedSlideHeights, setExpandedSlideHeights] = useState<number[]>([]);

  const totalSlides = gameShots.length + (!isDeleted && onFileSelect ? 1 : 0);
  const id = useId();

  // Measurement refs — each measures only the expanded comment text block
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

  // Measure expanded text height for each slide once on mount
  useLayoutEffect(() => {
    const heights = expandedMeasureRefs.current.map((el, i) => {
      if (!slides[i]?.shot?.comment) return 0;
      return el?.offsetHeight ?? 0;
    });
    setExpandedSlideHeights(
      heights.map((h) => (h > 0 ? COLLAPSED_SLIDE_H + h : COLLAPSED_SLIDE_H))
    );
  }, [gameShots.length]);

  const handlePreviousClick = () => {
    setCurrent((p) => (p <= 0 ? totalSlides - 1 : p - 1));
    setSlideHeight(COLLAPSED_SLIDE_H);
  };
  const handleNextClick = () => {
    setCurrent((p) => (p >= totalSlides - 1 ? 0 : p + 1));
    setSlideHeight(COLLAPSED_SLIDE_H);
  };
  const handleSlideClick = (index: number) => {
    setCurrent(index);
    setSlideHeight(COLLAPSED_SLIDE_H);
  };

  const handleCommentToggle = (isExpanded: boolean) => {
    if (isExpanded) {
      setSlideHeight(expandedSlideHeights[current] ?? COLLAPSED_SLIDE_H);
    } else {
      setSlideHeight(COLLAPSED_SLIDE_H);
    }
  };

  return (
    <div className="relative w-[480px] mx-auto">
      {/* ── Hidden measurement: expanded comment text only ──────────────── */}
      <div
        className="absolute top-0 left-0 invisible pointer-events-none overflow-hidden"
        style={{ zIndex: -1, width: 480 }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            ref={(el) => { expandedMeasureRefs.current[i] = el; }}
            className="text-[11px] leading-relaxed italic whitespace-pre-wrap"
            style={{
              paddingLeft: 40,   // matches pl on expanded text (px-2.5 + avatar + gap)
              paddingRight: 10,  // matches pr-2.5
              paddingBottom: 8,  // matches pb-2
            }}
          >
            {slide.shot.comment ? `"${slide.shot.comment}"` : ""}
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
                <div className="w-full shrink-0 rounded-xl overflow-hidden" style={{ height: IMAGE_H }}>
                  <UploadPlaceholder onFileSelect={onFileSelect} className="h-full" />
                </div>
              </li>
            </div>
          )}
        </ul>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div className="flex justify-center w-full mt-6">
        <CarouselControl type="previous" title="Go to previous slide" handleClick={handlePreviousClick} />
        <CarouselControl type="next" title="Go to next slide" handleClick={handleNextClick} />
      </div>
    </div>
  );
}
