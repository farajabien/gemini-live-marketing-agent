"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StrengthGauge } from "./StrengthGauge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Target, Sparkles, Activity, Brain, FileText, CheckCircle2, Play, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { VideoPlan } from "@/lib/types";

interface NarrativeCanvasProps {
  narrative: any;
  videoPlans: VideoPlan[];
  isGeneratingTitle?: boolean;
  onGenerateSmartTitle?: () => void;
  onUpdateField?: (field: string, value: string) => void;
}

export function NarrativeCanvas({ 
  narrative, 
  videoPlans, 
  isGeneratingTitle, 
  onGenerateSmartTitle,
  onUpdateField 
}: NarrativeCanvasProps) {
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);
  
  const positioning = narrative?.aiPositioning;
  const strength = narrative?.narrativeStrength;

  return (
    <div className="h-full flex flex-col bg-[#020205] border-l border-white/[0.03] overflow-hidden">
      {/* Header / Stats Strip */}
      <div className="px-5 py-3 border-b border-white/[0.03] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="size-8 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
             <Target className="size-4 text-slate-400" />
           </div>
           <div>
             <h2 className="text-[11px] font-black text-white tracking-tight leading-none mb-0.5 uppercase">Narrative Canvas</h2>
             <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Live Strategic State</div>
           </div>
        </div>
        
        {strength && (
          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl px-3 py-1.5 transition-all hover:bg-white/[0.05]">
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
                <div className="p-3 rounded-2xl bg-red-500/[0.02] border border-red-500/10 group/card transition-all hover:bg-red-500/[0.04]">
                   <div className="flex items-center gap-2 mb-1.5">
                      <Activity className="size-3 text-red-500/60" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-red-500/60">The Villain</span>
                   </div>
                   <p className="text-[11px] text-slate-300 leading-relaxed font-medium">{positioning?.villain || "Not defined yet..."}</p>
                </div>

                {/* Hero */}
                <div className="p-3 rounded-2xl bg-blue-500/[0.02] border border-blue-500/10 group/card transition-all hover:bg-blue-500/[0.04]">
                   <div className="flex items-center gap-2 mb-1.5">
                      <Target className="size-3 text-blue-500/60" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-500/60">The Hero</span>
                   </div>
                   <p className="text-[11px] text-slate-300 leading-relaxed font-medium">{positioning?.hero || "Not defined yet..."}</p>
                </div>

                {/* Mechanism */}
                <div className="p-3 rounded-2xl bg-purple-500/[0.02] border border-purple-500/10 group/card transition-all hover:bg-purple-500/[0.04]">
                   <div className="flex items-center gap-2 mb-1.5">
                      <Brain className="size-3 text-purple-500/60" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-purple-500/60">The Mechanism</span>
                   </div>
                   <p className="text-[10px] text-white italic font-black leading-tight">{positioning?.mechanism || "Not defined yet..."}</p>
                </div>
              </div>
          </div>

          {/* Media Archive */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LayoutGrid className="size-4 text-slate-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Media Archive</h3>
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
                    className="bg-white/5 border border-white/10 rounded-[1.5rem] p-3 flex flex-col gap-3 hover:bg-white/10 transition-all group cursor-pointer border-transparent hover:border-white/20"
                  >
                    <div className="aspect-video rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden relative">
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
                      <div className="text-[10px] font-black text-white truncate uppercase tracking-widest italic mb-0.5">{plan.title || "Untitled Video"}</div>
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
