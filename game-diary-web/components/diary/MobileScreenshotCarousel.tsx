"use client";

import React, { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import ScreenshotItem from "./ScreenshotItem";
import UploadPlaceholder from "./UploadPlaceholder";
import { cn, maskNickname } from "@/src/lib/utils";
import { ChevronRight } from "lucide-react";

interface MobileScreenshotCarouselProps {
  gameShots: any[];
  profiles: any;
  current: any;
  session: any;
  newShotId: string | null;
  activeMoveShotId: string | null;
  setActiveMoveShotId: (id: string | null) => void;
  setActiveShot: (shot: any) => void;
  setHoveredShot: (shot: any | null) => void;
  handleDownload: (url: string) => void;
  handleImageDelete: (id: string) => void;
  fetchData: () => void;
  onFileSelect: (file: File) => void;
  isDeleted?: boolean;
}

export default function MobileScreenshotCarousel({
  gameShots,
  profiles,
  current,
  session,
  newShotId,
  activeMoveShotId,
  setActiveMoveShotId,
  setActiveShot,
  setHoveredShot,
  handleDownload,
  handleImageDelete,
  fetchData,
  onFileSelect,
  isDeleted = false,
}: MobileScreenshotCarouselProps) {
  if (isDeleted && gameShots.length === 0) return null;

  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    const updateStates = () => {
      setCount(api.scrollSnapList().length);
      setCurrentSlide(api.selectedScrollSnap());
    };

    updateStates();

    api.on("select", updateStates);
    api.on("reInit", updateStates);
    return () => {
      api.off("select", updateStates);
      api.off("reInit", updateStates);
    };
  }, [api, gameShots]);

  return (
    <div className="w-full flex flex-col">
      {/* Mobile Header Row: Highlight title and Dots Indicator */}
      <div className="flex items-center justify-between mb-2 pl-[2px]">
        <div className="flex items-center gap-1 group/label cursor-pointer select-none">
          <span className="text-[12px] font-bold tracking-tight text-primary transition-colors duration-200">
            하이라이트
          </span>
          <div className="text-primary flex items-center">
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Dots Indicator */}
        {count > 1 && (
          <div className="flex items-center gap-1.5 select-none pr-1.5">
            {Array.from({ length: count }).map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                  index === currentSlide ? "bg-primary w-3.5" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <Carousel setApi={setApi} opts={{ align: "start", dragFree: false }} className="w-full">
        <CarouselContent className="-ml-3">
          {gameShots.map((shot) => (
            <CarouselItem key={shot.id} className="pl-3 basis-full">
              <ScreenshotItem
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
              <div className="mt-1.5 p-2 bg-muted rounded-[6px] flex items-center gap-2.5 animate-in fade-in duration-300">
                <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate">
                  <img 
                    src={profiles?.[shot.uploader_id]?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`}
                    alt=""
                    className={`w-full h-full object-cover ${!profiles?.[shot.uploader_id]?.has_logged_in ? 'blur-xs scale-110' : ''}`}
                  />
                </div>
                <div className="flex-1 min-w-0 text-[11px] leading-normal break-words">
                  <span className="font-semibold text-foreground mr-1.5 select-none">
                    {profiles?.[shot.uploader_id]?.has_logged_in 
                      ? (profiles?.[shot.uploader_id]?.display_name || 'Anonymous')
                      : maskNickname(profiles?.[shot.uploader_id]?.display_name || 'Anonymous')}
                  </span>
                  {shot.comment && (
                    <span className="font-medium text-muted-foreground/80 italic tracking-tight whitespace-pre-wrap">
                      "{shot.comment}"
                    </span>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
          {!isDeleted && (
            <CarouselItem className="pl-3 basis-full">
              <UploadPlaceholder onFileSelect={onFileSelect} />
            </CarouselItem>
          )}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
