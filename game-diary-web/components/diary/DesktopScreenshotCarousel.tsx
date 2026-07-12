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
}: SlideProps) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const { src, title, isUploader, uploaderName, uploaderAvatar, hasLoggedIn } = slide;
  const isActive = current === index;

  useEffect(() => {
    if (!isActive) setShowMoveMenu(false);
  }, [isActive]);

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
        {/* Image — fixed 270px (16:9) */}
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

        {/* Comment card — fills remaining height, moves with slide */}
        <div className="w-full flex-1 bg-muted rounded-xl py-1.5 px-2.5 flex items-start justify-between gap-2.5 select-none overflow-hidden">
          {/* Left: avatar + name + full comment */}
          <div className="flex items-start gap-2.5 flex-1 min-w-0 pt-0.5">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate mt-0.5">
              <img
                src={uploaderAvatar}
                alt=""
                className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
              />
            </div>
            <div className="flex-1 min-w-0 text-[11px] leading-normal break-words text-left">
              <span className="font-semibold text-foreground/90 mr-1.5 select-none">{uploaderName}</span>
              {slide.shot.comment && (
                <span className="font-medium text-muted-foreground/95 italic tracking-tight whitespace-pre-wrap">
                  &ldquo;{slide.shot.comment}&rdquo;
                </span>
              )}
            </div>
          </div>

          {/* Right: action buttons — only interactive when active */}
          <div
            className={`flex items-start gap-1.5 shrink-0 relative pt-0.5 transition-opacity duration-300 ${
              isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            {!isDeleted && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border cursor-pointer ${
                  showMoveMenu
                    ? "bg-primary text-white border-primary shadow-md"
                    : "bg-card text-muted-foreground border-border hover:bg-muted-foreground/10 hover:text-foreground"
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
                        .eq("id", slide.shot.id)
                        .then(() => { fetchData(); setShowMoveMenu(false); });
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                      slide.shot.game_title === g.title
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
              onClick={(e) => { e.stopPropagation(); onDownload?.(slide.shot.url); }}
              className="w-7 h-7 rounded-lg bg-card text-muted-foreground border border-border hover:bg-muted-foreground/10 hover:text-foreground transition-all flex items-center justify-center cursor-pointer"
              title="이미지 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {isUploader && !isDeleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("스크린샷을 삭제할까요?")) onDelete?.(slide.shot.id);
                }}
                className="w-7 h-7 rounded-lg bg-card text-muted-foreground border border-border hover:bg-destructive hover:text-white transition-all flex items-center justify-center cursor-pointer"
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
  // slideHeight is fixed after first measurement — never changes on slide navigation
  const [slideHeight, setSlideHeight] = useState(316);

  const totalSlides = gameShots.length + (!isDeleted && onFileSelect ? 1 : 0);
  const id = useId();

  // Refs to hidden measurement divs for each comment section
  const commentMeasureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const slides: SlideData[] = gameShots.map((shot) => {
    const uploaderProfile = profiles?.[shot.uploader_id];
    const isUploader = session?.user?.id === shot.uploader_id;
    const hasLoggedIn = uploaderProfile?.has_logged_in ?? false;
    return {
      title: `${uploaderProfile?.display_name || "게이머"}님의 스크린샷`,
      src: shot.url,
      shot,
      isUploader,
      uploaderName: hasLoggedIn
        ? uploaderProfile?.display_name || "Anonymous"
        : maskNickname(uploaderProfile?.display_name || "Anonymous"),
      uploaderAvatar:
        uploaderProfile?.avatar_url ||
        `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`,
      hasLoggedIn,
    };
  });

  // Measure max comment height once on mount (and when gameShots count changes).
  // slideHeight stays fixed during slide navigation — no layout jump.
  useLayoutEffect(() => {
    if (commentMeasureRefs.current.length === 0) return;
    const heights = commentMeasureRefs.current
      .filter(Boolean)
      .map((el) => el!.offsetHeight);
    const maxCommentH = Math.max(36, ...heights); // min 36px for empty comment row
    const computed = 270 + 8 + maxCommentH; // image + gap + comment
    setSlideHeight(Math.max(316, computed)); // never smaller than original 316
  }, [gameShots.length]);

  const handlePreviousClick = () =>
    setCurrent((p) => (p <= 0 ? totalSlides - 1 : p - 1));
  const handleNextClick = () =>
    setCurrent((p) => (p >= totalSlides - 1 ? 0 : p + 1));
  const handleSlideClick = (index: number) => setCurrent(index);

  return (
    <div className="relative w-[480px] mx-auto">
      {/* ── Hidden measurement divs ─────────────────────────────────────────
          Render every comment card off-screen to determine the maximum height.
          Width matches the usable text area inside a slide comment card.
          pr accounts for the ~90px button column on the right.          ── */}
      <div className="absolute top-0 left-0 w-[480px] invisible pointer-events-none overflow-hidden" style={{ zIndex: -1 }}>
        {slides.map((slide, i) => (
          <div
            key={i}
            ref={(el) => { commentMeasureRefs.current[i] = el; }}
            className="w-full py-1.5 px-2.5 flex items-start gap-2.5"
          >
            {/* Avatar placeholder */}
            <div className="w-5 h-5 shrink-0 mt-0.5" />
            {/* Text — mirrors the real comment layout, pr reserves button space */}
            <div className="flex-1 min-w-0 text-[11px] leading-normal break-words text-left" style={{ paddingRight: 90 }}>
              <span className="font-semibold mr-1.5">{slide.uploaderName}</span>
              {slide.shot.comment && (
                <span className="whitespace-pre-wrap">&ldquo;{slide.shot.comment}&rdquo;</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Carousel ────────────────────────────────────────────────────── */}
      <div
        className="relative w-[480px] overflow-visible"
        style={{ height: slideHeight }}
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

      {/* ── Navigation ──────────────────────────────────────────────────── */}
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
