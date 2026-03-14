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
    <div className={cn("flex items-center gap-2 px-2 animate-in fade-in slide-in-from-left-2 duration-300", className)}>
      <div className="flex gap-0.5">
        <div className="size-1 bg-blue-500 rounded-full animate-pulse" />
        <div className="size-1 bg-blue-500 rounded-full animate-pulse delay-75" />
        <div className="size-1 bg-blue-500 rounded-full animate-pulse delay-150" />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
        {thinkingStatus || "Director Thinking"}
      </span>
    </div>
  );
}
