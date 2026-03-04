"use client"
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { firebaseDb as db } from "@/lib/firebase-client";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { createSeriesNarrative, refineSeriesNarrativeAction } from "@/app/actions/marketing";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AuthChoiceDialog } from "@/components/AuthChoiceDialog";
import { SERIES_NARRATIVE_STEPS, type SeriesNarrativeStepId } from "@/lib/series-narrative-config";
import { RefineWithAIButton } from "@/components/RefineWithAIButton";

// shadcn
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type Step = SeriesNarrativeStepId | "generating" | "review";

interface WizardData {
  genre: string;
  worldSetting: string;
  conflictType: string;
  protagonistArchetype: string;
  centralTheme: string;
  narrativeTone: string;
  visualStyle: string;
  episodeHooks: string;
}

export function NewSeriesNarrativeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resume");
  const { data: resumedData, isLoading: isResuming } = (db as any).useDoc(user ? "seriesNarratives" : null, resumeId);

  const [step, setStep] = useState<Step>(SERIES_NARRATIVE_STEPS[0].id);
  const [data, setData] = useState<WizardData>({
    genre: "sci-fi",
    worldSetting: "",
    conflictType: "internal",
    protagonistArchetype: "hero",
    centralTheme: "",
    narrativeTone: "stoic",
    visualStyle: "",
    episodeHooks: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const [generatedAnalysis, setGeneratedAnalysis] = useState<any>(null);
  const [seriesNarrativeId, setSeriesNarrativeId] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    // Only load from localStorage if not resuming from Firebase
    if (resumeId) return;

    const savedData = localStorage.getItem("series_narrative_wizard_data");
    const savedStep = localStorage.getItem("series_narrative_wizard_step");
    
    if (savedData) {
      try {
        setData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to parse saved series narrative data", e);
      }
    }
    
    if (savedStep && SERIES_NARRATIVE_STEPS.some(s => s.id === savedStep)) {
      setStep(savedStep as Step);
    }
    
    setIsLoaded(true);
  }, [resumeId]);

  // Handle Resumption from Firebase
  useEffect(() => {
    if (resumeId && resumedData && !isResuming) {
       setData({
         genre: resumedData.genre || "sci-fi",
         worldSetting: resumedData.worldSetting || "",
         conflictType: resumedData.conflictType || "internal",
         protagonistArchetype: resumedData.protagonistArchetype || "hero",
         centralTheme: resumedData.centralTheme || "",
         narrativeTone: resumedData.narrativeTone || "stoic",
         visualStyle: resumedData.visualStyle || "",
         episodeHooks: resumedData.episodeHooks || "",
       });
       
       if (resumedData.step && SERIES_NARRATIVE_STEPS.some(s => s.id === resumedData.step)) {
         setStep(resumedData.step as Step);
       }
       
       setIsLoaded(true);
    }
  }, [resumedData, isResuming, resumeId]);

  // Save to localStorage whenever data or step changes
  useEffect(() => {
    if (!isLoaded) return;
    
    localStorage.setItem("series_narrative_wizard_data", JSON.stringify(data));
    if (step !== "generating" && step !== "review") {
      localStorage.setItem("series_narrative_wizard_step", step);
    }
  }, [data, step, isLoaded]);

  const currentStepIndex = SERIES_NARRATIVE_STEPS.findIndex((s) => s.id === step);
  const currentStep = SERIES_NARRATIVE_STEPS[currentStepIndex];

  // Auto-trigger submit once user logs in if we were waiting
  useEffect(() => {
    if (user && showAuthChoice) {
      setShowAuthChoice(false);
      handleSubmit();
    }
  }, [user, showAuthChoice]);

  const nextStep = () => {
    if (currentStepIndex < SERIES_NARRATIVE_STEPS.length - 1) {
      setStep(SERIES_NARRATIVE_STEPS[currentStepIndex + 1].id);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setStep(SERIES_NARRATIVE_STEPS[currentStepIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      setShowAuthChoice(true);
      return;
    }

    setIsSubmitting(true);
    setStep("generating");

    try {
      const uid = user.id || (user as any).uid;
      const result = await createSeriesNarrative(data, uid);
      
      setSeriesNarrativeId(result.seriesNarrativeId);
      setGeneratedAnalysis(result.analysis);
      
      toast.success("Series Architecture generated!");
      setStep("review" as any);
      setIsSubmitting(false);
    } catch (error: any) {
      console.error("Failed to create series narrative:", error);
      toast.error(error.message || "Something went wrong. Please try again.");
      setStep(SERIES_NARRATIVE_STEPS[SERIES_NARRATIVE_STEPS.length - 1].id);
      setIsSubmitting(false);
    }
  };

  const handleRefine = async () => {
    if (!seriesNarrativeId || !refineFeedback) return;
    
    setIsRefining(true);
    try {
      const uid = user!.id || (user as any).uid;
      const refined = await refineSeriesNarrativeAction(seriesNarrativeId, refineFeedback, uid);
      setGeneratedAnalysis(refined); // Update view with refined data
      setRefineFeedback("");
      toast.success("Architecture refined!");
    } catch (e) {
      toast.error("Refinement failed");
    } finally {
      setIsRefining(false);
    }
  };

  const handleFinish = () => {
    localStorage.removeItem("series_narrative_wizard_data");
    localStorage.removeItem("series_narrative_wizard_step");
    router.push(`/series/new?narrativeId=${seriesNarrativeId}`);
  };

  const updateData = (key: keyof WizardData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-[#050510] font-sans text-slate-100 flex flex-col">
      <Header transparent />

      <main className="flex-1 flex flex-col items-center justify-center p-6 pt-24">
        <div className="max-w-xl w-full">
          {/* Progress */}
          {step !== "generating" && (
            <div className="flex items-center gap-2 mb-8">
              {SERIES_NARRATIVE_STEPS.map((s, i) => {
                const isCompleted = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;

                return (
                  <div
                    key={s.id}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      isCompleted
                        ? "bg-purple-600"
                        : isCurrent
                          ? "bg-white"
                          : "bg-white/10"
                    )}
                  />
                );
              })}
            </div>
          )}

          {step !== "generating" && currentStep && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300" key={step}>
              <span className="text-purple-500 font-bold tracking-widest text-xs uppercase mb-4 block">
                Story Architecture — Step {currentStepIndex + 1} of {SERIES_NARRATIVE_STEPS.length}
              </span>
              <h1 className="text-4xl font-black mb-4">{currentStep.title}</h1>
              <p className="text-slate-400 mb-8 text-lg">
                {currentStep.description}
              </p>
              
              {currentStep.type === "text" ? (
                <div className="relative group">
                  <Textarea
                    className="w-full bg-white/5 border-white/10 rounded-2xl p-6 text-xl min-h-[160px] pb-16 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-slate-600 resize-none"
                    placeholder={currentStep.placeholder}
                    value={data[currentStep.id as keyof WizardData]}
                    onChange={(e) => updateData(currentStep.id as keyof WizardData, e.target.value)}
                    autoFocus
                  />
                  <div className="absolute bottom-4 right-4 animate-in fade-in duration-300">
                    <RefineWithAIButton 
                      step={currentStep as any}
                      currentValue={data[currentStep.id as keyof WizardData]}
                      onRefined={(newVal) => updateData(currentStep.id as keyof WizardData, newVal)}
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentStep.choices?.map((choice) => (
                    <Card
                      key={choice.value}
                      className={cn(
                        "cursor-pointer transition-all hover:scale-[1.02]",
                        data[currentStep.id as keyof WizardData] === choice.value
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                      onClick={() => updateData(currentStep.id as keyof WizardData, choice.value)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={cn(
                              "material-symbols-outlined",
                              data[currentStep.id as keyof WizardData] === choice.value
                                ? "text-purple-400"
                                : "text-slate-500"
                            )}
                          >
                            {choice.icon}
                          </span>
                          <h3 className="font-bold text-white">{choice.label}</h3>
                        </div>
                        <p className="text-sm text-slate-400">
                          {choice.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "generating" && (
            <div className="text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full animate-ping" />
                <div className="absolute inset-0 border-4 border-t-purple-500 border-r-indigo-500 border-b-transparent border-l-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-white">
                    auto_stories
                  </span>
                </div>
              </div>
              <h2 className="text-3xl font-black mb-4">
                Architecting your Series...
              </h2>
              <p className="text-slate-400 text-lg max-w-md mx-auto">
                Our AI is weaving your story elements into a cohesive World Narrative and Character Arc.
              </p>
            </div>
          )}

          {step === "review" && generatedAnalysis && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              <span className="text-purple-500 font-bold tracking-widest text-xs uppercase mb-4 block">
                Narrative Architecture Refinement
              </span>
              <h1 className="text-4xl font-black mb-6">{generatedAnalysis.title}</h1>
              
              <div className="space-y-8 mb-12">
                <section>
                  <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-2">Logline</h3>
                  <p className="text-xl text-white leading-relaxed">{generatedAnalysis.logline}</p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section>
                    <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-2">Character Dynamics</h3>
                    <p className="text-slate-400 leading-relaxed">{generatedAnalysis.characterDynamics}</p>
                  </section>
                  <section>
                    <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-2">Visual Moat</h3>
                    <p className="text-slate-400 leading-relaxed">{generatedAnalysis.visualMoat}</p>
                  </section>
                </div>

                <section>
                  <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-3">Major Plot Beats</h3>
                  <div className="space-y-4">
                    {generatedAnalysis.plotBeats?.map((beat: string, i: number) => (
                      <div key={i} className="flex gap-4 items-start bg-white/5 p-4 rounded-xl border border-white/10 transition-colors hover:bg-white/10">
                        <span className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-slate-200">{beat}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-3">World Rules</h3>
                  <div className="flex flex-wrap gap-2">
                    {generatedAnalysis.worldRules?.map((rule: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full text-sm">
                        {rule}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              {/* Refinement Interface */}
              <div className="bg-purple-600/5 border border-purple-500/20 rounded-3xl p-8 mb-12">
                <h3 className="text-white font-bold mb-2">Not quite right?</h3>
                <p className="text-slate-400 text-sm mb-6">Tell the AI what to change or deepen. We'll regenerate the architecture instantly.</p>
                
                <Textarea
                  className="w-full bg-black/40 border-white/10 rounded-xl p-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-slate-600 resize-none mb-4"
                  placeholder="e.g. Make the villain more mysterious, or focus more on the underwater elements..."
                  value={refineFeedback}
                  onChange={(e) => setRefineFeedback(e.target.value)}
                  disabled={isRefining}
                />
                
                <Button 
                  onClick={handleRefine}
                  disabled={!refineFeedback || isRefining}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-full transition-all"
                >
                  {isRefining ? "Refining..." : "Refine Architecture"}
                  {!isRefining && <span className="material-symbols-outlined ml-2 text-sm">refresh</span>}
                </Button>
              </div>

              <div className="flex justify-end gap-4 border-t border-white/5 pt-8">
                 <Button
                  variant="ghost"
                  onClick={() => setStep(SERIES_NARRATIVE_STEPS[SERIES_NARRATIVE_STEPS.length - 1].id)}
                  className="text-slate-400 hover:text-white"
                >
                  Re-edit Inputs
                </Button>
                <Button 
                  onClick={handleFinish}
                  className="bg-white text-black hover:bg-slate-200 font-black px-12 py-6 h-auto text-lg rounded-full shadow-2xl shadow-white/10"
                >
                  Confirm Architecture
                  <span className="material-symbols-outlined ml-2">check_circle</span>
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step !== "generating" && step !== "review" && (
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-white/5">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="text-slate-400 hover:text-white disabled:opacity-0 disabled:pointer-events-none"
              >
                Back
              </Button>

              <Button
                onClick={nextStep}
                disabled={
                  currentStep?.type === "text" && 
                  (data[currentStep.id as keyof WizardData] as string).length < 5
                }
                className="px-8 py-4 h-auto bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                {currentStepIndex === SERIES_NARRATIVE_STEPS.length - 1 ? "Preview Architecture" : "Continue"}
                <span className="material-symbols-outlined ml-2">
                  arrow_forward
                </span>
              </Button>
            </div>
          )}
        </div>
      </main>

      <AuthChoiceDialog 
        isOpen={showAuthChoice} 
        onClose={() => setShowAuthChoice(false)}
        onContinueAsGuest={() => setShowAuthChoice(false)}
      />
    </div>
  );
}
