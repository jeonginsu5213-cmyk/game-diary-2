"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
import { maskNickname } from "@/src/lib/utils";

interface ScreenshotCommentCardProps {
  shot: any;
  profiles: any;
  className?: string;
}

const ONE_LINE_PX = 18; // ≈ 1 line of text at 11 px / leading-normal

/**
 * Expandable screenshot comment card (mobile).
 *
 * - Short comments (fit on 1 line): no expand, always shown inline
 * - Long comments: click to expand → comment continues inline from name
 * - Smooth max-height animation on expand / collapse
 */
export default function ScreenshotCommentCard({
  shot,
  profiles,
  className = "",
}: ScreenshotCommentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  const textRef = useRef<HTMLDivElement>(null);

  const profile = profiles?.[shot.uploader_id];
  const hasLoggedIn = profile?.has_logged_in ?? false;
  const displayName = hasLoggedIn
    ? profile?.display_name || "Anonymous"
    : maskNickname(profile?.display_name || "Anonymous");
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`;

  const hasComment = !!shot.comment;

  // Detect if the single-line text is truncated (i.e., needs expansion)
  useLayoutEffect(() => {
    if (!hasComment) { setCanExpand(false); return; }
    if (shot.comment.includes("\n")) { setCanExpand(true); return; }
    const el = textRef.current;
    if (el) {
      setCanExpand(el.scrollHeight > el.clientHeight);
    }
  }, [shot.comment, displayName]);

  const handleClick = () => {
    if (canExpand) setExpanded((v) => !v);
  };

  return (
    <div
      className={`flex items-center gap-2.5 ${className} ${canExpand ? "cursor-pointer select-none" : ""}`}
      onClick={handleClick}
    >
      {/* Avatar — items-center handles vertical alignment */}
      <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate">
        <img
          src={avatarUrl}
          alt=""
          className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
        />
      </div>

      {/* Text — clipped to 1 line when collapsed, full when expanded */}
      <div
        ref={textRef}
        className="flex-1 min-w-0 overflow-hidden"
        style={{
          maxHeight: expanded ? "400px" : `${ONE_LINE_PX}px`,
          transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          className={`text-[11px] leading-normal ${
            expanded ? "whitespace-pre-wrap" : "truncate"
          }`}
        >
          <span className="font-semibold text-foreground/90 mr-1.5">{displayName}</span>
          {hasComment && (
            <span className="font-medium text-muted-foreground/80 italic tracking-tight">
              &ldquo;{expanded ? shot.comment : shot.comment.replace(/\n/g, " ")}&rdquo;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
