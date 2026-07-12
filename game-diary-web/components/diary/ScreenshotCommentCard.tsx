"use client";

import React, { useState } from "react";
import { maskNickname } from "@/src/lib/utils";

interface ScreenshotCommentCardProps {
  shot: any;
  profiles: any;
  className?: string;
}

/**
 * Expandable screenshot comment card.
 * - Collapsed: single line with ellipsis
 * - Expanded : full comment with whitespace-pre-wrap, avatar top-aligned
 */
export default function ScreenshotCommentCard({
  shot,
  profiles,
  className = "",
}: ScreenshotCommentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const profile = profiles?.[shot.uploader_id];
  const hasLoggedIn = profile?.has_logged_in ?? false;
  const displayName = hasLoggedIn
    ? profile?.display_name || "Anonymous"
    : maskNickname(profile?.display_name || "Anonymous");
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${shot.uploader_id}`;

  const hasComment = !!shot.comment;

  return (
    <div
      className={`flex gap-2.5 ${className} ${hasComment ? "cursor-pointer select-none" : ""}`}
      onClick={() => hasComment && setExpanded((v) => !v)}
    >
      {/* Avatar — top-aligned when expanded, center-aligned when collapsed */}
      <div
        className={`w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate ${
          expanded ? "mt-0.5 self-start" : "self-center"
        }`}
      >
        <img
          src={avatarUrl}
          alt=""
          className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 text-[11px] leading-normal text-left">
        {expanded ? (
          // Expanded: full text, whitespace-pre-wrap
          <>
            <span className="font-semibold text-foreground/90 mr-1.5">{displayName}</span>
            {hasComment && (
              <span className="font-medium text-muted-foreground/80 italic tracking-tight whitespace-pre-wrap">
                &ldquo;{shot.comment}&rdquo;
              </span>
            )}
          </>
        ) : (
          // Collapsed: single line with ellipsis
          <p className="truncate leading-normal">
            <span className="font-semibold text-foreground/90 mr-1.5">{displayName}</span>
            {hasComment && (
              <span className="font-medium text-muted-foreground/80 italic tracking-tight">
                &ldquo;{shot.comment.replace(/\n/g, " ")}&rdquo;
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
