"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import type { VideoPlan, Scene, ContentStatus } from "@/lib/types";
import { downloadPlanAssets } from "@/lib/download-utils";

import { Header } from "@/components/Header";
import { AuthScreen } from "@/components/screens/AuthScreen";
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
  const { user, refreshToken, isLoading: isAuthLoading } = useAuth();
  const type = searchParams.get("type") || "video";
  const planId = searchParams.get("planId");
  const isCarousel = type === "carousel";

  const { width, height } = useWindowSize();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isManuallyTriggering, setIsManuallyTriggering] = useState(false);
  
  // Ref Flags to prevent double-firing
  const imageGenerationStarted = useRef(false);
  const audioGenerationStarted = useRef(false);
  const videoPollingStarted = useRef(false);
  const renderStarted = useRef(false);
  const thumbnailRef = useRef(false); // Prevent thumbnail retry loop


  // UI State
  const [isReady, setIsReady] = useState(false);
  const [statusText, setStatusText] = useState("Initializing...");
  const [visualProgress, setVisualProgress] = useState(0);

  // Caption state for carousels
  const [socialCaptions, setSocialCaptions] = useState<Record<number, string>>({});
  const [generatingCaptionFor, setGeneratingCaptionFor] = useState<number | null>(null);
  
  // Data Fetching
  const successPlanQuery = useMemo(
    () => planId ? { videoPlans: { $: { where: { id: planId } }, narrative: {} } } : null,
    [planId]
  );
  const { data } = db.useQuery(successPlanQuery);
  const plan = (data && 'videoPlans' in data ? data.videoPlans?.[0] : undefined) as VideoPlan & { narrative?: { id: string }[] } | undefined;

  // Manual Trigger Function (can be called from UI)
  const triggerVisualsManually = () => {
    if (!plan || imageGenerationStarted.current) return;
    
    setIsManuallyTriggering(true);
    imageGenerationStarted.current = true;
    console.log("🛠️ Manual visual generation triggered");
    
    fetch("/api/generate-visuals", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${refreshToken}`
        },
        body: JSON.stringify({ planId: plan.id })
    })
    .then(res => {
        console.log("✅ Manual trigger response:", res.status);
        toast.success("Restarted visual generation!");
    })
    .catch(err => {
        console.error("❌ Manual trigger failed:", err);
        toast.error("Failed to restart generation");
    })
    .finally(() => {
        imageGenerationStarted.current = false;
        setIsManuallyTriggering(false);
    });
  };

  const deepRestart = async () => {
    if (!plan) return;
    if (!confirm("This will delete all generated images and start fresh. Continue?")) return;

    try {
        setIsManuallyTriggering(true);
        console.log("🔥 Deep restart initiated for plan:", plan.id);
        
        const resetScenes = plan.scenes.map((s: Scene) => ({
            ...s,
            imageUrl: null,
            videoClipUrl: null,
            operationId: null
        }));

        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        await (db as DbWithTransact).transact([
            tx.videoPlans[plan.id!].update({ 
                status: 'pending',
                scenes: resetScenes,
                thumbnailUrl: null
            })
        ]);

        toast.success("Project reset! Starting fresh...");
        imageGenerationStarted.current = false;
        audioGenerationStarted.current = false;
        renderStarted.current = false;

    } catch (err) {
        console.error("❌ Deep restart failed:", err);
        toast.error("Reset failed");
    } finally {
        setIsManuallyTriggering(false);
    }
  };

  // 1. Trigger Generation (Serve-Side)
  useEffect(() => {
    if (!plan) return;

    // If completed, just mark ready
    if (plan.status === 'completed') {
      setIsReady(true);
      setVisualProgress(100);
      return;
    }

    const visualMode = plan.visualMode || "image";

    // Trigger Visuals - Images or B-Roll
    const missingVisuals = visualMode === "broll"
      ? plan.scenes.some((s: Scene) => !s.videoClipUrl && !s.operationId)
      : plan.scenes.some((s: Scene) => !s.imageUrl);
    
    const canTrigger = !plan.status || plan.status === 'pending' || plan.status === 'draft' || plan.status === 'generating';

    console.log("🔍 [SuccessScreen] Orchestration DEBUG:", {
        planId: plan.id,
        status: plan.status,
        visualMode,
        missingVisuals,
        canTrigger,
        imageGenStarted: imageGenerationStarted.current,
        totalScenes: plan.scenes?.length,
        visualsDone: visualMode === "broll" 
            ? plan.scenes?.filter((s: any) => s.videoClipUrl).length 
            : plan.scenes?.filter((s: any) => s.imageUrl).length
    });

    if (missingVisuals && canTrigger && !imageGenerationStarted.current) {
        imageGenerationStarted.current = true;
        console.log(`🚀 [SuccessScreen] Triggering ${visualMode} generation...`);
        
        if (plan.status !== 'generating') {
            type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
            (db as DbWithTransact).transact([tx.videoPlans[plan.id!].update({ status: 'generating' })]);
        }

        fetch("/api/generate-visuals", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${refreshToken}`
            },
            body: JSON.stringify({ planId: plan.id })
        }).then(res => {
            console.log("✅ [SuccessScreen] Visual generation API responded:", res.status);
        }).catch(err => {
            console.error("❌ [SuccessScreen] Visual generation failed:", err);
        }).finally(() => {
            imageGenerationStarted.current = false;
        });
    }

    // Poll B-Roll Operations if needed
    if (visualMode === "broll" && !videoPollingStarted.current) {
        const hasOperations = plan.scenes.some((s: Scene) => !!s.operationId);
        if (hasOperations) {
            videoPollingStarted.current = true;
            console.log("Starting B-roll polling...");

            const pollInterval = setInterval(() => {
                fetch("/api/poll-video-clips", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${refreshToken}`
                    },
                    body: JSON.stringify({ planId: plan.id })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.allComplete) {
                        console.log("All B-roll clips ready");
                        clearInterval(pollInterval);
                        videoPollingStarted.current = false;
                    }
                })
                .catch(err => console.error("Polling failed:", err));
            }, 10000); // Poll every 10 seconds

            // Cleanup
            return () => clearInterval(pollInterval);
        }
    }

    // Trigger Audio - only after first visual is ready
    const firstVisualExists = visualMode === "broll"
      ? !!plan.scenes[0]?.videoClipUrl
      : !!plan.scenes[0]?.imageUrl;
    const firstAudioMissing = !plan.scenes[0]?.audioUrl;

    // CRITICAL FIX: Generate audio even if status is 'completed' but audio is missing
    // This handles cases where audio generation failed silently
    if (!audioGenerationStarted.current && firstVisualExists && firstAudioMissing && !isCarousel) {
        audioGenerationStarted.current = true;
        console.log("Triggering audio generation (missing audio detected)...");
        fetch("/api/generate-audio", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${refreshToken}`
            },
            body: JSON.stringify({ planId: plan.id })
        })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            console.error("Audio generation failed:", data.error);
          } else {
            console.log("Audio generation successful:", data);
          }
          audioGenerationStarted.current = false;
        })
        .catch(err => {
          console.error("Audio trigger failed:", err);
          audioGenerationStarted.current = false;
        });
    }

    // Trigger Thumbnail - only if missing and not failed yet
    if (plan.thumbnailUrl && thumbnailRef.current) {
        console.log("✅ Thumbnail already exists, resetting ref flag");
        thumbnailRef.current = false;
    }

    if (plan.thumbnailPrompt && !plan.thumbnailUrl && !thumbnailRef.current) {
        console.log("Thumbnail generation requested for plan:", plan.id);
        thumbnailRef.current = true;
        fetch("/api/generate-thumbnail", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${refreshToken}`
            },
            body: JSON.stringify({ planId: plan.id })
        })
        .then(res => {
          if (res.ok) {
            console.log("✅ Thumbnail generated successfully");
          } else if (res.status === 503) {
            console.warn("⚠️ Thumbnail service unavailable, skipping retries");
          } else {
            console.error("Thumbnail generation failed:", res.status);
          }
        })
        .catch(err => console.error("Thumbnail trigger failed:", err));
    }
  }, [plan, isCarousel]);

  // 2. Poll Status & Update Progress UI + Orchestrate Remaining Steps
  useEffect(() => {
    if (!plan) return;

    const visualMode = plan.visualMode || "image";
    const scenes = (plan.scenes || []) as Scene[];
    const totalScenes = scenes.length;
    
    // Count completed assets
    const visualsDone = visualMode === "broll"
      ? scenes.filter((s: Scene) => !!s.videoClipUrl).length
      : scenes.filter((s: Scene) => !!s.imageUrl).length;
    
    const audioDone = scenes.filter((s: Scene) => !!s.audioUrl).length;
    const allVisualsDone = visualsDone === totalScenes;
    const allAudioDone = audioDone === totalScenes;
    const allAssetsDone = isCarousel ? allVisualsDone : (allVisualsDone && allAudioDone);
    
    // Status Text Logic
    let text = "Initializing...";
    let target = 5;

    if (plan.status === 'generating' || plan.status === 'pending') {
         text = visualMode === "broll" ? "Starting AI Video Generation..." : "Starting AI Engines...";
         target = 10;
    }

    if (plan.thumbnailPrompt && !plan.thumbnailUrl) {
         text = "Designing Viral Thumbnail...";
         target = 15;
    } else if (plan.thumbnailUrl) {
         target = 20;
    }

    if (totalScenes > 0) {
        if (!allVisualsDone) {
            if (visualMode === "broll") {
                text = `Generating B-Roll Clip ${visualsDone + 1} of ${totalScenes}... (⏱ This may take several minutes)`;
            } else {
                text = `Designing Scene ${visualsDone + 1} of ${totalScenes}...`;
            }
            target = 20 + ((visualsDone / totalScenes) * 40); // 20% -> 60%
        } else if (!isCarousel && !allAudioDone) {
             text = `Synthesizing Voiceover (${audioDone}/${totalScenes})...`;
             target = 60 + ((audioDone / totalScenes) * 25); // 60% -> 85%
        } else if (allAssetsDone && !plan.videoUrl && !isCarousel) {
             text = "Rendering Final MP4...";
             target = 90;
        } else if (allAssetsDone) {
             text = "Finalizing Assets...";
             target = 98;
        }
    }

    // **ORCHESTRATION LOGIC** - Trigger next steps automatically
    
    // Step 1: If visuals done and audio missing, trigger audio (non-carousel only)
    if (allVisualsDone && !allAudioDone && !isCarousel && !audioGenerationStarted.current) {
        audioGenerationStarted.current = true;
        console.log("🎙️ Visuals complete - triggering audio generation...");
        console.log("🎙️ Debug - allVisualsDone:", allVisualsDone, "allAudioDone:", allAudioDone, "visualsDone:", visualsDone, "audioDone:", audioDone, "totalScenes:", totalScenes);
        
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        (db as DbWithTransact).transact([tx.videoPlans[plan.id!].update({ status: 'generating_audio' })]);
        
        fetch("/api/generate-audio", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${refreshToken}`
            },
            body: JSON.stringify({ planId: plan.id })
        })
        .then(res => res.json())
        .then(data => {
          if (data.error) console.error("Audio generation failed:", data.error);
          else console.log("✅ Audio generation complete");
          audioGenerationStarted.current = false;
        })
        .catch(err => {
          console.error("Audio trigger failed:", err);
          audioGenerationStarted.current = false;
        });
    }

    // Step 2: If all assets done and video missing, trigger video render (non-carousel only)
    if (allAssetsDone && !plan.videoUrl && !isCarousel && !renderStarted.current) {
        renderStarted.current = true;
        console.log("🎬 Audio complete - triggering MP4 render...");
        
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        (db as DbWithTransact).transact([tx.videoPlans[plan.id!].update({ status: 'rendering_video' })]);
        
        const triggerRender = () => {
            fetch("/api/generate-video", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${refreshToken}`
                },
                body: JSON.stringify({ planId: plan.id, background: true })
            })
            .then(async (res) => {
                if (res.status === 425) {
                    console.log("⏳ Assets not ready (425), retrying render in 5s...");
                    setTimeout(triggerRender, 5000);
                    return;
                }
                if (!res.ok) {
                    const data = await res.json();
                    console.error("Background render failed:", data.error || res.statusText);
                } else {
                    console.log("✅ Render started successfully");
                }
            })
            .catch(err => console.error("Background render request failed:", err));
        };
        
        triggerRender();
    }

    // Step 3: If everything is done, mark completed
    const fullyComplete = isCarousel 
      ? allVisualsDone 
      : (allAssetsDone && !!plan.videoUrl);
    
    if (fullyComplete && plan.status !== 'completed') {
        console.log("✅ ALL STEPS COMPLETE - marking as completed");
        setIsReady(true);
        text = "Ready to Viral! 🚀";
        target = 100;
        
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        (db as DbWithTransact).transact([tx.videoPlans[plan.id!].update({ status: 'completed' })]);
    }

    if (plan.status === 'completed') {
        text = "Ready to Viral! 🚀";
        target = 100;
        if (!isReady) setIsReady(true);
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
  }, [plan, isReady, isCarousel, statusText]);

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
      await downloadPlanAssets(plan, carouselRef.current);
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
      
      {plan && <CarouselRenderer ref={carouselRef} plan={plan} />}

      <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl rounded-2xl border border-white/5 p-8 shadow-xl text-center z-10 grid md:grid-cols-2 gap-8 items-center">
        
        <div className="flex justify-center">
                {plan && (isReady || (plan.scenes && plan.scenes.some((s) => !!s.imageUrl))) ? (
                  isCarousel ? (
                    /* Carousel Preview - Grid of Slides */
                    <div className="w-full max-w-[350px] max-h-[500px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#232948] shadow-xl">
                      <div className="p-3 space-y-3">
                        {plan.scenes.map((scene, i) => {
                          // Construct InstantDB CDN URL directly (avoids permission issues with SDK method)
                          const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";
                          const imageUrl = scene.imageUrl?.startsWith("http") || scene.imageUrl?.startsWith("data:")
                            ? scene.imageUrl
                            : `https://api.instantdb.com/runtime/storage/${APP_ID}/${scene.imageUrl}`;

                          // Debug logging for image issues
                          if (!scene.imageUrl) {
                            console.log(`[Scene ${i}] No imageUrl - generation may still be in progress`);
                          } else if (!scene.imageUrl.startsWith("http") && !scene.imageUrl.startsWith("data:")) {
                            console.log(`[Scene ${i}] InstantDB path: ${scene.imageUrl} → ${imageUrl}`);
                          }

                          return (
                            <div key={i} className="bg-white dark:bg-[#101322] rounded-xl overflow-hidden border border-slate-100 dark:border-white/5 hover:shadow-lg transition-shadow">
                              {/* Slide Image */}
                              <div className="aspect-square relative bg-slate-100 dark:bg-[#0d101b]">
                                {scene.imageUrl ? (
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
                                  {i + 1}/{plan.scenes.length}
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
                            <div                                  className="h-full bg-gradient-to-r from-red-600 to-orange-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(220,38,38,0.5)]" 
                                 style={{ width: `${visualProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-slate-400 italic text-center">
                            {plan?.scenes && plan.scenes[Math.floor((visualProgress / 100) * plan.scenes.length)]?.visualPrompt 
                                ? `"${plan.scenes[Math.floor((visualProgress / 100) * plan.scenes.length)].visualPrompt.substring(0, 60)}..."` 
                                : "Designing scenes..."}
                        </p>
                   </div>
               )}
             </div>

             {isReady && (
                 <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDownloading ? <span className="animate-spin material-symbols-outlined">refresh</span> : <span className="material-symbols-outlined">download</span>}
                        {isDownloading ? "Generating..." : (isCarousel ? "Download Carousel Images (ZIP)" : (plan?.scenes[0].audioUrl ? "Download Video (MP4)" : "Download Assets (ZIP)"))}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <Link 
                            href={plan?.narrative?.[0]?.id ? `/narrative/${plan.narrative[0].id}/drafts?planId=${plan.id}` : "/dashboard"}
                            className="h-12 border border-slate-200 dark:border-[#232948] hover:bg-slate-50 dark:hover:bg-[#232948] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">dashboard</span>
                            Dashboard
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
                 </div>
             )}
        </div>

      </div>
      </div>
    </div>
  );
}
