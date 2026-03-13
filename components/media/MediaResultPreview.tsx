"use client";

import { useState } from "react";
import { VideoPreview } from "@/components/VideoPreview";
import { cn } from "@/lib/utils";
import type { VideoPlan, Scene } from "@/lib/types";
import { toast } from "sonner";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";

/* ─── Retrying Image Component ─── */
function RetryingImage({ src, alt, className, slideNumber }: { src: string; alt: string; className: string, slideNumber: number }) {
  const [retries, setRetries] = useState(0);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);
  const maxRetries = 15;

  const currentSrc = errorSrc || src;

  const handleError = () => {
    if (retries < maxRetries) {
      setTimeout(() => {
        setRetries(r => r + 1);
        try {
          const url = new URL(src);
          url.searchParams.set('retry', String(retries + 1));
          url.searchParams.set('t', String(Date.now()));
          setErrorSrc(url.toString());
        } catch (e) {
          setErrorSrc(`${src}?retry=${retries + 1}&t=${Date.now()}`);
        }
      }, 1000);
    } else {
      setErrorSrc(`data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f1f5f9" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" font-size="14" text-anchor="middle" dy=".3em" fill="%2394a3b8"%3ESlide ${slideNumber}%3C/text%3E%3C/svg%3E`);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}

/* ─── Media Result Preview Component ─── */
interface MediaResultPreviewProps {
  plan: VideoPlan;
  isReady: boolean;
  statusText?: string;
  visualProgress?: number;
  onRestart?: () => void;
  onDeepRestart?: () => void;
  isManuallyTriggering?: boolean;
}

export function MediaResultPreview({
  plan,
  isReady,
  statusText,
  visualProgress = 0,
  onRestart,
  onDeepRestart,
  isManuallyTriggering
}: MediaResultPreviewProps) {
  const type = plan.type || "video";
  const isCarousel = type === "carousel";
  
  // Caption state for carousels
  const [socialCaptions, setSocialCaptions] = useState<Record<number, string>>({});
  const [generatingCaptionFor, setGeneratingCaptionFor] = useState<number | null>(null);

  // Copy caption to clipboard
  const handleCopyCaption = async (caption: string, slideNumber: number) => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success(`Slide ${slideNumber} caption copied!`, {
        icon: "📋",
        duration: 2000,
      });
    } catch (err) {
      toast.error("Failed to copy caption");
    }
  };

  // Generate social-optimized caption using AI
  const handleGenerateSocialCaption = async (slideText: string, slideIndex: number) => {
    // This requires refreshToken which we don't have here directly.
    // In a real refactor, we might want to pass a callback or use an auth hook.
    // For now, let's assume the callback pattern is better for reusability.
    toast.info("Social generation coming soon to this view...");
  };

  if (!isReady && !plan.scenes?.some(s => !!s.imageUrl || !!s.videoClipUrl)) {
    return (
      <div className="bg-black/40 backdrop-blur-md p-10 rounded-[2.45rem] flex flex-col items-center justify-center border border-white/10 w-full min-h-[300px]">
        <div className="relative z-10 flex flex-col items-center gap-4 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{Math.round(visualProgress)}%</div>
          <p className="text-[10px] text-white/60 uppercase tracking-widest font-black leading-tight">
            {statusText}
          </p>
          {onRestart && (
            <button 
              onClick={onRestart}
              disabled={isManuallyTriggering}
              className="mt-2 text-[10px] text-red-500 hover:text-red-700 font-bold uppercase underline"
            >
              {isManuallyTriggering ? "Restarting..." : "Stuck? Restart"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      {isCarousel ? (
        /* Carousel Preview - Horizontal shadcn Carousel */
        <div className="w-full max-w-4xl mx-auto">
          <Carousel className="w-full" opts={{ align: "start", loop: true }}>
            <CarouselContent className="-ml-2 md:-ml-4">
              {(plan.scenes || []).map((scene, i) => {
                const imageUrl = scene.imageUrl?.startsWith("http") || scene.imageUrl?.startsWith("data:")
                  ? scene.imageUrl
                  : scene.imageUrl
                    ? `/api/proxy-image?path=${encodeURIComponent(scene.imageUrl)}`
                    : undefined;

                return (
                  <CarouselItem key={i} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/2">
                    <div className="group relative bg-[#0a0b14] rounded-[2rem] overflow-hidden border border-white/5 hover:border-red-500/30 transition-all duration-500 shadow-2xl">
                      {/* Image Container */}
                      <div className="aspect-[4/5] relative overflow-hidden">
                        {scene.imageUrl && imageUrl ? (
                          <div className="w-full h-full transition-transform duration-700 group-hover:scale-105">
                            <RetryingImage
                              src={imageUrl}
                              alt={`Slide ${i + 1}`}
                              className="w-full h-full object-cover"
                              slideNumber={i + 1}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] text-white/20">
                            <span className="material-symbols-outlined text-5xl mb-2 animate-pulse">image</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Rendering...</span>
                          </div>
                        )}
                        
                        {/* Slide Badge */}
                        <div className="absolute top-6 left-6 z-10">
                          <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-black text-white shadow-xl">
                            SLIDE {i + 1} / {(plan.scenes || []).length}
                          </div>
                        </div>

                        {/* Hover Overlay for Copy */}
                        {scene.voiceover && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-8 text-center">
                            <p className="text-sm font-medium leading-relaxed text-white/90 mb-6 line-clamp-4">
                              &quot;{scene.voiceover}&quot;
                            </p>
                            <button
                              onClick={() => handleCopyCaption(scene.voiceover || "", i + 1)}
                              className="px-6 py-2.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                              Copy Script
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Info Bar (Always visible) */}
                      <div className="p-5 border-t border-white/5 flex items-center justify-between">
                         <div className="flex-1 min-w-0 pr-4">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Visual Hook</p>
                            <p className="text-xs font-bold text-white/70 truncate">{scene.textOverlay || scene.voiceover || "No script"}</p>
                         </div>
                         <div className="flex items-center gap-2">
                            {scene.audioUrl && (
                               <div className="size-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                  <span className="material-symbols-outlined text-sm animate-pulse">volume_up</span>
                               </div>
                            )}
                         </div>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            
            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <CarouselPrevious className="static translate-y-0 bg-white/5 border-white/10 hover:bg-white/10 text-white" />
              <div className="px-4 py-2 rounded-full bg-white/5 border border-white/5 flex items-center gap-2">
                 <div className="size-1.5 rounded-full bg-red-600 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Navigator</span>
              </div>
              <CarouselNext className="static translate-y-0 bg-white/5 border-white/10 hover:bg-white/10 text-white" />
            </div>
          </Carousel>

          {!isReady && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-600 transition-all duration-1000" 
                  style={{ width: `${visualProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-black">
                {statusText} • {Math.round(visualProgress)}%
              </p>
              {onRestart && (
                <button
                  onClick={onRestart}
                  disabled={isManuallyTriggering}
                  className="text-[9px] text-red-500/60 hover:text-red-500 transition-colors uppercase tracking-[0.2em] font-black underline underline-offset-4"
                >
                  {isManuallyTriggering ? "Initializing..." : "Stuck? Restart Stage"}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Video Preview - Standard Player */
        <div className="relative w-full max-w-[300px] aspect-[9/16] shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-black">
          <VideoPreview plan={plan} />
          {!isReady && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-20 text-center">
              <div className="mb-4">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
                  <div 
                    className="absolute inset-0 rounded-full border-4 border-red-600 border-t-transparent animate-spin"
                    style={{ animationDuration: '3s' }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
                    {Math.round(visualProgress)}%
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-white uppercase tracking-widest font-black leading-tight mb-6 max-w-[140px]">
                {statusText}
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                {onRestart && (
                  <button
                    onClick={onRestart}
                    disabled={isManuallyTriggering}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    {isManuallyTriggering ? "Restarting..." : "Stuck? Soft Restart"}
                  </button>
                )}
                {onDeepRestart && (
                  <button
                    onClick={onDeepRestart}
                    disabled={isManuallyTriggering}
                    className="px-4 py-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-500/60 hover:text-red-500 text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    Deep Restart (Wipe)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
