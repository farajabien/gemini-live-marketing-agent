"use client";

import { cn } from "@/lib/utils";

interface StrengthGaugeProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  label?: string;
  showLabel?: boolean;
}

export function StrengthGauge({
  score,
  size = "md",
  label,
  showLabel = true
}: StrengthGaugeProps) {
  // Clamp score between 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Calculate color based on score
  const getColor = (score: number) => {
    if (score >= 85) return { ring: "stroke-green-500", text: "text-green-400", bg: "bg-green-500/10" };
    if (score >= 70) return { ring: "stroke-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" };
    if (score >= 50) return { ring: "stroke-orange-500", text: "text-orange-400", bg: "bg-orange-500/10" };
    return { ring: "stroke-red-500", text: "text-red-400", bg: "bg-red-500/10" };
  };

  const colors = getColor(clampedScore);

  // Size configurations
  const sizes = {
    sm: {
      container: "w-16 h-16",
      strokeWidth: 4,
      text: "text-sm",
      labelText: "text-xs",
      radius: 28
    },
    md: {
      container: "w-24 h-24",
      strokeWidth: 5,
      text: "text-xl",
      labelText: "text-sm",
      radius: 42
    },
    lg: {
      container: "w-32 h-32",
      strokeWidth: 6,
      text: "text-3xl",
      labelText: "text-base",
      radius: 56
    },
  };

  const config = sizes[size];
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", config.container)}>
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r={config.radius}
            className="stroke-white/10"
            strokeWidth={config.strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="50%"
            cy="50%"
            r={config.radius}
            className={cn(colors.ring, "transition-all duration-1000 ease-out")}
            strokeWidth={config.strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>

        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-black", config.text, colors.text)}>
            {Math.round(clampedScore)}
          </span>
        </div>
      </div>

      {/* Label */}
      {showLabel && label && (
        <span className={cn("font-bold text-slate-400 text-center", config.labelText)}>
          {label}
        </span>
      )}
    </div>
  );
}
