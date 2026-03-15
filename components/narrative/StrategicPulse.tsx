"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Brain, Zap, Target, BarChart3, Users } from "lucide-react";
import { FounderNarrative } from "@/lib/types";

interface LayerProgressProps {
  label: string;
  score: number;
  icon: React.ReactNode;
  color: string;
}

function LayerProgress({ label, score, icon, color }: LayerProgressProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className={cn("size-4 rounded-md flex items-center justify-center", color)}>
            {icon}
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <span className="text-[10px] font-black tabular-nums">{Math.round(score)}%</span>
      </div>
      <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000 ease-out rounded-full", color.replace('bg-', 'bg-').replace('/20', ''))} 
          style={{ width: `${score}%` }} 
        />
      </div>
    </div>
  );
}

export function StrategicPulse({ narrative }: { narrative: FounderNarrative }) {
  const scores = narrative.narrativeStrength || {
    overallScore: 0,
    narrativeScore: 0,
    formatScore: 0,
    behaviorScore: 0,
    evolutionScore: 0
  };

  return (
    <div className="p-5 space-y-6 bg-card/30 rounded-3xl border border-border/50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/80 leading-none mb-1">Total Capture</h3>
          <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Strategic Operating System</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-primary/10 border border-primary/20">
            <Zap className="size-3 text-primary animate-pulse fill-primary" />
            <span className="text-[10px] font-black tabular-nums text-primary">{Math.round(scores.overallScore)}%</span>
        </div>
      </div>

      <div className="grid gap-4">
        <LayerProgress 
          label="Narrative Layer" 
          score={scores.narrativeScore || 0} 
          icon={<Target className="size-2.5" />} 
          color="bg-red-500/20 text-red-500" 
        />
        <LayerProgress 
          label="Format Layer" 
          score={scores.formatScore || 0} 
          icon={<Zap className="size-2.5" />} 
          color="bg-amber-500/20 text-amber-500" 
        />
        <LayerProgress 
          label="Behavior Layer" 
          score={scores.behaviorScore || 0} 
          icon={<Users className="size-2.5" />} 
          color="bg-blue-500/20 text-blue-500" 
        />
        <LayerProgress 
          label="Evolution Layer" 
          score={scores.evolutionScore || 0} 
          icon={<BarChart3 className="size-2.5" />} 
          color="bg-purple-500/20 text-purple-500" 
        />
      </div>
      
      <div className="pt-2 border-t border-border/50">
        <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-secondary/30 border border-border/50">
          <Brain className="size-3 text-muted-foreground" />
          <p className="text-[9px] font-medium text-muted-foreground italic leading-tight">
            Director Agent is mining behavior layer via audience frustration analysis...
          </p>
        </div>
      </div>
    </div>
  );
}
