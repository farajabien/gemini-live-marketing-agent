"use client";

import { useState, useMemo } from "react";
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
import { Search, Brain, Sparkles, Activity, PlusCircle, LayoutGrid, Target, ArrowRight, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";


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


  const narrativeQuery = useMemo(
    () => user ? { narratives: { $: { where: { id: narrativeId } } } } : null,
    [user?.id, narrativeId]
  );
  const { data, isLoading, error } = (db as any).useQuery(narrativeQuery);

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
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
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
            <StrengthGauge score={strength.overallScore} size="lg" />
          </div>
        )}
      </div>

      <Tabs defaultValue="strategy" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 px-1 mb-6 overflow-x-auto w-full justify-start h-12 rounded-2xl flex items-center gap-2">
          <TabsTrigger value="strategy" className="rounded-xl px-6 h-9 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all text-[11px] font-black uppercase tracking-widest gap-2">
            <Target className="size-3.5" /> Strategy
          </TabsTrigger>
          <TabsTrigger value="inputs" className="rounded-xl px-6 h-9 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all text-[11px] font-black uppercase tracking-widest gap-2">
            <Search className="size-3.5" /> Strategic Inputs
          </TabsTrigger>

          <TabsTrigger value="pulse" className="rounded-xl px-6 h-9 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all text-[11px] font-black uppercase tracking-widest gap-2">
            <Activity className="size-3.5" /> Narrative Pulse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategy" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 outline-none">
          {positioning ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">AI-Extracted Positioning</h2>
                  <p className="text-slate-400 text-sm">Strategic narrative elements identified from your inputs</p>
                </div>
                <Button
                  onClick={handleRegeneratePositioning}
                  disabled={isRegenerating}
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-9 rounded-full px-4"
                >
                  {isRegenerating ? (
                    <>
                      <Activity className="size-3.5 animate-spin mr-2" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Brain className="size-3.5 mr-2" />
                      Regenerate Strategy
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/[0.07] transition-colors relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Target className="size-16" />
                  </div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-black mb-4">The Villain</h3>
                  <p className="text-xl text-slate-200 leading-relaxed font-medium">{positioning.villain}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/[0.07] transition-colors relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Sparkles className="size-16" />
                  </div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-blue-500 font-black mb-4">The Hero</h3>
                  <p className="text-xl text-slate-200 leading-relaxed font-medium">{positioning.hero}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/[0.07] transition-colors relative overflow-hidden group">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-orange-500 font-black mb-4">The Stakes</h3>
                  <p className="text-xl text-slate-200 leading-relaxed font-medium">{positioning.stakes}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/[0.07] transition-colors relative overflow-hidden group">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-green-500 font-black mb-4">The Promise</h3>
                  <p className="text-xl text-slate-200 leading-relaxed font-medium">{positioning.promise}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:col-span-2 relative overflow-hidden group">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-purple-500 font-black mb-4">The Unique Mechanism</h3>
                  <p className="text-2xl font-black text-white leading-tight max-w-3xl">{positioning.mechanism}</p>
                </div>

                <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-3xl p-8 group">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-black mb-4">Before State</h3>
                  <p className="text-lg text-slate-300 leading-relaxed italic">"{positioning.contrast?.before}"</p>
                </div>

                <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-3xl p-8 group">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-green-500 font-black mb-4">After State</h3>
                  <p className="text-lg text-slate-300 leading-relaxed italic">"{positioning.contrast?.after}"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <Brain className="size-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Positioning data is not available yet.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inputs" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 outline-none pb-20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-white">Strategic Brief</h2>
              <p className="text-slate-400 text-sm">The foundational logic that drives your entire content engine</p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-slate-500 border-white/10 px-4 py-1.5 rounded-full">Foundation Data</Badge>
          </div>

          <div className="grid grid-cols-1 gap-12">
            {/* Market & Reality */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Target className="size-4 text-blue-500" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Market & Reality</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <NarrativeSection
                  narrativeId={narrativeId}
                  title="Target Audience"
                  field="audience"
                  value={narrative.audience || ""}
                  placeholder="e.g. Solo founders building in public..."
                />
                <NarrativeSection
                  narrativeId={narrativeId}
                  title="Current Reality"
                  field="currentState"
                  value={narrative.currentState || ""}
                  placeholder="What is their day-to-day like right now?"
                />
              </div>
            </div>

            {/* The Value Gap */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Brain className="size-4 text-red-500" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">The Value Gap</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <NarrativeSection
                  narrativeId={narrativeId}
                  title="The Expensive Pain"
                  field="problem"
                  value={narrative.problem || ""}
                  placeholder="What is the core problem keeping them stuck?"
                />
                <NarrativeSection
                  narrativeId={narrativeId}
                  title="Cost of Inaction"
                  field="costOfInaction"
                  value={narrative.costOfInaction || ""}
                  placeholder="What happens if they do nothing?"
                />
              </div>
            </div>

            {/* The Transformation */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Sparkles className="size-4 text-green-500" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">The Transformation</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2">
                  <NarrativeSection
                    narrativeId={narrativeId}
                    title="Unique Mechanism"
                    field="solution"
                    value={narrative.solution || ""}
                    placeholder="Your unique approach or system..."
                  />
                </div>
                <NarrativeSection
                  narrativeId={narrativeId}
                  title="The After State"
                  field="afterState"
                  value={narrative.afterState || ""}
                  placeholder="What does their life look like after using your system?"
                />
                <NarrativeSection
                  narrativeId={narrativeId}
                  title="Identity Shift"
                  field="identityShift"
                  value={narrative.identityShift || ""}
                  placeholder="Who do they become in the process?"
                />
              </div>
            </div>

            {/* Brand Voice Card */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-red-500/20 transition-all">
                  <Activity className="size-8 text-slate-500 group-hover:text-red-500 transition-colors" />
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1">Brand Voice Strategy</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-white capitalize">{narrative.voice || "calm"}</span>
                    <Badge variant="outline" className="text-[9px] border-red-500/20 text-red-500/60 font-black uppercase">Active</Badge>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="border-white/10 text-slate-400 hover:text-white rounded-full h-10 px-6 font-black uppercase tracking-widest text-[10px]">
                Adjust Voice
              </Button>
            </div>
          </div>
        </TabsContent>


        <TabsContent value="pulse" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 outline-none">
          {strength ? (
            <div className="space-y-12">
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <h2 className="text-4xl font-black text-white">Narrative Pulse Score</h2>
                <p className="text-slate-400">Comprehensive breakdown of how your narrative foundation performs across key strategic dimensions.</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-white/5 rounded-3xl p-8 flex flex-col items-center gap-6 border border-white/5">
                  <StrengthGauge score={strength.specificityScore} size="lg" />
                  <div className="text-center">
                    <h4 className="font-black text-white text-sm uppercase tracking-widest mb-1">Specificity</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Target Precision</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-3xl p-8 flex flex-col items-center gap-6 border border-white/5">
                  <StrengthGauge score={strength.emotionalClarity} size="lg" />
                  <div className="text-center">
                    <h4 className="font-black text-white text-sm uppercase tracking-widest mb-1">Clarity</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Emotional Impact</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-3xl p-8 flex flex-col items-center gap-6 border border-white/5">
                  <StrengthGauge score={strength.tensionStrength} size="lg" />
                  <div className="text-center">
                    <h4 className="font-black text-white text-sm uppercase tracking-widest mb-1">Tension</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Narrative Stakes</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-3xl p-8 flex flex-col items-center gap-6 border border-white/5">
                  <StrengthGauge score={strength.contrastScore} size="lg" />
                  <div className="text-center">
                    <h4 className="font-black text-white text-sm uppercase tracking-widest mb-1">Contrast</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Before vs After</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-red-600/10 to-transparent border border-red-600/20 rounded-3xl p-10 text-center space-y-6">
                <h3 className="text-3xl font-black text-white">Unlock Full Growth</h3>
                <p className="text-slate-400 max-w-xl mx-auto">Your overall narrative score of <strong>{Math.round(strength.overallScore)}/100</strong> shows a strong foundation. Use the content engine to build authority with consistent, strategic output.</p>
                <Button 
                  onClick={() => router.push(`/narrative/${narrativeId}/engine`)}
                  className="bg-red-600 hover:bg-red-700 text-white font-black rounded-full h-12 px-8 uppercase tracking-widest text-xs gap-2"
                >
                  Enter Content Engine <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <Activity className="size-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Score analysis is not available yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>

  );
}
