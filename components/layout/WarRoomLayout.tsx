"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface WarRoomLayoutProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  className?: string;
}

/**
 * Standardized layout for the "War Room" experience.
 * Features a fixed-width left pane (usually for DirectorChat) 
 * and a scrollable right pane (usually for the Canvas).
 */
export function WarRoomLayout({ leftPane, rightPane, className }: WarRoomLayoutProps) {
  return (
    <div className={cn("flex flex-col xl:flex-row h-screen overflow-hidden bg-black", className)}>
      {/* Left Pane: Primary Intelligence/Controls */}
      <div className="w-full xl:w-[400px] 2xl:w-[450px] border-r border-white/5 bg-[#020205] flex flex-col shrink-0 relative z-10 shadow-2xl shadow-blue-900/10">
        {leftPane}
      </div>

      {/* Right Pane: Strategic Canvas */}
      <div className="flex-1 min-w-0 bg-[#050505] overflow-y-auto relative custom-scrollbar">
         {rightPane}
      </div>
    </div>
  );
}
