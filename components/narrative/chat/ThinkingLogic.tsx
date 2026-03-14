"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ThinkingLogicProps {
  isThinking: boolean;
  thinkingStatus: string;
  className?: string;
}

export function ThinkingLogic({ isThinking, thinkingStatus, className }: ThinkingLogicProps) {
  if (!isThinking && !thinkingStatus) return null;

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded-full w-fit animate-in fade-in slide-in-from-left-2 duration-500 backdrop-blur-sm", className)}>
      <div className="flex gap-1">
        <div className="size-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
        <div className="size-1.5 bg-blue-500 rounded-full animate-pulse delay-150 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
        <div className="size-1.5 bg-blue-500 rounded-full animate-pulse delay-300 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 drop-shadow-sm">
        {thinkingStatus || "Director Thinking"}
      </span>
    </div>
  );
}
