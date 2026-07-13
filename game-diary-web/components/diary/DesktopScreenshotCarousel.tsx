"use client";
import { IconArrowNarrowRight } from "@tabler/icons-react";
import { useState, useRef, useId, useEffect, useLayoutEffect } from "react";
import { Trash2, FolderInput, Download, Gamepad2 } from "lucide-react";
import { maskNickname } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";
import { ImageZoom } from "@/components/ui/ImageZoom";
import UploadPlaceholder from "./UploadPlaceholder";

// ── Constants ─────────────────────────────────────────────────────────────────
const IMAGE_H = 270;
const GAP_H = 8;
const CARD_PY = 6;       // py-1.5 = 6 px
const CONTENT_MT = 3;    // mt-[3px] — aligns content to visual center in collapsed card
const COLLAPSED_CARD_H = 38;
const COLLAPSED_SLIDE_H = IMAGE_H + GAP_H + COLLAPSED_CARD_H; // 316
// Available text width: 480 - px(10) - avatar(20) - gap(10) - buttons(96) - px(10) = 334
const TEXT_AREA_W = 334;
const ONE_LINE_H = 18;   // ≈ 1 line of 11px / leading-normal text

interface SlideData {
  title: string;
  src: string;
  shot: any;
  isUploader: boolean;
  uploaderName: string;
  uploaderAvatar: string;
  hasLoggedIn: boolean;
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
  slideHeight: number;
  /** True only if this slide's comment is long enough to need expansion */
  canExpand: boolean;
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
  slideHeight,
  canExpand,
  onCommentToggle,
}: SlideProps) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [commentExpanded, setCommentExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { src, title, isUploader, shot, uploaderName, uploaderAvatar, hasLoggedIn } = slide;
  const isActive = current === index;
  const hasComment = !!shot.comment;

  // Collapse and reset when slide becomes inactive
  useEffect(() => {
    if (!isActive) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setCommentExpanded(false);
      setShowMoveMenu(false);
    }
  }, [isActive]);

  const handleCommentClick = (e: React.MouseEvent) => {
    if (!canExpand || !isActive) return;
    e.stopPropagation();

    if (commentExpanded) {
      // ── Collapsing ──────────────────────────────────────────────────────────
      // Start the height transition first; reset text after animation completes
      onCommentToggle(false);
      collapseTimerRef.current = setTimeout(() => setCommentExpanded(false), 300);
    } else {
      // ── Expanding ───────────────────────────────────────────────────────────
      // Switch to full text immediately; height catches up via transition
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setCommentExpanded(true);
      onCommentToggle(true);
    }
  };

  return (
    <div className="[perspective:1200px] [transform-style:preserve-3d] shrink-0">
      <li
        className="flex flex-col w-[480px] mx-[16px] z-10 cursor-pointer"
        style={{
          height: slideHeight,
          transform: !isActive ? "scale(0.95) rotateX(8deg)" : "scale(1) rotateX(0deg)",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transformOrigin: "bottom",
        }}
        onClick={() => { if (!isActive) handleSlideClick(index); }}
      >
        {/* ── Image ─────────────────────────────────────────────────────────── */}
        <div
          className="w-full shrink-0 bg-[#1D1F2F] rounded-xl overflow-hidden relative"
          style={{ height: IMAGE_H }}
        >
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

        {/* ── Gap ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0" style={{ height: GAP_H }} />

        {/* ── Comment card ──────────────────────────────────────────────────── */}
        {/*
          Layout rules:
          • Always items-start so nothing shifts on expand
          • Avatar, text, buttons all get mt-[3px] → visually centered in the 38 px collapsed card
            (6 px py-top + 3 px mt + 20 px avatar = 29 px from top; 6 px py-bottom → total 35 px in 38 px card)
          • overflow-hidden clips during the height transition → creates a smooth reveal
        */}
        <div
          className={`w-full flex-1 bg-muted rounded-xl flex items-start gap-2.5 py-1.5 px-2.5 overflow-hidden select-none ${
            canExpand && isActive ? "cursor-pointer" : ""
          }`}
          onClick={handleCommentClick}
        >
          {/* Avatar */}
          <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate mt-[3px]">
            <img
              src={uploaderAvatar}
              alt=""
              className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
            />
          </div>

          {/* Name + comment — inline, full text when expanded */}
          <div className="flex-1 min-w-0 text-[11px] leading-normal mt-[3px]">
            {commentExpanded ? (
              <>
                <span className="font-semibold text-foreground/90 mr-1.5">{uploaderName}</span>
                {hasComment && (
                  <span className="font-medium text-muted-foreground/95 italic tracking-tight whitespace-pre-wrap">
                    &ldquo;{shot.comment}&rdquo;
                  </span>
                )}
              </>
            ) : (
              <p className="truncate leading-normal">
                <span className="font-semibold text-foreground/90 mr-1.5">{uploaderName}</span>
                {hasComment && (
                  <span className="font-medium text-muted-foreground/95 italic tracking-tight">
                    &ldquo;{shot.comment.replace(/\n/g, " ")}&rdquo;
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Action buttons — icon-only, same vertical position as avatar */}
          <div
            className={`flex items-center gap-1.5 shrink-0 relative mt-[3px] transition-opacity duration-300 ${
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

// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

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
  const [expandedSlideHeights, setExpandedSlideHeights] = useState<number[]>([]);
  const [canExpandSlides, setCanExpandSlides] = useState<boolean[]>([]);

  const totalSlides = gameShots.length + (!isDeleted && onFileSelect ? 1 : 0);
  const id = useId();

  // Measurement refs — one per slide, measures the full inline text block
  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const slides: SlideData[] = gameShots.map((shot) => {
    const p = profiles?.[shot.uploader_id];
    const hasLoggedIn = p?.has_logged_in ?? false;
    const isUploader = session?.user?.id === shot.uploader_id;
    return {
      title: `${p?.display_name || "게이머"}님의 스크린샷`,
      src: shot.url,
      shot,
      isUploader,
      uploaderName: hasLoggedIn
        ? p?.display_name || "Anonymous"
        : maskNickname(p?.display_name || "Anonymous"),
      uploaderAvatar:
        p?.avatar_url ||
        `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`,
      hasLoggedIn,
    };
  });

  // After first render, measure each slide's full-text height to know:
  // (a) whether expansion is needed, (b) what height to expand to
  useLayoutEffect(() => {
    const results = measureRefs.current.map((el, i) => {
      if (!el || !slides[i]?.shot?.comment) {
        return { canExpand: false, expandedH: COLLAPSED_SLIDE_H };
      }
      const textH = el.offsetHeight;
      const needsExpand = textH > ONE_LINE_H;
      // Expanded card height = py-top + mt + textH + py-bottom
      const expandedCardH = CARD_PY + CONTENT_MT + textH + CARD_PY;
      const expandedH = needsExpand
        ? Math.max(COLLAPSED_SLIDE_H, IMAGE_H + GAP_H + expandedCardH)
        : COLLAPSED_SLIDE_H;
      return { canExpand: needsExpand, expandedH };
    });

    setCanExpandSlides(results.map((r) => r.canExpand));
    setExpandedSlideHeights(results.map((r) => r.expandedH));
  }, [gameShots.length]);

  const collapse = () => setSlideHeight(COLLAPSED_SLIDE_H);

  const handlePreviousClick = () => { setCurrent((p) => (p <= 0 ? totalSlides - 1 : p - 1)); collapse(); };
  const handleNextClick = () => { setCurrent((p) => (p >= totalSlides - 1 ? 0 : p + 1)); collapse(); };
  const handleSlideClick = (index: number) => { setCurrent(index); collapse(); };

  const handleCommentToggle = (isExpanded: boolean) => {
    setSlideHeight(
      isExpanded ? (expandedSlideHeights[current] ?? COLLAPSED_SLIDE_H) : COLLAPSED_SLIDE_H
    );
  };

  return (
    <div className="relative w-[480px] mx-auto">
      {/* ── Hidden measurement divs ────────────────────────────────────────────
          Each div renders name + full comment at TEXT_AREA_W with whitespace-pre-wrap.
          offsetHeight tells us whether/how much the comment overflows 1 line.       ── */}
      <div
        className="absolute top-0 left-0 invisible pointer-events-none overflow-hidden"
        style={{ zIndex: -1, width: 480 }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            ref={(el) => { measureRefs.current[i] = el; }}
            className="text-[11px] leading-normal whitespace-pre-wrap"
            style={{ width: TEXT_AREA_W }}
          >
            <span className="font-semibold mr-1.5">{slide.uploaderName}</span>
            {slide.shot.comment && (
              <span className="font-medium italic">
                &ldquo;{slide.shot.comment}&rdquo;
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Carousel ────────────────────────────────────────────────────────── */}
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
              slideHeight={slideHeight}
              canExpand={canExpandSlides[index] ?? false}
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
                <div
                  className="w-full shrink-0 rounded-xl overflow-hidden"
                  style={{ height: IMAGE_H }}
                >
                  <UploadPlaceholder onFileSelect={onFileSelect} className="h-full" />
                </div>
              </li>
            </div>
          )}
        </ul>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="flex justify-center w-full mt-6">
        <CarouselControl type="previous" title="Go to previous slide" handleClick={handlePreviousClick} />
        <CarouselControl type="next" title="Go to next slide" handleClick={handleNextClick} />
      </div>
    </div>
  );
}
