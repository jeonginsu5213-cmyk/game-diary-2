"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
import { maskNickname } from "@/src/lib/utils";

interface ScreenshotCommentCardProps {
  shot: any;
  profiles: any;
  className?: string;
}

const ONE_LINE_PX = 18; // ≈ 1 line of 11 px / leading-normal

/**
 * Expandable screenshot comment card (mobile).
 *
 * Key design decisions:
 *  - items-start on the flex row: both avatar and text are pinned to the top
 *    at all times → the first line never shifts when expanding/collapsing.
 *  - A hidden `fullHeightRef` div measures the actual wrapped text height so
 *    the max-height transition animates over the exact content range (not 400px),
 *    making both expand and collapse fully visible.
 *  - Separate `expanded` (max-height) and `contentExpanded` (text rendering)
 *    states: collapse triggers the height animation first, and only after it
 *    completes (300 ms) does the text snap back to truncated.
 */
export default function ScreenshotCommentCard({
  shot,
  profiles,
  className = "",
}: ScreenshotCommentCardProps) {
  const [expanded, setExpanded]               = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [canExpand, setCanExpand]             = useState(false);
  const [fullHeight, setFullHeight]           = useState(ONE_LINE_PX);

  const clipRef       = useRef<HTMLDivElement>(null); // overflow-hidden container
  const measureRef    = useRef<HTMLDivElement>(null); // hidden full-text measurement
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profile     = profiles?.[shot.uploader_id];
  const hasLoggedIn = profile?.has_logged_in ?? false;
  const displayName = hasLoggedIn
    ? profile?.display_name || "Anonymous"
    : maskNickname(profile?.display_name || "Anonymous");
  const avatarUrl   =
    profile?.avatar_url ||
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`;
  const hasComment  = !!shot.comment;

  // Measure actual full-text height and detect if clipping occurs at 1 line
  useLayoutEffect(() => {
    if (!hasComment) { setCanExpand(false); return; }

    // Actual height of fully-wrapped text at current container width
    if (measureRef.current) {
      setFullHeight(measureRef.current.offsetHeight);
    }

    if (shot.comment.includes("\n")) { setCanExpand(true); return; }
    const el = clipRef.current;
    if (el) setCanExpand(el.scrollHeight > el.clientHeight);
  }, [shot.comment, displayName]);

  const handleClick = () => {
    if (!canExpand) return;
    if (expanded) {
      setExpanded(false);
      collapseTimer.current = setTimeout(() => setContentExpanded(false), 300);
    } else {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      setContentExpanded(true);
      setExpanded(true);
    }
  };

  return (
    <div
      className={`flex items-start gap-2.5 ${className} ${canExpand ? "cursor-pointer select-none" : ""}`}
      onClick={handleClick}
    >
      {/* Avatar — items-start pins it to the top always; never drifts down */}
      <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate">
        <img
          src={avatarUrl}
          alt=""
          className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
        />
      </div>

      {/* Text area */}
      <div className="flex-1 min-w-0 relative">

        {/*
          Hidden measurement div.
          Renders the full name + comment with whitespace-pre-wrap at the same
          width as the visible text area. Its offsetHeight is the true target
          for the max-height expand animation.
        */}
        {hasComment && (
          <div
            ref={measureRef}
            className="absolute top-0 left-0 w-full invisible pointer-events-none
                       text-[11px] leading-normal whitespace-pre-wrap"
          >
            <span className="font-semibold mr-1.5">{displayName}</span>
            <span className="font-medium italic">
              &ldquo;{shot.comment}&rdquo;
            </span>
          </div>
        )}

        {/*
          Animated container: max-height transitions between ONE_LINE_PX and
          the measured fullHeight so the animation covers the exact content range.
        */}
        <div
          ref={clipRef}
          className="overflow-hidden"
          style={{
            maxHeight: expanded ? fullHeight : ONE_LINE_PX,
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
    </div>
  );
}
