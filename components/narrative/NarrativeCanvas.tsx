"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { StrengthGauge } from "./StrengthGauge";
import { LayoutGrid, Target, Sparkles, Activity, Brain, FileText, Play, PlusCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { VideoPlan, ViralPattern, ContentSeed } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PatternLibrary } from "./PatternLibrary";

interface NarrativeCanvasProps {
  narrative: any;
  videoPlans: VideoPlan[];
  isGeneratingTitle?: boolean;
  onGenerateSmartTitle?: () => void;
  onUpdateField?: (field: string, value: string) => void;
  onSelectPattern?: (pattern: ViralPattern) => void;
}

export function NarrativeCanvas({ 
  narrative, 
  videoPlans, 
  isGeneratingTitle, 
  onGenerateSmartTitle,
  onUpdateField,
  onSelectPattern
}: NarrativeCanvasProps) {
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);
  const [pulseField, setPulseField] = useState<string | null>(null);
  
  const positioning = narrative?.aiPositioning;
  const strength = narrative?.narrativeStrength;

  // Track changes for visual pulsing
  const prevPositioningRef = useRef(positioning);
  const prevStrengthRef = useRef(strength?.overallScore);

  useEffect(() => {
    if (!positioning) return;
    
    // Check which field changed
    if (positioning.villain !== prevPositioningRef.current?.villain) {
      setPulseField('villain');
    } else if (positioning.hero !== prevPositioningRef.current?.hero) {
      setPulseField('hero');
    } else if (positioning.mechanism !== prevPositioningRef.current?.mechanism) {
      setPulseField('mechanism');
    } else if (strength?.overallScore !== prevStrengthRef.current) {
        setPulseField('strength');
        prevStrengthRef.current = strength?.overallScore;
    }

    if (pulseField) {
      const timer = setTimeout(() => setPulseField(null), 3000);
      return () => clearTimeout(timer);
    }
    
    prevPositioningRef.current = positioning;
  }, [positioning, strength?.overallScore, pulseField]);

  return (
    <div className="h-full flex flex-col bg-background border-l border-border overflow-hidden">
      {/* Header / Stats Strip */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="size-8 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
             <Target className="size-4 text-slate-400" />
           </div>
           <div>
             <h2 className="text-[11px] font-black text-foreground tracking-tight leading-none mb-0.5 uppercase">Narrative Canvas</h2>
             <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Live Strategic State</div>
           </div>
        </div>
        
        {strength && (
          <div className={cn(
            "flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl px-3 py-1.5 transition-all hover:bg-white/[0.05]",
            pulseField === 'strength' && "ring-2 ring-blue-500/50 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          )}>
            <StrengthGauge score={strength.overallScore} size="xs" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Health</span>
              <span className="text-[10px] font-black text-white">{Math.round(strength.overallScore)}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 space-y-6">
          {/* Intelligence Matrix */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Strategic Intelligence</h3>
                {onGenerateSmartTitle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onGenerateSmartTitle}
                    disabled={isGeneratingTitle}
                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 gap-1.5 h-6 px-2"
                  >
                    {isGeneratingTitle ? <Activity className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                    Optimize
                  </Button>
                )}
             </div>

              <div className="grid grid-cols-1 gap-2">
                {/* Villain */}
                <div className={cn(
                  "p-4 rounded-[2rem] bg-gradient-to-br from-red-500/[0.03] to-transparent border border-red-500/10 group/card transition-all hover:bg-red-500/[0.05] hover:border-red-500/20 shadow-lg shadow-black/20",
                  pulseField === 'villain' && "ring-2 ring-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse"
                )}>
                   <div className="flex items-center gap-2 mb-2">
                      <div className="size-5 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Activity className="size-3 text-red-500" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500/80">The Villain</span>
                   </div>
                   <p className="text-[12px] text-slate-300 leading-relaxed font-medium pl-1 italic">{positioning?.villain || "Not defined yet..."}</p>
                </div>

                {/* Hero */}
                <div className={cn(
                  "p-4 rounded-[2rem] bg-gradient-to-br from-blue-500/[0.03] to-transparent border border-blue-500/10 group/card transition-all hover:bg-blue-500/[0.05] hover:border-blue-500/20 shadow-lg shadow-black/20",
                  pulseField === 'hero' && "ring-2 ring-blue-500/50 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse"
                )}>
                   <div className="flex items-center gap-2 mb-2">
                      <div className="size-5 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Target className="size-3 text-blue-500" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500/80">The Hero</span>
                   </div>
                   <p className="text-[12px] text-slate-300 leading-relaxed font-medium pl-1 italic">{positioning?.hero || "Not defined yet..."}</p>
                </div>

                {/* Mechanism */}
                <div className={cn(
                   "p-4 rounded-[2rem] bg-gradient-to-br from-purple-500/[0.03] to-transparent border border-purple-500/10 group/card transition-all hover:bg-purple-500/[0.05] hover:border-purple-500/20 shadow-lg shadow-black/20",
                   pulseField === 'mechanism' && "ring-2 ring-purple-500/50 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.3)] animate-pulse"
                )}>
                   <div className="flex items-center gap-2 mb-2">
                      <div className="size-5 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Brain className="size-3 text-purple-500" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-500/80">The Mechanism</span>
                   </div>
                   <p className="text-[11px] text-foreground italic font-black leading-tight pl-1 drop-shadow-md">{positioning?.mechanism || "Not defined yet..."}</p>
                </div>
              </div>
          </div>

          {/* Viral Pattern Engine */}
          <div className="pt-4 border-t border-border/50">
            <PatternLibrary 
              patterns={narrative?.patternLibrary || []} 
              onSelect={onSelectPattern || (() => {})} 
              activeId={narrative?.activePatternId}
            />
          </div>

          {/* Content Seeds */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80 leading-none mb-1">Content Seeds</h3>
                <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Strategic Generation Anchors</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {(narrative?.seeds || []).length === 0 ? (
                <div className="p-6 rounded-[2rem] bg-secondary/10 border border-dashed border-border flex flex-col items-center text-center">
                  <Sparkles className="size-4 text-muted-foreground/30 mb-2" />
                  <p className="text-[9px] font-medium text-muted-foreground italic">Seeds emerge from strategy sessions...</p>
                </div>
              ) : (
                (narrative?.seeds as ContentSeed[]).map(seed => (
                  <div key={seed.id} className="p-3 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
                      <div>
                        <p className="text-[10px] font-black text-foreground uppercase tracking-wider">{seed.topic}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{seed.pillar}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="size-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Media Archive */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LayoutGrid className="size-4 text-slate-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Media Archive</h3>
              </div>
              <Badge variant="outline" className="border-white/10 text-slate-500 px-2 py-0.5 rounded-full text-[8px] font-bold">
                {videoPlans.length} Assets
              </Badge>
            </div>

            {videoPlans.length === 0 ? (
              <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem] p-12 text-center space-y-4">
                <div className="size-16 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-2">
                  <PlusCircle className="size-6 text-slate-700" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-white/40 uppercase tracking-widest text-sm italic">Archive Empty</h4>
                  <p className="text-slate-600 text-[10px] font-medium max-w-[200px] mx-auto leading-relaxed">
                    Chat with the Director to generate your first strategic angle.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videoPlans.map((plan: any) => (
                  <div 
                    key={plan.id} 
                    onClick={() => setPreviewPlan(plan)}
                    className="group relative bg-[#050505] border border-white/5 rounded-[2rem] overflow-hidden hover:border-white/20 transition-all duration-500 cursor-pointer shadow-xl hover:shadow-blue-500/5"
                  >
                    <div className="aspect-video relative overflow-hidden">
                      {plan.coverUrl ? (
                        <img src={plan.coverUrl} className="size-full object-cover group-hover:scale-110 transition-transform duration-700" alt={plan.title} />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          <FileText className="size-6" />
                          <span className="text-[7px] font-black uppercase">Draft</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <Badge className="bg-white/10 backdrop-blur-md border-white/10 text-[7px] font-black uppercase tracking-widest text-white/60 py-0 px-1.5 h-4">
                          {plan.status || 'draft'}
                        </Badge>
                        <div className="size-6 rounded-full bg-red-600 flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-300 shadow-xl shadow-red-600/40">
                          <Play className="size-2 text-white fill-current" />
                        </div>
                      </div>
                    </div>
                    <div className="px-1">
                      <div className="text-[10px] font-black text-foreground truncate uppercase tracking-widest italic mb-0.5">{plan.title || "Untitled Video"}</div>
                      <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                        {new Date(plan.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Strategic Foundations */}
          <div className="pt-8 border-t border-white/[0.03]">
             <details className="group">
               <summary className="flex items-center gap-3 cursor-pointer list-none">
                 <div className="size-8 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-slate-500 group-hover:text-white transition-colors">
                   <Target className="size-4" />
                 </div>
                 <div className="flex-1">
                   <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Foundations</h4>
                   <p className="text-[8px] text-slate-600 uppercase tracking-widest">Audience & Voice</p>
                 </div>
                 <PlusCircle className="size-3 text-slate-600 group-open:rotate-45 transition-transform" />
               </summary>
               
               <div className="space-y-4 pt-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-1.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Audience</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{narrative?.audience || "Not defined"}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-1.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Core Problem</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{narrative?.problem || "Not defined"}</p>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Voice Profile</span>
                    <Badge variant="outline" className="border-red-500/20 text-red-500 text-[8px] font-black uppercase px-2 py-0.5">{narrative?.voice || "neutral"}</Badge>
                  </div>
               </div>
             </details>
          </div>
        </div>
      </div>

      <PreviewDialog 
        isOpen={!!previewPlan}
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />
    </div>
  );
}
