"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, maskNickname } from "@/src/lib/utils";

interface BackgroundPreviewProps {
  hoveredShot: any | null;
  profiles: any;
}

export default function BackgroundPreview({ hoveredShot, profiles }: BackgroundPreviewProps) {
  const [activeShot, setActiveShot] = useState<any | null>(null);

  useEffect(() => {
    if (hoveredShot) {
      setActiveShot(hoveredShot);
    }
  }, [hoveredShot]);

  return (
    <AnimatePresence>
      {hoveredShot && activeShot && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 20 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed top-[12vh] left-1/2 -translate-x-1/2 z-[200] w-[640px] flex flex-col overflow-hidden rounded-lg shadow-[0_40px_100px_rgba(0,0,0,0.6)] bg-card border border-border/50 backdrop-blur-2xl pointer-events-none"
        >
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <img
              src={activeShot.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          <div className="p-4 bg-card flex items-center gap-4 border-t border-border/30">
            {(() => {
              const uploaderProfile = profiles?.[activeShot.uploader_id];
              const hasLoggedIn = !!uploaderProfile?.has_logged_in;
              const displayName = hasLoggedIn 
                ? (uploaderProfile?.display_name || 'Anonymous') 
                : maskNickname(uploaderProfile?.display_name || 'Anonymous');
              return (
                <div className="flex items-center gap-3 shrink-0 border-r border-border/30 pr-4">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-border shadow-sm shrink-0">
                    <img 
                      src={uploaderProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeShot.uploader_id}`} 
                      className={cn(
                        "w-full h-full object-cover",
                        !hasLoggedIn && "blur-xs scale-110"
                      )} 
                      alt="" 
                    />
                  </div>
                  <span className="text-[13px] font-black text-foreground truncate max-w-[120px]">
                    {displayName}
                  </span>
                </div>
              );
            })()}

            {activeShot.comment ? (
              <p className="text-foreground/80 text-[13px] font-bold leading-tight line-clamp-2 italic flex-1">
                "{activeShot.comment}"
              </p>
            ) : (
              <p className="text-muted-foreground/30 text-[12px] font-medium italic flex-1">
                작성된 코멘트가 없습니다.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
