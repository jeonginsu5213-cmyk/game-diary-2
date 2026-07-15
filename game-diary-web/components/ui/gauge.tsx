"use client";

import React from "react";
import { cn } from "@/src/lib/utils";

interface GaugeProps {
  value?: number;
  size?: "tiny" | "small" | "medium" | "large";
  showValue?: boolean;
  indeterminate?: boolean;
  colors?: {
    primary?: string;
    secondary?: string;
    [key: string]: string | undefined;
  };
  arcPriority?: "equal" | "default";
  className?: string;
}

const sizeConfig = {
  tiny: {
    dimension: 28,
    strokeWidth: 3,
    textSize: "text-[8px]",
  },
  small: {
    dimension: 48,
    strokeWidth: 5,
    textSize: "text-[11px]",
  },
  medium: {
    dimension: 72,
    strokeWidth: 7,
    textSize: "text-[15px]",
  },
  large: {
    dimension: 112,
    strokeWidth: 10,
    textSize: "text-[22px]",
  },
};

export function Gauge({
  value = 0,
  size = "medium",
  showValue = false,
  indeterminate = false,
  colors,
  arcPriority = "default",
  className,
}: GaugeProps) {
  const config = sizeConfig[size] || sizeConfig.medium;
  const radius = (config.dimension - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Bound value between 0 and 100
  const boundedValue = Math.min(100, Math.max(0, value));
  
  // If indeterminate, show 25% arc spinning
  const activeValue = indeterminate ? 25 : boundedValue;
  const strokeDashoffset = circumference - (activeValue / 100) * circumference;

  // Resolve Colors
  let primaryColor = "var(--primary, #e94a44)"; // Default brand color
  let secondaryColor = "rgba(0, 0, 0, 0.08)"; // Subtle grey background track

  // For dark mode compatibility
  if (typeof window !== "undefined" && document.documentElement.classList.contains("dark")) {
    secondaryColor = "rgba(255, 255, 255, 0.1)";
  }

  if (colors) {
    if (colors.primary) {
      primaryColor = colors.primary;
    }
    if (colors.secondary) {
      secondaryColor = colors.secondary;
    }

    // Resolve color ranges (e.g. {"0": "#...", "10": "#..."})
    const numericKeys = Object.keys(colors)
      .map((k) => parseInt(k, 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => b - a); // Sort descending

    if (numericKeys.length > 0) {
      const matchingKey = numericKeys.find((key) => boundedValue >= key);
      if (matchingKey !== undefined) {
        primaryColor = colors[matchingKey.toString()] || primaryColor;
      }
    }
  }

  return (
    <div className="relative inline-flex items-center justify-center select-none shrink-0 isolate">
      <svg
        width={config.dimension}
        height={config.dimension}
        viewBox={`0 0 ${config.dimension} ${config.dimension}`}
        className={cn(
          "-rotate-90 origin-center transition-transform",
          indeterminate && "animate-spin",
          className
        )}
        style={{
          animationDuration: indeterminate ? "1.4s" : undefined,
        }}
      >
        {/* Background Track Circle */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          stroke={secondaryColor}
          strokeWidth={config.strokeWidth}
        />
        {/* Foreground Progress Circle */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          stroke={primaryColor}
          strokeWidth={config.strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>

      {/* Center value display */}
      {showValue && !indeterminate && (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-sans font-black text-foreground/90 translate-y-[-0.5px]",
            config.textSize
          )}
        >
          {Math.round(boundedValue)}
        </span>
      )}
    </div>
  );
}
