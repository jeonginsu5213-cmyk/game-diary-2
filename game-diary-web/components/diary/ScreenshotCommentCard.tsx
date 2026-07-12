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
 * - Collapsed: single line (name + comment truncated), all items vertically centered
 * - Expanded : name stays on first row, full comment appears below — nothing shifts
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
    <div className={`flex flex-col ${className} ${hasComment ? "cursor-pointer select-none" : ""}`}
         onClick={() => hasComment && setExpanded((v) => !v)}>

      {/* ── Row 1: always visible, always items-center — never shifts ─── */}
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div className="w-5 h-5 rounded-full overflow-hidden border border-border/40 shrink-0 isolate">
          <img
            src={avatarUrl}
            alt=""
            className={`w-full h-full object-cover ${!hasLoggedIn ? "blur-xs scale-110" : ""}`}
          />
        </div>

        {/* Name + collapsed comment on one line */}
        <div className="flex-1 min-w-0 text-[11px] leading-normal">
          <p className="truncate leading-normal">
            <span className="font-semibold text-foreground/90 mr-1.5">{displayName}</span>
            {hasComment && !expanded && (
              <span className="font-medium text-muted-foreground/80 italic tracking-tight">
                &ldquo;{shot.comment.replace(/\n/g, " ")}&rdquo;
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Expanded comment text (below Row 1) ──────────────────────── */}
      {expanded && hasComment && (
        <div className="mt-1 text-[11px] leading-relaxed italic text-muted-foreground/80 tracking-tight whitespace-pre-wrap"
             style={{ paddingLeft: 28 /* avatar(20) + gap-2.5(10) - slight indent */ }}>
          &ldquo;{shot.comment}&rdquo;
        </div>
      )}
    </div>
  );
}
