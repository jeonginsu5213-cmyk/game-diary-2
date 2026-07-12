"use client";
import { IconArrowNarrowRight } from "@tabler/icons-react";
import { useState, useRef, useId, useEffect } from "react";
import { Trash2, FolderInput, Download, Gamepad2 } from "lucide-react";
import { cn, maskNickname } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";
import { ImageZoom } from "@/components/ui/ImageZoom";
import UploadPlaceholder from "./UploadPlaceholder";

interface SlideData {
  title: string;
  button: string;
  src: string;
  shot: any;
  isUploader: boolean;
}

interface SlideProps {
  slide: SlideData;
  index: number;
  current: number;
  handleSlideClick: (index: number) => void;
  onAction?: (shot: any) => void;
  isDeleted?: boolean;
}

const Slide = ({ 
  slide, 
  index, 
  current, 
  handleSlideClick,
  isDeleted,
}: SlideProps) => {
  const slideRef = useRef<HTMLLIElement>(null);
  const { src, title } = slide;

  return (
    <div className="[perspective:1200px] [transform-style:preserve-3d]">
      <li
        ref={slideRef}
        className="flex flex-1 flex-col items-center justify-center relative text-center text-white opacity-100 transition-all duration-300 ease-in-out w-[480px] h-[270px] mx-[16px] z-10 cursor-pointer"
        onClick={() => {
          if (current !== index) {
            handleSlideClick(index);
          }
        }}
        style={{
          transform:
            current !== index
              ? "scale(0.95) rotateX(8deg)"
              : "scale(1) rotateX(0deg)",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transformOrigin: "bottom",
        }}
      >
        <div className="absolute top-0 left-0 w-full h-[270px] bg-[#1D1F2F] rounded-xl overflow-hidden transition-all duration-150 ease-out shadow-lg">
          <ImageZoom
            src={src}
            alt={title}
            width={480}
            height={270}
            unoptimized
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-600 ease-in-out"
            zoomProps={{
              isDisabled: current !== index
            }}
          />
        </div>
      </li>
    </div>
  );
};

interface CarouselControlProps {
  type: string;
  title: string;
  handleClick: () => void;
}

const CarouselControl = ({
  type,
  title,
  handleClick,
}: CarouselControlProps) => {
  return (
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
};

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
  onAction, 
  onDownload, 
  onDelete, 
  isDeleted,
  onFileSelect
}: DesktopScreenshotCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const totalSlides = gameShots.length + (!isDeleted && onFileSelect ? 1 : 0);

  const handlePreviousClick = () => {
    const previous = current - 1;
    setCurrent(previous < 0 ? totalSlides - 1 : previous);
    setShowMoveMenu(false);
  };

  const handleNextClick = () => {
    const next = current + 1;
    setCurrent(next === totalSlides ? 0 : next);
    setShowMoveMenu(false);
  };

  const handleSlideClick = (index: number) => {
    if (current !== index) {
      setCurrent(index);
      setShowMoveMenu(false);
    }
  };

  const id = useId();

  // Map gameShots to slides format
  const slides: SlideData[] = gameShots.map((shot) => {
    const uploaderProfile = profiles?.[shot.uploader_id];
    const isUploader = session?.user?.id === shot.uploader_id;
    return {
      title: `${uploaderProfile?.display_name || '게이머'}님의 스크린샷`,
      button: "자세히 보기",
      src: shot.url,
      shot: shot,
      isUploader: isUploader
    };
  });

  const isUploadSlot = current === slides.length;
  const currentSlide = !isUploadSlot ? slides[current] : null;

  return (
    <div className="w-[480px] mx-auto flex flex-col gap-0" aria-labelledby={`carousel-heading-${id}`}>
      {/* Image carousel — fixed 270px height */}
      <div className="relative w-[480px] h-[270px] overflow-visible">
        <ul
          className="absolute flex mx-[-16px] transition-transform duration-1000 cubic-bezier(0.4, 0, 0.2, 1) h-full"
          style={{
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
            />
          ))}
          {!isDeleted && onFileSelect && (
            <div className="[perspective:1200px] [transform-style:preserve-3d]">
              <li
                className="flex flex-1 flex-col items-center justify-center relative text-center opacity-100 transition-all duration-300 ease-in-out w-[480px] h-[270px] mx-[16px] z-10"
                style={{
                  transform: current !== slides.length ? "scale(0.95) rotateX(8deg)" : "scale(1) rotateX(0deg)",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  transformOrigin: "bottom",
                }}
              >
                <div className="absolute top-0 left-0 w-full h-[270px] rounded-xl overflow-hidden">
                  <UploadPlaceholder onFileSelect={onFileSelect} />
                </div>
              </li>
            </div>
          )}
        </ul>
      </div>

      {/* Comment card — normal flow, expands freely */}
      {currentSlide && (
        <div className="w-full mt-2 py-1.5 px-2.5 bg-muted rounded-xl flex items-start justify-between gap-2.5 animate-in fade-in duration-300 select-none">
          {/* Left: Avatar + uploader name + full comment */}
          <div className="flex items-start gap-2.5 flex-1 min-w-0 pt-0.5">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate mt-0.5">
              <img 
                src={profiles?.[currentSlide.shot.uploader_id]?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentSlide.shot.uploader_id}`}
                alt=""
                className={`w-full h-full object-cover ${!profiles?.[currentSlide.shot.uploader_id]?.has_logged_in ? 'blur-xs scale-110' : ''}`}
              />
            </div>
            <div className="flex-1 min-w-0 text-[11px] leading-normal break-words text-left">
              <span className="font-semibold text-foreground/90 mr-1.5 select-none">
                {profiles?.[currentSlide.shot.uploader_id]?.has_logged_in 
                  ? (profiles?.[currentSlide.shot.uploader_id]?.display_name || 'Anonymous')
                  : maskNickname(profiles?.[currentSlide.shot.uploader_id]?.display_name || 'Anonymous')}
              </span>
              {currentSlide.shot.comment && (
                <span className="font-medium text-muted-foreground/95 italic tracking-tight whitespace-pre-wrap">
                  "{currentSlide.shot.comment}"
                </span>
              )}
            </div>
          </div>

          {/* Right: Move, Download, Delete buttons */}
          <div className="flex items-center gap-1.5 shrink-0 relative pt-0.5">
            {/* Move button */}
            {!isDeleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(!showMoveMenu);
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border cursor-pointer ${showMoveMenu ? 'bg-primary text-white border-primary shadow-md' : 'bg-card text-muted-foreground border-border hover:bg-muted-foreground/10 hover:text-foreground'}`}
                title="이미지 이동"
              >
                <FolderInput className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Move dropdown menu */}
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
                        .eq("id", currentSlide.shot.id)
                        .then(() => {
                          fetchData();
                          setShowMoveMenu(false);
                        });
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${currentSlide.shot.game_title === g.title ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
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

            {/* Download button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.(currentSlide.shot.url);
              }}
              className="w-7 h-7 rounded-lg bg-card text-muted-foreground border border-border hover:bg-muted-foreground/10 hover:text-foreground transition-all flex items-center justify-center cursor-pointer"
              title="이미지 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Delete button */}
            {currentSlide.isUploader && !isDeleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("스크린샷을 삭제할까요?")) {
                    onDelete?.(currentSlide.shot.id);
                  }
                }}
                className="w-7 h-7 rounded-lg bg-card text-muted-foreground border border-border hover:bg-destructive hover:text-white transition-all flex items-center justify-center cursor-pointer"
                title="이미지 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
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
