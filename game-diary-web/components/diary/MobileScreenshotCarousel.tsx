"use client";

import React, { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import ScreenshotItem from "./ScreenshotItem";
import UploadPlaceholder from "./UploadPlaceholder";
import { maskNickname } from "@/src/lib/utils";

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
}: MobileScreenshotCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrentSlide(api.selectedScrollSnap());

    const onSelect = () => {
      setCurrentSlide(api.selectedScrollSnap());
    };

    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, gameShots]);

  return (
    <div className="w-full flex flex-col">
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
              <div className="mt-2.5 p-2 bg-card border-[0.5px] border-border/30 rounded-[6px] flex items-start gap-2.5 animate-in fade-in duration-300">
                <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0">
                  <img 
                    src={profiles?.[shot.uploader_id]?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`}
                    alt=""
                    className={`w-full h-full object-cover ${!profiles?.[shot.uploader_id]?.has_logged_in ? 'blur-xs scale-110' : ''}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-foreground">
                      {profiles?.[shot.uploader_id]?.has_logged_in 
                        ? (profiles?.[shot.uploader_id]?.display_name || 'Anonymous')
                        : maskNickname(profiles?.[shot.uploader_id]?.display_name || 'Anonymous')}
                    </span>
                  </div>
                  {shot.comment && (
                    <p className="text-[11px] font-medium text-muted-foreground/80 mt-0.5 leading-relaxed break-words">
                      {shot.comment}
                    </p>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
          <CarouselItem className="pl-3 basis-full">
            <UploadPlaceholder onFileSelect={onFileSelect} />
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      {/* Dots Indicator */}
      {count > 1 && (
        <div className="flex justify-center gap-1.5 mt-3 select-none">
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
  );
}
