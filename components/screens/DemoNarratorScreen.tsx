"use client";

import { useState, useEffect } from "react";
import { AuthChoiceDialog } from "@/components/AuthChoiceDialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import Link from "next/link";
import { GeminiVoiceName } from "@/lib/ai/gemini-tts";

interface Segment {
  id: number;
  startSec: number;
  endSec: number;
  onScreen: string;
  roughCaption: string;
}

const VOICES: GeminiVoiceName[] = [
  "Kore", "Zephyr", "Puck", "Charon", "Fenrir", "Leda", "Orus", "Aoede"
];

const LOADING_MESSAGES = [
  "Sorting the CV laundry...",
  "Running the first wash cycle...",
  "Applying digital starch...",
  "Refining the truth skeleton...",
  "Polishing the audio fibers...",
  "Assembling the submission-ready package...",
  "Almost clean. Final rinse in progress..."
];

export function DemoNarratorScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const [productDocs, setProductDocs] = useState("");
  const [segments, setSegments] = useState<Segment[]>([
    { id: 1, startSec: 0, endSec: 5, onScreen: "Initial view", roughCaption: "Introducing our great product." }
  ]);
  const [voice, setVoice] = useState<GeminiVoiceName>("Kore");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);

  // Loading message rotation
  useEffect(() => {
    if (isGenerating) {
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[i]);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const addSegment = () => {
    const lastSeg = segments[segments.length - 1];
    setSegments([
      ...segments,
      {
        id: lastSeg ? lastSeg.id + 1 : 1,
        startSec: lastSeg ? lastSeg.endSec : 0,
        endSec: lastSeg ? lastSeg.endSec + 5 : 5,
        onScreen: "",
        roughCaption: ""
      }
    ]);
  };

  const removeSegment = (id: number) => {
    if (segments.length === 1) return;
    setSegments(segments.filter(s => s.id !== id));
  };

  const updateSegment = (id: number, field: keyof Segment, value: any) => {
    setSegments(segments.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleGenerate = async () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }

    if (!productDocs.trim()) {
      toast.error("Please provide product documentation.");
      return;
    }

    const hasEmptyFields = segments.some(s => !s.onScreen.trim() || !s.roughCaption.trim());
    if (hasEmptyFields) {
      toast.error("Please fill in all segment descriptions and captions.");
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch("/api/demo-narrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments,
          productDocs,
          voiceName: voice
        })
      });

      if (!res.ok) {
        throw new Error("Generation failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "demo-narrator-output.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Demo narration bundle downloaded!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate narration.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-[#f6f6f8] dark:bg-[#080911] font-sans text-slate-900 dark:text-white flex flex-col">
      
      <AuthChoiceDialog 
        isOpen={isAuthDialogOpen} 
        onClose={() => setIsAuthDialogOpen(false)} 
        onContinueAsGuest={() => setIsAuthDialogOpen(false)}
      />

      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] -right-[10%] w-[30%] h-[30%] bg-purple-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-8 relative z-10">
        
        <div className="mb-8">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm font-bold flex items-center gap-1 mb-4">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to Dashboard
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-white mb-2">
                Demo <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-500">Narrator</span>
                </h1>
                <p className="text-slate-500 dark:text-[#929bc9] text-lg font-medium max-w-2xl">
                Turn your screen recording into a professional demo with AI voiceover.
                </p>
              </div>
              <div className="flex items-center gap-4 bg-white/50 dark:bg-white/5 p-2 rounded-2xl border border-slate-200 dark:border-white/10">
                <label className="text-xs font-black uppercase text-slate-400 px-2">Voice</label>
                <select 
                  value={voice}
                  onChange={(e) => setVoice(e.target.value as any)}
                  className="bg-transparent text-sm font-bold focus:outline-none"
                >
                  {VOICES.map(v => <option key={v} value={v} className="dark:bg-[#101322]">{v}</option>)}
                </select>
              </div>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
            {/* PRODUCT DOCS SECTION */}
            <div className="bg-white/80 dark:bg-[#101322]/80 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-slate-200 dark:border-white/5 shadow-xl">
                <label className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 block">
                    Product Context / Documentation
                </label>
                <textarea
                    className="w-full resize-none rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0d101b] p-6 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 min-h-[150px] transition-all leading-relaxed"
                    placeholder="Paste your product README, PRD, or elevator pitch here. The AI uses this to refine your rough captions into a polished script."
                    value={productDocs}
                    onChange={(e) => setProductDocs(e.target.value)}
                />
            </div>

            {/* SEGMENTS SECTION */}
            <div className="bg-white/80 dark:bg-[#101322]/80 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-slate-200 dark:border-white/5 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <label className="text-sm font-black text-slate-400 uppercase tracking-widest">
                        Video Segments & Captions
                    </label>
                    <button 
                      onClick={addSegment}
                      className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline"
                    >
                      <span className="material-symbols-outlined text-sm">add_circle</span>
                      Add Segment
                    </button>
                </div>

                <div className="space-y-4">
                  {segments.map((s, idx) => (
                    <div key={s.id} className="grid grid-cols-1 md:grid-cols-[100px_100px_1fr_1fr_40px] gap-4 items-start p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Start (s)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={s.startSec}
                          onChange={(e) => updateSegment(s.id, "startSec", parseFloat(e.target.value))}
                          className="bg-white dark:bg-[#0d101b] border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">End (s)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={s.endSec}
                          onChange={(e) => updateSegment(s.id, "endSec", parseFloat(e.target.value))}
                          className="bg-white dark:bg-[#0d101b] border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">On Screen Action</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Uploading CV"
                          value={s.onScreen}
                          onChange={(e) => updateSegment(s.id, "onScreen", e.target.value)}
                          className="bg-white dark:bg-[#0d101b] border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Rough Caption</label>
                        <textarea 
                          placeholder="e.g. Now I upload my CV to the laundry."
                          value={s.roughCaption}
                          onChange={(e) => updateSegment(s.id, "roughCaption", e.target.value)}
                          className="bg-white dark:bg-[#0d101b] border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[38px] resize-none"
                        />
                      </div>
                      <button 
                        onClick={() => removeSegment(s.id)}
                        disabled={segments.length === 1}
                        className="mt-5 text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-10 flex flex-col items-center">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !productDocs.trim()}
                        className="w-full max-w-md h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
                    >
                        {isGenerating ? (
                            <>
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                <span>{loadingMsg}</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">mic</span>
                                <span>Generate Voiceover Package</span>
                            </>
                        )}
                    </button>
                    <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
                      Pro Feature • ZIP contains WAV, SRT, and JSON
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
