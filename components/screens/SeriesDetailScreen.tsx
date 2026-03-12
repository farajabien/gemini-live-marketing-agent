"use client";

import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { tx } from "@/lib/firebase-tx";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { EpisodeCard } from "@/components/series/EpisodeCard";
import { ProductionOverlay, type EpisodeProgress } from "@/components/series/ProductionOverlay";
import type { Series, Episode, SeriesWithEpisodes } from "@/lib/types";
import Link from "next/link";

interface SeriesDetailScreenProps {
  seriesId: string;
}

export function SeriesDetailScreen({ seriesId }: SeriesDetailScreenProps) {
  const { user, refreshToken, getFreshToken, isInitialLoading } = useAuth();
  const [isEditingVisuals, setIsEditingVisuals] = useState(false);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, EpisodeProgress>>({});
  // Track which episodes have had visuals/audio/render triggered to avoid duplicate calls
  const triggeredVisuals = useRef<Set<string>>(new Set());
  const triggeredAudio = useRef<Set<string>>(new Set());
  const triggeredRender = useRef<Set<string>>(new Set());

  const seriesQuery = useMemo(
    () => ({ 
      series: { $: { where: { id: seriesId } } },
      episodesNew: { $: { collection: 'episodes', where: { seriesId: seriesId } } },
      episodesOld: { $: { collection: 'episodes', where: { series: seriesId } } }
    }),
    [seriesId]
  );
  const { data, isLoading: isSeriesLoading, error } = db.useQuery(seriesQuery);

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

  useEffect(() => {
    if (!seriesData || !user) return;

    const generatingEpisodes = (seriesData.episodes || []).filter(e => e.status === 'generating' && e.videoPlanId);
    if (generatingEpisodes.length === 0) return;

    const orchestrate = async () => {
      if (orchestratingRef.current) return;
      orchestratingRef.current = true;
      const token = (await getFreshToken?.()) ?? refreshToken ?? null;
      if (!token) {
        orchestratingRef.current = false;
        return;
      }
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
                  if (!res.ok) triggeredVisuals.current.delete(episode.id);
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
                console.log(`[Orchestration] Assets ready for episode ${episode.episodeNumber}, triggering render...`);
                const renderRes = await fetch("/api/generate-video", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                  body: JSON.stringify({ planId: plan.id, background: true })
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
  }, [seriesData, user, refreshToken, getFreshToken, db]);

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
      fetch("/api/generate-visuals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      }).catch(err => console.error("[SeriesDetail] Async visual trigger failed:", err));

    } catch (err: any) {
      console.error("[SeriesDetail] Video generation orchestration failed:", err);
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
  };
  const sortedEpisodes = [...(seriesData.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
  
  // Calculate Progress
  const completedEpisodes = (seriesData.episodes || []).filter(e => e.status === 'complete').length;
  const progressPercent = Math.round((completedEpisodes / seriesData.episodeCount) * 100);

  return (
    <div className="min-h-screen w-full bg-[#f6f6f8] dark:bg-[#080911] font-sans text-slate-900 dark:text-white flex flex-col pt-20">
      <Header />
      
      {/* Production Overlay for generating or failed state */}
      <ProductionOverlay 
        episodes={generatingEps}
        progress={episodeProgress}
        onRetry={(ep) => handleRetryEpisode(ep)}
      />
      
      {/* Cinematic Series Header */}
      <div className="w-full bg-white dark:bg-[#101322] border-b border-slate-200 dark:border-white/10 pt-4 pb-8 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/5 to-transparent pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="flex flex-col gap-4">
             {/* Breadcrumbs */}
             <div className="flex items-center gap-2">
               <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Director's Hub
               </Link>
                <span className="text-slate-200 dark:text-white/10 text-[10px]">/</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Series Generation</span>
              </div>

             <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                   <h1 className="text-4xl font-black mb-2 tracking-tighter text-slate-900 dark:text-white">
                     {seriesData.title}
                   </h1>
                   <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-2xl leading-relaxed text-balance">
                     {seriesData.tagline}
                   </p>
                </div>
                
                {/* Status Badges */}
                <div className="flex flex-wrap gap-3">
                   <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center min-w-[100px]">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Episodes</span>
                      <span className="text-xl font-black">{seriesData.episodeCount}</span>
                   </div>
                   <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center min-w-[100px]">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Status</span>
                      <div className="flex items-center gap-2">
                         <div className={`h-2 w-2 rounded-full ${seriesData.status === 'complete' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-blue-500 animate-pulse'}`} />
                         <span className="text-xs font-black uppercase tracking-widest">{seriesData.status}</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* Production Progress Bar */}
             <div className="w-full space-y-2">
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Story Completion</span>
                    <span className="text-xs font-black text-blue-600">{progressPercent}% Completed</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200 dark:border-white/5 p-0.5">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full px-6 py-12 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Main Episodes List */}
          <div className="lg:col-span-8 space-y-10">
            <div className="flex items-center justify-between">
               <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-600 text-3xl">list_alt</span>
                  Storyboard Beats
               </h2>
               <div className="px-4 py-1.5 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {completedEpisodes} / {seriesData.episodeCount} Rendered
               </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {sortedEpisodes.map((episode) => (
                <EpisodeCard 
                  key={episode.id}
                  episode={episode}
                  onEditScript={handleEditScript}
                  onGenerateVideo={handleGenerateVideo}
                />
              ))}
            </div>
          </div>

          {/* Sidebar - Visual Consistency & Production Notes */}
          <div className="lg:col-span-4 space-y-8">
             <div className="bg-white dark:bg-[#101322] rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/10 shadow-xl sticky top-24">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-400">
                      <span className="material-symbols-outlined text-purple-600 text-lg">palette</span>
                      Visual continuity
                   </h3>
                </div>
                <div className="bg-slate-50/50 dark:bg-[#0d101b] rounded-3xl p-6 border border-slate-200 dark:border-white/5 mb-6">
                   <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-mono italic">
                      &quot;{seriesData.visualConsistency}&quot;
                   </p>
                </div>
                
                <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Director's Notes</h4>
                    <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5">check_circle</span>
                            <span className="text-xs font-bold text-slate-500">Consistent characters & hooks</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5">check_circle</span>
                            <span className="text-xs font-bold text-slate-500">Narrative arc verified</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5">check_circle</span>
                            <span className="text-xs font-bold text-slate-500">Viral structure optimized</span>
                        </li>
                    </ul>
                </div>

                <div className="mt-12 p-6 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg shadow-indigo-500/20">
                    <h5 className="text-sm font-black mb-1">Pro Tip</h5>
                    <p className="text-[10px] font-medium text-indigo-100 leading-relaxed uppercase tracking-wider">
                      Keep visual consistency high to train social algorithms on your specific character style.
                    </p>
                </div>
             </div>
          </div>
        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-8 right-8 z-50">
           <button 
             onClick={() => {
               // Logic to generate all pending episodes
               sortedEpisodes.filter(e => e.status !== 'complete').forEach(handleGenerateVideo);
             }}
             className="group h-16 px-8 rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 overflow-hidden"
           >
             <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
             <span className="material-symbols-outlined relative z-10 transition-transform group-hover:rotate-12">auto_awesome</span>
              <span className="text-xs font-black uppercase tracking-[0.2em] relative z-10 flex items-center gap-2">
               {completedEpisodes === seriesData.episodeCount ? 'Regenerate Series' : 'Compile Remainder'}
               <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] tabular-nums">
                 {completedEpisodes} / {seriesData.episodeCount}
               </span>
             </span>
           </button>
        </div>
      </div>
    </div>
  );
}
