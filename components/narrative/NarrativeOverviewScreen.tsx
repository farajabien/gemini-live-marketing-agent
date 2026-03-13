"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { firebaseDb as db } from "@/lib/firebase-client";
import { AuthScreen } from "@/components/screens/AuthScreen";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NarrativeSection } from "./NarrativeSection";
import { StrengthGauge } from "./StrengthGauge";
import { updateNarrativeField, regeneratePositioning, generateSmartTitleAction } from "@/app/actions/marketing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Brain, Sparkles, Activity, PlusCircle, LayoutGrid, Target, ArrowRight, FileText, CheckCircle2, Play, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { VideoPlan } from "@/lib/types";
import { useCollection } from "@/hooks/use-firestore";


interface NarrativeOverviewScreenProps {
  narrativeId: string;
}

export function NarrativeOverviewScreen({ narrativeId }: NarrativeOverviewScreenProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditingOneLiner, setIsEditingOneLiner] = useState(false);
  const [editedOneLiner, setEditedOneLiner] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);


  const query = useMemo(
    () => user ? { 
      narratives: { $: { where: { id: narrativeId } } },
      videoPlans: { $: { where: { narrativeId: narrativeId }, order: { createdAt: "desc" }, limit: 8 } }
    } : null,
    [user?.id, narrativeId]
  );
  const { data, isLoading, error } = (db as any).useQuery(query);

  const { data: chatMessages } = useCollection(`narratives/${narrativeId}/chat_messages`, {
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit: 1
  });

  const lastDirectorMessage = chatMessages?.find(m => m.role === 'model');

  // Chat Onboarding Auto-Pop
  useEffect(() => {
    const narrative = (data as any)?.narratives?.[0];
    if (!isLoading && narrative && narrative.narrativeStrength?.overallScore === 0) {
      const fabToggle = document.querySelector('[data-director-fab]') as HTMLButtonElement;
      if (fabToggle) {
        // Small delay to ensure layout is ready
        setTimeout(() => {
          if (!document.querySelector('[data-director-dialog]')) {
            fabToggle.click();
          }
        }, 800);
      }
    }
  }, [isLoading, data, narrativeId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Brain className="size-8 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Query Error</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error.message || "Failed to load narrative data. Please try again."}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-white/10 text-white hover:bg-white/5">
          Retry Connection
        </Button>
      </div>
    );
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const narrative = (data as any)?.narratives?.[0];

  if (!narrative) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-black mb-2">Narrative not found</h1>
        <Link href="/dashboard" className="text-red-600 font-bold hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const handleRegeneratePositioning = async () => {
    setIsRegenerating(true);
    try {
      await regeneratePositioning(narrativeId, user.id || (user as any).uid);
    } catch (error) {
      console.error("Failed to regenerate positioning:", error);
      alert("Failed to regenerate positioning. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === narrative.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      await updateNarrativeField(narrativeId, "title", editedTitle, user.id);
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update title:", error);
      alert("Failed to update title. Please try again.");
    }
  };

  const handleSaveOneLiner = async () => {
    if (editedOneLiner === narrative.oneLiner) {
      setIsEditingOneLiner(false);
      return;
    }

    try {
      await updateNarrativeField(narrativeId, "oneLiner", editedOneLiner, user.id);
      setIsEditingOneLiner(false);
    } catch (error) {
      console.error("Failed to update one-liner:", error);
      alert("Failed to update one-liner. Please try again.");
    }
  };


const positioning = narrative.aiPositioning;
    const strength = narrative.narrativeStrength;


  const handleGenerateSmartTitle = async () => {
    setIsGeneratingTitle(true);
    try {
      await generateSmartTitleAction(narrativeId, user.id || (user as any).uid);
    } catch (error) {
      console.error("Failed to generate smart title:", error);
      alert("Failed to generate smart title. Please try again.");
    } finally {
      setIsGeneratingTitle(false);
    }
  };


    
  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex-1 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 mb-2 w-full max-w-2xl">
                <input
                  type="text"
                  autoFocus
                  className="bg-white/5 border border-red-500/50 rounded-lg px-3 py-1 text-4xl font-black text-white outline-none w-full"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setIsEditingTitle(false);
                      setEditedTitle(narrative.title);
                    }
                  }}
                />
              </div>
            ) : (
              <h1 
                className="text-4xl font-black mb-2 text-white flex items-center gap-3 group cursor-pointer"
                onClick={() => {
                  setEditedTitle(narrative.title);
                  setIsEditingTitle(true);
                }}
              >
                {narrative.title}
                <span className="material-symbols-outlined text-slate-600 group-hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-all">
                  edit
                </span>
              </h1>
            )}

            <div className="mt-1 sm:mt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSmartTitle}
                disabled={isGeneratingTitle}
                className="border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-400 hover:bg-red-500/10 h-8 rounded-full gap-1.5"
              >
                {isGeneratingTitle ? (
                  <Activity className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Smart Title
              </Button>
            </div>
          </div>

          {isEditingOneLiner ? (
            <div className="flex items-center gap-2 max-w-3xl">
              <input
                type="text"
                autoFocus
                className="bg-white/5 border border-red-500/30 rounded-lg px-3 py-1 text-slate-400 outline-none w-full"
                value={editedOneLiner}
                onChange={(e) => setEditedOneLiner(e.target.value)}
                onBlur={handleSaveOneLiner}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveOneLiner();
                  if (e.key === "Escape") {
                    setIsEditingOneLiner(false);
                    setEditedOneLiner(narrative.oneLiner || "");
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Story Hook
              </span>
              <p 
                className="text-slate-400 group/one cursor-pointer flex items-center gap-2"
                onClick={() => {
                  setEditedOneLiner(narrative.oneLiner || "");
                  setIsEditingOneLiner(true);
                }}
              >
                {narrative.oneLiner || "Your strategic narrative foundation for all content"}
                <span className="material-symbols-outlined text-slate-700 group-hover/one:text-red-400 text-xs opacity-0 group-hover/one:opacity-100 transition-all">
                  edit
                </span>
              </p>
            </div>
          )}
        </div>

        {strength && (
          <div className="shrink-0 mt-4 md:mt-0">
             <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-4">
               <StrengthGauge score={strength.overallScore} size="xs" />
               <div className="space-y-0.5">
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Narrative Health</div>
                  <div className="text-sm font-black text-white">{Math.round(strength.overallScore)}%</div>
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Strategic Intelligence Strip */}
      {positioning && (
        <div className="bg-gradient-to-r from-blue-600/5 to-transparent border border-white/5 rounded-[2rem] p-6 group">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <div className="text-[9px] font-black uppercase tracking-widest text-red-500/60 flex items-center gap-1.5">
                    <Activity className="size-3" /> The Villain
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed line-clamp-3">{positioning.villain}</p>
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] font-black uppercase tracking-widest text-blue-500/60 flex items-center gap-1.5">
                    <Target className="size-3" /> The Hero
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed line-clamp-3">{positioning.hero}</p>
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] font-black uppercase tracking-widest text-purple-500/60 flex items-center gap-1.5">
                    <Brain className="size-3" /> The Mechanism
                  </div>
                  <p className="text-[11px] text-white font-black italic leading-tight line-clamp-3">{positioning.mechanism}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between md:justify-end gap-6 md:border-l md:border-white/5 md:pl-8">
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-600 mb-2">Specificity</div>
                  <StrengthGauge score={strength?.specificityScore || 0} size="xs" />
                </div>
                <div className="text-center">
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-600 mb-2">Tension</div>
                  <StrengthGauge score={strength?.tensionStrength || 0} size="xs" />
                </div>
              </div>
              <Button 
                onClick={() => {
                  const fabToggle = document.querySelector('[data-director-fab]') as HTMLButtonElement;
                  if (fabToggle) fabToggle.click();
                }}
                className="size-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 group/btn"
              >
                <Sparkles className="size-5 group-hover/btn:animate-pulse" />
              </Button>
            </div>
          </div>

          {lastDirectorMessage && (
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[8px] font-black uppercase tracking-widest text-blue-400">
                  Latest Insight
                </div>
                <p className="text-[10px] text-slate-400 italic line-clamp-1">"{lastDirectorMessage.text}"</p>
              </div>
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 whitespace-nowrap">
                Director Intelligence Standby
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutGrid className="size-5 text-slate-500" />
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Media Archive</h3>
          </div>
          <div className="flex items-center gap-4">
            {narrative.audience && (
              <Badge variant="ghost" className="text-[9px] font-black uppercase tracking-widest text-slate-500 gap-2 border border-white/5 hover:bg-white/5 px-3">
                Targeting: {narrative.audience}
              </Badge>
            )}
            <Badge variant="outline" className="border-white/10 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold">
              {(data as any)?.videoPlans?.length || 0} Assets
            </Badge>
          </div>
        </div>

        {((data as any)?.videoPlans?.length || 0) === 0 ? (
          <div className="bg-white/5 border border-dashed border-white/10 rounded-[3rem] p-20 text-center space-y-4">
            <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="size-8 text-slate-600" />
            </div>
            <div className="space-y-2">
              <h4 className="font-black text-white uppercase tracking-widest text-lg italic">The Grid is Empty</h4>
              <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                Trigger the Director to generate your first content angle or stress-test the transformation.
              </p>
            </div>
            <Button 
              onClick={() => {
                const fabToggle = document.querySelector('[data-director-fab]') as HTMLButtonElement;
                if (fabToggle) fabToggle.click();
              }}
              variant="outline"
              className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10 font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl mt-4"
            >
              Start Brainstorming
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(data as any).videoPlans.map((plan: any) => (
              <div 
                key={plan.id} 
                onClick={() => setPreviewPlan(plan)}
                className="bg-white/5 border border-white/10 rounded-[1.5rem] p-4 flex flex-col gap-4 hover:bg-white/10 transition-all group cursor-pointer border-transparent hover:border-white/20"
              >
                <div className="aspect-video rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden relative">
                  {plan.coverUrl ? (
                    <img src={plan.coverUrl} className="size-full object-cover group-hover:scale-110 transition-transform duration-700" alt={plan.title} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <FileText className="size-8" />
                      <span className="text-[8px] font-black uppercase">Draft Asset</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <Badge className="bg-white/10 backdrop-blur-md border-white/10 text-[8px] font-black uppercase tracking-widest text-white/60 py-0 px-2 h-5">
                      {plan.status || 'draft'}
                    </Badge>
                    <div className="size-8 rounded-full bg-red-600 flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-300 shadow-xl shadow-red-600/40">
                      <Play className="size-3 text-white fill-current" />
                    </div>
                  </div>
                </div>
                <div className="px-1">
                  <div className="text-[11px] font-black text-white truncate uppercase tracking-widest italic mb-1">{plan.title || "Untitled Video"}</div>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                    {(plan.scripts?.length || 0) > 0 && (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="size-3" /> Scripted
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Foundational Inputs Collapsible Strip */}
        <div className="pt-12 border-t border-white/5">
          <details className="group">
            <summary className="flex items-center gap-3 cursor-pointer list-none">
              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-white transition-colors">
                <Target className="size-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Strategic Foundations</h4>
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">Audience, Problem & Core Voice</p>
              </div>
              <div className="text-slate-600 group-hover:text-red-500 transition-colors mr-4">
                <PlusCircle className="size-4 group-open:rotate-45 transition-transform" />
              </div>
            </summary>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 animate-in slide-in-from-top-2 duration-300">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Target Audience</span>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{narrative.audience || "Not defined"}</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Core Problem</span>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{narrative.problem || "Not defined"}</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Market Voice</span>
                <div className="pt-1">
                  <Badge variant="outline" className="border-red-500/20 text-red-500 text-[9px] font-black uppercase px-3 py-1">{narrative.voice || "calm"}</Badge>
                </div>
              </div>
            </div>
          </details>
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
