"use client";

import { useEffect } from "react";

interface GenerationDialogProps {
  isOpen: boolean;
  statusText: string;
  cost?: number;
}


export function GenerationDialog({ isOpen, statusText, cost }: GenerationDialogProps) {
  // Prevent background scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-[#101322] rounded-[2.5rem] p-12 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95 fade-in duration-300">
        {/* Animated Background Gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-red-600/20 rounded-full blur-3xl animate-pulse" />
        
        <div className="relative flex flex-col items-center gap-6 text-center">
          {/* Loading Spinner */}
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-slate-200 dark:border-white/10" />
            <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-600 text-3xl animate-pulse">auto_awesome</span>
            </div>
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Compiling Your Content
            </h3>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {statusText}
            </p>
            {cost !== undefined && cost > 0 && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-[10px] font-black text-red-500/50 uppercase tracking-widest">Est. Cost</span>
                <span className="text-sm font-mono font-bold text-red-500">${cost.toFixed(4)}</span>
              </div>
            )}
          </div>


          {/* Progress Indicators */}
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
              <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Analyzing script structure
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 opacity-60">
              <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Generating visual prompts
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 opacity-30">
              <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Creating final plan
              </span>
            </div>
          </div>

          {/* Tip */}
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            This usually takes 10-15 seconds. Feel free to grab a coffee ☕
          </p>
        </div>
      </div>
    </div>
  );
}
