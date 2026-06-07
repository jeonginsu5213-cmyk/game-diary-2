"use client";

import React, { useState, useEffect, useRef } from 'react';
import { cn, maskNickname } from "@/src/lib/utils";

export default function FloatingScreenshotPreview({ hoveredShot, profiles }: { hoveredShot: any | null, profiles: any }) {
  const [activeShot, setActiveShot] = useState<any | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [smoothPosition, setSmoothPosition] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (hoveredShot) {
      setActiveShot(hoveredShot);
    }
  }, [hoveredShot]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };
    const animate = () => {
      setSmoothPosition((prev) => ({
        x: lerp(prev.x, mousePosition.x, 0.15),
        y: lerp(prev.y, mousePosition.y, 0.15),
      }));
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mousePosition]);

  const isVisible = !!hoveredShot;

  return (
    <div
      className="pointer-events-none fixed z-[300] flex flex-col overflow-hidden rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.5)] bg-card border border-border/50 backdrop-blur-xl"
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${smoothPosition.x - 200}px, ${smoothPosition.y + 30}px, 0)`,
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.8,
        transition: "opacity 0.25s ease-out, scale 0.25s ease-out",
        width: "400px",
      }}
    >
      {activeShot && (
        <>
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <img
              src={activeShot.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          
          <div className="p-3 bg-card flex items-center gap-3 border-t border-border">
            {(() => {
              const uploaderProfile = profiles?.[activeShot.uploader_id];
              const hasLoggedIn = !!uploaderProfile?.has_logged_in;
              const displayName = hasLoggedIn 
                ? (uploaderProfile?.display_name || 'Anonymous') 
                : maskNickname(uploaderProfile?.display_name || 'Anonymous');
              return (
                <div className="flex items-center gap-2 shrink-0 border-r border-border pr-3">
                  <img 
                    src={uploaderProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeShot.uploader_id}`} 
                    className={cn(
                      "w-6 h-6 rounded-full border border-border shadow-sm object-cover",
                      !hasLoggedIn && "blur-xs"
                    )} 
                    alt="" 
                  />
                  <span className="text-[11px] font-black text-foreground truncate max-w-[80px]">
                    {displayName}
                  </span>
                </div>
              );
            })()}
            
            {activeShot.comment ? (
              <p className="text-foreground/80 text-[12px] font-bold leading-tight line-clamp-2 italic flex-1">
                "{activeShot.comment}"
              </p>
            ) : (
              <p className="text-muted-foreground/40 text-[11px] font-medium italic flex-1">
                No comment shared.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
