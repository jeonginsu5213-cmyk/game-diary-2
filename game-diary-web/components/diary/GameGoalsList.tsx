"use client";

import React from "react";
import { Check } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import confetti from "canvas-confetti";
import { cn } from "@/src/lib/utils";

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
  isDeleted?: boolean;
  fetchData: () => void;
}

export function GameGoalsList({ goals, isDeleted = false, fetchData }: GameGoalsListProps) {
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
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.8 },
        colors: ["#e94a44", "#f7ced1", "#ffffff", "#d6e4f0"]
      });
    }

    fetchData();
  };

  return (
    <div className="-mt-2 md:mt-0 mb-4 px-4 md:px-6 py-4 bg-primary/5 border border-primary/10 rounded-2xl animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[16px]">🎯</span>
        <h4 className="font-bold text-foreground text-[14px] tracking-tight translate-y-[-0.5px]">오늘의 목표</h4>
      </div>
      <div className="space-y-1.5">
        {goals.map((goal) => (
          <div
            key={goal.id}
            onClick={() => handleToggle(goal)}
            className={cn(
              "flex items-start gap-3 py-1.5 px-2.5 rounded-xl transition-all select-none border",
              isDeleted ? "cursor-default" : "cursor-pointer hover:bg-primary/5 active:scale-[0.99]",
              goal.is_achieved 
                ? "bg-primary/10 border-primary/20" 
                : "bg-card border-border/40 hover:border-primary/20"
            )}
          >
            {/* Custom Checkbox */}
            <div
              className={cn(
                "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors mt-0.5",
                goal.is_achieved
                  ? "bg-primary border-primary text-white"
                  : "border-muted-foreground/30 bg-background"
              )}
            >
              {goal.is_achieved && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
            </div>

            {/* Title */}
            <span
              className={cn(
                "text-[13px] font-medium leading-tight flex-1 break-words transition-all duration-300",
                goal.is_achieved 
                  ? "text-muted-foreground line-through decoration-muted-foreground/60" 
                  : "text-foreground"
              )}
            >
              {goal.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
