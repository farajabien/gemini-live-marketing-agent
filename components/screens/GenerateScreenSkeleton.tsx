"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function GenerateScreenSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0d]">
      {/* Header Skeleton */}
      <div className="border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Top section with title and badges */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Plan Title */}
        <Skeleton className="h-10 w-96 mb-4" />

        {/* Badges Row */}
        <div className="flex gap-3 mb-8">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>

        {/* Scene Cards */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-8 p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d101b]">
            {/* Scene Header */}
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            {/* Voiceover Text */}
            <Skeleton className="h-20 w-full mb-6" />

            {/* Visual Preview */}
            <div className="rounded-2xl overflow-hidden mb-4">
              <Skeleton className="aspect-video w-full" />
            </div>

            {/* Visual Prompt */}
            <div className="flex items-start gap-2 p-4 rounded-xl bg-white/5">
              <Skeleton className="w-5 h-5 rounded-full mt-0.5" />
              <Skeleton className="h-12 flex-1" />
            </div>
          </div>
        ))}

        {/* Voice Selector */}
        <div className="my-8">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>

        {/* Action Button */}
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}
