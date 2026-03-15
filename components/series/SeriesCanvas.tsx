"use client";

import { Brain, Activity, Target, Shield, Zap, Film, Play, CheckCircle2, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Episode, SeriesWithEpisodes, SeriesNarrative } from "@/lib/types";
import { MediaResultPreview } from "@/components/media/MediaResultPreview";

interface SeriesCanvasProps {
  series: SeriesWithEpisodes;
  narrative?: SeriesNarrative;
  selectedEpisodeId: string | null;
  onSelectEpisode: (id: string) => void;
  episodeProgress: Record<string, any>;
  onGenerateEpisode: (ep: Episode) => void;
  onGenerateSeasonPlot: () => void;
}

export function SeriesCanvas({ 
  series, 
  narrative,
  selectedEpisodeId, 
  onSelectEpisode, 
  episodeProgress,
  onGenerateEpisode,
  onGenerateSeasonPlot
}: SeriesCanvasProps) {
  const sortedEpisodes = [...(series.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const selectedEpisode = sortedEpisodes.find(e => e.id === selectedEpisodeId) || sortedEpisodes[0];
  const completedEpisodes = series.episodes?.filter(e => e.status === 'complete').length || 0;

  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden relative">
      {/* Subtle Aura for Series Intelligence */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
      </div>

      {/* Dynamic Header */}
      <div className="px-6 py-4 border-b border-white/[0.03] bg-[#080808]/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-3">
             <div className="size-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Film className="size-5 text-amber-500" />
             </div>
             <div>
                <h2 className="text-xl font-black tracking-tight italic uppercase">{series.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                   <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Series Intelligence Active</span>
                </div>
             </div>
          </div>
          <Badge variant="outline" className="h-7 px-3 border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {completedEpisodes}/{series.episodeCount} Episodes Ready
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
        {/* Series Foundation */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
              <Target className="size-3 text-amber-500" />
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Series Foundation</h3>
              <div className="flex-1 h-px bg-white/[0.03]" />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FoundationCard 
                title="Conflict / Villain" 
                content={narrative?.conflictType || "Deducing the market's greatest obstacle..."} 
                icon={Shield} 
                color="text-red-400" 
              />
              <FoundationCard 
                title="Protagonist / Hero" 
                content={narrative?.protagonistArchetype || "Identifying your brand's unique edge..."} 
                icon={Target} 
                color="text-blue-400" 
              />
              <FoundationCard 
                title="Mechanism / Setting" 
                content={narrative?.worldSetting || "Engineering the tactical conversion..."} 
                icon={Zap} 
                color="text-amber-400" 
              />
           </div>
        </section>

        {/* Episode Storyboard */}
        <section className="space-y-6">
           <div className="flex items-center gap-4 mb-4">
              <Play className="size-3 text-blue-500" />
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Storyboard Beats</h3>
            </div>

            {/* Generate Season Plot CTA */}
            {(!series.megaPrompt || (series.megaPrompt && sortedEpisodes.length === 0)) && narrative?.logline && (
              <div className="p-8 rounded-[3rem] bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in duration-700 mt-4 mb-8">
                <div className="size-16 rounded-3xl bg-amber-500/20 flex items-center justify-center border border-amber-500/20 shadow-xl shadow-amber-500/10">
                  <Sparkles className="size-8 text-amber-500" />
                </div>
                <div className="max-w-md">
                   <h4 className="text-lg font-black italic uppercase tracking-tight text-white mb-2">
                     {series.megaPrompt ? "Storyboards Missing" : "Architect the Master Plot"}
                   </h4>
                   <p className="text-[11px] font-medium text-slate-400 leading-relaxed uppercase tracking-widest text-balance">
                     {series.megaPrompt 
                        ? "The master arc is ready, but the storyboards need architecting. Let's populate your production beats."
                        : "The story brain is healthy. We are ready to weave your hooks into a high-fidelity cinematic arc."}
                   </p>
                </div>
                <Button 
                  onClick={onGenerateSeasonPlot}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-[0.2em] text-[10px] px-10 py-6 h-auto rounded-full shadow-2xl shadow-amber-500/20 gap-3 group"
                >
                  {series.megaPrompt ? "Re-Architect Storyboards" : "Generate Master Season Plot"}
                  <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            )}

            <div className="space-y-4">
             {sortedEpisodes.map((ep) => (
               <EpisodeCard 
                 key={ep.id}
                 episode={ep}
                 isActive={selectedEpisode?.id === ep.id}
                 progress={episodeProgress[ep.id]}
                 onClick={() => onSelectEpisode(ep.id!)}
                 onGenerate={() => onGenerateEpisode(ep)}
               />
             ))}
           </div>

           {series.megaPrompt && sortedEpisodes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-white/10 rounded-[2rem] bg-white/[0.02] mt-4">
                <Loader2 className="size-6 text-blue-500 animate-spin" />
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                  Architecting Storyboards...
                </p>
              </div>
            )}
         </section>

         {/* Master Plot Review section */}
         {series.megaPrompt && (
           <section className="mt-12 p-8 rounded-[3rem] bg-gradient-to-br from-blue-600/[0.04] to-transparent border border-white/[0.03] animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="flex items-center gap-4 mb-6">
                <div className="size-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                  <Film className="size-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Master Season Arc</h3>
                  <p className="text-[9px] text-slate-500 font-medium uppercase tracking-widest">Cinematic Strategy Guide</p>
                </div>
             </div>
             <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                <p className="text-[13px] leading-relaxed text-slate-300 italic whitespace-pre-wrap font-medium">
                  {series.megaPrompt}
                </p>
             </div>
           </section>
         )}
      </div>
    </div>
  );
}

function FoundationCard({ title, content, icon: Icon, color }: any) {
  return (
    <div className="p-4 rounded-[2rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all group shadow-lg shadow-black/20">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={cn("size-6 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors")}>
          <Icon className={cn("size-3.5", color)} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 group-hover:text-amber-500 transition-colors">{title}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400 font-medium line-clamp-3 italic pl-1">
        "{content}"
      </p>
    </div>
  );
}

function EpisodeCard({ episode, isActive, progress, onClick, onGenerate }: any) {
  const isComplete = episode.status === 'complete';
  const isGenerating = episode.status === 'generating';
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative p-5 rounded-[2.5rem] border transition-all cursor-pointer overflow-hidden",
        isActive 
          ? "bg-gradient-to-br from-amber-500/[0.08] to-transparent border-amber-500/30 shadow-2xl shadow-amber-950/20" 
          : "bg-[#080808] border-white/5 hover:border-white/10 hover:bg-white/[0.03]"
      )}
    >
      {/* Active Indicator Glow */}
      {isActive && (
        <div className="absolute -top-12 -right-12 size-32 bg-amber-500/10 blur-3xl rounded-full" />
      )}
      <div className="flex items-start gap-4 relative z-10">
        <div className={cn(
          "size-10 rounded-xl flex items-center justify-center text-xs font-black transition-colors shrink-0",
          isActive ? "bg-amber-500 text-black" : "bg-white/5 text-slate-600 group-hover:bg-white/10"
        )}>
          {episode.episodeNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className={cn(
              "text-lg font-black tracking-tight transition-colors",
              isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
            )}>
              {episode.title}
            </h4>
            {isComplete && <CheckCircle2 className="size-4 text-emerald-500" />}
            {isGenerating && <Loader2 className="size-4 text-amber-500 animate-spin" />}
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed italic line-clamp-2 mb-4">
            {episode.script}
          </p>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className={cn(
                  "size-1.5 rounded-full",
                  isComplete ? "bg-emerald-500" : isGenerating ? "bg-amber-500 animate-pulse" : "bg-slate-700"
                )} />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                  {isComplete ? "Production Ready" : isGenerating ? "In Production" : "Draft Status"}
                </span>
             </div>

             {!isComplete && !isGenerating && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                  className="px-4 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <Sparkles className="size-3" />
                  Trigger Render
                </button>
             )}

             {isComplete && (
               <div className="flex items-center gap-2">
                 <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                   MP4 Archived
                 </Badge>
               </div>
             )}
          </div>
        </div>

        {isActive && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
             <ChevronRight className="size-8 text-amber-500" />
          </div>
        )}
      </div>

      {isGenerating && progress && (
        <div className="mt-6 space-y-2">
           <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-amber-500/60">
              <span>{progress.phase} Mode</span>
              <span>{Math.round((progress.visualsDone / progress.totalScenes) * 100)}%</span>
           </div>
           <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
             <div 
               className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-1000"
               style={{ width: `${(progress.visualsDone / progress.totalScenes) * 100}%` }}
             />
           </div>
        </div>
      )}
    </div>
  );
}
