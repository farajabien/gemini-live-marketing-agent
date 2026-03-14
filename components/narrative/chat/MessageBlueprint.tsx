"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Activity, ChevronUp, ChevronDown, Play } from "lucide-react";

interface MessageBlueprintProps {
  message: any;
  messageIndex: number;
  showThoughts: boolean;
  onToggleThoughts: () => void;
  onProduceVideo: (script: string) => void;
}

export function MessageBlueprint({ 
  message: m, 
  messageIndex: i, 
  showThoughts, 
  onToggleThoughts,
  onProduceVideo
}: MessageBlueprintProps) {
  if (!m.warRoomDialogue && !m.thoughtProcess && !m.blueprint) return null;

  return (
    <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500 w-full max-w-full overflow-hidden">
        {m.blueprint && Object.keys(m.blueprint).length > 0 && (
          <div className="grid grid-cols-2 gap-2 w-full max-w-full">
              {Object.entries(m.blueprint).map(([key, value]: [string, any], idx) => (
                <div key={idx} className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex flex-col gap-1 transition-all hover:bg-white/[0.05] hover:border-blue-500/20 group/card min-w-0 overflow-hidden text-left">
                  <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 group-hover/card:text-blue-400 transition-colors truncate">
                      {key.replace(/_/g, ' ')}
                  </span>
                  <p className="text-[10px] text-slate-300 leading-tight font-medium break-words">
                      {value}
                  </p>
                </div>
              ))}
              
              <div className="col-span-2 flex items-center justify-between gap-2 mt-1 w-full overflow-hidden">
                <button 
                  onClick={onToggleThoughts}
                  className="text-[8px] font-black uppercase tracking-widest text-blue-500/60 hover:text-blue-400 transition-colors py-2 px-3 flex items-center gap-2 min-w-0"
                >
                  {showThoughts ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
                  <span className="truncate">{showThoughts ? "Hide Deep Analysis" : "Inspect Deep Analysis"}</span>
                </button>

                <button 
                  onClick={() => {
                    const el = document.getElementById(`raw-data-${i}`);
                    if (el) el.classList.toggle('hidden');
                  }}
                  className="text-[8px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors py-2 px-3 shrink-0"
                >
                  Raw Protocol
                </button>
              </div>

              <div id={`raw-data-${i}`} className="col-span-2 hidden animate-in zoom-in-95 duration-200 mt-2 w-full max-w-full overflow-hidden">
                <pre className="p-4 bg-black/60 rounded-2xl font-mono text-[9px] text-blue-400/70 overflow-x-auto border border-blue-500/10 shadow-2xl whitespace-pre-wrap break-all">
                    {JSON.stringify(m, null, 2)}
                </pre>
              </div>

              {(m.blueprint?.script || m.blueprint?.video_script) && (
                <div className="col-span-2 mt-2 animate-in fade-in slide-in-from-left-4 duration-500">
                    <Button 
                      onClick={() => onProduceVideo(m.blueprint.script || m.blueprint.video_script)}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2 shadow-xl shadow-blue-900/40"
                    >
                      <Play className="size-4 fill-current" />
                      Produce This Video Now
                    </Button>
                </div>
              )}
          </div>
        )}

        {m.warRoomDialogue && showThoughts && (
          <div className="px-5 py-4 bg-blue-500/10 border border-blue-500/20 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500 w-full overflow-hidden text-left">
              <div className="flex items-center gap-3 mb-3 opacity-80">
                <Activity className="size-4 text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Strategy War Room Debate</span>
              </div>
              <div className="font-mono text-[11px] text-slate-300 leading-relaxed space-y-3 whitespace-pre-wrap break-words w-full overflow-hidden">
                {m.warRoomDialogue.split('\n').map((line: string, idx: number) => {
                  const isDisruptor = line.toLowerCase().includes('disruptor');
                  const isArchitect = line.toLowerCase().includes('architect');
                  
                  return (
                    <div key={idx} className={cn(
                      "pl-4 border-l-4 transition-all duration-300 w-full break-words break-all text-left",
                      isDisruptor ? "border-red-500/40 text-red-100/70" : 
                      isArchitect ? "border-emerald-500/40 text-emerald-100/70" : 
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
