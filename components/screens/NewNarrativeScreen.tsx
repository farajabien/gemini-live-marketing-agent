"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { createBrandNarrative } from "@/app/actions/marketing";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AuthChoiceDialog } from "@/components/AuthChoiceDialog";
import { NARRATIVE_STEPS, type NarrativeStepId } from "@/lib/narrative-config";
import { RefineWithAIButton } from "@/components/RefineWithAIButton";

// shadcn
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type Step = NarrativeStepId | "generating";

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
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("narrative_wizard_data");
    const savedStep = localStorage.getItem("narrative_wizard_step");
    
    if (savedData) {
      try {
        setData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to parse saved narrative data", e);
      }
    }
    
    if (savedStep && NARRATIVE_STEPS.some(s => s.id === savedStep)) {
      setStep(savedStep as Step);
    }
    
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever data or step changes
  useEffect(() => {
    if (!isLoaded) return;
    
    localStorage.setItem("narrative_wizard_data", JSON.stringify(data));
    if (step !== "generating") {
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
      const userId = user.id || (user as any).uid;
      const result = await createBrandNarrative(data, userId);
      
      // Clear localStorage on success
      localStorage.removeItem("narrative_wizard_data");
      localStorage.removeItem("narrative_wizard_step");
      
      toast.success("Strategy designed successfully!");
      router.push(`/narrative/${result.narrativeId}`);
    } catch (error: any) {
      console.error("Failed to create narrative:", error);
      toast.error(error.message || "Something went wrong. Please try again.");
      setStep(NARRATIVE_STEPS[NARRATIVE_STEPS.length - 1].id);
      setIsSubmitting(false);
    }
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

          {/* Navigation */}
          {step !== "generating" && (
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
                {currentStepIndex === NARRATIVE_STEPS.length - 1 ? "Generate Strategy" : "Continue"}
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
