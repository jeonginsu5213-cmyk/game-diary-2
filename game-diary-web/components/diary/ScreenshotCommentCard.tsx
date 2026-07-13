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
 * Two separate states:
 *  - `expanded`        → drives the max-height transition (animation)
 *  - `contentExpanded` → drives which text is rendered (truncate vs pre-wrap)
 *
 * When COLLAPSING: start height animation first, switch content only AFTER it
 * completes (300 ms) so the user never sees the text jump abruptly.
 *
 * Avatar uses `self-start` so it stays pinned to the top of the flex row
 * regardless of how tall the text becomes.
 */
export default function ScreenshotCommentCard({
  shot,
  profiles,
  className = "",
}: ScreenshotCommentCardProps) {
  const [expanded, setExpanded]               = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [canExpand, setCanExpand]             = useState(false);

  const textRef      = useRef<HTMLDivElement>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profile = profiles?.[shot.uploader_id];
  const hasLoggedIn = profile?.has_logged_in ?? false;
  const displayName = hasLoggedIn
    ? profile?.display_name || "Anonymous"
    : maskNickname(profile?.display_name || "Anonymous");
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`;

  const hasComment = !!shot.comment;

  // Detect whether the text is clipped at 1-line height → canExpand
  useLayoutEffect(() => {
    if (!hasComment) { setCanExpand(false); return; }
    if (shot.comment.includes("\n")) { setCanExpand(true); return; }
    const el = textRef.current;
    if (el) setCanExpand(el.scrollHeight > el.clientHeight);
  }, [shot.comment, displayName]);

  const handleClick = () => {
    if (!canExpand) return;

    if (expanded) {
      // ── Collapsing: animate height down, switch text AFTER animation ─────
      setExpanded(false);
      collapseTimer.current = setTimeout(() => setContentExpanded(false), 300);
    } else {
      // ── Expanding: show full text immediately, then animate height up ─────
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      setContentExpanded(true);
      setExpanded(true);
    }
  };

  return (
    <div
      className={`flex items-center gap-2.5 ${className} ${canExpand ? "cursor-pointer select-none" : ""}`}
      onClick={handleClick}
    >
      {/*
        Avatar: self-start pins it to the top of the flex row permanently.
        items-center on the parent keeps it visually centred when collapsed
        (card height ≈ avatar height), but self-start prevents it from
        drifting to the middle when the text div grows.
      */}
      <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate self-start">
        <img
          src={avatarUrl}
          alt=""
          className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
        />
      </div>

      {/*
        Text container: max-height drives the smooth reveal animation.
        Content (whitespace-pre-wrap vs truncate) is controlled separately
        by contentExpanded so the text never jumps during the collapse.
      */}
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
            contentExpanded ? "whitespace-pre-wrap" : "truncate"
          }`}
        >
          <span className="font-semibold text-foreground/90 mr-1.5">{displayName}</span>
          {hasComment && (
            <span className="font-medium text-muted-foreground/80 italic tracking-tight">
              &ldquo;{contentExpanded ? shot.comment : shot.comment.replace(/\n/g, " ")}&rdquo;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
