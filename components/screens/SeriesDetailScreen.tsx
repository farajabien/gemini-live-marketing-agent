"use client";

import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { tx } from "@/lib/firebase-tx";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { ProductionOverlay, type EpisodeProgress } from "@/components/series/ProductionOverlay";
import type { SeriesWithEpisodes, Episode } from "@/lib/types";
import { DirectorChat } from "@/components/narrative/DirectorChat";
import { SeriesCanvas } from "@/components/series/SeriesCanvas";
import { toast } from "sonner";
import { updateSeriesField, generateSeasonPlotAction } from "@/app/actions/marketing";
import { MediaScreen } from "@/components/screens/MediaScreen";
import { EpisodeDetailView } from "@/components/series/EpisodeDetailView";
import { Loader2, ArrowLeft, Film, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WarRoomLayout } from "@/components/layout/WarRoomLayout";

interface SeriesDetailScreenProps {
  seriesId: string;
}

export function SeriesDetailScreen({ seriesId }: SeriesDetailScreenProps) {
  const { user, refreshToken, getFreshToken, isInitialLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlEpisodeId = searchParams.get("episodeId");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(urlEpisodeId);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, EpisodeProgress>>({});
  const [showProductionOverlay, setShowProductionOverlay] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const isMediaView = searchParams.get("type") === "media";

  // Sync with URL
  useEffect(() => {
    if (urlEpisodeId) {
      setSelectedEpisodeId(urlEpisodeId);
    }
  }, [urlEpisodeId]);

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
  
  const { data, isLoading: isSeriesLoading } = db.useQuery(seriesQuery);

  const seriesData = useMemo(() => {
    if (!data || !('series' in data)) return null;
    const series = (data as any).series?.[0];
    if (!series) return null;

    const episodesNew = (data as any).episodesNew || [];
    const episodesOld = (data as any).episodesOld || [];
    
    const episodesMap = new Map();
    [...episodesOld, ...episodesNew].forEach(ep => {
      episodesMap.set(ep.id, ep);
    });
    
    const episodes = Array.from(episodesMap.values()).sort((a: any, b: any) => 
      (a.episodeNumber || 0) - (b.episodeNumber || 0)
    );
    return { ...series, episodes } as SeriesWithEpisodes;
  }, [data]);

  const selectedEpisode = useMemo(() => {
    if (!urlEpisodeId || !seriesData?.episodes) return null;
    return seriesData.episodes.find((e: Episode) => e.id === urlEpisodeId) || null;
  }, [seriesData?.episodes, urlEpisodeId]);

  const seriesNarrativeId = seriesData?.seriesNarrativeId;
  const narrativeQuery = useMemo(
    () => seriesNarrativeId ? {
      narratives: { $: { collection: 'seriesNarratives', where: { id: seriesNarrativeId } } }
    } : null,
    [seriesNarrativeId]
  );
  const { data: narrativeData } = db.useQuery(narrativeQuery as any);
  const narrative = (narrativeData as any)?.narratives?.[0];

  // Orchestration Effect (Maintained from original)
  const activeRenders = useRef(0);
  const episodeProgressRef = useRef(episodeProgress);
  episodeProgressRef.current = episodeProgress;
  const orchestratingRef = useRef(false);
  const seriesDataRef = useRef(seriesData);
  seriesDataRef.current = seriesData;

  useEffect(() => {
    if (!user || !seriesId) return;

    const getGeneratingEpisodes = () => (seriesDataRef.current?.episodes || []).filter((e: Episode) => e.status === 'generating' && e.videoPlanId);
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

            if (plan.status === "failed") {
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
                 await fetch("/api/generate-audio", {
                   method: "POST",
                   headers: { "Content-Type": "application/json", "Authorization": `Bearer ${refreshToken}` },
                   body: JSON.stringify({ planId: plan.id })
                 });
               }
               continue;
            }

            if (allAssetsDone && !plan.videoUrl) {
              if (activeRenders.current > 0) continue;
              if (!triggeredRender.current.has(episode.id)) {
                triggeredRender.current.add(episode.id);
                activeRenders.current++;
                const renderRes = await fetch("/api/generate-video", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ planId: plan.id, background: true }),
                });
                activeRenders.current--;
                if (!renderRes.ok && renderRes.status !== 409) {
                  triggeredRender.current.delete(episode.id);
                  await tx.episodes[episode.id].update({ status: "failed", updatedAt: Date.now() });
                }
              }
              continue;
            }

            if (allAssetsDone && !!plan.videoUrl && episode.status !== 'complete') {
               triggeredVisuals.current.delete(episode.id);
               triggeredAudio.current.delete(episode.id);
               triggeredRender.current.delete(episode.id);
               await tx.episodes[episode.id].update({
                 status: 'complete',
                 videoUrl: plan.videoUrl,
                 duration: plan.duration,
                 updatedAt: Date.now(),
                 ...(plan.thumbnailUrl != null ? { thumbnailUrl: plan.thumbnailUrl } : {})
               });
            }
          } catch (err) {
            console.error("[Series Orchestration] Error:", episode.id, err);
          }
        }
      } finally {
        orchestratingRef.current = false;
      }
    };

    const timer = setInterval(orchestrate, 5000);
    return () => clearInterval(timer);
  }, [user?.id, seriesId, !!seriesData?.episodes?.some((e: Episode) => e.status === 'generating')]);

  const handleGenerateEpisode = async (episode: Episode) => {
    const token = (await getFreshToken?.()) ?? refreshToken ?? null;
    if (!token) return;
    
    try {
      const compileRes = await fetch("/api/episodes/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ episodeId: episode.id })
      });
      
      const compileData = await compileRes.json();
      if (!compileData.success) throw new Error(compileData.error || "Failed to compile episode");
      
      const { planId } = compileData;
      
      if (!triggeredVisuals.current.has(episode.id)) {
        triggeredVisuals.current.add(episode.id);
        fetch("/api/generate-visuals", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ planId })
        }).catch(() => triggeredVisuals.current.delete(episode.id));
      }
      toast.success(`Production started for Episode ${episode.episodeNumber}`);
    } catch (err: any) {
      console.error("[SeriesDetail] Orchestration failed:", err);
      toast.error("Production failure. check console.");
    }
  };

  const handleTitleClick = () => {
    setTempTitle(seriesData?.title || "");
    setIsEditingTitle(true);
  };

  const handleTitleSubmit = async () => {
    if (!tempTitle.trim() || tempTitle === seriesData?.title) {
      setIsEditingTitle(false);
      return;
    }

    if (!user?.id) return;

    try {
      const promise = updateSeriesField(seriesId, 'title', tempTitle, user.id);
      setIsEditingTitle(false);
      
      toast.promise(promise, {
        loading: 'Saving title...',
        success: 'Series title updated.',
        error: 'Failed to update title.'
      });
    } catch (err) {
      console.error("Failed to submit title:", err);
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
  };

  if (isInitialLoading || isSeriesLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 text-blue-500 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Opening Series War Room...</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (!seriesData) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-black mb-2 italic">Series Not Found</h1>
        <Link href="/dashboard">
          <Button variant="outline" className="h-12 px-8 border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-xl">
            Return to Hub
          </Button>
        </Link>
      </div>
    );
  }

  const handleGenerateSeasonPlot = async () => {
    if (!seriesNarrativeId) return;
    const promise = generateSeasonPlotAction(seriesNarrativeId, seriesData?.episodeCount || 3);
    toast.promise(promise, {
      loading: "Generating Master Season Plot...",
      success: "Season Plot synchronized with Production Console.",
      error: "Failed to generate season plot."
    });
    try {
      await promise;
    } catch (e) {}
  };

  const headerTitle = (
    <div className="flex items-center gap-3">
      <div className="size-6 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
        <Film className="size-3 text-amber-500" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-0.5">Series Strategy</span>
        {isEditingTitle ? (
          <input
            autoFocus
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') handleTitleCancel();
            }}
            className="bg-white/5 border border-blue-500/50 rounded px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider outline-none w-full max-w-[300px]"
          />
        ) : (
          <span 
            onClick={handleTitleClick}
            className="text-[11px] font-black text-white leading-none italic truncate max-w-[200px] cursor-pointer hover:text-blue-400 transition-colors group flex items-center gap-2"
          >
            {seriesData.title}
            <span className="opacity-0 group-hover:opacity-100 material-symbols-outlined text-[10px]">edit</span>
          </span>
        )}
      </div>
    </div>
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => router.push(`/series/${seriesId}${isMediaView ? '' : '?type=media'}`)}
        className="h-7 px-3 rounded-xl border-white/10 bg-white/5 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/10 gap-1.5"
      >
        <LayoutGrid className="size-3 text-blue-500" />
        {isMediaView ? "Planning" : "Assets"}
      </Button>
      {!isMediaView && seriesData.episodes?.some((e: Episode) => e.status === 'generating' || e.status === 'failed') && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowProductionOverlay(true)}
          className="h-7 px-3 rounded-xl border-blue-500/20 bg-blue-500/5 text-blue-400 text-[9px] font-black uppercase tracking-widest hover:bg-blue-500/10 animate-pulse"
        >
          Pulse
        </Button>
      )}
    </div>
  );


  return (
    <AppLayout 
      seriesId={seriesId} 
      noPadding 
      headerTitle={headerTitle} 
      headerActions={headerActions}
    >
      {isMediaView ? (
        <MediaScreen isIntegrated={true} overrideSeriesId={seriesId} />
      ) : (
        <WarRoomLayout
          leftPane={<DirectorChat narrativeId={seriesData.seriesNarrativeId || ""} seriesId={seriesId} inline={true} />}
          rightPane={
            <div className="h-full">
              {urlEpisodeId && !selectedEpisode ? (
                <div className="h-full flex flex-col items-center justify-center bg-[#050505] gap-4">
                  <Loader2 className="size-8 text-blue-500 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Retrieving Episode Blueprint...</p>
                </div>
              ) : selectedEpisode ? (
                <EpisodeDetailView 
                  episode={selectedEpisode} 
                  onClose={() => router.push(`/series/${seriesId}`)} 
                />
              ) : (
                <SeriesCanvas 
                  series={seriesData} 
                  narrative={narrative}
                  selectedEpisodeId={urlEpisodeId} 
                  onSelectEpisode={(id: string) => {
                    router.push(`/series/${seriesId}?episodeId=${id}`, { scroll: false });
                  }}
                  episodeProgress={episodeProgress}
                  onGenerateEpisode={handleGenerateEpisode}
                  onGenerateSeasonPlot={handleGenerateSeasonPlot}
                />
              )}
            </div>
          }
        />
      )}

      {/* Production Overlay Modal */}
      {showProductionOverlay && (
        <ProductionOverlay 
          episodes={(seriesData.episodes || []).filter((e: Episode) => e.status === 'generating' || e.status === 'failed')}
          progress={episodeProgress}
          onRetry={(ep) => handleGenerateEpisode(ep)}
          canDismiss={true}
          onDismiss={() => setShowProductionOverlay(false)}
        />
      )}
    </AppLayout>
  );
}
