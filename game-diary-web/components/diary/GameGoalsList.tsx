"use client";

import React from "react";
import { supabase } from "@/src/lib/supabase";
import { cn, maskNickname } from "@/src/lib/utils";
import { Gauge } from "@/components/ui/gauge";

interface Goal {
  id: string;
  session_id: string;
  guild_id: string;
  game_name: string;
  creator_id: string;
  title: string;
  is_achieved: boolean;
  created_at: string;
}

interface GameGoalsListProps {
  goals: Goal[];
  profiles: Record<string, any>;
  isDeleted?: boolean;
  fetchData: () => void;
}

export function GameGoalsList({ goals, profiles, isDeleted = false, fetchData }: GameGoalsListProps) {
  if (!goals || goals.length === 0) return null;

  const handleToggle = async (goal: Goal) => {
    if (isDeleted) return;

    const nextAchieved = !goal.is_achieved;

    // Update in DB
    const { error } = await supabase
      .from("goals")
      .update({ is_achieved: nextAchieved })
      .eq("id", goal.id);

    if (error) {
      console.error("Failed to update goal status:", error.message);
      return;
    }

    if (nextAchieved) {
      // Fire confetti celebration!
      import("canvas-confetti").then((module) => {
        const confetti = module.default;
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.8 },
          colors: ["#e94a44", "#f7ced1", "#ffffff", "#d6e4f0"]
        });
      }).catch((err) => {
        console.error("Failed to load canvas-confetti dynamically:", err);
      });
    }

    fetchData();
  };

  const totalGoals = goals.length;
  const achievedGoals = goals.filter((g) => g.is_achieved).length;
  const achievementRate = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;

  // Determine color matching the gauge thresholds
  let rateColorClass = "text-primary";
  if (achievementRate >= 70) {
    rateColorClass = "text-[#22c55e]";
  } else if (achievementRate >= 40) {
    rateColorClass = "text-[#ffa500]";
  } else {
    rateColorClass = "text-[#e94a44]";
  }

  return (
    <div className="-mt-2 md:mt-0 mb-4 px-2 md:px-6 pt-2 pb-4 bg-primary/5 border border-primary/10 rounded-2xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-foreground text-[14px] tracking-tight translate-x-[2px] translate-y-[-0.5px]">오늘의 목표 🔥</h4>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-[12px] font-sans font-bold translate-y-[-0.5px]", rateColorClass)}>
            {achievementRate}%
          </span>
          <Gauge 
            value={achievementRate} 
            size="tiny" 
            colors={{
              "0": "#e94a44",   // Red
              "40": "#ffa500",  // Orange
              "70": "#22c55e"   // Green
            }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        {goals.map((goal) => (
          <div
            key={goal.id}
            onClick={() => handleToggle(goal)}
            className={cn(
              "flex items-center justify-between gap-3 py-2 px-3 rounded-xl transition-all select-none border",
              isDeleted ? "cursor-default" : "cursor-pointer hover:bg-primary/5 active:scale-[0.99]",
              goal.is_achieved 
                ? "bg-primary/10 border-primary/20" 
                : "bg-card border-border/40 hover:border-primary/20"
            )}
          >
            {/* Title & Creator */}
            <div className="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
              <span
                className={cn(
                  "text-[13px] font-medium leading-tight break-words transition-all duration-300",
                  goal.is_achieved 
                    ? "text-muted-foreground line-through decoration-muted-foreground/60" 
                    : "text-foreground"
                )}
              >
                {goal.title}
              </span>
              {goal.creator_id && (
                <span className="text-[10px] text-muted-foreground/50 font-bold shrink-0">
                  · {profiles[goal.creator_id]?.has_logged_in 
                    ? (profiles[goal.creator_id]?.display_name || "알 수 없음") 
                    : maskNickname(profiles[goal.creator_id]?.display_name || "알 수 없음")}
                </span>
              )}
            </div>

            {/* Achieve Button */}
            <div
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-300 shrink-0 select-none",
                goal.is_achieved
                  ? "bg-primary text-white shadow-sm shadow-primary/20"
                  : "bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10"
              )}
            >
              {goal.is_achieved ? "달성🔥" : "달성"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
