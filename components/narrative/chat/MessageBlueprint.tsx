"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Activity, ChevronUp, ChevronDown, Play, Info } from "lucide-react";

interface MessageBlueprintProps {
  message: any;
  onProduceVideo: (script: string) => void;
}

export function MessageBlueprint({ 
  message: m, 
  onProduceVideo
}: MessageBlueprintProps) {
  const [showThoughts, setShowThoughts] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (!m.warRoomDialogue && !m.thoughtProcess && !m.blueprint) return null;

  const blueprint = m.blueprint || {};
  const hasBlueprint = Object.keys(blueprint).length > 0;

  return (
    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500 w-full max-w-full overflow-hidden">
        {hasBlueprint && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {Object.entries(blueprint).map(([key, value]: [string, any], idx) => {
                // Ignore script in the grid, it gets its own card
                if (key === 'script' || key === 'video_script') return null;
                
                return (
                  <div key={idx} className="px-4 py-3 bg-white/[0.03] border border-white/[0.05] rounded-[1.2rem] flex flex-col gap-1 transition-all hover:bg-white/[0.06] hover:border-blue-500/20 group/card">
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover/card:text-blue-400 transition-colors">
                        {key.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] text-slate-300 leading-tight font-medium">
                        {value}
                    </p>
                  </div>
                );
              })}
              
              <div className="col-span-1 sm:col-span-2 flex items-center justify-between py-1">
                <button 
                  onClick={() => setShowThoughts(!showThoughts)}
                  className="text-[9px] font-black uppercase tracking-widest text-blue-500/80 hover:text-blue-400 transition-colors flex items-center gap-2"
                >
                  {showThoughts ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  {showThoughts ? "Hide Strategic Reasoning" : "Inspect Strategic Reasoning"}
                </button>

                <button 
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showRaw ? "Hide Protocol" : "View Protocol"}
                </button>
              </div>

              {showRaw && (
                <div className="col-span-1 sm:col-span-2 animate-in zoom-in-95 duration-200">
                  <pre className="p-4 bg-black/40 rounded-2xl font-mono text-[9px] text-blue-400/50 overflow-x-auto border border-white/5 whitespace-pre-wrap">
                      {JSON.stringify(m, null, 2)}
                  </pre>
                </div>
              )}

              {(blueprint.script || blueprint.video_script) && (
                <div className="col-span-1 sm:col-span-2 mt-2 group/action relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover/action:opacity-40 transition duration-1000 group-hover/action:duration-200" />
                    <Button 
                      onClick={() => onProduceVideo(blueprint.script || blueprint.video_script)}
                      className="relative w-full bg-[#050505] border border-blue-500/30 hover:border-blue-500/60 text-white h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] gap-3 shadow-2xl transition-all"
                    >
                      <Play className="size-4 fill-blue-500 text-blue-500" />
                      Initialize Video Production
                    </Button>
                </div>
              )}
          </div>
        )}

        {m.warRoomDialogue && showThoughts && (
          <div className="px-6 py-5 bg-blue-600/5 border border-blue-500/10 rounded-[2rem] animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-3 mb-4 opacity-80">
                <div className="size-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                   <Activity className="size-3.5 text-blue-400" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Strategy Internal Debate</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 leading-relaxed space-y-4">
                {m.warRoomDialogue.split('\n').filter(Boolean).map((line: string, idx: number) => {
                  const isDisruptor = line.toLowerCase().includes('disruptor');
                  const isArchitect = line.toLowerCase().includes('architect');
                  
                  return (
                    <div key={idx} className={cn(
                      "pl-4 border-l-2 transition-all duration-300",
                      isDisruptor ? "border-red-500/30 text-red-200/60" : 
                      isArchitect ? "border-emerald-500/30 text-emerald-200/60" : 
                      "border-white/10 opacity-60"
                    )}>
                      {line.replace(/\*\*/g, '')}
                    </div>
                  );
                })}
              </div>
          </div>
        )}
    </div>
  );
}
