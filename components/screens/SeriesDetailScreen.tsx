"use client";

import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { tx } from "@/lib/firebase-tx";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { ProductionOverlay, type EpisodeProgress } from "@/components/series/ProductionOverlay";
import { MediaResultPreview } from "@/components/media/MediaResultPreview";
import type { Series, Episode, SeriesWithEpisodes, VideoPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { PlusCircle, Play, Film, MessageSquare, AlertCircle, ChevronRight, LayoutDashboard, Brain, Sparkles, Settings2, Download, ExternalLink } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useGenerateStore } from "@/hooks/use-generate-store";
import { toast } from "sonner";

interface SeriesDetailScreenProps {
  seriesId: string;
}

export function SeriesDetailScreen({ seriesId }: SeriesDetailScreenProps) {
  const { user, refreshToken, getFreshToken, isInitialLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlEpisodeId = searchParams.get("episodeId");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(urlEpisodeId);
  const [isEditingVisuals, setIsEditingVisuals] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const openGenerator = useGenerateStore(state => state.openGenerator);

  // Sync with URL
  useEffect(() => {
    if (urlEpisodeId) {
      setSelectedEpisodeId(urlEpisodeId);
    }
  }, [urlEpisodeId]);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, EpisodeProgress>>({});
  const [showProductionOverlay, setShowProductionOverlay] = useState(true);
  // Track which episodes have had visuals/audio/render triggered to avoid duplicate calls
  const triggeredVisuals = useRef<Set<string>>(new Set());
  const triggeredAudio = useRef<Set<string>>(new Set());
  const triggeredRender = useRef<Set<string>>(new Set());

  const seriesQuery = useMemo(
    () => ({ 
      series: { $: { where: { id: seriesId } } },
      episodesNew: { $: { collection: 'episodes', where: { seriesId: seriesId } } },
      episodesOld: { $: { collection: 'episodes', where: { series: seriesId } } },
      ...(selectedEpisodeId ? {
        selectedEpisode: { $: { collection: 'episodes', where: { id: selectedEpisodeId } } }
      } : {})
    }),
    [seriesId, selectedEpisodeId]
  );
  const { data, isLoading: isSeriesLoading } = db.useQuery(seriesQuery);

  // Separate query for the focused plan to avoid bloat in the main series query if needed
  // But for now, let's just fetch it when selected.
  const episodeForPlan = (data as any)?.selectedEpisode?.[0];
  const selectedPlanId = episodeForPlan?.videoPlanId;
  
  const planQuery = useMemo(
    () => selectedPlanId ? { 
      videoPlans: { $: { where: { id: selectedPlanId } } } 
    } : null,
    [selectedPlanId]
  );
  const { data: planData, isLoading: isPlanLoading } = db.useQuery(planQuery);
  const selectedPlan = (planData && 'videoPlans' in planData ? planData.videoPlans?.[0] : undefined) as VideoPlan | undefined;

  const seriesData = useMemo(() => {
    if (!data || !('series' in data)) return null;
    const series = data.series?.[0];
    if (!series) return null;

    const episodesNew = (data as any).episodesNew || [];
    const episodesOld = (data as any).episodesOld || [];
    
    // Merge episodes and deduplicate by ID
    const episodesMap = new Map();
    [...episodesOld, ...episodesNew].forEach(ep => {
      episodesMap.set(ep.id, ep);
    });
    
    const episodes = Array.from(episodesMap.values());
    
    return { ...series, episodes } as SeriesWithEpisodes;
  }, [data]);

  // Orchestration Effect: Drives the production state machine for episodes
  // Limit concurrent Remotion renders to 1
  const activeRenders = useRef(0);
  const episodeProgressRef = useRef(episodeProgress);
  episodeProgressRef.current = episodeProgress;
  const orchestratingRef = useRef(false);
  const seriesDataRef = useRef(seriesData);
  seriesDataRef.current = seriesData;

  useEffect(() => {
    if (!user || !seriesId) return;

    const getGeneratingEpisodes = () => (seriesDataRef.current?.episodes || []).filter(e => e.status === 'generating' && e.videoPlanId);
    
    if (getGeneratingEpisodes().length === 0) return;

    const orchestrate = async () => {
      if (orchestratingRef.current) return;
      orchestratingRef.current = true;
      const token = (await getFreshToken?.()) ?? refreshToken ?? null;
      if (!token) {
        orchestratingRef.current = false;
        return;
      }
      const generatingEpisodes = getGeneratingEpisodes();
      if (generatingEpisodes.length === 0) return;

      try {
        for (const episode of generatingEpisodes) {
          if (!episode.id || !episode.videoPlanId) continue;
          try {
            const planRes = await fetch(`/api/video-plans/${episode.videoPlanId}`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (!planRes.ok) continue;
            const { plan } = await planRes.json();
            if (!plan) continue;

            // If the underlying VideoPlan has already failed (for example because
            // /api/generate-video returned a 500), surface that failure at the
            // episode level and stop trying to orchestrate further work.
            if (plan.status === "failed") {
              console.warn(
                "[Orchestration] Plan is in failed status, marking episode failed:",
                episode.id,
              );
              triggeredVisuals.current.delete(episode.id);
              triggeredAudio.current.delete(episode.id);
              triggeredRender.current.delete(episode.id);
              if (episode.status !== "failed") {
                await tx.episodes[episode.id].update({
                  status: "failed",
                  updatedAt: Date.now(),
                });
              }
              continue;
            }

            const totalScenes = plan.scenes.length;
            const visualsDone = plan.scenes.filter((s: any) => {
              if (!!s.imageUrl || !!s.videoClipUrl) return true;
              if (s.subScenes && s.subScenes.length > 0) {
                return s.subScenes.every((sub: any) => !!sub.imageUrl);
              }
              return false;
            }).length;
            const audioDone = plan.scenes.filter((s: any) => !!s.audioUrl).length;
            const allVisualsDone = visualsDone === totalScenes;
            const allAudioDone = audioDone === totalScenes;
            const allAssetsDone = allVisualsDone && allAudioDone;

            let phase: EpisodeProgress['phase'] = 'visuals';
            if (allVisualsDone && !allAudioDone) phase = 'audio';
            else if (allAssetsDone && !plan.videoUrl) phase = 'rendering';
            else if (allAssetsDone && plan.videoUrl) phase = 'complete';

            setEpisodeProgress(prev => ({
              ...prev,
              [episode.id]: {
                episodeId: episode.id,
                title: episode.title,
                episodeNumber: episode.episodeNumber,
                phase,
                visualsDone,
                audioDone,
                totalScenes,
              }
            }));

            if (!allVisualsDone) {
              const hasPendingOps = plan.scenes.some((s: any) => s.operationId && !s.videoClipUrl && !s.imageUrl);
              if (hasPendingOps) {
                await fetch("/api/poll-video-clips", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                  body: JSON.stringify({ planId: plan.id })
                });
              } else if (!triggeredVisuals.current.has(episode.id)) {
                triggeredVisuals.current.add(episode.id);
                console.log(`[Orchestration] Triggering visual generation for episode ${episode.episodeNumber}...`);
                fetch("/api/generate-visuals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                  body: JSON.stringify({ planId: plan.id })
                }).then(res => {
                  if (!res.ok && res.status !== 409) triggeredVisuals.current.delete(episode.id);
                }).catch(() => triggeredVisuals.current.delete(episode.id));
              }
              continue;
            }

            if (allVisualsDone && !allAudioDone) {
               if (!triggeredAudio.current.has(episode.id)) {
                 triggeredAudio.current.add(episode.id);
                 console.log(`[Orchestration] Visuals ready for episode ${episode.episodeNumber}, triggering audio...`);
                 const audioRes = await fetch("/api/generate-audio", {
                   method: "POST",
                   headers: { "Content-Type": "application/json", "Authorization": `Bearer ${refreshToken}` },
                   body: JSON.stringify({ planId: plan.id })
                 });
                 
                 if (audioRes.status === 429) {
                   console.warn(`[Orchestration] Rate limit hit for episode ${episode.episodeNumber}, marking failed.`);
                   triggeredAudio.current.delete(episode.id);
                   await tx.episodes[episode.id].update({ 
                     status: 'failed',
                     updatedAt: Date.now()
                   });
                   continue;
                 }
               }
               continue;
            }

            if (allAssetsDone && !plan.videoUrl) {
              if (activeRenders.current > 0) {
                continue;
              }
              if (!triggeredRender.current.has(episode.id)) {
                triggeredRender.current.add(episode.id);
                activeRenders.current++;
                console.log(
                  `[Orchestration] Assets ready for episode ${episode.episodeNumber}, triggering render...`,
                );
                const renderRes = await fetch("/api/generate-video", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ planId: plan.id, background: true }),
                });
                activeRenders.current--;
                if (renderRes.status === 409) {
                  console.log(`[Orchestration] Render already in progress for episode ${episode.episodeNumber}, skipping.`);
                  continue;
                }
                if (renderRes.status === 429) {
                  triggeredRender.current.delete(episode.id);
                  await tx.episodes[episode.id].update({ 
                    status: 'failed',
                    updatedAt: Date.now()
                  });
                  continue;
                }
                if (!renderRes.ok) {
                  console.warn(
                    `[Orchestration] Render failed for episode ${episode.episodeNumber} with status ${renderRes.status}, marking failed.`,
                  );
                  triggeredRender.current.delete(episode.id);
                  await tx.episodes[episode.id].update({
                    status: "failed",
                    updatedAt: Date.now(),
                  });
                  continue;
                }
              }
              continue;
            }

            if (allAssetsDone && !!plan.videoUrl && episode.status !== 'complete') {
               console.log(`[Orchestration] Episode ${episode.episodeNumber} fully rendered, marking complete!`);
               triggeredVisuals.current.delete(episode.id);
               triggeredAudio.current.delete(episode.id);
               triggeredRender.current.delete(episode.id);
               const completeData: Record<string, unknown> = {
                 status: 'complete',
                 videoUrl: plan.videoUrl,
                 duration: plan.duration,
                 updatedAt: Date.now()
               };
               if (plan.thumbnailUrl != null) completeData.thumbnailUrl = plan.thumbnailUrl;
               await tx.episodes[episode.id].update(completeData);
            }
          } catch (err) {
            console.error("[Orchestration] Failed for episode:", episode.id, err);
          }
        }
      } finally {
        orchestratingRef.current = false;
      }
    };

    // Adaptive polling: use a ref to read episodeProgress without causing
    // the effect to re-run (which would create a feedback loop)
    const getInterval = () => {
      const prog = episodeProgressRef.current;
      const generatingEpisodes = getGeneratingEpisodes();
      const allInRenderOrComplete = generatingEpisodes.every(e => {
        const p = prog[e.id];
        return p?.phase === 'rendering' || p?.phase === 'complete';
      });
      return allInRenderOrComplete ? 15000 : 5000;
    };

    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      timer = setTimeout(() => {
        orchestrate().then(scheduleNext);
      }, getInterval());
    };

    orchestrate().then(scheduleNext);

    return () => clearTimeout(timer);
  }, [user?.id, seriesId, !!seriesData?.episodes?.some(e => e.status === 'generating')]);

  const handleEditScript = (episode: Episode) => {
    // TODO: Implement script editing modal
    console.log("Edit script for episode:", episode.id);
  };

  const handleGenerateVideo = async (episode: Episode) => {
    const token = (await getFreshToken?.()) ?? refreshToken ?? null;
    if (!token) return;
    
    try {
      // Step 1: Compile episode structure into a renderable VideoPlan
      const compileRes = await fetch("/api/episodes/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ episodeId: episode.id })
      });
      
      const compileData = await compileRes.json();
      if (!compileData.success) throw new Error(compileData.error || "Failed to compile episode");
      
      const { planId } = compileData;
      
      // Step 2: Trigger the background visual generation engine
      if (!triggeredVisuals.current.has(episode.id)) {
        triggeredVisuals.current.add(episode.id);
        fetch("/api/generate-visuals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ planId })
        }).catch(err => {
          console.error("[SeriesDetail] Async visual trigger failed:", err);
          triggeredVisuals.current.delete(episode.id);
        });
      }

    } catch (err: any) {
      console.error("[SeriesDetail] Video generation orchestration failed:", err);
    }
  };

  const handleDownloadSeries = async () => {
    if (!seriesData || isDownloading) return;
    
    const completedEpisodes = (seriesData.episodes || []).filter(ep => ep.status === 'complete' && ep.videoUrl);
    if (completedEpisodes.length === 0) {
      alert("No completed episodes ready for download yet.");
      return;
    }

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(seriesData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase());
      
      const downloadTasks = completedEpisodes.map(async (ep) => {
        try {
          const url = (ep.videoUrl!.startsWith('http') || ep.videoUrl!.startsWith('data:'))
            ? ep.videoUrl! 
            : `/api/proxy-image?path=${encodeURIComponent(ep.videoUrl!)}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const fileName = `episode_${ep.episodeNumber}_${ep.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
          folder?.file(fileName, blob);
        } catch (err) {
          console.error(`Failed to download episode ${ep.episodeNumber}:`, err);
          toast.error(`Failed to include Episode ${ep.episodeNumber} in the ZIP.`);
        }
      });

      await Promise.all(downloadTasks);
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${seriesData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_series.zip`);
      toast.success("Series ZIP ready!");
    } catch (err) {
      console.error("Failed to generate series ZIP:", err);
      toast.error("Failed to generate ZIP. Please check your connection.");
    } finally {
      setIsDownloading(false);
    }
  };
  
  const handleDownloadEpisode = async (episode: Episode) => {
    if (!episode.videoUrl) return;
    
    try {
      const url = (episode.videoUrl.startsWith('http') || episode.videoUrl.startsWith('data:'))
        ? episode.videoUrl 
        : `/api/proxy-image?path=${encodeURIComponent(episode.videoUrl)}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const fileName = `ep_${episode.episodeNumber}_${episode.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
      saveAs(blob, fileName);
      toast.success(`Downloading Episode ${episode.episodeNumber}...`);
    } catch (err) {
      console.error("Failed to download episode:", err);
      toast.error("Failed to download episode.");
    }
  };


  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101322] flex flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1337ec] border-t-transparent"></div>
        <p className="text-sm text-slate-500 animate-pulse">Checking your account...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (isSeriesLoading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101322] flex items-center justify-center flex-col gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1337ec] border-t-transparent"></div>
        <p className="text-sm text-slate-500 animate-pulse">Fetching your series details...</p>
      </div>
    );
  }


  if (!seriesData) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101322] flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">search_off</span>
        <h1 className="text-2xl font-black mb-2">Series Not Found</h1>
        <p className="text-slate-500 mb-8 max-w-md">We couldn't find the series you're looking for. It might have been deleted or the link is incorrect.</p>
        <Link href="/dashboard" className="h-12 px-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center transition-all hover:scale-105 active:scale-95">
          Back to Dashboard
        </Link>
      </div>
    );
  }



  const generatingEps = (seriesData.episodes || []).filter(e => e.status === 'generating' || e.status === 'failed');
  const activeEpisode = generatingEps[0] || null;

  const handleRetryEpisode = async (episode: Episode) => {
    triggeredAudio.current.delete(episode.id);
    triggeredRender.current.delete(episode.id);
    await tx.episodes[episode.id].update({ 
      status: 'draft',
      updatedAt: Date.now()
    });
    // Automatically re-trigger generation
    handleGenerateVideo(episode);
  };
  const sortedEpisodes = [...(seriesData.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const selectedEpisode = sortedEpisodes.find(e => e.id === selectedEpisodeId) || sortedEpisodes[0];
  
  // Calculate Progress
  const completedEpisodes = (seriesData.episodes || []).filter(e => e.status === 'complete').length;
  const progressPercent = Math.round((completedEpisodes / seriesData.episodeCount) * 100);

  return (
    <div className="min-h-full w-full bg-[#050505] font-sans text-white flex flex-col">
      {/* Production Overlay for generating or failed state */}
      {showProductionOverlay && (
        <ProductionOverlay 
          episodes={generatingEps}
          progress={episodeProgress}
          onRetry={(ep) => handleRetryEpisode(ep)}
          canDismiss={true}
          onDismiss={() => setShowProductionOverlay(false)}
        />
      )}
      
      {/* Director's Desk Layout */}
      <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden">
        
        {/* LEFT: Filmstrip/Episode List */}
        <div className="w-full md:w-[320px] lg:w-[380px] border-r border-white/5 bg-[#0a0a09] flex flex-col">
          <div className="p-6 border-b border-white/5 bg-[#0d0d0c]">
             <div className="flex items-center justify-between mb-2">
               <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Storyboard Beats</h2>
               <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                 {completedEpisodes}/{seriesData.episodeCount} Rendered
               </span>
             </div>
             <h1 className="text-xl font-black tracking-tighter truncate">{seriesData.title}</h1>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {sortedEpisodes.map((ep) => {
              const isActive = selectedEpisodeId === ep.id || (!selectedEpisodeId && ep.episodeNumber === 1);
              const progress = episodeProgress[ep.id];
              
              return (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEpisodeId(ep.id);
                    router.push(`/series/${seriesId}?episodeId=${ep.id}`, { scroll: false });
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all duration-300 group",
                    isActive 
                      ? "bg-white/5 border-amber-500/50 shadow-lg shadow-amber-500/5" 
                      : "bg-[#0d0d0c] border-white/5 hover:border-white/10 hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex gap-4 items-start">
                    <div className={cn(
                      "size-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 transition-colors",
                      isActive ? "bg-amber-500 text-black" : "bg-white/5 text-white/40 group-hover:bg-white/10"
                    )}>
                      {ep.episodeNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={cn(
                          "text-sm font-bold truncate transition-colors",
                          isActive ? "text-white" : "text-white/60 group-hover:text-white/90"
                        )}>
                          {ep.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "size-1.5 rounded-full",
                          ep.status === 'complete' ? "bg-emerald-500" : ep.status === 'generating' ? "bg-amber-500 animate-pulse" : "bg-white/20"
                        )} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30 truncate">
                          {ep.status === 'complete' ? 'Ready to Air' : ep.status === 'generating' ? 'In Production' : 'Script Prepared'}
                        </span>
                      </div>
                      
                      {ep.status === 'generating' && progress && (
                        <div className="mt-3 space-y-1.5">
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 transition-all duration-500"
                              style={{ width: `${(progress.visualsDone / progress.totalScenes) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-black uppercase text-amber-500/60">
                            {progress.phase} — {progress.visualsDone}/{progress.totalScenes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            
            {/* Global Actions - Moved inside scrollable area for better flow */}
            <div className="pt-6 pb-2 space-y-3">
               <button
                 disabled={progressPercent === 100}
                 onClick={() => sortedEpisodes.filter(e => e.status !== 'complete').forEach(handleGenerateVideo)}
                 className="w-full h-12 rounded-2xl bg-amber-500 text-black font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-amber-400 transition-all disabled:opacity-30 shadow-lg shadow-amber-500/10"
               >
                 <Sparkles className="size-4" />
                 Compile Remainder
               </button>
               
               <button
                 disabled={completedEpisodes === 0 || isDownloading}
                 onClick={handleDownloadSeries}
                 className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-30"
               >
                 <Download className={cn("size-4", isDownloading && "animate-bounce")} />
                 {isDownloading ? "Zipping..." : "Download Series"}
               </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Director's Monitor & Plan Details */}
        <div className="flex-1 bg-[#050505] flex flex-col overflow-hidden relative">
          
          {/* Top Bar for Selected Episode */}
          <div className="h-16 px-8 border-b border-white/5 flex items-center justify-between bg-[#080808]/50 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Film className="size-4" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest">
                Monitor: Episode {selectedEpisode?.episodeNumber}: {selectedEpisode?.title}
              </h2>
            </div>
            
            <div className="flex items-center gap-3">
              {selectedEpisode?.status !== 'complete' && selectedEpisode?.status !== 'generating' && (
                <button
                  onClick={() => handleGenerateVideo(selectedEpisode)}
                  className="h-9 px-5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Play className="size-3 fill-current" />
                  Render Master
                </button>
              )}
              {selectedEpisode?.status === 'complete' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadEpisode(selectedEpisode)}
                    className="h-9 w-9 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all"
                    title="Download MP4"
                  >
                    <Download className="size-4" />
                  </button>
                  <button
                    onClick={() => handleGenerateVideo(selectedEpisode)}
                    className="h-9 px-5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Fresh Cut
                  </button>
                </div>
              )}
              
              {seriesData.episodes?.some(e => e.status === 'generating' || e.status === 'failed') && !showProductionOverlay && (
                <button
                  onClick={() => setShowProductionOverlay(true)}
                  className="h-9 px-4 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-500 hover:bg-blue-600/20 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 animate-pulse"
                >
                  <Sparkles className="size-3" />
                  Show Status
                </button>
              )}

              {selectedEpisode?.videoPlanId && (
                <button
                  onClick={() => openGenerator({ planId: selectedEpisode.videoPlanId, narrativeId: seriesData.seriesNarrativeId })}
                  className="h-9 px-4 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  title="Open in Production Lab"
                >
                  <ExternalLink className="size-3" />
                  <span className="hidden lg:inline">Edit Scenes</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
              
              {/* Media Preview Monitor */}
              <div className="space-y-6">
                <div className="group relative rounded-[2.5rem] overflow-hidden border border-white/5 bg-white/[0.02] shadow-2xl">
                  {/* Glowing Backdrop */}
                  <div className="absolute -inset-20 bg-amber-500/5 blur-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  
                  <div className="relative p-6">
                    <MediaResultPreview 
                      plan={selectedPlan || { scenes: selectedEpisode?.visualPrompts?.map(vp => ({ visualPrompt: vp })) || [] } as any}
                      isReady={selectedEpisode?.status === 'complete'}
                      statusText={episodeProgress[selectedEpisode?.id]?.phase || "Director's Preview"}
                      visualProgress={selectedEpisode?.status === 'complete' ? 100 : (episodeProgress[selectedEpisode?.id]?.visualsDone / episodeProgress[selectedEpisode?.id]?.totalScenes) * 100 || 0}
                      onRestart={() => handleGenerateVideo(selectedEpisode)}
                    />
                    
                    {selectedEpisode?.status === 'complete' && (
                      <button
                        onClick={() => handleDownloadEpisode(selectedEpisode)}
                        className="absolute bottom-10 right-10 size-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all z-10"
                        title="Download MP4"
                      >
                        <Download className="size-6" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 text-center">
                     <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Duration</div>
                     <div className="text-2xl font-black text-amber-500">{selectedEpisode?.duration || "90"}s</div>
                   </div>
                   <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 text-center">
                     <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Scenes</div>
                     <div className="text-2xl font-black text-blue-500">{selectedEpisode?.visualPrompts?.length || 0}</div>
                   </div>
                </div>
              </div>

              {/* Script & Details */}
              <div className="space-y-8">
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <MessageSquare className="size-4 text-amber-500" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Narrative Beat</h3>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-amber-500/20 rounded-full" />
                    <p className="text-xl font-medium leading-relaxed italic text-white/90 pl-4 font-serif">
                      &quot;{selectedEpisode?.script}&quot;
                    </p>
                  </div>
                </section>

                <section>
                   <div className="flex items-center gap-3 mb-6">
                    <Settings2 className="size-4 text-blue-500" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Production Specs</h3>
                  </div>
                  <div className="space-y-4">
                    {selectedEpisode?.visualPrompts?.map((prompt, i) => (
                      <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors flex gap-4">
                        <div className="size-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed truncate">
                          {prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="p-8 rounded-[2rem] bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
                  <h4 className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-500" />
                    Director's Note
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed italic">
                    {seriesData.visualConsistency || "Maintain visual flow and pacing across episodes."}
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
