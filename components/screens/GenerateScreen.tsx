"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {  generateVideoPlanWithOptions } from "@/lib/ai/generation";
import { preprocessVerbatimScript } from "@/lib/ai/script-preprocessor";
import { generatePositioningAction } from "@/app/actions/marketing";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { id } from "@/lib/utils/id";
import { tx } from "@/lib/firebase-tx";
import { VoiceSelector } from "@/components/VoiceSelector";
import { uploadFile, getFileUrl } from "@/lib/instantdb-storage";
import { Header } from "@/components/Header";
import { AuthChoiceDialog } from "@/components/AuthChoiceDialog";
import { GenerationDialog } from "@/components/GenerationDialog";
import type { ContentSettings, VideoPlan, VoiceTone, ContentPiece } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";
import { useGenerateStore } from "@/hooks/use-generate-store";
import {
  DEFAULT_SETTINGS,
  OUTPUT_PRESETS,
  saveSettingsToLocalStorage,
  loadSettingsFromLocalStorage,
} from "@/lib/content-settings";
import Image from "next/image";

// shadcn components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Clapperboard, Layout, Mic, MicOff, Settings2, Share2, Save, Trash, RefreshCw, ChevronRight, Play, Info, Video, CheckCircle2 } from "lucide-react";
import type { FounderNarrative } from "@/lib/types";

interface GenerateScreenProps {
  initialPlanId?: string;
  isModal?: boolean;
  onClose?: () => void;
  hideHeader?: boolean;
  activeNarrativeId?: string;
}

export function GenerateScreen({ initialPlanId, isModal = false, onClose, hideHeader = false, activeNarrativeId: propNarrativeId }: GenerateScreenProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<"video" | "carousel">("video");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [isLoadingPlan, setIsLoadingPlan] = useState(!!initialPlanId);

  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(initialPlanId || null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saving" | "saved" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("JBFqnCBsd6RMkjVDRZzb"); // Default: Sarah
  const [settings, setSettings] = useState<ContentSettings>(DEFAULT_SETTINGS);
  const [visualMode, setVisualMode] = useState<"image" | "broll" | "gif_voice">("image"); // Pro only for broll
  const [verbatimMode, setVerbatimMode] = useState(false); // Use exact script for voiceover
  const [verbatimTone, setVerbatimTone] = useState<VoiceTone>("neutral"); // Tone affects prosody only
  const [seamlessMode, setSeamlessMode] = useState(false); // Carousel only: seamless transitions
  const [autoCleanScript, setAutoCleanScript] = useState(true); // Auto-preprocess scripts for verbatim mode
  
  // Strategic Inputs (Unified Narrative)
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [showStrategy, setShowStrategy] = useState(false);


  const { user, refreshToken, signInAsGuest, isLoading: isAuthLoading } = useAuth();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showAuthChoice, setShowAuthChoice] = useState(false);

  // Narrative (Project) context
  const [selectedNarrativeId, setSelectedNarrativeId] = useState<string | undefined>(propNarrativeId);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>(undefined);
  
  // Fetch ALL user narratives for the project selection
  const { data: narrativesData } = (db as any).useQuery(
    user
      ? { narratives: { $: { where: { userId: user.id }, order: { createdAt: "desc" } } } }
      : null
  );
  const narratives = (narrativesData?.narratives || []) as FounderNarrative[];
  
  // Fetch approved content pieces for the selected narrative
  const { data: draftsData } = (db as any).useQuery(
    user && selectedNarrativeId && selectedNarrativeId !== "new"
      ? { 
          narratives: { 
            $: { where: { id: selectedNarrativeId } },
            contentPieces: {
              $: { 
                where: { 
                    status: { "in": ["approved", "published"] } 
                },
                order: { createdAt: "desc" } 
              },
              generatedPlans: {}
            }
          } 
        }
      : null
  );
  const approvedDrafts = (draftsData?.narratives?.[0]?.contentPieces || []) as ContentPiece[];

  // If propNarrativeId changes, update selection
  useEffect(() => {
    if (propNarrativeId && propNarrativeId !== selectedNarrativeId) {
        setSelectedNarrativeId(propNarrativeId);
    }
  }, [propNarrativeId]);
  
  const startOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  // Use user entity counters for quota check
  const currentMonthStartUTC = startOfMonth();
  const needsReset = ((user && 'generationResetDate' in user ? user.generationResetDate : 0) ?? 0) < currentMonthStartUTC;
  const currentUsage = needsReset ? 0 : ((user && 'monthlyGenerations' in user ? user.monthlyGenerations : 0) ?? 0);
  const planLimit = (user && 'planId' in user && (user.planId === 'pro' || user.planId === 'pro_max')) ? 20 : 1;
  const isOverLimit = currentUsage >= planLimit;
  
  // Load params from URL query string OR global store (backward compat)
  const { params: generateParams } = useGenerateStore();

  useEffect(() => {
    // Priority 1: URL params (new route-based flow)
    if (searchParams) {
      const urlMode = searchParams.get("mode");
      const urlFormat = searchParams.get("format");
      const urlNarrativeId = searchParams.get("narrativeId");
      const urlDraftId = searchParams.get("draftId");

      // Read script from sessionStorage (too large for URL)
      const storedScript = typeof window !== 'undefined' ? sessionStorage.getItem('generate-script') : null;

      if (storedScript) {
        setIdea(storedScript);
        // Clear after reading to prevent reuse
        sessionStorage.removeItem('generate-script');
      }

      if (urlMode === "verbatim") {
        setVerbatimMode(true);
      }

      if (urlFormat === "video" || urlFormat === "carousel") {
        setFormat(urlFormat);
      }

      if (urlNarrativeId) {
        setSelectedNarrativeId(urlNarrativeId);
      }

      if (urlDraftId) {
        setSelectedDraftId(urlDraftId);
      }

      return; // Skip store params if URL params found
    }

    // Priority 2: Store params (legacy modal flow - backward compat)
    if (Object.keys(generateParams).length > 0) {
        if (!generateParams.script && !generateParams.planId && !initialPlanId && isModal) {
            useGenerateStore.getState().closeGenerator();
            toast.error("Please select an approved draft to generate content from.");
            return;
        }

        if (generateParams.script) {
            setIdea(generateParams.script);
        }
        if (generateParams.mode === "verbatim") {
            setVerbatimMode(true);
        }
        if (generateParams.format) {
            setFormat(generateParams.format);
        }
        if (generateParams.draftId) {
            setSelectedDraftId(generateParams.draftId);
        }
    } else {
        // Fallback to query params for direct links
        const searchParams = new URLSearchParams(window.location.search);
        const scriptParam = searchParams.get("script");
        const modeParam = searchParams.get("mode");

        if (scriptParam) {
            setIdea(scriptParam);
            if (modeParam === "verbatim") {
                setVerbatimMode(true);
            }
            const typeParam = searchParams.get("type");
            const draftIdParam = searchParams.get("draftId");
            if (typeParam) {
                if (typeParam.toLowerCase().includes("carousel")) {
                  setFormat("carousel");
                } else {
                  setFormat("video");
                }
            }
            if (draftIdParam) {
                setSelectedDraftId(draftIdParam);
            }
            // Clean up URL but preserve tool=generate if needed
            const url = new URL(window.location.href);
            url.searchParams.delete("script");
            url.searchParams.delete("mode");
            url.searchParams.delete("type");
            url.searchParams.delete("draftId");
            // We do NOT delete tool=generate as it might be keeping us open
            
            window.history.replaceState({}, "", url.toString());
            return;
        } else if (isModal && !initialPlanId) {
            // Enforce that modals ONLY open with explicit context.
            // If they try to open an empty modal (e.g. from an old link), close it.
            useGenerateStore.getState().closeGenerator();
            toast.error("Please click 'Create Video' or 'Carousel' on an approved draft to begin.");
        }
    }

    if (!initialPlanId) return;

    const loadPlan = async () => {
      try {
        setIsLoadingPlan(true);
        const response = await fetch(`/api/video-plans/${initialPlanId}`, {
          headers: {
            "Authorization": `Bearer ${refreshToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error("Failed to load plan");
        }

        const { plan: loadedPlan } = await response.json();
        setPlan(loadedPlan);
        setPlanId(initialPlanId);
        
        // Restore settings from the plan
        if (loadedPlan.style || loadedPlan.audience || loadedPlan.goal || loadedPlan.outputFormat) {
          setSettings({
            style: loadedPlan.style || DEFAULT_SETTINGS.style,
            audience: loadedPlan.audience || DEFAULT_SETTINGS.audience,
            goal: loadedPlan.goal || DEFAULT_SETTINGS.goal,
            outputFormat: loadedPlan.outputFormat || DEFAULT_SETTINGS.outputFormat,
          });
        }
        
        // Restore UI state
        if (loadedPlan.type) setFormat(loadedPlan.type);
        if (loadedPlan.voiceId) setSelectedVoiceId(loadedPlan.voiceId);
        if (loadedPlan.visualMode) setVisualMode(loadedPlan.visualMode);
      } catch (err) {
        console.error("Failed to load plan:", err);
        setError("Failed to load the video plan. It may have been deleted or you don't have access.");
        // Redirect to dashboard after delay if error
        setTimeout(() => router.push("/dashboard"), 3000);
      } finally {
        setIsLoadingPlan(false);
      }
    };

    loadPlan();
  }, [initialPlanId, router]);

  // Load persisted settings on mount (only if not loading a plan)
  useEffect(() => {
    if (initialPlanId) return; // Skip if loading a plan
    
    const stored = loadSettingsFromLocalStorage();
    if (stored) {
      setSettings(stored);
      // Align UI toggles with stored output preset
      const preset = OUTPUT_PRESETS.find((p) => p.id === stored.outputFormat);
      if (preset) {
        setFormat(preset.format);
      }
    }
  }, [initialPlanId]);

  // Persist settings whenever they change
  useEffect(() => {
    saveSettingsToLocalStorage(settings);
  }, [settings]);


  const [statusText, setStatusText] = useState("Generating...");

  const handleGenerate = async () => {
    setError(null);
    if (!selectedNarrativeId || selectedNarrativeId === "new") {
      toast.error("Please select a project first.");
      return;
    }
    if (!idea.trim()) {
      setError("Please enter an idea.");
      return;
    }

    if (isOverLimit) {
        setShowLimitModal(true);
        return;
    }

    // Gated Auth: If not logged in, show choice instead of proceeding
    if (!user) {
        setShowAuthChoice(true);
        return;
    }

    setIsGenerating(true);
    setTotalCost(0);


    try {
      let strategyContext: any = undefined;
      const activeNarrative = narratives.find(n => n.id === selectedNarrativeId);

      // 1. Pull Positioning from Narrative
      if (activeNarrative) {
         setStatusText("Loading narrative context...");
         console.log("Using narrative context for positioning...");

         const narrativeProblem = activeNarrative.thePain || "";
         const narrativeSolution = activeNarrative.yourApproach || "";
         const narrativeVoice = activeNarrative.founderVoice || "neutral";

         // TEMPORARY FIX: Skip AI positioning generation (it's timing out and blocking video generation)
         // TODO: Add timeout + graceful fallback later
         console.log("Skipping AI positioning generation (optional enhancement, currently disabled)");
         strategyContext = {
           problem: narrativeProblem,
           solution: narrativeSolution,
           voice: narrativeVoice
           // positioning: undefined - skipped for now
           // pillars: undefined - skipped for now
         };

         /*
         // ORIGINAL CODE (re-enable with timeout later):
         try {
           const positioningResult = await generatePositioningAction({
             audience: settings.audience,
             problem: narrativeProblem,
             solution: narrativeSolution,
             voice: narrativeVoice
           });

           strategyContext = {
             problem: narrativeProblem,
             solution: narrativeSolution,
             voice: narrativeVoice,
             positioning: positioningResult.positioning,
             pillars: positioningResult.pillars
           };
         } catch (posError) {
           console.error("Positioning generation failed, using raw narrative context:", posError);
           strategyContext = {
              problem: narrativeProblem,
              solution: narrativeSolution,
              voice: narrativeVoice
           };
         }
         */
      }

      let generatedPlan: VideoPlan;

      if (verbatimMode) {
        // VERBATIM MODE: Use exact script, AI only generates visuals

        // Optional preprocessing: Clean and format script
        let scriptToUse = idea;
        if (autoCleanScript) {
          setStatusText("Cleaning script format...");
          const preprocessResult = await preprocessVerbatimScript(idea);

          if (preprocessResult.wasModified) {
            console.log("[AutoClean] Script was modified:", preprocessResult.changes);
            scriptToUse = preprocessResult.cleanedScript;

            // Show a toast with what changed
            toast.info(`Auto-formatted script: ${preprocessResult.changes.join(", ")}`);
          } else {
            console.log("[AutoClean] Script already well-formatted");
          }
        }

        setStatusText("Parsing Narrative Intent...");
        console.log("Generating in VERBATIM MODE - preserving exact script");

        const { plan: verbatimPlan, cost: verbatimCost } = await generateVideoPlanWithOptions(
          scriptToUse, // Use cleaned script
          format,
          "30s", // Default duration, auto-determined by scene count
          {
            verbatimMode: true,
            tone: verbatimTone,
            sceneChunkOptions: {
              maxWordsPerScene: 30,
              respectBlankLines: true,
            },
            strategy: strategyContext,
          },
          settings,
          [] // No images support for now
        );
        generatedPlan = verbatimPlan;
        setTotalCost(prev => prev + verbatimCost);

        
      } else {
      // STANDARD MODE: AI rewrites and generates everything
      

      setStatusText("Synthesizing Story Beats...");
        console.log("Refining idea...");
        const { refineIdea } = await import("@/lib/ai/generation");
        const { refinedPrompt, thumbnailPrompt, cost: refineCost } = await refineIdea(idea, format, settings, strategyContext);
        setTotalCost(prev => prev + refineCost);

        
        setStatusText("Assembling Storyboard...");
        
        
        const imagesPayload: any[] = []; // No images support for now

        console.log("Generating plan with refined context...");
        // Updated call signature to support passing visualMode options
        // generateVideoPlanWithOptions(idea, format, duration, options, settings, images)
        const { plan: standardPlan, cost: standardCost } = await generateVideoPlanWithOptions(
            refinedPrompt, 
            format, 
            "30s", // Default duration, auto-determined by scene count
            { visualMode, seamlessMode, strategy: strategyContext }, // Pass visualMode and seamlessMode here!
            settings, 
            imagesPayload
        );
        generatedPlan = standardPlan;
        setTotalCost(prev => prev + standardCost);

      }

      // Persist selected output settings into plan object for display
      generatedPlan.style = settings.style;
      generatedPlan.audience = settings.audience;
      generatedPlan.goal = settings.goal;
      generatedPlan.outputFormat = settings.outputFormat;
      // Ensure visualMode is persisted so generation uses correct strategy (e.g. Giphy vs Gemini)
      generatedPlan.visualMode = visualMode;
      setPlan(generatedPlan);

      // Auto-save as draft
      if (user) {
        try {
          setAutoSaveStatus("saving");
          const newPlanId = id();

          // Get narrative angles for auto-tagging
          const selectedNarrative = narratives.find(n => n.id === selectedNarrativeId);
          const narrativeAngles = selectedNarrative?.angles;

          // Save draft via API route
          const response = await fetch('/api/video-plans/draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshToken}`,
            },
            body: JSON.stringify({
              plan: generatedPlan,
              planId: newPlanId,
              narrativeId: selectedNarrativeId,
              narrativeAngles,
              sourceContentPieceId: selectedDraftId,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to save draft');
          }

          setPlanId(newPlanId);
          setAutoSaveStatus("saved");

          // Update URL without reload
          if (hideHeader) {
              const url = new URL(window.location.href);
              url.searchParams.set("planId", newPlanId);
              window.history.replaceState({}, "", url.toString());
          } else {
              router.push(`/generate/${newPlanId}`, { scroll: false });
          }

          // Hide saved indicator after 3 seconds
          setTimeout(() => setAutoSaveStatus(null), 3000);
        } catch (saveErr) {
          console.error("Failed to auto-save draft:", saveErr);
          // Don't show error to user, they can still use the plan
        }
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error("Generation failed:", err);
      setError(message || "Something went wrong.");
    } finally {
      setIsGenerating(false);
      setStatusText("Generating...");
    }
  };


  const handleCreateVideo = async () => {
    if (!plan || !user) return;

    if (isOverLimit) {
        setShowLimitModal(true);
        return;
    }

    setIsSaving(true);
    try {
      // If we have an existing draft planId, update it. Otherwise create new.
      const finalPlanId = planId || id();
      console.log("Compiling video for user:", user.id, "PlanID:", finalPlanId);

      const planWithVoice = plan.type === 'video'
        ? { ...plan, voiceId: selectedVoiceId, status: 'pending' as const, visualMode }
        : { ...plan, status: 'pending' as const };

      // Get narrative angles for auto-tagging (if not a draft)
      const selectedNarrative = narratives.find(n => n.id === selectedNarrativeId);
      const narrativeAngles = selectedNarrative?.angles;

      // If updating existing draft, update via tx. If new, save via API
      if (planId) {
        // Update existing draft to pending and increment counters
        const txns = [
          tx.videoPlans[planId].update({
            status: 'pending',
            ...(plan.type === 'video' && { voiceId: selectedVoiceId, visualMode }),
          }),
          // Increment counters (drafts don't increment, so do it now)
          tx.$users[user.id].merge({
            lifetimeGenerations: 1,
            monthlyGenerations: 1,
          }),
        ];

        // Type assertion needed because db can be MockDb in E2E tests
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        await (db as DbWithTransact).transact(txns);
      } else {
        // Save new video plan via API
        const response = await fetch('/api/video-plans/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${refreshToken}`,
          },
          body: JSON.stringify({
            plan: planWithVoice,
            planId: finalPlanId,
            narrativeId: selectedNarrativeId,
            narrativeAngles,
            sourceContentPieceId: selectedDraftId,
            voiceId: plan.type === 'video' ? selectedVoiceId : undefined,
            visualMode: plan.type === 'video' ? visualMode : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save video plan');
        }
      }

      fetch("/api/generate-visuals", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${refreshToken}`
        },
        body: JSON.stringify({ planId: finalPlanId })
      }).catch(err => console.error("Initial generation trigger failed:", err));

      router.push(`/success?type=${plan.type}&planId=${finalPlanId}`);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error("Failed to save plan:", err);
      setError(message || "Failed to create project. Please try again.");
      setIsSaving(false);
    }
  };

  const togglePosted = async () => {
    if (!planId || !plan) return;
    const newPostedAt = plan.postedAt ? undefined : Date.now();
    try {
      type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
      await (db as DbWithTransact).transact([
        tx.videoPlans[planId].update({ postedAt: newPostedAt })
      ]);
      setPlan({ ...plan, postedAt: newPostedAt });
    } catch (err) {
      console.error("Failed to toggle posted status:", err);
    }
  };

  const continueAsGuest = async () => {
    setShowAuthChoice(false);
    setIsGenerating(true);
    try {
        await signInAsGuest();
        // Since signInAsGuest is async and updates auth state, 
        // we can try to trigger generation directly if idea exists
        if (idea.trim()) {
            handleGenerate();
        }
    } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error("Guest login failed:", err);
        setError(message || "Guest login failed.");
        setIsGenerating(false);
    }
  };

  return (
    <>
      {/* Generation Loading Dialog */}
      <GenerationDialog isOpen={isGenerating} statusText={statusText} cost={totalCost} />

      
      <div className="w-full max-w-full">
        {isModal && (
            <div className="w-full flex justify-end mb-2 sticky top-0 z-50 pt-2 bg-black">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-white/40 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                </Button>
            </div>
        )}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        {/* LEFT COLUMN: Input & Configuration */}
        <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-4">
          
          {/* Compact Top Header & Project Switcher - Hidden in Layout */}
          {!hideHeader && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 dark:bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Clapperboard className="text-white size-5" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-lg font-black leading-none tracking-tight">Video Compiler</h1>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">AI Generation Engine</p>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-[200px]">
                <Select 
                  value={selectedNarrativeId} 
                  onValueChange={(val) => {
                    if (val === "new") {
                      router.push('/narrative/new');
                    } else {
                      setSelectedNarrativeId(val);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Layout className="size-3.5 text-red-500 shrink-0" />
                      <SelectValue placeholder="Select Project" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1225] border-white/10 text-white">
                    {narratives.map((n) => (
                      <SelectItem key={n.id} value={n.id} className="text-xs">
                        {n.title}
                      </SelectItem>
                    ))}
                    <Separator className="my-1 bg-white/5" />
                    <SelectItem value="new" className="text-xs text-red-500 font-bold">
                      + New Project
                    </SelectItem>
                  </SelectContent>
                </Select>

                {selectedNarrativeId && (
                  <Select 
                    onValueChange={(draftId) => {
                      const draft = approvedDrafts.find(d => d.id === draftId);
                      if (draft) {
                        setIdea(draft.editedBody || draft.body);
                        setVerbatimMode(true);
                        setSelectedDraftId(draft.id);
                        // Auto-detect format from content piece
                        const formatStr = (draft.format as string) || '';
                        // If it's a carousel format (e.g., 'carousel', 'tiktok-carousel') switch generator to carousel
                        if (formatStr.toLowerCase().includes('carousel')) {
                          setFormat('carousel');
                        } else {
                          setFormat('video');
                        }
                        toast.success("Draft loaded into script editor");
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold min-w-[180px]">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Sparkles className="size-3.5 text-blue-500 shrink-0" />
                        <SelectValue placeholder="Approved Drafts" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f1225] border-white/10 text-white max-w-[300px]">
                      {approvedDrafts.length === 0 ? (
                        <div className="p-4 text-center text-[10px] text-white/40 font-bold uppercase tracking-widest">
                          No approved drafts yet
                        </div>
                      ) : (
                        approvedDrafts.map((draft) => (
                          <SelectItem key={draft.id} value={draft.id} className="text-xs">
                            <div className="flex flex-col gap-0.5 w-full pr-2">
                              <span className="font-bold flex items-center justify-between w-full">
                                <span className="truncate">{draft.title || 'Untitled Draft'}</span>
                                {draft.generatedPlans && draft.generatedPlans.length > 0 && (
                                  <span className="text-[10px] text-green-500 font-bold ml-2 flex items-center gap-1 shrink-0 bg-green-500/10 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 className="size-3" /> Used
                                  </span>
                                )}
                              </span>
                              <span className={`text-[10px] truncate italic ${draft.generatedPlans && draft.generatedPlans.length > 0 ? "text-white/20" : "text-white/40"}`}>
                                {draft.body.substring(0, 40)}...
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <Card className="bg-white/80 dark:bg-[#101322]/80 backdrop-blur-xl rounded-[2.5rem] p-6 border-slate-200 dark:border-white/5 shadow-xl transition-all overflow-hidden">
            <CardContent className="p-0 flex flex-col gap-6">
              {/* Script Input Wrapper */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
                    Script & Idea
                  </Label>
                  { idea.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-5 bg-white/5 text-white/40 font-black">
                      {idea.length} / 3000
                    </Badge>
                  )}
                </div>

                {!selectedNarrativeId && (
                  <div className="mb-4 p-4 rounded-2xl bg-red-600/10 border border-red-600/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-3 text-center sm:text-left">
                      <div className="size-8 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                        <Sparkles className="size-4 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs font-black text-white">No Project Selected</p>
                        <p className="text-[10px] text-white/40 font-medium">You need a Brand Narrative to generate content.</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => router.push('/narrative/new')}
                      className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest px-4 h-8 rounded-lg shadow-lg shadow-red-600/20"
                    >
                      Create Narrative
                    </Button>
                  </div>
                )}
                
                <Textarea
                  className="w-full resize-none rounded-2xl border-white/5 bg-white/5 p-5 text-base text-white placeholder:text-white/20 focus-visible:ring-red-600/20 focus-visible:border-red-600 min-h-[180px] leading-relaxed transition-all"
                  placeholder={verbatimMode 
                    ? "Paste your script exactly. Blank lines = scene breaks." 
                    : "Paste your blog post, tweet, or rough idea..."}
                  value={idea}
                  maxLength={3000}
                  onChange={(e) => setIdea(e.target.value)}
                />
              </div>
              


              {/* Verbatim Mode Section - Compact */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <Mic className="size-4 text-red-600" />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold">Use my script verbatim</Label>
                      <span className="text-[10px] text-white/40 hidden sm:inline">(AI generates visuals only)</span>
                    </div>
                  </div>
                  <Switch
                    checked={verbatimMode}
                    onCheckedChange={setVerbatimMode}
                    className="scale-90"
                  />
                </div>

                {/* Auto-Clean Toggle (Only visible when verbatim mode is ON) */}
                {verbatimMode && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <Sparkles className="size-4 text-blue-600" />
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold text-blue-700 dark:text-blue-400">Auto-format script</Label>
                        <span className="text-[10px] text-blue-600/60 dark:text-blue-400/60 hidden sm:inline">(Detects & fixes [Visual:] markers)</span>
                      </div>
                    </div>
                    <Switch
                      checked={autoCleanScript}
                      onCheckedChange={setAutoCleanScript}
                      className="scale-90"
                    />
                  </div>
                )}
              </div>



              {/* Format & Style Selection (Tabs) */}
              <div className="flex flex-col gap-6 pt-4 border-t border-slate-100 dark:border-white/5">
                <Tabs value={format} onValueChange={(v: any) => setFormat(v)} className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest">Format</Label>
                    <TabsList className="bg-slate-100 dark:bg-black/40 p-1 h-9 rounded-xl">
                      <TabsTrigger value="video" className="text-[10px] font-black uppercase px-4 rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white">
                        <Video className="size-3.5 mr-1.5" /> Video
                      </TabsTrigger>
                      <TabsTrigger value="carousel" className="text-[10px] font-black uppercase px-4 rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white">
                        <Layout className="size-3.5 mr-1.5" /> Carousel
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </Tabs>

                {format === "video" && (
                  <Tabs value={visualMode} onValueChange={(v: any) => {
                    if (v === 'broll' && user && ('planId' in user && user.planId !== 'pro_max')) {
                      router.push('/upgrade');
                      return;
                    }
                    setVisualMode(v);
                  }} className="w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Video Style
                        {visualMode === 'broll' && <Sparkles className="size-3 text-purple-400" />}
                      </Label>
                      <TabsList className="bg-white/5 p-1 h-9 rounded-xl overflow-x-auto sm:overflow-visible">
                        <TabsTrigger value="image" className="text-[10px] font-black uppercase px-3 rounded-lg data-[state=active]:bg-red-600">Images</TabsTrigger>
                        <TabsTrigger value="broll" className="text-[10px] font-black uppercase px-3 rounded-lg data-[state=active]:bg-red-600 flex items-center gap-1.5">
                          B-Roll
                          {user && ('planId' in user && user.planId !== 'pro_max') && (
                            <Badge className="h-3.5 px-1 py-0 bg-gradient-to-r from-red-500 to-orange-500 text-[7px] text-white border-none leading-none">PRO</Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="gif_voice" className="text-[10px] font-black uppercase px-3 rounded-lg data-[state=active]:bg-red-600">GIF + Voice</TabsTrigger>
                      </TabsList>
                    </div>
                  </Tabs>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || isAuthLoading}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-[0.98] transition-all"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="size-5 animate-spin" />
                      <div className="flex flex-col items-start leading-none">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Working</span>
                        <span className="text-xs font-black uppercase tracking-widest">{statusText}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                        <Sparkles className="size-5" />
                        <span className="text-sm uppercase tracking-widest">Compile {format === 'video' ? 'Video' : 'Carousel'}</span>
                    </div>
                  )}
                </Button>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center gap-3">
                  <div className="size-6 bg-red-500/10 rounded-full flex items-center justify-center">
                    <Info className="size-3.5 text-red-500" />
                  </div>
                  <p className="text-[11px] font-bold text-red-500">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Output (Plan) */}
        <div className="lg:col-span-12 xl:col-span-5 relative">
          <div className="sticky top-28 flex flex-col gap-6 h-[calc(100vh-140px)]">
          {plan ? (
            <div className="animate-in fade-in slide-in-from-right-8 duration-700 flex flex-col gap-6 h-full overflow-hidden">
              <div className="flex items-center justify-between shrink-0 px-2">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiler Result</span>
                </div>
                <div className="flex items-center gap-3">
                  {autoSaveStatus && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
                      {autoSaveStatus === "saving" ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border border-green-500/30 border-t-green-500" />
                          <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">Saving...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[12px] text-green-500">check_circle</span>
                          <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">Auto-saved</span>
                        </>
                      )}
                    </div>
                  )}
                  {plan && (
                    <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/5 transition-all">
                      <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer" htmlFor="posted-toggle">
                        {plan.postedAt ? "Posted" : "Mark as Posted"}
                      </Label>
                      <Switch 
                        id="posted-toggle"
                        checked={!!plan.postedAt} 
                        onCheckedChange={togglePosted}
                        className="scale-75 data-[state=checked]:bg-green-500"
                      />
                    </div>
                  )}
                  <button 
                      onClick={() => {
                        setPlan(null);
                        setPlanId(null);
                        setAutoSaveStatus(null);
                        router.push("/generate", { scroll: false });
                      }}
                      className="group flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                  >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      Reset 
                  </button>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-[#101322]/80 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)] flex flex-col flex-1 min-h-0 relative">
                <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0 bg-white/40 dark:bg-[#101322]/40 z-10 backdrop-blur-md rounded-t-[2.5rem]">
                    <h3 className="text-xl font-black tracking-tight mb-3 leading-tight">{plan.title}</h3>
                    <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20">{plan.tone}</div>
                        <div className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/5">
                            {plan.scenes.length} {plan.type === 'carousel' ? 'Slides' : 'Scenes'}
                        </div>
                        {plan.type === 'video' && (
                            <div className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/5">
                                ~{plan.estimatedDuration}s
                            </div>
                        )}
                        <div className="px-3 py-1 bg-red-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20">
                            {plan.type === 'carousel' ? 'CAROUSEL' : 'VIDEO'}
                        </div>
                        {plan.postedAt && (
                          <div className="px-3 py-1 bg-green-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20 animate-in zoom-in-95 duration-300">
                            POSTED
                          </div>
                        )}
                    </div>
                </div>

                <div className="overflow-y-auto p-6 space-y-5 flex-1 scrollbar-hide hover:scrollbar-default">
                  {plan.scenes.map((scene, i) => (
                    <div key={i} className="group/scene p-6 bg-slate-50/50 dark:bg-black/20 rounded-3xl border border-slate-100 dark:border-white/5 transition-hover hover:bg-white dark:hover:bg-[#161a2d]">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                           {plan.type === 'carousel' ? 'Slide' : 'Scene'} 0{i + 1}
                        </span>
                        {plan.type === 'video' && <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/5 text-[10px] font-black text-slate-500">{scene.duration}s</span>}
                      </div>
                      
                      <p className="text-base font-bold mb-6 text-slate-800 dark:text-slate-100 leading-relaxed italic">
                        &quot;{scene.voiceover}&quot;
                      </p>

                         <div className="relative group/visual rounded-2xl overflow-hidden bg-white dark:bg-[#0d101b] border border-slate-200 dark:border-white/5">
                          {scene.imageUrl && (
                              <div className={`${plan.type === 'video' ? 'aspect-[9/16]' : 'aspect-video'} w-full relative`}>
                                 <Image width={800} height={450} 
                                     src={scene.imageUrl.startsWith('http') ? scene.imageUrl : getFileUrl(scene.imageUrl)} 
                                     className="w-full h-full object-cover transition-transform duration-700 group-hover/visual:scale-110" 
                                     alt="Scene visual" 
                                 />
                                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60"></div>
                              </div>
                          )}
                         <div className="p-4 bg-white/10 dark:bg-white/5 backdrop-blur-md">
                            <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">brush</span>
                                <p className="text-[11px] text-white/40 font-medium leading-relaxed">
                                    {scene.visualPrompt}
                                </p>
                            </div>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0d101b]/50 backdrop-blur-xl shrink-0 flex flex-col gap-3 rounded-b-[2.5rem] relative z-[30]">
                    {plan.type === 'video' && (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[12px] text-red-500">record_voice_over</span>
                                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Narrator Voice</span>
                                </div>
                            </div>
                            <VoiceSelector selectedVoiceId={selectedVoiceId} onVoiceSelect={setSelectedVoiceId} />
                        </div>
                    )}
                    
                    <button
                        onClick={handleCreateVideo}
                        disabled={isSaving}
                        className="group relative w-full h-11 bg-red-600 hover:scale-[1.02] active:scale-95 text-white font-black rounded-xl shadow-[0_12px_24px_-6px_rgba(220,38,38,0.3)] transition-all disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div className="relative flex items-center justify-center gap-2 bg-red-600 h-full transition-all group-hover:bg-transparent">
                            {isSaving ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-base">{plan.type === 'carousel' ? 'view_carousel' : 'movie_creation'}</span>
                                    <span className="text-[10px] uppercase tracking-widest font-black">
                                       {plan.type === 'carousel' ? 'Finalize & Save Carousel' : 'Finalize & Render Video'}
                                    </span>
                                </>
                            )}
                        </div>
                    </button>
                    
                    <p className="text-[8px] text-center text-slate-500 font-bold uppercase tracking-[0.2em] leading-none">
                        Ready in 1080p Resolution
                    </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden xl:flex flex-col items-center justify-center h-[700px] bg-white/5 border-2 border-dashed border-white/5 rounded-[3rem] p-12 text-center group transition-colors hover:border-red-500/50">
                <div className="h-24 w-24 rounded-[2rem] bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                    <span className="material-symbols-outlined text-5xl text-white/10">auto_stories</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Awaiting Your Spark</h3>
                <p className="text-sm text-slate-500 dark:text-[#929bc9] max-w-[240px] leading-relaxed">
                    Paste your script and hit generate to see your vision structured into a professional storyboard.
                </p>
            </div>
          )}
          </div>
        </div>

        {/* Limit Reached Modal */}
        {showLimitModal && (
            <div 
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={(e) => {
                    if (e.target === e.currentTarget) setShowLimitModal(false);
                }}
            >
                <div className="bg-white dark:bg-[#101322] border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl scale-100 animate-in zoom-in-95 duration-300">
                    <div className="h-20 w-20 bg-gradient-to-br from-red-600 to-orange-500 rounded-3xl mx-auto flex items-center justify-center mb-6 rotate-12 shadow-xl shadow-red-500/20">
                        <span className="material-symbols-outlined text-white text-4xl">lock</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Free Limit Reached</h2>
                    <p className="text-sm text-white/40 mb-8 leading-relaxed">
                        You&apos;ve reached your monthly limit of {planLimit} video. Upgrade to Pro to unlock <span className="text-red-500 font-bold">unlimited creativity</span>.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => router.push('/upgrade')} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 transition-all active:scale-95">Upgrade to Pro</button>
                        <button onClick={() => setShowLimitModal(false)} className="w-full py-4 text-white/40 font-bold hover:text-white transition-colors">Maybe Later</button>
                    </div>
                </div>
            </div>
        )}

        {/* Auth Choice Modal */}
        <AuthChoiceDialog 
            isOpen={showAuthChoice} 
            onClose={() => setShowAuthChoice(false)} 
            onContinueAsGuest={continueAsGuest}
        />
        </div>
      </div>
    </>
  );
}
