"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/src/lib/supabase";
import { cn, maskNickname } from "@/src/lib/utils";
import { Gauge } from "@/components/ui/gauge";
import { motion, AnimatePresence } from "framer-motion";

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
  const [localGoals, setLocalGoals] = useState<Goal[]>(goals || []);
  const pendingTogglesRef = useRef<Record<string, boolean>>({});
  const debounceTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Keep local goals state in sync with incoming props, avoiding overwriting pending optimistic states
  useEffect(() => {
    if (!goals) {
      setLocalGoals([]);
      return;
    }
    setLocalGoals((prevLocal) => {
      return goals.map((incomingGoal) => {
        const pendingState = pendingTogglesRef.current[incomingGoal.id];
        if (pendingState !== undefined) {
          if (incomingGoal.is_achieved === pendingState) {
            // DB has caught up! Clear the pending toggle
            delete pendingTogglesRef.current[incomingGoal.id];
            return incomingGoal;
          }
          // DB has not caught up yet: keep our optimistic local state
          const localGoal = prevLocal.find((g) => g.id === incomingGoal.id);
          return localGoal || incomingGoal;
        }
        return incomingGoal;
      });
    });
  }, [goals]);

  // Clean up debounce timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(debounceTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  if (!goals || goals.length === 0) return null;

  const handleToggle = async (goal: Goal) => {
    if (isDeleted) return;

    const nextAchieved = !goal.is_achieved;

    // 1. Optimistic Update: Update UI state instantly
    setLocalGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? { ...g, is_achieved: nextAchieved } : g))
    );

    // 2. Play confetti immediately if setting to achieved
    if (nextAchieved) {
      import("canvas-confetti")
        .then((module) => {
          const confetti = module.default;
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.8 },
            colors: ["#e94a44", "#f7ced1", "#ffffff", "#d6e4f0"],
          });
        })
        .catch((err) => {
          console.error("Failed to load canvas-confetti dynamically:", err);
        });
    }

    // 3. Set pending target state
    pendingTogglesRef.current[goal.id] = nextAchieved;

    // 4. Cancel any previous pending debounce write for this goal
    if (debounceTimeoutsRef.current[goal.id]) {
      clearTimeout(debounceTimeoutsRef.current[goal.id]);
    }

    // 5. Debounce the network request by 300ms to group rapid clicks
    debounceTimeoutsRef.current[goal.id] = setTimeout(() => {
      delete debounceTimeoutsRef.current[goal.id];

      supabase
        .from("goals")
        .update({ is_achieved: nextAchieved })
        .eq("id", goal.id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to update goal status:", error.message);
            // Rollback on error: clear pending state and revert UI
            delete pendingTogglesRef.current[goal.id];
            setLocalGoals((prev) =>
              prev.map((g) => (g.id === goal.id ? { ...g, is_achieved: !nextAchieved } : g))
            );
          } else {
            // Trigger parent refetch to keep data matching
            fetchData();
          }
        });
    }, 300);
  };

  const totalGoals = localGoals.length;
  const achievedGoals = localGoals.filter((g) => g.is_achieved).length;
  const achievementRate = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;

  // Get dynamic title text based on progress rate
  let titleText = "달성한 목표를 체크해보세요 👑";
  if (achievementRate === 100) {
    titleText = "오늘의 목표 올 클리어! 🏆";
  } else if (achievementRate >= 70) {
    titleText = "목표 달성이 코앞이에요! ⚡";
  } else if (achievementRate >= 40) {
    titleText = "목표 달성 절반 돌파! 🛡️";
  } else if (achievementRate > 0) {
    titleText = "좋은 출발이에요! 🌱";
  }

  let rateColorClass = "text-[#e94a44]";
  if (achievementRate >= 70) {
    rateColorClass = "text-[#22c55e]";
  } else if (achievementRate >= 40) {
    rateColorClass = "text-[#ffa500]";
  }
  const sectionClasses = "bg-primary/5 border-primary/10";

  // Sort goals by creation time to prevent Postgres heap order shifts on update.
  // If creation times are identical, use ID as a stable secondary sort key.
  const stableGoals = [...localGoals].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.id.localeCompare(b.id);
  });

  return (
    <div className={cn("-mt-2 md:mt-0 mb-4 px-2 md:px-6 pt-2 pb-2 border rounded-2xl animate-in fade-in duration-300", sectionClasses)}>
      <div className="flex items-center justify-between mb-2">
        <div className="relative overflow-hidden h-[22px] flex-1 min-w-0 flex items-center translate-x-[4px] translate-y-[-0.5px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h4
              key={titleText}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="font-bold text-foreground text-[14px] tracking-tight whitespace-nowrap"
            >
              {titleText}
            </motion.h4>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 shrink-0 -translate-x-[4px]">
          <span className={cn("text-[12px] font-sans font-bold translate-y-[-0.5px]", rateColorClass)}>
            {achievementRate}%
          </span>
          <Gauge 
            value={achievementRate} 
            size="tiny" 
            className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]"
            colors={{
              "0": "#e94a44",   // Red
              "40": "#ffa500",  // Orange
              "70": "#22c55e"   // Green
            }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        {stableGoals.map((goal) => (
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

            <div
              className={cn(
                "h-[26px] flex items-center justify-center font-bold rounded-lg shrink-0 select-none border",
                goal.is_achieved
                  ? "bg-transparent text-primary border-transparent shadow-none text-[14px] pl-2.5 pr-0"
                  : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 text-[11px] px-2.5"
              )}
            >
              {goal.is_achieved ? "달성 🔥" : "달성"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
