"use client"
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { firebaseDb as db } from "@/lib/firebase-client";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { createBrandNarrative, refineBrandNarrativeAction } from "@/app/actions/marketing";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AuthChoiceDialog } from "@/components/AuthChoiceDialog";
import { NARRATIVE_STEPS, type NarrativeStepId } from "@/lib/narrative-config";
import { RefineWithAIButton } from "@/components/RefineWithAIButton";

// shadcn
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type Step = NarrativeStepId | "generating" | "review";

interface WizardData {
  audience: string;
  currentState: string;
  problem: string;
  costOfInaction: string;
  solution: string;
  afterState: string;
  identityShift: string;
  voice: string;
}

export function NewNarrativeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resume");
  const { data: resumedData, isLoading: isResuming } = (db as any).useDoc(user ? "narratives" : null, resumeId);

  const [step, setStep] = useState<Step>(NARRATIVE_STEPS[0].id);
  const [data, setData] = useState<WizardData>({
    audience: "",
    currentState: "",
    problem: "",
    costOfInaction: "",
    solution: "",
    afterState: "",
    identityShift: "",
    voice: "calm",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const [generatedAnalysis, setGeneratedAnalysis] = useState<any>(null);
  const [narrativeId, setNarrativeId] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    // Only load from localStorage if not resuming from Firebase
    if (resumeId) return;

    const savedData = localStorage.getItem("narrative_wizard_data");
    const savedStep = localStorage.getItem("narrative_wizard_step");
    const savedAnalysis = localStorage.getItem("narrative_last_analysis");
    const savedId = localStorage.getItem("narrative_last_id");
    
    if (savedData) {
      try {
        setData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to parse saved narrative data", e);
      }
    }
    
    if (savedAnalysis) {
      try {
        setGeneratedAnalysis(JSON.parse(savedAnalysis));
        if (savedId) setNarrativeId(savedId);
        setStep("review" as any);
      } catch (e) {
        console.error("Failed to parse saved analysis", e);
      }
    } else if (savedStep && NARRATIVE_STEPS.some(s => s.id === savedStep)) {
      setStep(savedStep as Step);
    }
    
    setIsLoaded(true);
  }, [resumeId]);

  // Handle Resumption from Firebase
  useEffect(() => {
    if (resumeId && resumedData && !isResuming) {
       setData({
         audience: resumedData.audience || "",
         currentState: resumedData.currentState || "",
         problem: resumedData.problem || "",
         costOfInaction: resumedData.costOfInaction || "",
         solution: resumedData.solution || "",
         afterState: resumedData.afterState || "",
         identityShift: resumedData.identityShift || "",
         voice: resumedData.voice || "calm",
       });
       
       if (resumedData.step && NARRATIVE_STEPS.some(s => s.id === resumedData.step)) {
         setStep(resumedData.step as Step);
       }
       
       setIsLoaded(true);
    }
  }, [resumedData, isResuming, resumeId]);

  // Save to localStorage whenever data or step changes
  useEffect(() => {
    if (!isLoaded) return;
    
    localStorage.setItem("narrative_wizard_data", JSON.stringify(data));
    if (step !== "generating" && step !== "review") {
      localStorage.setItem("narrative_wizard_step", step);
    }
  }, [data, step, isLoaded]);

  const currentStepIndex = NARRATIVE_STEPS.findIndex((s) => s.id === step);
  const currentStep = NARRATIVE_STEPS[currentStepIndex];

  // Auto-trigger submit once user logs in if we were waiting
  useEffect(() => {
    if (user && showAuthChoice) {
      setShowAuthChoice(false);
      handleSubmit();
    }
  }, [user, showAuthChoice]);

  const nextStep = () => {
    if (currentStepIndex < NARRATIVE_STEPS.length - 1) {
      setStep(NARRATIVE_STEPS[currentStepIndex + 1].id);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setStep(NARRATIVE_STEPS[currentStepIndex - 1].id);
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
      const result = await createBrandNarrative(data, uid);
      
      setNarrativeId(result.narrativeId);
      setGeneratedAnalysis(result.analysis);
      
      // Backup to localStorage immediately
      localStorage.setItem("narrative_last_analysis", JSON.stringify(result.analysis));
      localStorage.setItem("narrative_last_id", result.narrativeId);
      
      toast.success("Brand Strategy designed!");
      setStep("review" as any);
      setIsSubmitting(false);
    } catch (error: any) {
      console.error("Failed to create narrative:", error);
      
      // If it's a Firestore error but we have the analysis (optimistically returned or from previous failure)
      // Check if we can extract analysis from error if createBrandNarrative was modified to return it? 
      // For now, we trust the server action to either succeed or throw.
      
      toast.error(error.message || "Something went wrong. Please try again.");
      setStep(NARRATIVE_STEPS[NARRATIVE_STEPS.length - 1].id);
      setIsSubmitting(false);
    }
  };

  const handleRefine = async () => {
    if (!narrativeId || !refineFeedback) return;
    
    setIsRefining(true);
    try {
      const uid = user!.id || (user as any).uid;
      const refined = await refineBrandNarrativeAction(narrativeId, refineFeedback, uid);
      setGeneratedAnalysis(refined);
      localStorage.setItem("narrative_last_analysis", JSON.stringify(refined));
      setRefineFeedback("");
      toast.success("Strategy refined!");
    } catch (e) {
      toast.error("Refinement failed");
    } finally {
      setIsRefining(false);
    }
  };

  const handleFinish = () => {
    localStorage.removeItem("narrative_wizard_data");
    localStorage.removeItem("narrative_wizard_step");
    localStorage.removeItem("narrative_last_analysis");
    localStorage.removeItem("narrative_last_id");
    router.push(`/narrative/${narrativeId}`);
  };

  const handleStartOver = () => {
    localStorage.removeItem("narrative_wizard_data");
    localStorage.removeItem("narrative_wizard_step");
    localStorage.removeItem("narrative_last_analysis");
    localStorage.removeItem("narrative_last_id");
    window.location.href = "/narrative/new"; // Hard refresh to clear state
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
              {NARRATIVE_STEPS.map((s, i) => {
                const isCompleted = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;

                return (
                  <div
                    key={s.id}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      isCompleted
                        ? "bg-red-600"
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
              <span className="text-red-500 font-bold tracking-widest text-xs uppercase mb-4 block">
                Step {currentStepIndex + 1} of {NARRATIVE_STEPS.length}
              </span>
              <h1 className="text-4xl font-black mb-4">{currentStep.title}</h1>
              <p className="text-slate-400 mb-8 text-lg">
                {currentStep.description}
              </p>
              
              {currentStep.type === "text" ? (
                <div className="relative group">
                  <Textarea
                    className="w-full bg-white/5 border-white/10 rounded-2xl p-6 text-xl min-h-[160px] pb-16 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-slate-600 resize-none"
                    placeholder={currentStep.placeholder}
                    value={data[currentStep.id as keyof WizardData]}
                    onChange={(e) => updateData(currentStep.id as keyof WizardData, e.target.value)}
                    autoFocus
                  />
                  <div className="absolute bottom-4 right-4 animate-in fade-in duration-300">
                    <RefineWithAIButton 
                      step={currentStep}
                      currentValue={data[currentStep.id as keyof WizardData]}
                      onRefined={(newVal) => updateData(currentStep.id as keyof WizardData, newVal)}
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
                          ? "border-red-500 bg-red-500/10"
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
                                ? "text-red-400"
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
                <div className="absolute inset-0 border-4 border-red-500/30 rounded-full animate-ping" />
                <div className="absolute inset-0 border-4 border-t-red-500 border-r-orange-500 border-b-transparent border-l-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-white">
                    neurology
                  </span>
                </div>
              </div>
              <h2 className="text-3xl font-black mb-4">
                Designing your Strategy...
              </h2>
              <p className="text-slate-400 text-lg max-w-md mx-auto">
                Our AI is analyzing your inputs to create a comprehensive Brand
                Positioning and Content Pillars.
              </p>
            </div>
          )}

          {step === "review" && generatedAnalysis && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto">
              <span className="text-red-500 font-bold tracking-widest text-xs uppercase mb-4 block">
                Brand Strategy Refinement
              </span>
              <h1 className="text-4xl font-black mb-8">Your Marketing Edge</h1>
              
              <div className="space-y-10 mb-12">
                <section>
                  <h3 className="text-red-500 font-bold uppercase text-xs tracking-wider mb-2">Positioning Statement</h3>
                  {generatedAnalysis.positioningStatement ? (
                    <p className="text-xl text-white leading-relaxed font-medium italic">"{generatedAnalysis.positioningStatement}"</p>
                  ) : (
                    <div className="p-4 bg-red-600/10 border border-red-500/20 rounded-xl">
                      <p className="text-red-400 text-sm font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Strategy data appears blank. This can happen if the AI fails to synthesize correctly or your cache is stale.
                      </p>
                      <Button 
                        variant="link" 
                        onClick={handleStartOver}
                        className="text-red-500 underline text-xs p-0 mt-2 h-auto"
                      >
                        Click here to clear session and try again
                      </Button>
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-red-500 font-bold uppercase text-xs tracking-wider mb-2">Core Message</h3>
                  <p className="text-slate-300 leading-relaxed text-lg">{generatedAnalysis.coreMessage}</p>
                </section>

                <section>
                  <h3 className="text-red-500 font-bold uppercase text-xs tracking-wider mb-4">Content Pillars</h3>
                  <div className="grid gap-6">
                    {generatedAnalysis.contentPillars?.map((pillar: any, i: number) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-colors hover:bg-white/10">
                        <h4 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center text-[10px]">
                            {i + 1}
                          </span>
                          {pillar.title}
                        </h4>
                        <p className="text-slate-400 text-sm mb-4">{pillar.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {pillar.angles?.map((angle: string, j: number) => (
                            <span key={j} className="text-[10px] bg-red-600/10 text-red-400 px-2.5 py-1 rounded-full border border-red-600/20 font-bold">
                              {angle}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-red-500 font-bold uppercase text-xs tracking-wider mb-2">Brand Voice</h3>
                  <p className="text-slate-400 leading-relaxed">{generatedAnalysis.brandVoice}</p>
                </section>
              </div>

              {/* Refinement Interface */}
              <div className="bg-red-600/5 border border-red-500/20 rounded-3xl p-8 mb-12">
                <h3 className="text-white font-bold mb-2">Not quite right?</h3>
                <p className="text-slate-400 text-sm mb-6">Tell the AI what to change or deepen. We'll regenerate the strategy instantly.</p>
                
                <Textarea
                  className="w-full bg-black/40 border-white/10 rounded-xl p-4 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-slate-600 resize-none mb-4"
                  placeholder="e.g. Focus more on developers as the audience, or make the tone more playful..."
                  value={refineFeedback}
                  onChange={(e) => setRefineFeedback(e.target.value)}
                  disabled={isRefining}
                />
                
                <Button 
                  onClick={handleRefine}
                  disabled={!refineFeedback || isRefining}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-full transition-all"
                >
                  {isRefining ? "Refining..." : "Refine Strategy"}
                  {!isRefining && <span className="material-symbols-outlined ml-2 text-sm">refresh</span>}
                </Button>
              </div>

              <div className="flex justify-between items-center opacity-50 hover:opacity-100 transition-opacity">
                 <button 
                  onClick={handleStartOver}
                  className="text-slate-500 text-xs flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Start Over (Clear Cache)
                </button>
                <div className="text-[10px] text-slate-600">ID: {narrativeId}</div>
              </div>
              <div className="flex justify-end gap-4 border-t border-white/5 pt-8">
                 <Button
                  variant="ghost"
                  onClick={() => setStep(NARRATIVE_STEPS[NARRATIVE_STEPS.length - 1].id)}
                  className="text-slate-400 hover:text-white"
                >
                  Back to Inputs
                </Button>
                <Button 
                  onClick={handleFinish}
                  className="bg-white text-black hover:bg-slate-200 font-black px-12 py-6 h-auto text-lg rounded-full shadow-2xl shadow-white/10"
                >
                  Confirm Strategy
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
                className="px-8 py-4 h-auto bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                {currentStepIndex === NARRATIVE_STEPS.length - 1 ? "Preview Strategy" : "Continue"}
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
