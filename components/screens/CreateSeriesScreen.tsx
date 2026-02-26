"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/Header";
import { AuthChoiceDialog } from "@/components/AuthChoiceDialog";
import Link from "next/link";

export function CreateSeriesScreen() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, refreshToken } = useAuth();
  const [megaPrompt, setMegaPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  const handleCreateSeries = async () => {
    if (!user || !refreshToken) {
      setIsAuthDialogOpen(true);
      return;
    }

    if (megaPrompt.length < 100) {
      setError("Please provide more details (minimum 100 characters)");
      return;
    }

    setIsCreating(true);
    setError(null);
    setProgressMessage(null);

    try {
      const response = await fetch("/api/series/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${refreshToken}`
        },
        body: JSON.stringify({ megaPrompt }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to create series");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === "progress") {
              setProgressMessage(data.message);
            } else if (data.type === "success") {
              const { seriesId } = data.data;
              router.push(`/series/${seriesId}`);
              return;
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          }
        }
      }

    } catch (err: any) {
      console.error("Series creation failed:", err);
      setError(err.message || "Something went wrong");
      setIsCreating(false);
    }
  };

  const examplePrompts = [
    {
      title: "Alien Discovers Earth",
      prompt: "Create a 3-episode series about an alien discovering Earth for the first time.\\n\\nEpisode 1: The alien spots Earth from space and decides to visit\\nEpisode 2: Landing on Earth and exploring the first city\\nEpisode 3: Making first contact with humans\\n\\nStyle: Flat 2D illustration, colorful, educational\\nTone: Curious and friendly\\nDuration: ~60 seconds per episode"
    },
    {
      title: "Building in Public",
      prompt: "Create a 5-episode series documenting a founder's journey building a SaaS product.\\n\\nEpisode 1: The problem and initial idea\\nEpisode 2: First prototype and user feedback\\nEpisode 3: Pivoting based on insights\\nEpisode 4: First paying customers\\nEpisode 5: Scaling to 100 users\\n\\nStyle: Motion graphics, founder POV\\nTone: Authentic and motivational"
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#f6f6f8] dark:bg-[#080911] font-sans text-slate-900 dark:text-white flex flex-col">
      <Header />
      
      <AuthChoiceDialog 
        isOpen={isAuthDialogOpen} 
        onClose={() => setIsAuthDialogOpen(false)} 
        onContinueAsGuest={() => setIsAuthDialogOpen(false)}
      />

      <div className="flex-1 flex items-center justify-center p-6 mt-20">
        <div className="max-w-3xl w-full">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm font-bold flex items-center gap-1 mb-8">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to Creation Hub
            </Link>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Create Your Series
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Describe your series idea. AI will generate scripts for all episodes.
            </p>
          </div>

          {/* Mega-Prompt Input */}
          <div className="bg-white dark:bg-[#101322] rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-white/10 mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                Series Mega-Prompt
              </label>
              <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-black text-slate-500">
                {megaPrompt.length} / 5000 CHARS
              </div>
            </div>

            <textarea
              className="w-full resize-none rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#0d101b] p-6 text-base text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 min-h-[300px] leading-relaxed transition-all shadow-inner font-mono"
              placeholder="Example:\\n\\nCreate a 3-episode series about...\\n\\nEpisode 1: [First episode description]\\nEpisode 2: [Second episode]\\nEpisode 3: [Third episode]\\n\\nStyle: [Visual style]\\nTone: [Narrative tone]\\nDuration: [Target length]"
              value={megaPrompt}
              maxLength={5000}
              onChange={(e) => setMegaPrompt(e.target.value)}
            />


            {error && !isCreating && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{error}</p>
              </div>
            )}

            {isCreating && progressMessage && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">{progressMessage}</p>
                </div>
              </div>
            )}


            <button
              onClick={handleCreateSeries}
              disabled={isCreating || megaPrompt.length < 100}
              className="mt-6 w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isCreating ? (
                <>
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Series...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">auto_awesome</span>
                  Create Series
                </>
              )}
            </button>
          </div>

          {/* Example Prompts */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Example Prompts
            </h3>
            <div className="grid gap-4">
              {examplePrompts.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setMegaPrompt(example.prompt)}
                  className="text-left p-6 bg-white dark:bg-[#101322] rounded-2xl border border-slate-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500/50 transition-all group"
                >
                  <h4 className="font-black text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {example.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 font-mono">
                    {example.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
