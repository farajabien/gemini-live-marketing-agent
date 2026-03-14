"use client";

import { cn } from "@/lib/utils";

export function PremiumSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "animate-pulse bg-gradient-to-r from-white/[0.02] via-white/[0.05] to-white/[0.02] bg-[length:200%_100%] rounded-2xl",
        className
      )}
      style={{ 
        animationDuration: '2s',
        animationTimingFunction: 'linear'
      }}
    />
  );
}

export function WarRoomSkeleton() {
  return (
    <div className="flex flex-col xl:flex-row h-screen overflow-hidden bg-black">
      {/* Left Pane Skeleton */}
      <div className="w-full xl:w-[400px] 2xl:w-[450px] border-r border-white/5 bg-[#020205] flex flex-col shrink-0 p-6 space-y-6">
        <PremiumSkeleton className="h-8 w-1/2" />
        <PremiumSkeleton className="h-4 w-full" />
        <div className="flex-1 space-y-4">
          <PremiumSkeleton className="h-24 w-full" />
          <PremiumSkeleton className="h-24 w-full" />
          <PremiumSkeleton className="h-24 w-full" />
        </div>
        <PremiumSkeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Right Pane Skeleton */}
      <div className="flex-1 bg-[#050505] p-6 space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <PremiumSkeleton className="size-10 rounded-xl" />
            <div className="space-y-2 pt-1">
              <PremiumSkeleton className="h-4 w-32" />
              <PremiumSkeleton className="h-2 w-24" />
            </div>
          </div>
          <PremiumSkeleton className="h-8 w-24 rounded-full" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PremiumSkeleton className="h-32 w-full" />
          <PremiumSkeleton className="h-32 w-full" />
          <PremiumSkeleton className="h-32 w-full" />
        </div>

        <div className="space-y-4">
          <PremiumSkeleton className="h-4 w-40" />
          <PremiumSkeleton className="h-40 w-full" />
          <PremiumSkeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
