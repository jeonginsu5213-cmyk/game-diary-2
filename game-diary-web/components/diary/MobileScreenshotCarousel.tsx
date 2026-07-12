"use client";

import React, { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import ScreenshotItem from "./ScreenshotItem";
import UploadPlaceholder from "./UploadPlaceholder";
import { cn } from "@/src/lib/utils";
import { ChevronRight } from "lucide-react";
import ScreenshotCommentCard from "./ScreenshotCommentCard";

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
              <div className="mt-1.5 p-2 bg-muted rounded-[6px]">
                <ScreenshotCommentCard shot={shot} profiles={profiles} />
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
