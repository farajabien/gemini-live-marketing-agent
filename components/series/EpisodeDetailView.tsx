"use client";

import { useMemo } from "react";
import { firebaseDb as db } from "@/lib/firebase-client";
import { Badge } from "@/components/ui/badge";
import { MediaResultPreview } from "@/components/media/MediaResultPreview";
import { Episode, VideoPlan } from "@/lib/types";
import { Film, FileText, Sparkles, Clock, Layout, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EpisodeDetailViewProps {
  episode: Episode;
  onClose: () => void;
}

export function EpisodeDetailView({ episode, onClose }: EpisodeDetailViewProps) {
  const videoPlanQuery = useMemo(
    () => episode.videoPlanId ? {
      videoPlans: { $: { where: { id: episode.videoPlanId } } }
    } : null,
    [episode.videoPlanId]
  );

  const { data, isLoading } = db.useQuery(videoPlanQuery as any);
  const videoPlan = (data as any)?.videoPlans?.[0] as VideoPlan | undefined;

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 selection:bg-blue-500/30">
      {/* Blueprint Header */}
      <header className="px-8 py-6 border-b border-white/[0.03] bg-[#080808]/80 backdrop-blur-2xl shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-2xl transition-all border border-white/5 hover:border-white/10 group"
          >
            <ChevronLeft className="size-5 text-slate-500 group-hover:text-white transition-colors" />
          </button>
          
          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
              <span className="text-sm font-black text-amber-500">{episode.episodeNumber}</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tight leading-none mb-1">
                {episode.title}
              </h2>
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Film className="size-3" />
                Episode Tactical Blueprint
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn(
            "h-8 px-4 rounded-xl border-white/10 text-[10px] font-black uppercase tracking-[0.1em]",
            episode.status === 'complete' ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20" : 
            episode.status === 'generating' ? "text-amber-500 bg-amber-500/5 border-amber-500/20 animate-pulse" : 
            "text-slate-500 bg-white/5"
          )}>
            {episode.status.replace("_", " ")}
          </Badge>
          
          <button 
            onClick={onClose}
            className="h-10 px-6 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
          >
            Return to Canvas
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT: Assets & Preview */}
        <div className="flex-1 bg-black border-r border-white/[0.03] overflow-y-auto custom-scrollbar p-10">
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Media Preview Section */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="size-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Layout className="size-4 text-blue-500" />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Execution Results</h3>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
              
              {isLoading ? (
                <div className="aspect-video rounded-[3rem] bg-white/[0.01] border border-white/5 flex items-center justify-center">
                   <Loader2 className="size-8 text-blue-500 animate-spin" />
                </div>
              ) : videoPlan ? (
                <div className="animate-in fade-in zoom-in-95 duration-700">
                  <MediaResultPreview 
                    plan={videoPlan} 
                    isReady={episode.status === 'complete'} 
                    statusText={episode.status === 'generating' ? "Synthesizing visual assets..." : "Review current draft"}
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-[3rem] bg-white/[0.01] border border-dashed border-white/10 flex flex-col items-center justify-center text-center p-12 group hover:bg-white/[0.02] transition-colors">
                  <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <Sparkles className="size-10 text-slate-700" />
                  </div>
                  <h4 className="text-base font-black text-slate-400 uppercase tracking-widest mb-3">No Visuals Generated</h4>
                  <p className="text-sm text-slate-500 max-w-[280px] leading-relaxed italic font-medium">
                    Trigger the rendering engine from the canvas to populate this storyboard.
                  </p>
                </div>
              )}
            </section>

            {/* Storyboard Beats */}
            {videoPlan && videoPlan.scenes && (
              <section className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <Clock className="size-4 text-amber-500" />
                  </div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Storyboard Continuity</h3>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {videoPlan.scenes.map((scene, idx) => (
                    <div key={idx} className="group p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all duration-300 flex gap-8 items-start">
                      <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center text-xs font-black text-slate-500 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:scale-110">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-4">
                        <p className="text-lg text-slate-200 font-medium leading-relaxed font-serif italic">
                          &quot;{scene.voiceover}&quot;
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-[9px] font-black uppercase tracking-widest text-blue-500 border border-blue-500/20">Scene Prompt</span>
                          <span className="text-[10px] font-bold text-slate-500 truncate">{scene.visualPrompt}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* RIGHT: Meta & Script */}
        <div className="w-full lg:w-[450px] bg-[#080808]/80 backdrop-blur-3xl overflow-y-auto custom-scrollbar p-10 border-l border-white/[0.03]">
          <div className="space-y-12">
            {/* Full Script */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="size-8 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <FileText className="size-4 text-purple-500" />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Master Narrative</h3>
              </div>
              
              <div className="relative">
                <div className="absolute -left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500/30 via-transparent to-transparent rounded-full" />
                <p className="text-xl text-slate-200 leading-[1.8] font-serif italic selection:bg-purple-500/40 whitespace-pre-wrap px-2">
                  {episode.script}
                </p>
              </div>
            </section>

            {/* Episode Specs */}
            <section className="space-y-8 pt-8 border-t border-white/[0.03]">
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Tactical Specs</h3>
              <div className="grid grid-cols-2 gap-4">
                <SpecCard label="Format" value="9:16 Vertical" />
                <SpecCard label="Resolution" value="4K / HDR" />
                <SpecCard label="Target" value="60-90s" />
                <SpecCard label="Audio" value="Dolby Atmos" />
              </div>
            </section>

            {/* Quick Actions */}
            <div className="pt-8 border-t border-white/[0.03] space-y-4">
               <div className="p-6 rounded-[2rem] bg-blue-600/5 border border-blue-600/20 flex flex-col gap-4">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-center">Continuous Logic Engine</h4>
                  <p className="text-[11px] text-slate-400 text-center italic leading-relaxed">
                    Review and refine the episode blueprint before final render commitment.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">{label}</p>
      <p className="text-xs font-bold text-slate-300">{value}</p>
    </div>
  );
}
