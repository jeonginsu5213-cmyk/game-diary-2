"use client";
import { IconArrowNarrowRight } from "@tabler/icons-react";
import { useState, useRef, useId, useEffect, useLayoutEffect } from "react";
import { Trash2, FolderInput, Download, Gamepad2 } from "lucide-react";
import { maskNickname } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";
import { ImageZoom } from "@/components/ui/ImageZoom";
import UploadPlaceholder from "./UploadPlaceholder";

// ── Layout constants ──────────────────────────────────────────────────────────
const IMAGE_H       = 270;
const GAP_H         = 8;
const CARD_H        = 38;   // collapsed card height
const COLLAPSED_H   = IMAGE_H + GAP_H + CARD_H;  // 316
// Centering items inside 38 px card (no py padding):
//   avatar  (h=20): mt = (38-20)/2 = 9
//   buttons (h=28): mt = (38-28)/2 = 5
//   text    (h≈17): align with avatar top → mt = 9
const AVATAR_MT     = 8;   // (38-20)/2 = 9 exact, -1 to match text visual center
const BTN_MT        = 5;   // (38-28)/2 = 5px
const TEXT_MT       = 10;  // slight adjustment: text center ≈ avatar center
const TEXT_W        = 320; // conservative text-area width for measurement
const ONE_LINE_H    = 18;  // ≈ 1 line of 11 px / leading-normal

// ─────────────────────────────────────────────────────────────────────────────

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
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { src, title, isUploader, shot, uploaderName, uploaderAvatar, hasLoggedIn } = slide;
  const isActive  = current === index;
  const hasComment = !!shot.comment;

  useEffect(() => {
    if (!isActive) {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      setCommentExpanded(false);
      setShowMoveMenu(false);
    }
  }, [isActive]);

  const handleCommentClick = (e: React.MouseEvent) => {
    if (!canExpand || !isActive) return;
    e.stopPropagation();
    if (commentExpanded) {
      // Start height collapse first; switch text after animation
      onCommentToggle(false);
      collapseTimer.current = setTimeout(() => setCommentExpanded(false), 300);
    } else {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
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
          // height transition drives the card-bg animation; transform for 3-D effect
          transition:
            "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transformOrigin: "bottom",
        }}
        onClick={() => { if (!isActive) handleSlideClick(index); }}
      >
        {/* ── Image ──────────────────────────────────────────────────────── */}
        <div
          className="w-full shrink-0 bg-[#1D1F2F] rounded-xl overflow-hidden relative"
          style={{ height: IMAGE_H }}
        >
          <ImageZoom
            src={src} alt={title} width={480} height={270} unoptimized
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-600 ease-in-out"
            zoomProps={{ isDisabled: !isActive }}
          />
        </div>

        {/* ── Gap ────────────────────────────────────────────────────────── */}
        <div className="shrink-0" style={{ height: GAP_H }} />

        {/* ── Comment card ───────────────────────────────────────────────── */}
        {/*
          No py-padding on the card — we use explicit mt on each child so they
          are mathematically centred in the 38 px collapsed card height.

          Avatar  (h=20): mt=9  →  top:9  bottom:9  ✓
          Text    (h≈17): mt=9  →  aligned with avatar top   ✓
          Buttons (h=28): mt=5  →  top:5  bottom:5  ✓

          overflow-hidden clips the text when it overflows downward (expanded).
          As the li height transitions, the card bg and revealed text both animate.
        */}
        <div
          className={`w-full flex-1 bg-muted rounded-xl flex items-start gap-2.5 px-2.5 overflow-hidden select-none ${
            canExpand && isActive ? "cursor-pointer" : ""
          }`}
          onClick={handleCommentClick}
        >
          {/* Avatar */}
          <div
            className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate"
            style={{ marginTop: AVATAR_MT }}
          >
            <img
              src={uploaderAvatar} alt=""
              className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
            />
          </div>

          {/* Name + comment — inline; whitespace-pre-wrap when expanded */}
          <div
            className="flex-1 min-w-0 text-[11px] leading-normal"
            style={{ marginTop: TEXT_MT }}
          >
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

          {/* Action buttons */}
          <div
            className={`flex items-center gap-1.5 shrink-0 relative transition-opacity duration-300 ${
              isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            style={{ marginTop: BTN_MT }}
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
                      supabase.from("screenshots").update({ game_title: g.title })
                        .eq("id", shot.id)
                        .then(() => { fetchData(); setShowMoveMenu(false); });
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                      shot.game_title === g.title
                        ? "bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {g.icon_url
                      ? <img src={g.icon_url} className="w-3.5 h-3.5 object-contain shrink-0" alt="" />
                      : <Gamepad2 className="w-3.5 h-3.5 shrink-0 opacity-50" />}
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

const CarouselControl = ({ type, title, handleClick }: { type: string; title: string; handleClick: () => void }) => (
  <button
    className={`w-9 h-9 flex items-center mx-1.5 justify-center bg-card hover:bg-muted border border-border rounded-full focus:outline-none hover:-translate-y-0.5 active:translate-y-0.5 transition duration-200 cursor-pointer ${
      type === "previous" ? "rotate-180" : ""
    }`}
    title={title} onClick={handleClick}
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
  gameShots, session, profiles, current: currentDiary,
  fetchData, onDownload, onDelete, isDeleted, onFileSelect,
}: DesktopScreenshotCarouselProps) {
  const [current, setCurrent]                   = useState(0);
  const [slideHeight, setSlideHeight]           = useState(COLLAPSED_H);
  const [expandedHeights, setExpandedHeights]   = useState<number[]>([]);
  const [canExpandArr, setCanExpandArr]         = useState<boolean[]>([]);

  const totalSlides = gameShots.length + (!isDeleted && onFileSelect ? 1 : 0);
  const id = useId();
  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const slides: SlideData[] = gameShots.map((shot) => {
    const p = profiles?.[shot.uploader_id];
    const hasLoggedIn = p?.has_logged_in ?? false;
    return {
      title: `${p?.display_name || "게이머"}님의 스크린샷`,
      src: shot.url, shot,
      isUploader: session?.user?.id === shot.uploader_id,
      uploaderName: hasLoggedIn ? (p?.display_name || "Anonymous") : maskNickname(p?.display_name || "Anonymous"),
      uploaderAvatar: p?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`,
      hasLoggedIn,
    };
  });

  // Measure expanded text height → derive canExpand and expandedHeight per slide
  useLayoutEffect(() => {
    const results = measureRefs.current.map((el, i) => {
      if (!el || !slides[i]?.shot?.comment) return { canExpand: false, expandedH: COLLAPSED_H };
      const textH    = el.offsetHeight;
      const canExpand = textH > ONE_LINE_H;
      // card height when expanded = AVATAR_MT (top) + textH + AVATAR_MT (bottom symmetry)
      const cardH    = AVATAR_MT + textH + AVATAR_MT;
      const expandedH = canExpand ? Math.max(COLLAPSED_H, IMAGE_H + GAP_H + cardH) : COLLAPSED_H;
      return { canExpand, expandedH };
    });
    setCanExpandArr(results.map(r => r.canExpand));
    setExpandedHeights(results.map(r => r.expandedH));
  }, [gameShots.length]);

  const collapse = () => setSlideHeight(COLLAPSED_H);
  const handlePreviousClick = () => { setCurrent(p => p <= 0 ? totalSlides - 1 : p - 1); collapse(); };
  const handleNextClick     = () => { setCurrent(p => p >= totalSlides - 1 ? 0 : p + 1); collapse(); };
  const handleSlideClick    = (i: number) => { setCurrent(i); collapse(); };
  const handleCommentToggle = (expanded: boolean) =>
    setSlideHeight(expanded ? (expandedHeights[current] ?? COLLAPSED_H) : COLLAPSED_H);

  return (
    <div className="relative w-[480px] mx-auto">

      {/* ── Hidden measurement divs (full inline text at TEXT_W) ─────────── */}
      <div className="absolute top-0 left-0 invisible pointer-events-none overflow-hidden" style={{ zIndex: -1, width: 480 }}>
        {slides.map((slide, i) => (
          <div
            key={i}
            ref={el => { measureRefs.current[i] = el; }}
            className="text-[11px] leading-normal whitespace-pre-wrap"
            style={{ width: TEXT_W }}
          >
            <span className="font-semibold mr-1.5">{slide.uploaderName}</span>
            {slide.shot.comment && (
              <span className="font-medium italic">&ldquo;{slide.shot.comment}&rdquo;</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Carousel ─────────────────────────────────────────────────────── */}
      <div
        className="relative w-[480px] overflow-visible"
        style={{ height: slideHeight, transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
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
              slide={slide} index={index} current={current}
              handleSlideClick={handleSlideClick}
              isDeleted={isDeleted} currentDiary={currentDiary}
              onDownload={onDownload} onDelete={onDelete} fetchData={fetchData}
              slideHeight={slideHeight}
              canExpand={canExpandArr[index] ?? false}
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
                  transform: current !== slides.length ? "scale(0.95) rotateX(8deg)" : "scale(1) rotateX(0deg)",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
        <CarouselControl type="next"     title="Go to next slide"     handleClick={handleNextClick} />
      </div>
    </div>
  );
}
