"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { tx } from "@/lib/firebase-tx";
import { toast } from "sonner";
import { CarouselRenderer } from "@/components/CarouselRenderer";
import { VideoPreview } from "@/components/VideoPreview";
import { toBlob } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { VideoPlan, Scene } from "@/lib/types";
import { downloadPlanAssets } from "@/lib/download-utils";

import { Header } from "@/components/Header";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { SecureAccountDialog } from "@/components/SecureAccountDialog";
import Image from "next/image";

function RetryingImage({ src, alt, className, slideNumber }: { src: string; alt: string; className: string, slideNumber: number }) {
  const [retries, setRetries] = useState(0);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);
  const maxRetries = 15; // Try for up to 15 seconds while CDN propagates

  useEffect(() => {
    setRetries(0);
    setErrorSrc(null);
  }, [src]);

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
      }, 1000); // Retry every 1s
    } else {
      // Fallback SVG after max retries
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

export function SuccessScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshToken, isLoading: isAuthLoading } = useAuth();
  const type = searchParams.get("type") || "video";
  const planId = searchParams.get("planId");
  const isCarousel = type === "carousel";

  const { width, height } = useWindowSize();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isManuallyTriggering, setIsManuallyTriggering] = useState(false);
  
  // Ref Flags to prevent double-firing
  const orchestrationStarted = useRef(false);

  // UI State
  const [isReady, setIsReady] = useState(false);
  const [statusText, setStatusText] = useState("Initializing...");
  const [visualProgress, setVisualProgress] = useState(0);

  // Series redirect state
  const [seriesRedirectCountdown, setSeriesRedirectCountdown] = useState<number | null>(null);
  const seriesRedirectTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Caption state for carousels
  const [socialCaptions, setSocialCaptions] = useState<Record<number, string>>({});
  const [generatingCaptionFor, setGeneratingCaptionFor] = useState<number | null>(null);

  // Guest upgrade prompt
  const [secureAccountOpen, setSecureAccountOpen] = useState(false);
  
  // Data Fetching
  const successPlanQuery = useMemo(
    () => planId ? { 
      videoPlans: { $: { where: { id: planId } }, narrative: {} },
      episodes: { $: { collection: 'episodes', where: { videoPlanId: planId } } }
    } : null,
    [planId]
  );
  const { data } = db.useQuery(successPlanQuery);
  const plan = (data && 'videoPlans' in data ? data.videoPlans?.[0] : undefined) as VideoPlan & { narrative?: { id: string }[] } | undefined;
  const episode = (data as any)?.episodes?.[0];

  // Manual Trigger Function (can be called from UI)
  const triggerVisualsManually = () => {
    if (!plan) return;

    setIsManuallyTriggering(true);
    orchestrationStarted.current = false; // Allow re-trigger
    console.log("Manual re-trigger of orchestration pipeline");

    fetch("/api/orchestrate-generation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${refreshToken}`
        },
        body: JSON.stringify({ planId: plan.id })
    })
    .then(res => {
        console.log("Orchestration re-trigger response:", res.status);
        if (res.ok) toast.success("Generation restarted!");
        else toast.error("Failed to restart generation");
    })
    .catch(err => {
        console.error("Orchestration re-trigger failed:", err);
        toast.error("Failed to restart generation");
    })
    .finally(() => {
        orchestrationStarted.current = true;
        setIsManuallyTriggering(false);
    });
  };

  const deepRestart = async () => {
    if (!plan) return;
    if (!confirm("This will delete all generated images and start fresh. Continue?")) return;

    try {
        setIsManuallyTriggering(true);
        console.log("🔥 Deep restart initiated for plan:", plan.id);
        
        const resetScenes = (plan.scenes || []).map((s: Scene) => ({
            ...s,
            imageUrl: null,
            videoClipUrl: null,
            operationId: null
        }));

        const docId = planId || plan.id;
        if (!docId) { toast.error("Missing plan ID"); return; }
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        await (db as DbWithTransact).transact([
            tx.videoPlans[docId].update({
                status: 'pending',
                scenes: resetScenes,
                thumbnailUrl: null
            })
        ]);

        toast.success("Project reset! Starting fresh...");
        orchestrationStarted.current = false;

    } catch (err) {
        console.error("❌ Deep restart failed:", err);
        toast.error("Reset failed");
    } finally {
        setIsManuallyTriggering(false);
    }
  };

  // Cleanup series redirect timer on unmount
  useEffect(() => {
    return () => {
      if (seriesRedirectTimer.current) clearInterval(seriesRedirectTimer.current);
    };
  }, []);

  // 1. Trigger Server-Side Orchestration (fires once)
  useEffect(() => {
    if (!plan || !plan.scenes) return;
    if (plan.status === 'completed') {
      setIsReady(true);
      setVisualProgress(100);
      return;
    }
    if (orchestrationStarted.current) return;

    const canTrigger = !plan.status || plan.status === 'pending' || plan.status === 'draft' || plan.status === 'generating';
    if (!canTrigger) return;

    orchestrationStarted.current = true;
    console.log("[SuccessScreen] Triggering server-side orchestration pipeline...");

    fetch("/api/orchestrate-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({ planId: plan.id }),
    })
      .then((res) => {
        console.log("[SuccessScreen] Orchestration response:", res.status);
      })
      .catch((err) => {
        console.error("[SuccessScreen] Orchestration failed:", err);
        orchestrationStarted.current = false; // Allow retry
      });
  }, [plan, refreshToken]);

  // 2. Observe Status & Update Progress UI (server-side orchestration handles the pipeline)
  useEffect(() => {
    if (!plan || !plan.scenes) return;

    const visualMode = plan.visualMode || "image";
    const scenes = (plan.scenes || []) as Scene[];
    const totalScenes = scenes.length;

    // Count completed assets — including sub-scenes
    let visualsDone = 0;
    let totalVisuals = 0;

    if (visualMode === "broll") {
      totalVisuals = totalScenes;
      visualsDone = scenes.filter((s: Scene) => !!s.videoClipUrl).length;
    } else {
      for (const s of scenes) {
        const subs = (s as any).subScenes;
        if (subs && subs.length > 0) {
          totalVisuals += subs.length;
          visualsDone += subs.filter((sub: any) => !!sub.imageUrl).length;
        } else {
          totalVisuals += 1;
          if (s.imageUrl) visualsDone += 1;
        }
      }
    }

    const audioDone = scenes.filter((s: Scene) => !!s.audioUrl).length;
    const allVisualsDone = visualsDone === totalVisuals;
    const allAudioDone = audioDone === totalScenes;
    const allAssetsDone = isCarousel ? allVisualsDone : (allVisualsDone && allAudioDone);

    let text = "Initializing...";
    let target = 5;

    switch (plan.status) {
      case 'generating':
        if (!allVisualsDone) {
          text = visualMode === "broll"
            ? `Step 1/3 — Generating B-Roll Clip ${visualsDone + 1} of ${totalVisuals}`
            : `Step 1/3 — Designing Visual ${visualsDone + 1} of ${totalVisuals}`;
          target = 20 + ((visualsDone / totalVisuals) * 40);
        } else {
          text = "Step 1/3 — Visuals Complete";
          target = 60;
        }
        break;
      case 'generating_audio':
        text = `Step 2/3 — Synthesizing Voiceover (${audioDone}/${totalScenes})`;
        target = 60 + ((audioDone / totalScenes) * 25);
        break;
      case 'rendering_video':
      case 'rendering': {
        const renderPct = (plan as any).renderProgress || 0;
        text = renderPct > 0 ? `Step 3/3 — Compiling Video... ${renderPct}%` : "Step 3/3 — Compiling Final Video";
        target = 90 + (renderPct / 100) * 9;
        break;
      }
      case 'completed':
        text = "Ready!";
        target = 100;
        if (!isReady) {
          setIsReady(true);
          if (episode?.seriesId && !seriesRedirectTimer.current) {
            console.log(`[SuccessScreen] Part of series ${episode.seriesId}, starting countdown...`);
            setSeriesRedirectCountdown(5);
            let remaining = 5;
            seriesRedirectTimer.current = setInterval(() => {
              remaining -= 1;
              setSeriesRedirectCountdown(remaining);
              if (remaining <= 0) {
                if (seriesRedirectTimer.current) clearInterval(seriesRedirectTimer.current);
                seriesRedirectTimer.current = null;
                router.push(`/series/${episode.seriesId}`);
                toast.success("Returning to Series Generation...");
              }
            }, 1000);
          }
        }
        break;
      default:
        if (plan.thumbnailPrompt && !plan.thumbnailUrl) {
          text = "Preparing — Designing Thumbnail";
          target = 15;
        } else {
          text = "Preparing — Starting AI Engines";
          target = 10;
        }
    }

    setStatusText(text);

    // Animate Visual Progress
    const interval = setInterval(() => {
        setVisualProgress(prev => {
            if (prev >= target) return prev;
            return prev + (target - prev) * 0.1;
        });
    }, 100);

    return () => clearInterval(interval);
  }, [plan, isReady, isCarousel]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101322] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1337ec] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Linked copied to clipboard!");
  };

  const handleDownload = async () => {
    if (!plan) return;
    setIsDownloading(true);
    try {
      await downloadPlanAssets(plan, carouselRef.current, refreshToken);
    } catch (err: any) {
      console.error("Download failed:", err);
      toast.error(`Download failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

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
    if (!refreshToken) return;

    setGeneratingCaptionFor(slideIndex);
    try {
      const response = await fetch("/api/generate-social-caption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ text: slideText }),
      });

      if (!response.ok) throw new Error("Failed to generate caption");

      const { caption } = await response.json();
      setSocialCaptions(prev => ({ ...prev, [slideIndex]: caption }));
      toast.success("Social caption generated!", { icon: "✨" });
    } catch (err) {
      toast.error("Failed to generate social caption");
    } finally {
      setGeneratingCaptionFor(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black font-sans text-white flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center p-4 mt-16">
      {isReady && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      {/* Series redirect banner */}
      {seriesRedirectCountdown !== null && seriesRedirectCountdown > 0 && episode?.seriesId && (
        <div className="w-full max-w-4xl mb-4 z-20 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between gap-4 px-5 py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-400 animate-pulse">movie_filter</span>
              <span className="text-sm font-bold text-blue-200">
                This episode is part of a series — redirecting in {seriesRedirectCountdown}s
              </span>
            </div>
            <button
              onClick={() => {
                if (seriesRedirectTimer.current) clearInterval(seriesRedirectTimer.current);
                seriesRedirectTimer.current = null;
                setSeriesRedirectCountdown(null);
                toast.info("Auto-redirect cancelled");
              }}
              className="text-xs font-black uppercase tracking-widest text-blue-300 hover:text-white transition-colors shrink-0"
            >
              Stay Here
            </button>
          </div>
        </div>
      )}

      {plan && <CarouselRenderer ref={carouselRef} plan={plan} />}

      <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl rounded-2xl border border-white/5 p-8 shadow-xl text-center z-10 grid md:grid-cols-2 gap-8 items-center">
        
        <div className="flex justify-center">
                {plan && (isReady || (plan.scenes && plan.scenes.some((s) => !!s.imageUrl))) ? (
                  isCarousel ? (
                    /* Carousel Preview - Grid of Slides */
                    <div className="w-full max-w-[350px] max-h-[500px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#232948] shadow-xl">
                      <div className="p-3 space-y-3">
                        {(plan.scenes || []).map((scene, i) => {
                          // Resolve storage path via proxy (handles Firebase Storage access)
                          const imageUrl = scene.imageUrl?.startsWith("http") || scene.imageUrl?.startsWith("data:")
                            ? scene.imageUrl
                            : scene.imageUrl
                              ? `/api/proxy-image?path=${encodeURIComponent(scene.imageUrl)}`
                              : undefined;

                          // Debug logging for image issues
                          if (!scene.imageUrl) {
                            console.log(`[Scene ${i}] No imageUrl - generation may still be in progress`);
                          } else if (!scene.imageUrl.startsWith("http") && !scene.imageUrl.startsWith("data:")) {
                            console.log(`[Scene ${i}] Storage path: ${scene.imageUrl} → proxy`);
                          }

                          return (
                            <div key={i} className="bg-white dark:bg-[#101322] rounded-xl overflow-hidden border border-slate-100 dark:border-white/5 hover:shadow-lg transition-shadow">
                              {/* Slide Image */}
                              <div className="aspect-square relative bg-slate-100 dark:bg-[#0d101b]">
                                {scene.imageUrl && imageUrl ? (
                                  <RetryingImage
                                    src={imageUrl}
                                    alt={`Slide ${i + 1}`}
                                    className="w-full h-full object-cover"
                                    slideNumber={i + 1}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <span className="material-symbols-outlined text-4xl">image</span>
                                  </div>
                                )}
                                {/* Slide Number Badge */}
                                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-lg text-xs font-black">
                                  {i + 1}/{(plan.scenes || []).length}
                                </div>
                              </div>

                              {/* Slide Text */}
                              {scene.voiceover && (
                                <div className="p-3 space-y-2">
                                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                    {scene.voiceover}
                                  </p>

                                  {/* Caption Action Buttons */}
                                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                    <button
                                      onClick={() => handleCopyCaption(scene.voiceover || "", i + 1)}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50/5 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-[10px] font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-xs">content_copy</span>
                                      Copy Full
                                    </button>

                                    <button
                                      onClick={() => handleGenerateSocialCaption(scene.voiceover || "", i)}
                                      disabled={generatingCaptionFor === i}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-bold hover:from-red-700 hover:to-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {generatingCaptionFor === i ? (
                                        <>
                                          <span className="animate-spin material-symbols-outlined text-xs">refresh</span>
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <span className="material-symbols-outlined text-xs">auto_awesome</span>
                                          Social
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {/* Generated Social Caption */}
                                  {socialCaptions[i] && (
                                    <div className="p-2 rounded-lg bg-white/5 border border-red-500/20">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-red-500">
                                          ✨ Social Caption
                                        </span>
                                        <button
                                          onClick={() => handleCopyCaption(socialCaptions[i], i + 1)}
                                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-sm">content_copy</span>
                                        </button>
                                      </div>
                                      <p className="text-xs font-medium text-white">
                                        {socialCaptions[i]}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Progress Overlay for Incomplete Carousels */}
                      {!isReady && (
                        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white dark:from-[#191e33] to-transparent p-4 text-center">
                          <p className="text-sm font-bold text-slate-700 dark:text-white mb-1">{Math.round(visualProgress)}%</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                            {statusText}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerVisualsManually();
                            }}
                            disabled={isManuallyTriggering}
                            className="mt-2 text-[10px] text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest font-bold underline cursor-pointer"
                          >
                            {isManuallyTriggering ? "Restarting..." : "Stuck? Tap to Restart"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Video Preview - Standard Player */
                    <div className="relative w-full max-w-[300px] aspect-[9/16] shadow-2xl rounded-2xl overflow-hidden border border-slate-800">
                      <VideoPreview plan={plan} />
                      {!isReady && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full px-4 z-[100]">
                            <p className="text-xl font-bold text-white mb-2">{Math.round(visualProgress)}%</p>
                            <p className="text-[10px] text-white/70 uppercase tracking-widest font-black leading-tight max-w-[120px] mx-auto">
                              {statusText}
                            </p>
                            <div className="flex flex-col items-center gap-2">
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      triggerVisualsManually();
                                  }}
                                  disabled={isManuallyTriggering}
                                  className="mt-4 text-[9px] text-white/40 hover:text-white/80 transition-colors uppercase tracking-widest font-bold underline cursor-pointer"
                              >
                                  {isManuallyTriggering ? "Restarting..." : "Stuck? Tap to Restart"}
                              </button>
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      deepRestart();
                                  }}
                                  disabled={isManuallyTriggering}
                                  className="text-[9px] text-red-500/40 hover:text-red-500/80 transition-colors uppercase tracking-widest font-bold underline cursor-pointer"
                              >
                                  Deep Restart (Wipe & Retry)
                              </button>
                            </div>
                          </div>
                      )}
                    </div>
                  )
            ) : (
                 <div className="bg-black p-10 rounded-[2.45rem] flex flex-col h-full items-center justify-center bg-slate-100 dark:bg-[#101322] rounded-xl relative overflow-hidden shadow-inner border border-slate-200 dark:border-[#232948]">
                      <div className="relative z-10 flex flex-col items-center gap-4 p-4 text-center">
                        <div className="relative h-16 w-16">
                            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-[#232948]"></div>
                        </div>
                        <div className="text-2xl font-bold text-red-600">{Math.round(visualProgress)}%</div>
                        <p className="text-[10px] dark:text-white/60 uppercase tracking-widest font-black">{statusText}</p>
                        <button 
                              onClick={triggerVisualsManually}
                              disabled={isManuallyTriggering}
                              className="mt-2 text-[10px] text-red-500 hover:text-red-700 font-bold uppercase underline"
                          >
                              {isManuallyTriggering ? "Restarting..." : "Stuck? Restart"}
                        </button>
                      </div>
                 </div>
            )}
        </div>

        <div className="flex flex-col gap-6 text-left">
             <div className="animate-in slide-in-from-bottom-4 duration-500">
               {plan && <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">{plan.type} PROJECT</h3>}
               <h2 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight text-slate-900 dark:text-white">
                 {plan?.title || "Creating your masterpiece..."}
               </h2>
                <div className="flex items-center gap-3 text-lg font-medium text-red-600">
                   {!isReady && <span className="h-2 w-2 rounded-full bg-red-600 animate-ping"></span>}
                  <span>{statusText}</span>
               </div>
               
               {!isReady && (
                   <div className="mt-6 p-4 bg-slate-50 dark:bg-[#101322] rounded-xl border border-slate-100 dark:border-[#232948]">
                       <div className="flex justify-between text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">
                           <span>Generation Progress</span>
                           <span>{Math.round(visualProgress)}%</span>
                       </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-[#232948] rounded-full overflow-hidden mb-2">
                            <div
                                 className="h-full bg-gradient-to-r from-red-600 to-orange-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(220,38,38,0.5)]" 
                                 style={{ width: `${visualProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-slate-400 italic text-center">
                            {plan?.scenes && plan.scenes[Math.floor((visualProgress / 100) * plan.scenes.length)]?.visualPrompt 
                                ? `"${plan.scenes[Math.floor((visualProgress / 100) * plan.scenes.length)].visualPrompt.substring(0, 60)}..."` 
                                : "Designing scenes..."}
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-emerald-500/80 font-bold">
                            <span className="material-symbols-outlined text-xs">cloud_done</span>
                            Safe to leave — generation continues in the background
                        </div>
                   </div>
               )}
             </div>

             {isReady && (
                 <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                    <button
                        onClick={async () => {
                            if (type === 'book') {
                                toast.info("Preparing your PDF Magazine...");
                                // Trigger PDF generation API
                                window.open(`/api/video-plans/${planId}/pdf`, '_blank');
                            } else {
                                handleDownload();
                            }
                        }}
                        disabled={isDownloading}
                        className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDownloading ? <span className="animate-spin material-symbols-outlined">refresh</span> : <span className="material-symbols-outlined">{type === 'book' ? 'picture_as_pdf' : 'download'}</span>}
                        {isDownloading ? "Generating..." : (type === 'book' ? "Download Magazine (PDF)" : isCarousel ? "Download Carousel Images (ZIP)" : (plan?.scenes[0].audioUrl ? "Download Video (MP4)" : "Download Assets (ZIP)"))}
                    </button>

                    {type === 'book' && (
                        <button
                            onClick={async () => {
                                if (!plan) return;
                                toast.info("Converting Magazine to Video Video...");
                                try {
                                    setIsDownloading(true);
                                    // Trigger video compilation from book
                                    const res = await fetch(`/api/video-plans/${planId}/convert-to-video`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${refreshToken}` }
                                    });
                                    if (res.ok) {
                                        const { newPlanId } = await res.json();
                                        router.push(`/success?type=video&planId=${newPlanId}`);
                                        toast.success("Magazine compiled to Video!");
                                    } else {
                                        throw new Error("Conversion failed");
                                    }
                                } catch (e) {
                                    toast.error("Conversion failed");
                                } finally {
                                    setIsDownloading(false);
                                }
                            }}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">movie</span>
                            Compile to Video
                        </button>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Link 
                            href={episode?.seriesId ? `/series/${episode.seriesId}` : (plan?.narrative?.[0]?.id ? `/narrative/${plan.narrative[0].id}/drafts?planId=${plan.id}` : "/dashboard")}
                            className="h-12 border border-slate-200 dark:border-[#232948] hover:bg-slate-50 dark:hover:bg-[#232948] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">{episode?.seriesId ? 'movie_filter' : 'dashboard'}</span>
                            {episode?.seriesId ? 'Series Generation' : 'Dashboard'}
                        </Link>
                         <Link 
                            href={plan?.narrative?.[0]?.id ? `/narrative/${plan.narrative[0].id}/drafts?tool=generate` : "/generate"}
                            className="h-12 bg-slate-100 dark:bg-[#232948] hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">add_circle</span>
                            New
                        </Link>
                    </div>

                    <button 
                        onClick={handleShare}
                        className="w-full h-10 text-sm text-slate-500 hover:text-red-600 transition-colors flex items-center justify-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">share</span> Share Link
                    </button>

                    {/* Guest upgrade prompt */}
                    {user?.isGuest && (
                      <button
                        onClick={() => setSecureAccountOpen(true)}
                        className="w-full p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-left hover:border-amber-500/40 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-amber-400 text-xl">shield_person</span>
                          <div>
                            <p className="text-sm font-bold text-white">Secure Your Account</p>
                            <p className="text-[10px] text-amber-200/70">Add an email to keep your projects safe and accessible from any device.</p>
                          </div>
                          <span className="material-symbols-outlined text-amber-400/50 group-hover:text-amber-400 transition-colors ml-auto">chevron_right</span>
                        </div>
                      </button>
                    )}
                 </div>
             )}
        </div>

      </div>
      </div>

      <SecureAccountDialog
        isOpen={secureAccountOpen}
        onClose={() => setSecureAccountOpen(false)}
      />
    </div>
  );
}
