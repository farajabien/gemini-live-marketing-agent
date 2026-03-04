"use client";

import { Header } from "@/components/Header";
import { VoiceSelector } from "@/components/VoiceSelector";
import { getFileUrl } from "@/lib/firebase-client";
import { firebaseDb as db } from "@/lib/firebase-client";
import { tx } from "@/lib/firebase-tx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import type { VideoPlan } from "@/lib/types";

interface PlanReviewProps {
  plan: VideoPlan;
  planId: string;
}

/**
 * Simplified view for reviewing a generated plan
 * Shows ONLY the compilation results with sticky voice selector and huge "Finalize & Render Video" CTA
 * No input form, no reset button
 */
export function PlanReviewScreen({ plan, planId }: PlanReviewProps) {
  const router = useRouter();
  const [selectedVoiceId, setSelectedVoiceId] = useState(plan.voiceId || "JBFqnCBsd6RMkjVDRZzb");
  const [isRendering, setIsRendering] = useState(false);

  const handleFinalize = async () => {
    if (!plan.scenes || plan.scenes.length === 0) {
      toast.error("No scenes to render");
      return;
    }

    setIsRendering(true);
    toast.loading("Preparing video render...");

    try {
      router.push(`/success?planId=${planId}&type=${plan.type || 'video'}`);
      toast.dismiss();
      toast.success("Redirecting to render page!");
    } catch (error) {
      console.error("Failed to finalize:", error);
      toast.dismiss();
      toast.error("Failed to start rendering");
      setIsRendering(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0d]">
      <Header />
      
      {/* Scrollable Content Area with bottom padding for sticky bar */}
      <div className="max-w-4xl mx-auto px-6 py-12 pb-72">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Compiler Result
            </span>
          </div>
        </div>

        {/* Plan Title */}
        <h1 className="text-4xl font-black mb-4 text-slate-900 dark:text-white">
          {plan.title}
        </h1>

        {/* Badges */}
        <div className="flex gap-3 mb-12 flex-wrap">
          <span className="px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-wider">
            {plan.tone || "Neutral"}
          </span>
          <span className="px-4 py-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider">
            {plan.scenes?.length || 0} Scenes
          </span>
          <span className="px-4 py-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider">
            ~{(plan as any).duration || "30"}s
          </span>
          <span className="px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-wider">
            {plan.type === "carousel" ? "Carousel" : "Video"}
          </span>
        </div>

        {/* Scene List */}
        <div className="space-y-8">
          {plan.scenes?.map((scene, i) => (
            <div 
              key={i}
              className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d101b] transition-all hover:border-blue-500/30"
            >
              {/* Scene Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Scene {String(i + 1).padStart(2, '0')}
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold">
                  {scene.duration}s
                </span>
              </div>

              {/* Voiceover Text */}
              <p className="text-base font-bold mb-6 text-slate-800 dark:text-slate-100 leading-relaxed italic">
                &quot;{scene.voiceover}&quot;
              </p>

              {/* Visual Preview */}
              <div className="relative group/visual rounded-2xl overflow-hidden bg-white dark:bg-[#0d101b] border border-slate-200 dark:border-white/5">
                {scene.imageUrl && (
                  <div className="aspect-video w-full relative">
                    <Image 
                      width={800} 
                      height={450} 
                      src={scene.imageUrl.startsWith('http') ? scene.imageUrl : getFileUrl(scene.imageUrl)} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover/visual:scale-110" 
                      alt="Scene visual" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60"></div>
                  </div>
                )}
                
                {/* Visual Prompt */}
                <div className="p-4 bg-white/10 dark:bg-white/5 backdrop-blur-md">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-sm mt-0.5">brush</span>
                    <p className="text-[11px] text-slate-500 dark:text-[#929bc9] font-medium leading-relaxed">
                      {scene.visualPrompt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STICKY BOTTOM BAR - Voice Selector & CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0a0a0d]/95 border-t border-slate-200 dark:border-white/10 backdrop-blur-xl z-50 shadow-2xl">
        <div className="max-w-4xl mx-auto px-6 py-5">
          {/* Voice Selector */}
          <div className="mb-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">
              <span className="material-symbols-outlined text-sm align-middle mr-2">record_voice_over</span>
              Narrator Voice
            </label>
            <VoiceSelector
              selectedVoiceId={selectedVoiceId}
              onVoiceSelect={(voiceId) => {
                // Update plan voice in DB
                (db as any).transact([tx.videoPlans[planId].update({ voiceId })]);
                setSelectedVoiceId(voiceId);
                toast.success("Voice updated!");
              }}
            />
          </div>

          {/* HUGE CTA Button */}
          <button
            onClick={handleFinalize}
            disabled={isRendering || !plan.scenes || plan.scenes.length === 0}
            className="group relative w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-800 text-white font-black text-lg uppercase tracking-wider shadow-2xl hover:shadow-3xl transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            
            {/* Button Content */}
            <div className="relative flex items-center justify-center gap-3">
              <span className="material-symbols-outlined text-2xl">
                {isRendering ? "hourglass_empty" : "play_circle"}
              </span>
              {isRendering ? "Rendering..." : "Finalize & Render Video"}
            </div>
          </button>

          {/* Helper Text */}
          <p className="text-center text-[10px] text-slate-500 dark:text-slate-400 mt-3 font-bold uppercase tracking-wider">
            Ready in 1080p Resolution
          </p>
        </div>
      </div>
    </div>
  );
}
