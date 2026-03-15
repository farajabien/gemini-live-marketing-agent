"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Zap, Flame, Target, ShieldAlert, MessageSquare, Plus, ChevronRight, BarChart } from "lucide-react";
import { ViralPattern } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface PatternCardProps {
  pattern: ViralPattern;
  onSelect?: (pattern: ViralPattern) => void;
  isActive?: boolean;
}

function PatternCard({ pattern, onSelect, isActive }: PatternCardProps) {
  const Icon = pattern.hookType.toLowerCase().includes('contrarian') ? ShieldAlert : 
               pattern.hookType.toLowerCase().includes('authority') ? Flame :
               pattern.hookType.toLowerCase().includes('mistake') ? Target :
               Zap;

  return (
    <button
      onClick={() => onSelect?.(pattern)}
      className={cn(
        "group relative flex flex-col items-start p-4 rounded-3xl border transition-all text-left w-full",
        isActive 
          ? "bg-primary/5 border-primary shadow-lg shadow-primary/10" 
          : "bg-secondary/20 border-border/50 hover:bg-secondary/40 hover:border-border"
      )}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <div className={cn(
          "size-10 rounded-2xl flex items-center justify-center transition-colors",
          isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:bg-secondary-foreground/10"
        )}>
          <Icon className="size-5" />
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border/50">
          <BarChart className="size-3 text-muted-foreground" />
          <span className="text-[10px] font-black tabular-nums">{Math.round(pattern.successScore * 100)}%</span>
        </div>
      </div>
      
      <h3 className="text-sm font-black text-foreground mb-1 flex items-center gap-2">
        {pattern.name}
        {isActive && <div className="size-1.5 rounded-full bg-primary animate-pulse" />}
      </h3>
      <p className="text-[10px] text-muted-foreground font-medium leading-relaxed mb-4 line-clamp-2">
        {pattern.hookType}: {pattern.structure.join(" → ")}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-auto">
        {pattern.tags.map(tag => (
          <span key={tag} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 py-0.5 rounded-md bg-secondary/30">
            {tag}
          </span>
        ))}
      </div>
      
      <div className={cn(
        "absolute right-4 bottom-4 size-6 rounded-full flex items-center justify-center transition-all",
        isActive ? "bg-primary text-primary-foreground scale-110" : "bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100"
      )}>
        <ChevronRight className="size-3" />
      </div>
    </button>
  );
}

export function PatternLibrary({ patterns, onSelect, activeId }: { patterns: ViralPattern[], onSelect: (p: ViralPattern) => void, activeId?: string }) {
  if (patterns.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-border rounded-3xl bg-secondary/10 flex flex-col items-center text-center space-y-4">
        <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center">
          <Zap className="size-6 text-muted-foreground/40" />
        </div>
        <div>
          <h4 className="text-sm font-black text-foreground">No patterns detected yet</h4>
          <p className="text-[10px] text-muted-foreground max-w-[200px] mt-1">Talk to the Director to extract and store your first viral winning patterns.</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl text-[10px] font-black uppercase h-8 px-4">
          Establish Strategy
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80 leading-none mb-1">Pattern Library</h3>
          <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Viral Winning Structures</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-secondary">
          <Plus className="size-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {patterns.map((pattern) => (
          <PatternCard 
            key={pattern.id} 
            pattern={pattern} 
            onSelect={onSelect}
            isActive={pattern.id === activeId}
          />
        ))}
      </div>

      <div className="pt-2 px-2">
        <div className="flex items-center gap-2 py-2.5 px-3 rounded-2xl bg-primary/5 border border-primary/10">
          <MessageSquare className="size-3 text-primary" />
          <p className="text-[9px] font-medium text-primary leading-tight italic">
            "Reality Check" patterns are performing 22% better for dev audiences this week.
          </p>
        </div>
      </div>
    </div>
  );
}
