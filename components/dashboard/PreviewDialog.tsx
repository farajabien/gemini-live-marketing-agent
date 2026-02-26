"use client";

import { useRef, useState } from "react";
import { VideoPreview } from "@/components/VideoPreview";
import { CarouselRenderer } from "@/components/CarouselRenderer";
import { downloadPlanAssets } from "@/lib/download-utils";
import type { VideoPlan } from "@/lib/types";

interface PreviewDialogProps {
  plan: VideoPlan | null;
  isOpen: boolean;
  onClose: () => void;
}

import { useAuth } from "@/hooks/use-auth";

// ...

export function PreviewDialog({ plan, isOpen, onClose }: PreviewDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { refreshToken } = useAuth(); // Use refreshToken as the auth token

  if (!isOpen || !plan) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Wait for renderer to mount and images to load
      console.log('Preparing download...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await downloadPlanAssets(plan, carouselRef.current, refreshToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      alert(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Hidden Renderer for capture */}
      <div className="absolute opacity-0 pointer-events-none">
         <CarouselRenderer ref={carouselRef} plan={plan} />
      </div>

      <div className="bg-white dark:bg-[#101322] rounded-[2.5rem] w-full max-w-4xl shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-white dark:bg-[#101322]/80 backdrop-blur-md p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center shrink-0 z-20">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <span className="material-symbols-outlined text-white text-xl">play_arrow</span>
                </div>
                <div>
                    <h2 className="font-black text-xl text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-md tracking-tight">
                        {plan.title}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[10px] font-black text-blue-500 uppercase tracking-widest">{plan.type}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">High Quality Preview</span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="h-10 w-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-red-500">
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>

        {/* Content - Fixed Height, No Scroll */}
        <div className="flex-1 min-h-0 bg-[#f6f6f8] dark:bg-[#080911] flex flex-col items-center justify-center p-6 sm:p-10">
             <div className="w-full h-full flex items-center justify-center overflow-hidden drop-shadow-[0_24px_48px_rgba(0,0,0,0.4)]">
                <VideoPreview plan={plan} />
             </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#101322]/80 backdrop-blur-md flex justify-between items-center shrink-0">
             <button 
                onClick={onClose}
                className="px-6 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
             >
                Close
             </button>
             <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="group relative h-14 px-8 bg-[#1337ec] hover:scale-[1.02] active:scale-95 text-white font-black rounded-[1.25rem] shadow-[0_20px_40px_-10px_rgba(19,55,236,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden flex items-center gap-3"
             >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                <div className="relative flex items-center gap-3">
                    {isDownloading ? <span className="animate-spin material-symbols-outlined text-lg">refresh</span> : <span className="material-symbols-outlined text-lg">download</span>}
                    <span className="text-sm uppercase tracking-widest font-black">{isDownloading ? "Processing..." : (plan.type === 'carousel' ? "Download Images (ZIP)" : "Download Video")}</span>
                </div>
             </button>
        </div>

      </div>
    </div>
  );
}
