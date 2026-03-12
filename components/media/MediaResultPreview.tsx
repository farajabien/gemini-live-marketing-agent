"use client";

import { useState } from "react";
import { VideoPreview } from "@/components/VideoPreview";
import { cn } from "@/lib/utils";
import type { VideoPlan, Scene } from "@/lib/types";
import { toast } from "sonner";

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
        /* Carousel Preview - Grid of Slides */
        <div className="w-full max-w-[350px] max-h-[500px] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl bg-black/20 backdrop-blur-sm">
          <div className="p-3 space-y-3">
            {(plan.scenes || []).map((scene, i) => {
              const imageUrl = scene.imageUrl?.startsWith("http") || scene.imageUrl?.startsWith("data:")
                ? scene.imageUrl
                : scene.imageUrl
                  ? `/api/proxy-image?path=${encodeURIComponent(scene.imageUrl)}`
                  : undefined;

              return (
                <div key={i} className="bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all">
                  <div className="aspect-square relative bg-white/5">
                    {scene.imageUrl && imageUrl ? (
                      <RetryingImage
                        src={imageUrl}
                        alt={`Slide ${i + 1}`}
                        className="w-full h-full object-cover"
                        slideNumber={i + 1}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <span className="material-symbols-outlined text-4xl">image</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-lg text-xs font-black shadow-lg">
                      {i + 1}/{(plan.scenes || []).length}
                    </div>
                  </div>

                  {scene.voiceover && (
                    <div className="p-3 space-y-2">
                      <p className="text-xs leading-relaxed text-white/70 italic">
                        "{scene.voiceover}"
                      </p>
                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleCopyCaption(scene.voiceover || "", i + 1)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-[10px] font-bold hover:bg-white/10 hover:text-white transition-all shadow-sm"
                        >
                          <span className="material-symbols-outlined text-xs">content_copy</span>
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isReady && (
            <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 text-center">
              <p className="text-sm font-bold text-white mb-1">{Math.round(visualProgress)}%</p>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-black leading-tight">
                {statusText}
              </p>
              {onRestart && (
                <button
                  onClick={onRestart}
                  disabled={isManuallyTriggering}
                  className="mt-2 text-[10px] text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest font-bold underline"
                >
                  {isManuallyTriggering ? "Restarting..." : "Stuck? Restart"}
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
